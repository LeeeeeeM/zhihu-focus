package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func getFeed(ctx context.Context, client *http.Client, cookie, cursor string) (FeedPage, error) {
	u := "https://api.zhihu.com/topstory/recommend?limit=20"
	if cursor != "" {
		parsed, err := url.Parse(cursor)
		if err != nil || !validZhihuCursor(cursor, "api.zhihu.com", "/topstory/recommend") {
			return FeedPage{}, newAPIStatusError(http.StatusBadRequest, "知乎返回了无效的推荐分页地址")
		}
		u = parsed.String()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return FeedPage{}, err
	}
	req.Header.Set("User-Agent", "com.zhihu.android/Futureve/10.0.0 Mozilla/5.0")
	req.Header.Set("Accept", "application/json")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	resp, err := doZhihuRequest(client, req)
	if err != nil {
		return FeedPage{}, fmt.Errorf("知乎推荐请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, err := readUpstreamBody(resp.Body)
	if err != nil {
		return FeedPage{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return FeedPage{}, fmt.Errorf("知乎推荐接口返回 HTTP %d", resp.StatusCode)
	}
	var env FeedEnvelope
	if err = json.Unmarshal(b, &env); err != nil {
		return FeedPage{}, fmt.Errorf("无法解析知乎推荐响应：%w", err)
	}
	if env.Data == nil {
		return FeedPage{}, fmt.Errorf("知乎列表响应缺少 data 字段")
	}
	return mapFeedPage(env, "recommendation"), nil
}

func getHotList(ctx context.Context, client *http.Client, cursor string) (FeedPage, error) {
	u := "https://api.zhihu.com/topstory/hot-lists/total?limit=20"
	if cursor != "" {
		parsed, err := url.Parse(cursor)
		if err != nil || !validZhihuCursor(cursor, "api.zhihu.com", "/topstory/hot-lists/total") {
			return FeedPage{}, newAPIStatusError(http.StatusBadRequest, "知乎返回了无效的热榜分页地址")
		}
		u = parsed.String()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return FeedPage{}, err
	}
	req.Header.Set("User-Agent", "com.zhihu.android/Futureve/10.0.0 Mozilla/5.0")
	req.Header.Set("Accept", "application/json")
	resp, err := doZhihuRequest(client, req)
	if err != nil {
		return FeedPage{}, fmt.Errorf("知乎热榜请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, err := readUpstreamBody(resp.Body)
	if err != nil {
		return FeedPage{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return FeedPage{}, fmt.Errorf("知乎热榜接口返回 HTTP %d", resp.StatusCode)
	}
	var env FeedEnvelope
	if err = json.Unmarshal(b, &env); err != nil {
		return FeedPage{}, fmt.Errorf("无法解析知乎热榜响应：%w", err)
	}
	if env.Data == nil {
		return FeedPage{}, fmt.Errorf("知乎列表响应缺少 data 字段")
	}
	return mapFeedPage(env, "hotlist"), nil
}

func mapFeedPage(env FeedEnvelope, source string) FeedPage {
	out := make([]FeedItem, 0, len(env.Data))
	for _, raw := range env.Data {
		var card map[string]any
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.UseNumber()
		if decoder.Decode(&card) != nil {
			continue
		}
		target, ok := card["target"].(map[string]any)
		if !ok {
			continue
		}
		title := feedString(target["title"])
		kind := feedString(target["type"])
		if kind == "answer" {
			kind = "回答"
			if q, ok := target["question"].(map[string]any); ok {
				title = feedString(q["title"])
				kind = "回答"
			}
		} else if kind == "article" {
			kind = "文章"
		} else if kind == "pin" {
			kind = "想法"
		} else if kind == "question" {
			kind = "问题"
		}
		if title == "" {
			continue
		}
		excerpt := feedString(target["excerpt"])
		author := "知乎用户"
		avatar := ""
		if a, ok := target["author"].(map[string]any); ok {
			if name := feedString(a["name"]); name != "" {
				author = name
			}
			for _, key := range []string{"avatar_url", "avatar_url_template", "avatar"} {
				avatar = feedString(a[key])
				if avatar != "" {
					break
				}
			}
			if avatar == "" {
				if image, ok := a["avatar"].(map[string]any); ok {
					avatar = feedString(image["url"])
				}
			}
			if strings.HasPrefix(avatar, "//") {
				avatar = "https:" + avatar
			}
			if strings.Contains(avatar, "{size}") {
				avatar = strings.ReplaceAll(avatar, "{size}", "is")
			}
		}
		id := feedString(target["id"])
		if !validID(id) || (kind != "问题" && kind != "回答" && kind != "文章" && kind != "想法") {
			continue
		}
		link := "https://www.zhihu.com"
		if kind == "问题" {
			link = "https://www.zhihu.com/question/" + id
		} else if kind == "回答" {
			link = "https://www.zhihu.com/answer/" + id
		} else if kind == "文章" {
			link = "https://zhuanlan.zhihu.com/p/" + id
		} else if kind == "想法" {
			link = "https://www.zhihu.com/pin/" + id
		}
		category, timeLabel := "推荐", "知乎推荐"
		stats := fmt.Sprintf("%v 赞同 · %v 评论", target["voteup_count"], target["comment_count"])
		if source == "hotlist" {
			category, timeLabel = "热榜", "实时热榜"
			stats = feedString(card["detail_text"])
			if stats == "" {
				stats = fmt.Sprintf("%v 个回答", target["answer_count"])
			}
		}
		out = append(out, FeedItem{ID: id, Kind: kind, Category: category, Title: plainText(title), Excerpt: plainText(excerpt), Author: author, Avatar: avatar, Stats: stats, Time: timeLabel, URL: link})
	}
	return FeedPage{Items: out, NextCursor: env.Paging.Next, HasMore: !env.Paging.IsEnd && env.Paging.Next != "", Source: source}
}
