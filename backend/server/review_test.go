package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSearchOnlyFallsBackOnConfirmedAuthenticationFailure(t *testing.T) {
	for _, tc := range []struct {
		status       int
		body         string
		unauthorized bool
	}{
		{401, `{}`, true}, {403, `{"error":{"code":10003,"message":"请求参数异常"}}`, false},
		{403, `{"error":{"message":"请先登录"}}`, true}, {403, `{"error":{"message":"cookie expired"}}`, true}, {403, `{"error":{"message":"cookie rate limited"}}`, false}, {403, `{"error":{"message":"签名认证失败"}}`, false}, {429, `{"error":{"message":"cookie rate limited"}}`, false},
		{500, `{"error":{"message":"login service unavailable"}}`, false},
	} {
		client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
		})}
		_, err := searchZhihuPage(context.Background(), client, "d_c0=fixture", "测试", "")
		if err == nil || errors.Is(err, errZhihuCookieUnauthorized) != tc.unauthorized {
			t.Fatalf("status %d auth misclassified: %v", tc.status, err)
		}
	}
}

func TestV5CommentsAndRepliesUseOneSchema(t *testing.T) {
	body := `{"data":[{"id":"123","content":"<p>评论</p>","like_count":0,"vote_count":99,"author":{"name":"新版作者","avatar_url":"https://pic.zhimg.com/avatar.jpg"},"child_comment_count":2,"child_comment_next_offset":"next-token","child_comments":[{"id":"456","content":"回复","like_count":3,"author":{"name":"回复作者"}}]}],"paging":{"is_end":true}}`
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if !strings.Contains(r.URL.Path, "/comment_v5/") {
			t.Fatalf("old comment endpoint: %s", r.URL.Path)
		}
		if r.Header.Get("x-zse-96") == "" {
			t.Fatal("web signature missing")
		}
		if strings.HasSuffix(r.URL.Path, "/child_comment") {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"data":[{"id":"456","content":"回复","like_count":3,"author":{"name":"回复作者"}}],"paging":{"is_end":true}}`))}, nil
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, nil
	})}
	page, err := getAnswerComments(context.Background(), client, "d_c0=fixture", "1", "")
	if err != nil {
		t.Fatal(err)
	}
	c := page.Items[0]
	if c.Author != "新版作者" || c.LikeCount != 0 || len(c.Replies) != 0 || c.ReplyCount != 2 || !c.RepliesHasMore || c.RepliesCursor == "" {
		t.Fatalf("bad v5 mapping: %#v", c)
	}
	replies, err := getCommentReplies(context.Background(), client, "d_c0=fixture", "answer", "1", c.ID, c.RepliesCursor, replyProgress{})
	if err != nil {
		t.Fatal(err)
	}
	if len(replies.Items) != 1 || replies.Items[0].Author != "回复作者" || replies.Items[0].LikeCount != 3 {
		t.Fatalf("bad reply mapping: %#v", replies)
	}
	if _, err = getArticleComments(context.Background(), client, "d_c0=fixture", "2", ""); err != nil {
		t.Fatal(err)
	}
}

func TestMalformedResponsesCannotBecomeSuccessfulEmptyContent(t *testing.T) {
	ctx := context.Background()
	client := fixtureClient(`{}`)
	checks := []func() error{
		func() error { _, e := getFeed(ctx, client, "cookie", ""); return e },
		func() error { _, e := getHotList(ctx, client, ""); return e },
		func() error { _, e := searchZhihuPage(ctx, client, "cookie", "测试", ""); return e },
		func() error { _, e := searchZhihuOpenAPI(ctx, client, "secret", "测试"); return e },
		func() error { _, e := getAnswerDetail(ctx, client, "cookie", "1"); return e },
		func() error { _, e := getArticleDetail(ctx, client, "cookie", "1"); return e },
		func() error { _, e := getQuestionDetail(ctx, client, "cookie", "1"); return e },
		func() error { _, e := getQuestionAnswers(ctx, client, "cookie", "1", ""); return e },
		func() error { _, e := getAnswerComments(ctx, client, "cookie", "1", ""); return e },
	}
	for i, check := range checks {
		if check() == nil {
			t.Fatalf("malformed response accepted at check %d", i)
		}
	}
}

func TestAllAPIHandlersRejectUnauthenticatedPrivateAccess(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("private request reached upstream without Cookie")
		return nil, nil
	})}
	handler := newAPIHandler(Config{}, client)
	for _, endpoint := range []string{"GET /api/detail?type=answer&id=1", "GET /api/comments?type=article&id=1", "GET /api/question?id=1", "GET /api/question/answers?id=1", "GET /api/comment-replies?type=answer&contentId=1&commentId=1", "GET /api/history", "POST /api/history?type=answer&id=1", "POST /api/read?type=answer&id=1", "GET /api/search?q=test"} {
		method, path, _ := strings.Cut(endpoint, " ")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest(method, path, nil))
		if w.Code != 401 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%s returned %d or was cacheable", endpoint, w.Code)
		}
	}
}

func TestAuthenticatedRequestsNeverFollowRedirects(t *testing.T) {
	for _, check := range []func(context.Context, *http.Client) error{
		func(ctx context.Context, c *http.Client) error {
			_, e := getAnswerDetail(ctx, c, "cookie", "1")
			return e
		},
		func(ctx context.Context, c *http.Client) error { _, e := getFeed(ctx, c, "cookie", ""); return e },
		func(ctx context.Context, c *http.Client) error {
			_, e := searchZhihuPage(ctx, c, "cookie", "test", "")
			return e
		},
		func(ctx context.Context, c *http.Client) error {
			_, e := searchZhihuOpenAPI(ctx, c, "secret", "test")
			return e
		},
	} {
		calls := 0
		client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			calls++
			return &http.Response{StatusCode: 302, Header: http.Header{"Location": {"https://example.com/other"}}, Body: io.NopCloser(strings.NewReader(""))}, nil
		})}
		if err := check(context.Background(), client); err == nil || calls != 1 {
			t.Fatalf("redirect accepted or followed: %v, calls=%d", err, calls)
		}
	}
}

type brokenReader struct{}

func (brokenReader) Read([]byte) (int, error) { return 0, io.ErrUnexpectedEOF }

func TestResponseLimitsAndCursorValidation(t *testing.T) {
	if _, err := readUpstreamBody(brokenReader{}); err == nil {
		t.Fatal("ignored I/O error")
	}
	if _, err := readUpstreamBody(strings.NewReader(strings.Repeat("x", (8<<20)+1))); err == nil {
		t.Fatal("oversized response accepted")
	}
	for _, cursor := range []string{"https://user@www.zhihu.com/api/v4/questions/1/answers", "https://www.zhihu.com/api/v4/questions/1/answers#fragment", "https://evil.example/api/v4/questions/1/answers"} {
		if validZhihuCursor(cursor, "www.zhihu.com", "/api/v4/questions/1/answers") {
			t.Fatalf("accepted cursor: %s", cursor)
		}
	}
}

func TestOfficialSearchSchemaAndCanonicalIDs(t *testing.T) {
	client := fixtureClient(`{"Code":0,"Data":{"Items":[{"Title":"<em>标题</em>","ContentType":"Article","ContentID":"wrong-token","ContentText":"摘要","Url":"https://zhuanlan.zhihu.com/p/123?utm_source=openapi"},{"Title":"回答","ContentType":"Answer","ContentID":"456","Url":"javascript:alert(1)"}]}}`)
	items, err := searchZhihuOpenAPI(context.Background(), client, "secret", "test")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 || items[0].ID != "123" || items[0].Kind != "article" || items[0].Title != "标题" || !strings.Contains(items[0].URL, "utm_source") || items[1].URL != "https://www.zhihu.com/answer/456" {
		t.Fatalf("invalid mapping: %#v", items)
	}
}

func TestFeedUsesCanonicalKinds(t *testing.T) {
	client := fixtureClient(`{"data":[{"target":{"id":"12","type":"answer","title":"原标题","excerpt":"摘要","voteup_count":3,"comment_count":1,"question":{"title":"问题标题"},"author":{"name":"作者"}}},{"target":{"id":"34","type":"pin","title":"一个想法","excerpt":""}}],"paging":{"is_end":true}}`)
	page, err := getFeed(context.Background(), client, "cookie", "")
	if err != nil || len(page.Items) != 2 || page.Items[0].Kind != "answer" || page.Items[0].Title != "问题标题" || page.Items[0].URL != "https://www.zhihu.com/answer/12" || page.Items[1].Kind != "pin" || page.Items[1].URL != "https://www.zhihu.com/pin/34" {
		t.Fatalf("feed mapping: %#v %v", page, err)
	}
}

func TestCookieSearchKeepsQuestions(t *testing.T) {
	client := fixtureClient(`{"data":[{"object":{"id":123,"type":"question","title":"问题标题"}}],"paging":{"is_end":true}}`)
	page, err := searchZhihuPage(context.Background(), client, "cookie", "问题", "")
	if err != nil || len(page.Items) != 1 || page.Items[0].Kind != "question" || page.Items[0].URL != "https://www.zhihu.com/question/123" {
		t.Fatalf("question result lost: %#v %v", page, err)
	}
}
