package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// Cookie/Web APIs and Open Platform APIs share transport rules, not credentials.
// Redirects must never replay an authenticated request at another endpoint.
func doZhihuRequest(client *http.Client, req *http.Request) (*http.Response, error) {
	upstream := *client
	upstream.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return upstream.Do(req)
}

func applyZhihuWebHeaders(req *http.Request, cookie, referer string, body ...string) {
	req.Header.Set("Cookie", cookie)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Referer", referer)
	req.Header.Set("x-requested-with", "fetch")
	if dc0 := rawCookieValue(cookie, "d_c0"); dc0 != "" {
		req.Header.Set("x-zse-93", zhihuZse93)
		req.Header.Set("x-zse-96", zhihuSignature(req.URL.RequestURI(), dc0, body...))
	}
}

func validZhihuCursor(cursor, host, path string) bool {
	u, err := url.Parse(cursor)
	return err == nil && u.Scheme == "https" && u.Host == host && u.Path == path && u.User == nil && u.Fragment == ""
}

func readUpstreamBody(body io.Reader) ([]byte, error) {
	const limit = 8 << 20
	b, err := io.ReadAll(io.LimitReader(body, limit+1))
	if err != nil {
		return nil, fmt.Errorf("读取知乎响应失败")
	}
	if len(b) > limit {
		return nil, fmt.Errorf("知乎响应超过大小限制")
	}
	return b, nil
}

type zhihuContentError struct {
	status int
	code   int
	body   string
}

func (e *zhihuContentError) Error() string {
	if e.status == http.StatusForbidden && e.code == 10003 {
		return "知乎暂不支持当前方式读取此内容，请查看知乎原页"
	}
	return fmt.Sprintf("知乎内容接口返回 HTTP %d：%s", e.status, e.body)
}

func zhihuWebGet(ctx context.Context, client *http.Client, cookie, referer, endpoint string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	applyZhihuWebHeaders(req, cookie, referer)
	resp, err := doZhihuRequest(client, req)
	if err != nil {
		return nil, fmt.Errorf("知乎内容请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, err := readUpstreamBody(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var envelope struct {
			Error struct {
				Code int `json:"code"`
			} `json:"error"`
		}
		_ = json.Unmarshal(b, &envelope)
		return nil, &zhihuContentError{status: resp.StatusCode, code: envelope.Error.Code, body: "上游请求未成功"}
	}
	return b, nil
}
