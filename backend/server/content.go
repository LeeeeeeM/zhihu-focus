package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

func getAnswerDetail(ctx context.Context, client *http.Client, cookie, id string) (ContentDetail, error) {
	link := zhihuContentURL("answer", id)
	u := "https://www.zhihu.com/api/v4/answers/" + id + "?include=content,excerpt,question,author,voteup_count,comment_count"
	b, err := zhihuWebGet(ctx, client, cookie, link, u)
	if err != nil {
		return ContentDetail{}, err
	}
	var raw answerResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return ContentDetail{}, fmt.Errorf("无法解析回答详情：%w", err)
	}
	if strings.TrimSpace(raw.Question.Title) == "" && strings.TrimSpace(raw.Content) == "" {
		return ContentDetail{}, fmt.Errorf("知乎详情响应缺少有效内容")
	}
	return ContentDetail{ID: id, QuestionID: rawID(raw.Question.ID), Title: raw.Question.Title, Content: plainText(raw.Content), ContentHTML: raw.Content, Author: raw.Author.Name, Avatar: raw.Author.Avatar, CreatedAt: formatUnix(raw.CreatedTime), VoteUpCount: raw.VoteUpCount, CommentCount: raw.CommentCount, URL: link}, nil
}

func getQuestionDetail(ctx context.Context, client *http.Client, cookie, id string) (QuestionInfo, error) {
	webURL := zhihuContentURL("question", id)
	endpoint := "https://www.zhihu.com/api/v4/questions/" + id + "?include=detail,excerpt,created,updated_time,answer_count,follower_count,comment_count,author,topics"
	b, err := zhihuWebGet(ctx, client, cookie, webURL, endpoint)
	if err != nil {
		var upstream *zhihuContentError
		if !errors.As(err, &upstream) || upstream.status != http.StatusForbidden || upstream.code != 10003 {
			return QuestionInfo{}, err
		}
		// This endpoint requires a client signature. The answer endpoint still
		// exposes the question title; do not invent statistics it does not expose.
		return getQuestionSummary(ctx, client, cookie, id)
	}
	var raw questionResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return QuestionInfo{}, fmt.Errorf("无法解析问题详情：%w", err)
	}
	if strings.TrimSpace(raw.Title) == "" {
		return QuestionInfo{}, fmt.Errorf("知乎详情响应缺少有效内容")
	}
	detail := raw.Detail
	if detail == "" {
		detail = raw.Excerpt
	}
	topics := make([]string, 0, len(raw.Topics))
	for _, topic := range raw.Topics {
		if topic.Name != "" {
			topics = append(topics, topic.Name)
		}
	}
	return QuestionInfo{ID: id, Title: raw.Title, Detail: plainText(detail), DetailHTML: detail, Author: raw.Author.Name, CreatedAt: formatUnix(raw.Created), UpdatedAt: formatUnix(raw.UpdatedTime), AnswerCount: raw.AnswerCount, FollowerCount: raw.FollowerCount, CommentCount: raw.CommentCount, Topics: topics, URL: webURL}, nil
}

func getQuestionSummary(ctx context.Context, client *http.Client, cookie, id string) (QuestionInfo, error) {
	webURL := zhihuContentURL("question", id)
	endpoint := "https://www.zhihu.com/api/v4/questions/" + id + "/answers?include=question&limit=1&offset=0&sort_by=default"
	b, err := zhihuWebGet(ctx, client, cookie, webURL, endpoint)
	if err != nil {
		return QuestionInfo{}, err
	}
	var env struct {
		Data []struct {
			Question questionResponse `json:"question"`
		} `json:"data"`
	}
	if err := json.Unmarshal(b, &env); err != nil {
		return QuestionInfo{}, fmt.Errorf("无法解析问题摘要：%w", err)
	}
	for _, answer := range env.Data {
		if rawID(answer.Question.ID) == id && strings.TrimSpace(answer.Question.Title) != "" {
			return QuestionInfo{ID: id, Title: answer.Question.Title, Topics: []string{}, URL: webURL, MetadataLimited: true}, nil
		}
	}
	return QuestionInfo{}, newAPIStatusError(http.StatusServiceUnavailable, "知乎暂不支持读取此问题详情，且回答列表中没有可用的问题标题，请查看知乎原页")
}

func getQuestionAnswers(ctx context.Context, client *http.Client, cookie, id, cursor string) (QuestionAnswerPage, error) {
	basePath := "/api/v4/questions/" + id + "/answers"
	u := "https://www.zhihu.com" + basePath + "?include=data[*].excerpt,created_time,comment_count,voteup_count,author&limit=20&offset=0&sort_by=default"
	if cursor != "" {
		resolved, err := checkedZhihuCursor(cursor, "www.zhihu.com", basePath, "知乎返回了无效的问题回答分页地址")
		if err != nil {
			return QuestionAnswerPage{}, err
		}
		u = resolved
	}
	b, err := zhihuWebGet(ctx, client, cookie, zhihuContentURL("question", id), u)
	if err != nil {
		return QuestionAnswerPage{}, err
	}
	var env struct {
		Data   []answerResponse `json:"data"`
		Paging struct {
			Next  string `json:"next"`
			IsEnd bool   `json:"is_end"`
		} `json:"paging"`
	}
	if err = json.Unmarshal(b, &env); err != nil {
		return QuestionAnswerPage{}, fmt.Errorf("无法解析问题回答列表：%w", err)
	}
	if env.Data == nil {
		return QuestionAnswerPage{}, fmt.Errorf("知乎列表响应缺少 data 字段")
	}
	items := make([]QuestionAnswer, 0, len(env.Data))
	for _, answer := range env.Data {
		excerpt := plainText(answer.Excerpt)
		if excerpt == "" {
			excerpt = plainText(answer.Content)
		}
		if runes := []rune(excerpt); len(runes) > 420 {
			excerpt = string(runes[:420]) + "…"
		}
		items = append(items, QuestionAnswer{ID: rawID(answer.ID), Excerpt: excerpt, Author: answer.Author.Name, Avatar: answer.Author.Avatar, CreatedAt: formatUnix(answer.CreatedTime), VoteUpCount: answer.VoteUpCount, CommentCount: answer.CommentCount})
	}
	return QuestionAnswerPage{Items: items, NextCursor: env.Paging.Next, HasMore: !env.Paging.IsEnd && env.Paging.Next != ""}, nil
}

func getArticleDetail(ctx context.Context, client *http.Client, cookie, id string) (ContentDetail, error) {
	webURL := zhihuContentURL("article", id)
	endpoint := "https://zhuanlan.zhihu.com/api/articles/" + id
	b, err := zhihuWebGet(ctx, client, cookie, webURL, endpoint)
	if err != nil {
		return ContentDetail{}, err
	}
	var raw articleResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return ContentDetail{}, fmt.Errorf("无法解析文章详情：%w", err)
	}
	if strings.TrimSpace(raw.Title) == "" && strings.TrimSpace(raw.Content) == "" {
		return ContentDetail{}, fmt.Errorf("知乎详情响应缺少有效内容")
	}
	return ContentDetail{ID: id, Title: raw.Title, Content: plainText(raw.Content), ContentHTML: raw.Content, Author: raw.Author.Name, Avatar: raw.Author.Avatar, CreatedAt: formatUnix(raw.Created), VoteUpCount: raw.VoteUpCount, CommentCount: raw.CommentCount, URL: webURL}, nil
}
