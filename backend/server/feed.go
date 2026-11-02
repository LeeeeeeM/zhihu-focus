package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

func getFeed(ctx context.Context, client *http.Client, cookie, cursor string) (FeedPage, error) {
	return loadFeedPage(ctx, client, cookie, cursor, "https://api.zhihu.com/topstory/recommend?limit=20", "/topstory/recommend", "知乎返回了无效的推荐分页地址", "推荐", "recommendation")
}

func getHotList(ctx context.Context, client *http.Client, cursor string) (FeedPage, error) {
	return loadFeedPage(ctx, client, "", cursor, "https://api.zhihu.com/topstory/hot-lists/total?limit=20", "/topstory/hot-lists/total", "知乎返回了无效的热榜分页地址", "热榜", "hotlist")
}

func loadFeedPage(ctx context.Context, client *http.Client, cookie, cursor, fallback, path, invalidCursor, label, source string) (FeedPage, error) {
	endpoint := fallback
	if cursor != "" {
		resolved, err := checkedZhihuCursor(cursor, "api.zhihu.com", path, invalidCursor)
		if err != nil {
			return FeedPage{}, err
		}
		endpoint = resolved
	}
	b, err := zhihuAppJSON(ctx, client, cookie, endpoint, label)
	if err != nil {
		return FeedPage{}, err
	}
	var env FeedEnvelope
	if err = json.Unmarshal(b, &env); err != nil {
		return FeedPage{}, fmt.Errorf("无法解析知乎%s响应：%w", label, err)
	}
	if env.Data == nil {
		return FeedPage{}, fmt.Errorf("知乎列表响应缺少 data 字段")
	}
	return mapFeedPage(env, source), nil
}

func zhihuAppJSON(ctx context.Context, client *http.Client, cookie, endpoint, label string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "com.zhihu.android/Futureve/10.0.0 Mozilla/5.0")
	req.Header.Set("Accept", "application/json")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	resp, err := doZhihuRequest(client, req)
	if err != nil {
		return nil, fmt.Errorf("知乎%s请求失败：%w", label, err)
	}
	defer resp.Body.Close()
	b, err := readUpstreamBody(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("知乎%s接口返回 HTTP %d", label, resp.StatusCode)
	}
	return b, nil
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
		switch kind {
		case "answer":
			if q, ok := target["question"].(map[string]any); ok {
				title = feedString(q["title"])
			}
		case "article", "pin", "question":
		default:
			continue
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
		link := zhihuContentURL(kind, id)
		if !validID(id) || link == "" {
			continue
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
