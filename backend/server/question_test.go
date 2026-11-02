package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestQuestionSignatureFallback(t *testing.T) {
	const id = "2097043375547536464"
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		calls++
		if req.Header.Get("Cookie") != "test-cookie" || req.Header.Get("Referer") != "https://www.zhihu.com/question/"+id {
			t.Fatal("missing cookie or question referer")
		}
		status, body := http.StatusForbidden, `{"error":{"code":10003,"message":"请求参数异常，请升级客户端后重试。"}}`
		if calls == 2 {
			if req.URL.Path != "/api/v4/questions/"+id+"/answers" || req.URL.Query().Get("include") != "question" || req.URL.Query().Get("limit") != "1" {
				t.Fatalf("unexpected fallback: %s", req.URL)
			}
			status, body = http.StatusOK, `{"data":[{"question":{"id":2097043375547536464,"title":"真实问题标题"}}]}`
		}
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
	question, err := getQuestionDetail(context.Background(), client, "test-cookie", id)
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 || question.ID != id || question.Title != "真实问题标题" || !question.MetadataLimited || question.URL != "https://www.zhihu.com/question/"+id {
		t.Fatalf("unexpected summary: %#v, calls=%d", question, calls)
	}
}

func TestQuestionDoesNotFallbackForOtherErrors(t *testing.T) {
	for _, tc := range []struct{ status, code int }{{401, 10003}, {403, 40362}, {429, 10003}, {500, 10003}} {
		t.Run(fmt.Sprintf("%d/%d", tc.status, tc.code), func(t *testing.T) {
			calls := 0
			client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				calls++
				return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(fmt.Sprintf(`{"error":{"code":%d}}`, tc.code)))}, nil
			})}
			if _, err := getQuestionDetail(context.Background(), client, "cookie", "123"); err == nil {
				t.Fatal("expected upstream error")
			}
			if calls != 1 {
				t.Fatalf("unexpected retry: %d", calls)
			}
		})
	}
}

func TestQuestionSummaryRequiresMatchingTitle(t *testing.T) {
	for _, body := range []string{`{"data":[]}`, `{"data":[{"question":{"id":123}}]}`, `{"data":[{"question":{"id":456,"title":"其他问题"}}]}`, `invalid json`} {
		if _, err := getQuestionSummary(context.Background(), fixtureClient(body), "cookie", "123"); err == nil {
			t.Fatalf("accepted invalid summary: %s", body)
		}
	}
}

func TestQuestionSummaryPreservesUpstreamFailure(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 403, Body: io.NopCloser(strings.NewReader(`{"error":{"code":40362}}`))}, nil
	})}
	if _, err := getQuestionSummary(context.Background(), client, "cookie", "123"); err == nil || !strings.Contains(err.Error(), "403") {
		t.Fatalf("expected upstream failure, got %v", err)
	}
}
