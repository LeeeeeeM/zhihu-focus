package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var errZhihuCookieUnauthorized = errors.New("知乎 Cookie 无效或已过期")

func searchZhihuFallback(ctx context.Context, client *http.Client, secret, q string, cookieError error) (SearchPage, error) {
	if secret == "" {
		if cookieError != nil {
			return SearchPage{}, newAPIStatusError(http.StatusUnauthorized, "个人 Cookie 无效或已过期，且未配置 ZHIHU_ACCESS_SECRET 兜底")
		}
		return SearchPage{}, newAPIStatusError(http.StatusUnauthorized, "请在搜索设置中填写个人 Cookie，或配置 ZHIHU_ACCESS_SECRET 作为兜底")
	}
	items, err := searchZhihuOpenAPI(ctx, client, secret, q)
	if err != nil {
		return SearchPage{}, err
	}
	return SearchPage{Items: items, Source: "access_secret", UsedFallback: true}, nil
}

func isZhihuCookieAuthFailure(code json.RawMessage, message string, apiError json.RawMessage) bool {
	detail := strings.ToLower(message + " " + string(code) + " " + string(apiError))
	for _, marker := range []string{"unauthorized", "unauthenticated", "not logged in", "not login", "login required", "please log in", "logged out", "login expired", "token expired", "cookie expired", "invalid cookie", "cookie invalid", "cookie无效", "cookie失效", "cookie已过期", "未登录", "请先登录", "请登录", "登录已过期", "登录失效", "重新登录", "未登陆", "请先登陆", "重新登陆", "凭证失效", "凭证无效"} {
		if strings.Contains(detail, marker) {
			return true
		}
	}
	return false
}

func searchZhihuPage(ctx context.Context, client *http.Client, cookie, q, cursor string) (SearchPage, error) {
	basePath := "/search_v3"
	u := "https://api.zhihu.com" + basePath + "?" + url.Values{
		"t":          {"general"},
		"q":          {q},
		"correction": {"1"},
		"offset":     {"0"},
		"limit":      {"20"},
	}.Encode()
	if cursor != "" {
		resolved, err := checkedZhihuCursor(cursor, "api.zhihu.com", basePath, "知乎返回了无效的搜索分页地址")
		parsed, parseErr := url.Parse(resolved)
		if err != nil || parseErr != nil || parsed.Query().Get("q") != q {
			return SearchPage{}, newAPIStatusError(http.StatusBadRequest, "知乎返回了无效的搜索分页地址")
		}
		u = resolved
	}
	referer := "https://www.zhihu.com/search?type=content&q=" + url.QueryEscape(q)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return SearchPage{}, err
	}
	applyZhihuWebHeaders(req, cookie, referer)
	resp, err := doZhihuRequest(client, req)
	if err != nil {
		return SearchPage{}, fmt.Errorf("知乎搜索请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, err := readUpstreamBody(resp.Body)
	if err != nil {
		return SearchPage{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if resp.StatusCode == http.StatusUnauthorized || (resp.StatusCode == http.StatusForbidden && isZhihuCookieAuthFailure(nil, "", json.RawMessage(b))) {
			return SearchPage{}, errZhihuCookieUnauthorized
		}
		return SearchPage{}, fmt.Errorf("知乎搜索接口返回 HTTP %d", resp.StatusCode)
	}
	var env struct {
		Code    json.RawMessage `json:"code"`
		Message string          `json:"message"`
		Error   json.RawMessage `json:"error"`
		Data    []struct {
			Object struct {
				ID           json.RawMessage `json:"id"`
				Type         string          `json:"type"`
				Title        string          `json:"title"`
				URL          string          `json:"url"`
				Excerpt      string          `json:"excerpt"`
				Content      string          `json:"content"`
				VoteUpCount  int             `json:"voteup_count"`
				CommentCount int             `json:"comment_count"`
				Question     struct {
					Title string `json:"title"`
				} `json:"question"`
				Author struct {
					Name   string `json:"name"`
					Avatar string `json:"avatar_url"`
				} `json:"author"`
			} `json:"object"`
		} `json:"data"`
		Paging struct {
			Next  string `json:"next"`
			IsEnd bool   `json:"is_end"`
		} `json:"paging"`
	}
	if err = json.Unmarshal(b, &env); err != nil {
		return SearchPage{}, fmt.Errorf("无法解析知乎搜索响应：%w", err)
	}
	if len(env.Error) > 0 && string(env.Error) != "null" {
		if isZhihuCookieAuthFailure(env.Code, env.Message, env.Error) {
			return SearchPage{}, errZhihuCookieUnauthorized
		}
		return SearchPage{}, fmt.Errorf("知乎搜索接口返回业务错误，请稍后重试")
	}
	if env.Message != "" && isZhihuCookieAuthFailure(env.Code, env.Message, env.Error) {
		return SearchPage{}, errZhihuCookieUnauthorized
	}
	if env.Data == nil {
		return SearchPage{}, fmt.Errorf("知乎列表响应缺少 data 字段")
	}
	items := make([]SearchResult, 0, len(env.Data))
	for _, result := range env.Data {
		x := result.Object
		if x.Type != "answer" && x.Type != "article" && x.Type != "question" {
			continue
		}
		id := rawID(x.ID)
		if !validID(id) {
			continue
		}
		title := x.Title
		link := zhihuContentURL(x.Type, id)
		if x.Type == "answer" && title == "" {
			title = x.Question.Title
		}
		excerpt := x.Excerpt
		if excerpt == "" {
			excerpt = x.Content
		}
		stats := fmt.Sprintf("%d 赞同 · %d 评论", x.VoteUpCount, x.CommentCount)
		items = append(items, SearchResult{ID: id, Title: plainText(title), Excerpt: plainText(excerpt), Author: x.Author.Name, Avatar: x.Author.Avatar, Kind: x.Type, Stats: stats, URL: link})
	}
	return SearchPage{Items: items, NextCursor: env.Paging.Next, HasMore: !env.Paging.IsEnd && env.Paging.Next != ""}, nil
}

func searchZhihuOpenAPI(ctx context.Context, client *http.Client, secret, q string) ([]SearchResult, error) {
	u, _ := url.Parse("https://developer.zhihu.com/api/v1/content/zhihu_search")
	v := u.Query()
	v.Set("Query", q)
	v.Set("Count", "10")
	u.RawQuery = v.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+secret)
	req.Header.Set("X-Request-Timestamp", fmt.Sprint(time.Now().Unix()))
	req.Header.Set("Content-Type", "application/json")
	resp, err := doZhihuRequest(client, req)
	if err != nil {
		return nil, fmt.Errorf("知乎搜索请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, err := readUpstreamBody(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("知乎搜索接口返回 HTTP %d", resp.StatusCode)
	}
	var env APIEnvelope
	if err = json.Unmarshal(b, &env); err != nil {
		return nil, fmt.Errorf("无法解析知乎搜索响应：%w", err)
	}
	if env.Code != 0 {
		return nil, fmt.Errorf("知乎搜索错误 %d：%s", env.Code, env.Message)
	}
	if env.Data.Items == nil {
		return nil, fmt.Errorf("知乎开放平台搜索响应缺少 Items 字段")
	}
	out := make([]SearchResult, 0, len(env.Data.Items))
	for _, x := range env.Data.Items {
		stats := fmt.Sprintf("%d 赞同 · %d 评论", x.VoteUpCount, x.CommentCount)
		kind := strings.ToLower(x.ContentType)
		if kind != "answer" && kind != "article" && kind != "question" && kind != "pin" {
			continue
		}
		id := x.ContentID
		if strings.EqualFold(x.ContentType, "article") {
			if parsed, parseErr := url.Parse(x.URL); parseErr == nil {
				segments := strings.Split(strings.Trim(parsed.Path, "/"), "/")
				if len(segments) == 2 && segments[0] == "p" && validID(segments[1]) {
					id = segments[1]
				}
			}
		}
		if !validID(id) {
			continue
		}
		_, _, canonical := historyContent(kind, id, "")
		link := canonical
		if u, err := url.Parse(x.URL); err == nil && u.Scheme == "https" && u.User == nil && (u.Host == "zhihu.com" || strings.HasSuffix(u.Host, ".zhihu.com")) {
			link = x.URL
		}

		out = append(out, SearchResult{ID: id, Title: plainText(x.Title), Excerpt: plainText(x.ContentText), Author: x.AuthorName, Avatar: x.AuthorAvatar, Kind: kind, Stats: stats, URL: link})
	}
	return out, nil
}
