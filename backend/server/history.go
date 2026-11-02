package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const historyEndpoint = "https://api.zhihu.com/unify-consumption/read_history"

type HistoryItem struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"`
	Title   string `json:"title"`
	Excerpt string `json:"excerpt"`
	Author  string `json:"author"`
	Time    string `json:"time"`
	URL     string `json:"url"`
}

type HistoryPage struct {
	Items      []HistoryItem `json:"items"`
	NextCursor string        `json:"nextCursor,omitempty"`
	HasMore    bool          `json:"hasMore"`
}

func historyHandler(client *http.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		cookie := requestZhihuCookie(r)
		if cookie == "" || rawCookieValue(cookie, "d_c0") == "" {
			apiError(w, newAPIStatusError(http.StatusUnauthorized, "查看浏览历史需要包含 d_c0 的完整知乎 Cookie"))
			return
		}
		page, err := getHistory(r.Context(), client, cookie, r.URL.Query().Get("cursor"))
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	}
}

func validHistoryCursor(cursor string) bool {
	return validZhihuCursor(cursor, "api.zhihu.com", "/unify-consumption/read_history")
}

func getHistory(ctx context.Context, client *http.Client, cookie, cursor string) (HistoryPage, error) {
	endpoint := historyEndpoint + "?offset=0&limit=20"
	if cursor != "" {
		if !validHistoryCursor(cursor) {
			return HistoryPage{}, newAPIStatusError(http.StatusBadRequest, "无效的浏览历史分页地址")
		}
		endpoint = cursor
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return HistoryPage{}, err
	}
	applyZhihuWebHeaders(req, cookie, "https://www.zhihu.com/")
	resp, err := doZhihuRequest(client, req)
	if err != nil {
		return HistoryPage{}, fmt.Errorf("知乎浏览历史请求失败，请稍后重试")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return HistoryPage{}, fmt.Errorf("知乎浏览历史接口返回 HTTP %d，请检查 Cookie 或稍后重试", resp.StatusCode)
	}
	var env struct {
		Data []struct {
			Data struct {
				Header struct {
					Title string `json:"title"`
				} `json:"header"`
				Content struct {
					Author  string `json:"authorName"`
					Summary string `json:"summary"`
				} `json:"content"`
				Action struct {
					URL string `json:"url"`
				} `json:"action"`
				Extra struct {
					ID       json.RawMessage `json:"contentToken"`
					Kind     string          `json:"contentType"`
					ReadTime int64           `json:"readTime"`
				} `json:"extra"`
			} `json:"data"`
		} `json:"data"`
		Paging struct {
			Next  string `json:"next"`
			IsEnd bool   `json:"is_end"`
		} `json:"paging"`
	}
	body, err := readUpstreamBody(resp.Body)
	if err != nil {
		return HistoryPage{}, err
	}
	if err = json.Unmarshal(body, &env); err != nil || env.Data == nil {
		return HistoryPage{}, fmt.Errorf("无法解析知乎浏览历史，请稍后重试")
	}
	page := HistoryPage{Items: []HistoryItem{}}
	for _, entry := range env.Data {
		d := entry.Data
		kind, id, link := historyContent(d.Extra.Kind, rawID(d.Extra.ID), d.Action.URL)
		if d.Header.Title == "" || id == "" || link == "" {
			continue
		}
		readTime := d.Extra.ReadTime
		if readTime > 1e12 {
			readTime /= 1000
		}
		page.Items = append(page.Items, HistoryItem{ID: id, Kind: kind, Title: plainText(d.Header.Title), Excerpt: plainText(d.Content.Summary), Author: d.Content.Author, Time: formatUnix(readTime), URL: link})
	}
	if !env.Paging.IsEnd && env.Paging.Next != "" && env.Paging.Next != endpoint {
		if !validHistoryCursor(env.Paging.Next) {
			return HistoryPage{}, fmt.Errorf("知乎返回了无效的浏览历史分页地址")
		}
		page.NextCursor, page.HasMore = env.Paging.Next, true
	}
	return page, nil
}

func historyContent(kind, id, action string) (string, string, string) {
	u, err := url.Parse(action)
	safe := err == nil && u.Scheme == "https" && (u.Host == "zhihu.com" || strings.HasSuffix(u.Host, ".zhihu.com")) && u.User == nil
	if (!validID(id) || kind == "") && err == nil && (safe || u.Scheme == "zhihu") {
		parts := strings.Split(u.Host+u.Path, "/")
		for i := 0; i+1 < len(parts); i++ {
			if !validID(parts[i+1]) {
				continue
			}
			switch parts[i] {
			case "answer", "answers", "question", "questions", "p", "article", "articles", "pin", "pins":
				kind, id = strings.TrimSuffix(parts[i], "s"), parts[i+1]
				if kind == "p" {
					kind = "article"
				}
			}
		}
	}
	if validID(id) {
		switch kind {
		case "answer":
			return kind, id, "https://www.zhihu.com/answer/" + id
		case "question":
			return kind, id, "https://www.zhihu.com/question/" + id
		case "article":
			return kind, id, "https://zhuanlan.zhihu.com/p/" + id
		case "pin":
			return kind, id, "https://www.zhihu.com/pin/" + id
		}
	}
	if safe {
		return kind, action, action
	}
	return "", "", ""
}
