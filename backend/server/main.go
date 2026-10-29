package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type FeedItem struct {
	ID       string `json:"id"`
	Kind     string `json:"kind"`
	Category string `json:"category"`
	Title    string `json:"title"`
	Excerpt  string `json:"excerpt"`
	Author   string `json:"author"`
	Avatar   string `json:"avatar,omitempty"`
	Stats    string `json:"stats"`
	Time     string `json:"time"`
	Tag      string `json:"tag,omitempty"`
	URL      string `json:"url"`
}
type FeedPage struct {
	Items      []FeedItem `json:"items"`
	NextCursor string     `json:"nextCursor,omitempty"`
	HasMore    bool       `json:"hasMore"`
	Source     string     `json:"source,omitempty"`
}
type SearchResult struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Excerpt string `json:"excerpt"`
	Author  string `json:"author"`
	Avatar  string `json:"avatar,omitempty"`
	Kind    string `json:"kind"`
	Stats   string `json:"stats"`
	URL     string `json:"url"`
}
type SearchPage struct {
	Items        []SearchResult `json:"items"`
	NextCursor   string         `json:"nextCursor,omitempty"`
	HasMore      bool           `json:"hasMore"`
	Source       string         `json:"source,omitempty"`
	UsedFallback bool           `json:"usedFallback,omitempty"`
}
type ContentDetail struct {
	ID           string `json:"id"`
	QuestionID   string `json:"questionId,omitempty"`
	Title        string `json:"title"`
	Content      string `json:"content"`
	Author       string `json:"author"`
	Avatar       string `json:"avatar"`
	CreatedAt    string `json:"createdAt"`
	VoteUpCount  int    `json:"voteUpCount"`
	CommentCount int    `json:"commentCount"`
	URL          string `json:"url"`
}
type QuestionInfo struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	Detail        string   `json:"detail"`
	Author        string   `json:"author"`
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
	AnswerCount   int      `json:"answerCount"`
	FollowerCount int      `json:"followerCount"`
	CommentCount  int      `json:"commentCount"`
	Topics        []string `json:"topics"`
	URL           string   `json:"url"`
}
type QuestionAnswer struct {
	ID           string `json:"id"`
	Excerpt      string `json:"excerpt"`
	Author       string `json:"author"`
	Avatar       string `json:"avatar"`
	CreatedAt    string `json:"createdAt"`
	VoteUpCount  int    `json:"voteUpCount"`
	CommentCount int    `json:"commentCount"`
}
type QuestionAnswerPage struct {
	Items      []QuestionAnswer `json:"items"`
	NextCursor string           `json:"nextCursor,omitempty"`
	HasMore    bool             `json:"hasMore"`
}
type Comment struct {
	ID             string    `json:"id"`
	Content        string    `json:"content"`
	Author         string    `json:"author"`
	Avatar         string    `json:"avatar"`
	CreatedAt      string    `json:"createdAt"`
	LikeCount      int       `json:"likeCount"`
	ReplyCount     int       `json:"replyCount"`
	Replies        []Comment `json:"replies,omitempty"`
	RepliesCursor  string    `json:"repliesCursor,omitempty"`
	RepliesHasMore bool      `json:"repliesHasMore,omitempty"`
}
type CommentPage struct {
	Items      []Comment `json:"items"`
	NextCursor string    `json:"nextCursor,omitempty"`
	HasMore    bool      `json:"hasMore"`
}
type Config struct {
	AccessSecret string
	Cookie       string
}
type APIEnvelope struct {
	Code    int    `json:"Code"`
	Message string `json:"Message"`
	Data    struct {
		Items []struct {
			Title        string `json:"Title"`
			ContentType  string `json:"ContentType"`
			ContentID    string `json:"ContentID"`
			ContentText  string `json:"ContentText"`
			URL          string `json:"Url"`
			CommentCount int    `json:"CommentCount"`
			VoteUpCount  int    `json:"VoteUpCount"`
			AuthorName   string `json:"AuthorName"`
			AuthorAvatar string `json:"AuthorAvatar"`
		} `json:"Items"`
	} `json:"Data"`
}
type FeedEnvelope struct {
	Data   []json.RawMessage `json:"data"`
	Paging struct {
		Next  string `json:"next"`
		IsEnd bool   `json:"is_end"`
	} `json:"paging"`
}
type answerResponse struct {
	ID           json.RawMessage `json:"id"`
	Content      string          `json:"content"`
	Excerpt      string          `json:"excerpt"`
	CreatedTime  int64           `json:"created_time"`
	VoteUpCount  int             `json:"voteup_count"`
	CommentCount int             `json:"comment_count"`
	URL          string          `json:"url"`
	Question     struct {
		ID    json.RawMessage `json:"id"`
		Title string          `json:"title"`
	} `json:"question"`
	Author struct {
		Name   string `json:"name"`
		Avatar string `json:"avatar_url"`
	} `json:"author"`
}
type questionResponse struct {
	ID            json.RawMessage `json:"id"`
	Title         string          `json:"title"`
	Detail        string          `json:"detail"`
	Excerpt       string          `json:"excerpt"`
	Created       int64           `json:"created"`
	UpdatedTime   int64           `json:"updated_time"`
	AnswerCount   int             `json:"answer_count"`
	FollowerCount int             `json:"follower_count"`
	CommentCount  int             `json:"comment_count"`
	Author        struct {
		Name string `json:"name"`
	} `json:"author"`
	Topics []struct {
		Name string `json:"name"`
	} `json:"topics"`
}
type articleResponse struct {
	ID           json.RawMessage `json:"id"`
	Title        string          `json:"title"`
	Content      string          `json:"content"`
	Created      int64           `json:"created"`
	VoteUpCount  int             `json:"voteup_count"`
	CommentCount int             `json:"comment_count"`
	URL          string          `json:"url"`
	Author       struct {
		Name   string `json:"name"`
		Avatar string `json:"avatar_url"`
	} `json:"author"`
}
type commentsResponse struct {
	Data []struct {
		ID                json.RawMessage `json:"id"`
		Content           string          `json:"content"`
		CreatedTime       int64           `json:"created_time"`
		VoteCount         int             `json:"vote_count"`
		ChildCommentCount int             `json:"child_comment_count"`
		RepliesCount      int             `json:"replies_count"`
		Author            struct {
			Member struct {
				Name   string `json:"name"`
				Avatar string `json:"avatar_url"`
			} `json:"member"`
		} `json:"author"`
		ChildComments []struct {
			ID          json.RawMessage `json:"id"`
			Content     string          `json:"content"`
			CreatedTime int64           `json:"created_time"`
			VoteCount   int             `json:"vote_count"`
			Author      struct {
				Member struct {
					Name   string `json:"name"`
					Avatar string `json:"avatar_url"`
				} `json:"member"`
			} `json:"author"`
		} `json:"child_comments"`
	} `json:"data"`
	Paging struct {
		Next  string `json:"next"`
		IsEnd bool   `json:"is_end"`
	} `json:"paging"`
}

func main() {
	cfg := loadConfig()
	client := &http.Client{Timeout: 20 * time.Second}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "configured": map[string]bool{"search": cfg.AccessSecret != "", "recommendation": cfg.Cookie != ""}})
	})
	mux.HandleFunc("GET /api/feed", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r, cfg.Cookie)
		var page FeedPage
		var err error
		if cookie == "" {
			page, err = getHotList(r.Context(), client, r.URL.Query().Get("cursor"))
		} else {
			page, err = getFeed(r.Context(), client, cookie, r.URL.Query().Get("cursor"))
		}
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	})
	mux.HandleFunc("GET /api/search", func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q == "" {
			writeJSON(w, http.StatusOK, SearchPage{Items: []SearchResult{}})
			return
		}
		cursor := r.URL.Query().Get("cursor")
		userCookie := strings.TrimSpace(r.Header.Get("X-Zhihu-Cookie"))
		var page SearchPage
		var err error
		if userCookie != "" {
			page, err = searchZhihuPage(r.Context(), client, userCookie, q, cursor)
			if err == nil {
				page.Source = "cookie"
			} else if errors.Is(err, errZhihuCookieUnauthorized) {
				page, err = searchZhihuFallback(r.Context(), client, cfg.AccessSecret, q, err)
			}
		} else {
			page, err = searchZhihuFallback(r.Context(), client, cfg.AccessSecret, q, nil)
		}
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	})
	mux.HandleFunc("GET /api/detail", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r, cfg.Cookie)
		if cookie == "" {
			apiError(w, errors.New("读取详情需要在知简设置中配置知乎 Cookie"))
			return
		}
		contentType := r.URL.Query().Get("type")
		id := r.URL.Query().Get("id")
		if !validID(id) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的回答 ID"})
			return
		}
		var item ContentDetail
		var err error
		switch contentType {
		case "answer":
			item, err = getAnswerDetail(r.Context(), client, cookie, id)
		case "article":
			item, err = getArticleDetail(r.Context(), client, cookie, id)
		default:
			apiError(w, errors.New("不支持的知乎内容类型"))
			return
		}
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, item)
	})
	mux.HandleFunc("GET /api/comments", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r, cfg.Cookie)
		if cookie == "" {
			apiError(w, errors.New("读取评论需要在知简设置中配置知乎 Cookie"))
			return
		}
		contentType := r.URL.Query().Get("type")
		id := r.URL.Query().Get("id")
		if !validID(id) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的回答 ID"})
			return
		}
		var page CommentPage
		var err error
		switch contentType {
		case "answer":
			page, err = getAnswerComments(r.Context(), client, cookie, id, r.URL.Query().Get("cursor"))
		case "article":
			page, err = getArticleComments(r.Context(), client, cookie, id, r.URL.Query().Get("cursor"))
		default:
			apiError(w, errors.New("不支持的知乎内容类型"))
			return
		}
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	})
	mux.HandleFunc("GET /api/question", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r, cfg.Cookie)
		if cookie == "" {
			apiError(w, errors.New("读取问题需要在知简设置中配置知乎 Cookie"))
			return
		}
		id := r.URL.Query().Get("id")
		if !validID(id) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的问题 ID"})
			return
		}
		question, err := getQuestionDetail(r.Context(), client, cookie, id)
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, question)
	})
	mux.HandleFunc("GET /api/question/answers", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r, cfg.Cookie)
		if cookie == "" {
			apiError(w, errors.New("读取问题回答需要在知简设置中配置知乎 Cookie"))
			return
		}
		id := r.URL.Query().Get("id")
		if !validID(id) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的问题 ID"})
			return
		}
		page, err := getQuestionAnswers(r.Context(), client, cookie, id, r.URL.Query().Get("cursor"))
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	})
	mux.HandleFunc("GET /api/comment-replies", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r, cfg.Cookie)
		if cookie == "" {
			apiError(w, errors.New("读取评论回复需要在知简设置中配置知乎 Cookie"))
			return
		}
		contentType := r.URL.Query().Get("type")
		contentID := r.URL.Query().Get("contentId")
		commentID := r.URL.Query().Get("commentId")
		if (contentType != "answer" && contentType != "article") || !validID(contentID) || !validID(commentID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的内容或评论 ID"})
			return
		}
		page, err := getCommentReplies(r.Context(), client, cookie, contentType, contentID, commentID, r.URL.Query().Get("cursor"))
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	})
	addr := os.Getenv("ZHIFOCUS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8787"
	}
	log.Printf("Zhihu Focus API listening on http://%s", addr)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

func getAnswerDetail(ctx context.Context, client *http.Client, cookie, id string) (ContentDetail, error) {
	u := "https://www.zhihu.com/api/v4/answers/" + id + "?include=content,excerpt,question,author,voteup_count,comment_count"
	b, err := zhihuWebGet(ctx, client, cookie, "https://www.zhihu.com/answer/"+id, u)
	if err != nil {
		return ContentDetail{}, err
	}
	var raw answerResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return ContentDetail{}, fmt.Errorf("无法解析回答详情：%w", err)
	}
	link := "https://www.zhihu.com/answer/" + id
	return ContentDetail{ID: id, QuestionID: rawID(raw.Question.ID), Title: raw.Question.Title, Content: plainText(raw.Content), Author: raw.Author.Name, Avatar: raw.Author.Avatar, CreatedAt: formatUnix(raw.CreatedTime), VoteUpCount: raw.VoteUpCount, CommentCount: raw.CommentCount, URL: link}, nil
}

func getQuestionDetail(ctx context.Context, client *http.Client, cookie, id string) (QuestionInfo, error) {
	webURL := "https://www.zhihu.com/question/" + id
	endpoint := "https://www.zhihu.com/api/v4/questions/" + id + "?include=detail,excerpt,created,updated_time,answer_count,follower_count,comment_count,author,topics"
	b, err := zhihuWebGet(ctx, client, cookie, webURL, endpoint)
	if err != nil {
		return QuestionInfo{}, err
	}
	var raw questionResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return QuestionInfo{}, fmt.Errorf("无法解析问题详情：%w", err)
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
	return QuestionInfo{ID: id, Title: raw.Title, Detail: plainText(detail), Author: raw.Author.Name, CreatedAt: formatUnix(raw.Created), UpdatedAt: formatUnix(raw.UpdatedTime), AnswerCount: raw.AnswerCount, FollowerCount: raw.FollowerCount, CommentCount: raw.CommentCount, Topics: topics, URL: webURL}, nil
}

func getQuestionAnswers(ctx context.Context, client *http.Client, cookie, id, cursor string) (QuestionAnswerPage, error) {
	basePath := "/api/v4/questions/" + id + "/answers"
	u := "https://www.zhihu.com" + basePath + "?include=data[*].excerpt,created_time,comment_count,voteup_count,author&limit=20&offset=0&sort_by=default"
	if cursor != "" {
		parsed, err := url.Parse(cursor)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "www.zhihu.com" || parsed.Path != basePath {
			return QuestionAnswerPage{}, errors.New("知乎返回了无效的问题回答分页地址")
		}
		u = parsed.String()
	}
	b, err := zhihuWebGet(ctx, client, cookie, "https://www.zhihu.com/question/"+id, u)
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
	webURL := "https://zhuanlan.zhihu.com/p/" + id
	endpoint := "https://zhuanlan.zhihu.com/api/articles/" + id
	b, err := zhihuWebGet(ctx, client, cookie, webURL, endpoint)
	if err != nil {
		return ContentDetail{}, err
	}
	var raw articleResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return ContentDetail{}, fmt.Errorf("无法解析文章详情：%w", err)
	}
	return ContentDetail{ID: id, Title: raw.Title, Content: plainText(raw.Content), Author: raw.Author.Name, Avatar: raw.Author.Avatar, CreatedAt: formatUnix(raw.Created), VoteUpCount: raw.VoteUpCount, CommentCount: raw.CommentCount, URL: webURL}, nil
}

func getAnswerComments(ctx context.Context, client *http.Client, cookie, id, cursor string) (CommentPage, error) {
	basePath := "/api/v4/answers/" + id + "/root_comments"
	u := "https://www.zhihu.com" + basePath + "?limit=20&offset=0&order=normal&status=open"
	if cursor != "" {
		parsed, err := url.Parse(cursor)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "www.zhihu.com" || parsed.Path != basePath {
			return CommentPage{}, errors.New("知乎返回了无效的评论分页地址")
		}
		u = parsed.String()
	}
	b, err := zhihuWebGet(ctx, client, cookie, "https://www.zhihu.com/answer/"+id, u)
	if err != nil {
		return CommentPage{}, err
	}
	var raw commentsResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return CommentPage{}, fmt.Errorf("无法解析评论列表：%w", err)
	}
	return commentPageFromResponse(raw), nil
}

func getArticleComments(ctx context.Context, client *http.Client, cookie, id, cursor string) (CommentPage, error) {
	basePath := "/api/v4/comment_v5/articles/" + id + "/root_comment"
	u := "https://www.zhihu.com" + basePath + "?order_by=score&limit=20"
	if cursor != "" {
		parsed, err := url.Parse(cursor)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "www.zhihu.com" || parsed.Path != basePath {
			return CommentPage{}, errors.New("知乎返回了无效的文章评论分页地址")
		}
		u = parsed.String()
	}
	b, err := zhihuWebGet(ctx, client, cookie, "https://zhuanlan.zhihu.com/p/"+id, u)
	if err != nil {
		return CommentPage{}, err
	}
	var raw commentsResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return CommentPage{}, fmt.Errorf("无法解析文章评论：%w", err)
	}
	return commentPageFromResponse(raw), nil
}

func commentPageFromResponse(raw commentsResponse) CommentPage {
	out := make([]Comment, 0, len(raw.Data))
	for _, c := range raw.Data {
		replyCount := c.ChildCommentCount
		if replyCount == 0 {
			replyCount = c.RepliesCount
		}
		item := Comment{ID: rawID(c.ID), Content: plainText(c.Content), Author: c.Author.Member.Name, Avatar: c.Author.Member.Avatar, CreatedAt: formatUnix(c.CreatedTime), LikeCount: c.VoteCount, ReplyCount: replyCount}
		for _, reply := range c.ChildComments {
			item.Replies = append(item.Replies, Comment{ID: rawID(reply.ID), Content: plainText(reply.Content), Author: reply.Author.Member.Name, Avatar: reply.Author.Member.Avatar, CreatedAt: formatUnix(reply.CreatedTime), LikeCount: reply.VoteCount})
		}
		item.RepliesHasMore = item.ReplyCount > len(item.Replies)
		out = append(out, item)
	}
	return CommentPage{Items: out, NextCursor: raw.Paging.Next, HasMore: !raw.Paging.IsEnd && raw.Paging.Next != ""}
}

func getCommentReplies(ctx context.Context, client *http.Client, cookie, contentType, contentID, commentID, cursor string) (CommentPage, error) {
	basePath := "/api/v4/comments/" + commentID + "/child_comments"
	u := "https://www.zhihu.com" + basePath + "?limit=10&offset=0"
	if cursor != "" {
		parsed, err := url.Parse(cursor)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "www.zhihu.com" || parsed.Path != basePath {
			return CommentPage{}, errors.New("知乎返回了无效的子评论分页地址")
		}
		u = parsed.String()
	}
	referer := "https://www.zhihu.com/answer/" + contentID
	if contentType == "article" {
		referer = "https://zhuanlan.zhihu.com/p/" + contentID
	}
	b, err := zhihuWebGet(ctx, client, cookie, referer, u)
	if err != nil {
		return CommentPage{}, err
	}
	var raw commentsResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return CommentPage{}, fmt.Errorf("无法解析评论回复：%w", err)
	}
	return commentPageFromResponse(raw), nil
}

func zhihuWebGet(ctx context.Context, client *http.Client, cookie, referer, endpoint string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Cookie", cookie)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Referer", referer)
	req.Header.Set("x-requested-with", "fetch")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("知乎内容请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("知乎内容接口返回 HTTP %d：%s", resp.StatusCode, safeBody(b))
	}
	return b, nil
}

var tagPattern = regexp.MustCompile(`<[^>]*>`)
var blockPattern = regexp.MustCompile(`(?i)</(p|div|li|h[1-6]|blockquote|br)>`)

func plainText(s string) string {
	s = blockPattern.ReplaceAllString(s, "\n\n")
	s = tagPattern.ReplaceAllString(s, "")
	return strings.TrimSpace(html.UnescapeString(s))
}
func formatUnix(v int64) string {
	if v <= 0 {
		return ""
	}
	return time.Unix(v, 0).Format("2006-01-02 15:04")
}
func rawID(v json.RawMessage) string {
	if len(v) == 0 {
		return ""
	}
	var s string
	if json.Unmarshal(v, &s) == nil {
		return s
	}
	return strings.Trim(string(v), "\\\"")
}
func validID(v string) bool {
	if v == "" {
		return false
	}
	for _, r := range v {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
func loadConfig() Config {
	c := Config{AccessSecret: os.Getenv("ZHIHU_ACCESS_SECRET"), Cookie: os.Getenv("ZHIHU_COOKIE")}
	p := filepath.Join(".", ".env")
	b, err := os.ReadFile(p)
	if err != nil {
		return c
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		v = strings.TrimSpace(v)
		v = strings.Trim(v, "\"'")
		switch strings.TrimSpace(k) {
		case "ZHIHU_ACCESS_SECRET":
			if c.AccessSecret == "" {
				c.AccessSecret = v
			}
		case "ZHIHU_COOKIE":
			if c.Cookie == "" {
				c.Cookie = v
			}
		}
	}
	return c
}
func getFeed(ctx context.Context, client *http.Client, cookie, cursor string) (FeedPage, error) {
	u := "https://api.zhihu.com/topstory/recommend?limit=20"
	if cursor != "" {
		parsed, err := url.Parse(cursor)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "api.zhihu.com" || parsed.Path != "/topstory/recommend" {
			return FeedPage{}, errors.New("知乎返回了无效的推荐分页地址")
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
	resp, err := client.Do(req)
	if err != nil {
		return FeedPage{}, fmt.Errorf("知乎推荐请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return FeedPage{}, fmt.Errorf("知乎推荐接口返回 HTTP %d：%s", resp.StatusCode, safeBody(b))
	}
	var env FeedEnvelope
	if err = json.Unmarshal(b, &env); err != nil {
		return FeedPage{}, fmt.Errorf("无法解析知乎推荐响应：%w", err)
	}
	return mapFeedPage(env, "recommendation"), nil
}

func getHotList(ctx context.Context, client *http.Client, cursor string) (FeedPage, error) {
	u := "https://api.zhihu.com/topstory/hot-lists/total?limit=20"
	if cursor != "" {
		parsed, err := url.Parse(cursor)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "api.zhihu.com" || parsed.Path != "/topstory/hot-lists/total" {
			return FeedPage{}, errors.New("知乎返回了无效的热榜分页地址")
		}
		u = parsed.String()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return FeedPage{}, err
	}
	req.Header.Set("User-Agent", "com.zhihu.android/Futureve/10.0.0 Mozilla/5.0")
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return FeedPage{}, fmt.Errorf("知乎热榜请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return FeedPage{}, fmt.Errorf("知乎热榜接口返回 HTTP %d：%s", resp.StatusCode, safeBody(b))
	}
	var env FeedEnvelope
	if err = json.Unmarshal(b, &env); err != nil {
		return FeedPage{}, fmt.Errorf("无法解析知乎热榜响应：%w", err)
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
		out = append(out, FeedItem{ID: id, Kind: kind, Category: category, Title: title, Excerpt: excerpt, Author: author, Avatar: avatar, Stats: stats, Time: timeLabel, URL: link})
	}
	return FeedPage{Items: out, NextCursor: env.Paging.Next, HasMore: !env.Paging.IsEnd && env.Paging.Next != "", Source: source}
}

var errZhihuCookieUnauthorized = errors.New("知乎 Cookie 无效或已过期")

func searchZhihuFallback(ctx context.Context, client *http.Client, secret, q string, cookieError error) (SearchPage, error) {
	if secret == "" {
		if cookieError != nil {
			return SearchPage{}, errors.New("个人 Cookie 无效或已过期，且未配置 ZHIHU_ACCESS_SECRET 兜底")
		}
		return SearchPage{}, errors.New("请在搜索设置中填写个人 Cookie，或配置 ZHIHU_ACCESS_SECRET 作为兜底")
	}
	items, err := searchZhihuOpenAPI(ctx, client, secret, q)
	if err != nil {
		return SearchPage{}, err
	}
	return SearchPage{Items: items, Source: "access_secret", UsedFallback: true}, nil
}

func isZhihuCookieAuthFailure(code json.RawMessage, message string, apiError json.RawMessage) bool {
	detail := strings.ToLower(message + " " + string(code) + " " + string(apiError))
	for _, marker := range []string{"unauthorized", "unauthenticated", "login", "logged out", "expired", "cookie", "登录", "未登录", "请先登录", "登录已过期", "认证", "授权", "凭证失效", "已过期"} {
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
		parsed, err := url.Parse(cursor)
		if err != nil || parsed.Scheme != "https" || parsed.Host != "api.zhihu.com" || parsed.Path != basePath || parsed.Query().Get("q") != q {
			return SearchPage{}, errors.New("知乎返回了无效的搜索分页地址")
		}
		u = parsed.String()
	}
	referer := "https://www.zhihu.com/search?type=content&q=" + url.QueryEscape(q)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return SearchPage{}, err
	}
	req.Header.Set("Cookie", cookie)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Referer", referer)
	req.Header.Set("x-requested-with", "fetch")
	resp, err := client.Do(req)
	if err != nil {
		return SearchPage{}, fmt.Errorf("知乎搜索请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden || isZhihuCookieAuthFailure(nil, "", json.RawMessage(b)) {
			return SearchPage{}, errZhihuCookieUnauthorized
		}
		return SearchPage{}, fmt.Errorf("知乎搜索接口返回 HTTP %d：%s", resp.StatusCode, safeBody(b))
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
		return SearchPage{}, fmt.Errorf("知乎搜索接口返回错误：%s", safeBody(b))
	}
	if env.Message != "" && isZhihuCookieAuthFailure(env.Code, env.Message, env.Error) {
		return SearchPage{}, errZhihuCookieUnauthorized
	}
	items := make([]SearchResult, 0, len(env.Data))
	for _, result := range env.Data {
		x := result.Object
		if x.Type != "answer" && x.Type != "article" {
			continue
		}
		id := rawID(x.ID)
		if !validID(id) {
			continue
		}
		title := x.Title
		link := "https://www.zhihu.com/answer/" + id
		if x.Type == "article" {
			link = "https://zhuanlan.zhihu.com/p/" + id
		} else if title == "" {
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
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("知乎搜索请求失败：%w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("知乎搜索接口返回 HTTP %d：%s", resp.StatusCode, safeBody(b))
	}
	var env APIEnvelope
	if err = json.Unmarshal(b, &env); err != nil {
		return nil, fmt.Errorf("无法解析知乎搜索响应：%w", err)
	}
	if env.Code != 0 {
		return nil, fmt.Errorf("知乎搜索错误 %d：%s", env.Code, env.Message)
	}
	out := make([]SearchResult, 0, len(env.Data.Items))
	for _, x := range env.Data.Items {
		stats := fmt.Sprintf("%d 赞同 · %d 评论", x.VoteUpCount, x.CommentCount)
		id := x.ContentID
		if strings.EqualFold(x.ContentType, "article") {
			if parsed, parseErr := url.Parse(x.URL); parseErr == nil {
				segments := strings.Split(strings.Trim(parsed.Path, "/"), "/")
				if len(segments) == 2 && segments[0] == "p" && validID(segments[1]) {
					id = segments[1]
				}
			}
		}
		out = append(out, SearchResult{ID: id, Title: x.Title, Excerpt: x.ContentText, Author: x.AuthorName, Avatar: x.AuthorAvatar, Kind: x.ContentType, Stats: stats, URL: x.URL})
	}
	return out, nil
}
func str(v any) string { s, _ := v.(string); return s }
func feedString(v any) string {
	switch value := v.(type) {
	case string:
		return value
	case json.Number:
		return value.String()
	default:
		return ""
	}
}
func requestZhihuCookie(r *http.Request, fallback string) string {
	if cookie := strings.TrimSpace(r.Header.Get("X-Zhihu-Cookie")); cookie != "" {
		return cookie
	}
	return strings.TrimSpace(fallback)
}
func safeBody(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 240 {
		s = s[:240] + "…"
	}
	return s
}
func apiError(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Zhihu-Cookie")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
