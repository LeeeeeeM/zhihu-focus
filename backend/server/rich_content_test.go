package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func fixtureClient(body string) *http.Client {
	return &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
}

func TestDetailsPreserveRichContent(t *testing.T) {
	const content = `<p>正文<a href="https://example.com">链接</a><img data-actualsrc="https://pic.zhimg.com/example.jpg"></p>`
	encoded, err := json.Marshal(content)
	if err != nil {
		t.Fatal(err)
	}
	client := fixtureClient(`{"content":` + string(encoded) + `,"detail":` + string(encoded) + `,"question":{"id":123,"title":"标题"}}`)

	answer, err := getAnswerDetail(context.Background(), client, "cookie", "123")
	if err != nil {
		t.Fatal(err)
	}
	if answer.ContentHTML != content || strings.Contains(answer.Content, "<img") {
		t.Fatalf("answer content not preserved correctly: %#v", answer)
	}
	article, err := getArticleDetail(context.Background(), client, "cookie", "123")
	if err != nil {
		t.Fatal(err)
	}
	if article.ContentHTML != content {
		t.Fatal("article rich content was not preserved")
	}
	question, err := getQuestionDetail(context.Background(), client, "cookie", "123")
	if err != nil {
		t.Fatal(err)
	}
	if question.DetailHTML != content {
		t.Fatal("question rich content was not preserved")
	}
}

func TestCommentsPreserveRichContent(t *testing.T) {
	var raw commentsResponse
	if err := json.Unmarshal([]byte(`{"data":[{"id":1,"content":"<img src=\"https://example.com/a.jpg\">","child_comments":[{"id":2,"content":"<a href=\"https://example.com\">链接</a>"}]}]}`), &raw); err != nil {
		t.Fatal(err)
	}
	page := commentPageFromResponse(raw)
	if len(page.Items) != 1 || len(page.Items[0].Replies) != 1 {
		t.Fatal("comment or reply missing")
	}
	if !strings.Contains(page.Items[0].ContentHTML, "https://example.com/a.jpg") {
		t.Fatal("comment image missing")
	}
	if !strings.Contains(page.Items[0].Replies[0].ContentHTML, "https://example.com") {
		t.Fatal("reply link missing")
	}
}
