package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

func readReportHandler(client *http.Client) http.HandlerFunc {
	return readingWriteHandler(client, reportReading)
}

func readingWriteHandler(client *http.Client, write func(context.Context, *http.Client, string, string, string) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		cookie := requestZhihuCookie(r)
		if cookie == "" || rawCookieValue(cookie, "d_c0") == "" {
			apiError(w, newAPIStatusError(http.StatusUnauthorized, "阅读状态同步需要包含 d_c0 的完整知乎 Cookie"))
			return
		}
		kind, id := r.URL.Query().Get("type"), r.URL.Query().Get("id")
		if (kind != "answer" && kind != "article") || !validID(id) || len(id) > 32 {
			apiError(w, newAPIStatusError(http.StatusBadRequest, "阅读状态同步只支持有效的回答或文章 ID"))
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		if err := write(ctx, client, cookie, kind, id); err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

// Preserve d_c0's quotes: they are part of the web client's signature input.
func rawCookieValue(cookie, name string) string {
	for _, part := range strings.Split(cookie, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if ok && key == name {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func reportReading(ctx context.Context, client *http.Client, cookie, kind, id string) error {
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	items, err := json.Marshal([][]string{{kind, id, "read"}})
	if err != nil {
		return err
	}
	if err = form.WriteField("items", string(items)); err != nil {
		return err
	}
	if err = form.Close(); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://www.zhihu.com/lastread/touch", &body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", form.FormDataContentType())
	return sendReadingWrite(client, req, cookie, kind, id, "阅读状态同步", true)
}

func addHistory(ctx context.Context, client *http.Client, cookie, kind, id string) error {
	payload, err := json.Marshal(struct {
		ContentToken string `json:"content_token"`
		ContentType  string `json:"content_type"`
	}{id, kind})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://www.zhihu.com/api/v4/read_history/add", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	return sendReadingWrite(client, req, cookie, kind, id, "浏览历史保存", false, string(payload))
}

func sendReadingWrite(client *http.Client, req *http.Request, cookie, kind, id, label string, requireSuccess bool, body ...string) error {
	req.Header.Set("Origin", "https://www.zhihu.com")
	referer := "https://www.zhihu.com/answer/" + id
	if kind == "article" {
		referer = "https://zhuanlan.zhihu.com/p/" + id
	}
	applyZhihuWebHeaders(req, cookie, referer, body...)
	if xsrf := strings.Trim(rawCookieValue(cookie, "_xsrf"), "\""); xsrf != "" {
		req.Header.Set("x-xsrftoken", xsrf)
	}
	resp, err := doZhihuRequest(client, req)
	if err != nil {
		return fmt.Errorf("知乎%s请求失败", label)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("知乎%s失败（HTTP %d），请检查 Cookie 或稍后重试", label, resp.StatusCode)
	}
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, (64<<10)+1))
	if err != nil || len(responseBody) > 64<<10 {
		return fmt.Errorf("无法读取知乎%s响应", label)
	}
	responseBody = bytes.TrimSpace(responseBody)
	// History writes return HTTP 200 with JSON null in live responses. Treat
	// null like an empty acknowledgement, rather than requiring an object.
	// Keep the explicit confirmation required by lastread/touch separate.
	if !requireSuccess && (len(responseBody) == 0 || bytes.Equal(responseBody, []byte("null"))) {
		return nil
	}
	var result *struct {
		Success *bool           `json:"success"`
		Error   json.RawMessage `json:"error"`
		Code    *int            `json:"code"`
	}
	if err = json.Unmarshal(responseBody, &result); err != nil || result == nil {
		return fmt.Errorf("无法解析知乎%s响应", label)
	}
	if (result.Success != nil && !*result.Success) ||
		(len(result.Error) > 0 && string(result.Error) != "null" && string(result.Error) != "false") ||
		(result.Code != nil && *result.Code != 0 && *result.Code != http.StatusOK) {
		return fmt.Errorf("知乎%s未成功，请检查 Cookie 或稍后重试", label)
	}
	if requireSuccess && result.Success == nil {
		return fmt.Errorf("知乎未确认%s成功", label)
	}
	return nil
}
