package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHistoryMappingAndSignedPagination(t *testing.T) {
	const next = historyEndpoint + "?offset=20&limit=20"
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Method != "GET" || r.Header.Get("Cookie") != "d_c0=token" || r.Header.Get("x-zse-93") != zhihuZse93 {
			t.Fatal("missing authentication")
		}
		want := "2.0_4KvVG5x=HOHv992STwy4Ri9uSGNgH7PFw5=YIJMxh9wfNeI0aZsMUtxXhXLzqWWi"
		if calls > 1 {
			if r.URL.String() != next {
				t.Fatalf("unexpected next URL: %s", r.URL)
			}
			want = zhihuSignature(r.URL.RequestURI(), "token")
		}
		if r.Header.Get("x-zse-96") != want {
			t.Fatal("query was not signed correctly")
		}
		body := `{"data":[
		 {"data":{"header":{"title":"<b>标题</b>"},"content":{"authorName":"作者","summary":"<p>摘要</p>"},"extra":{"contentToken":2097043375547536464,"contentType":"answer","readTime":1793577600000}}},
		 {"data":{"header":{"title":"文章"},"action":{"url":"https://zhuanlan.zhihu.com/p/456"}}},
		 {"data":{"header":{"title":"回答"},"action":{"url":"https://www.zhihu.com/question/123/answer/789"}}},
		 {"data":{"header":{"title":"不安全链接"},"action":{"url":"javascript:alert(1)"}}}
		],"paging":{"next":"` + next + `","is_end":false}}`
		if calls > 1 {
			body = `{"data":[],"paging":{"is_end":true}}`
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, nil
	})}
	page, err := getHistory(context.Background(), client, "d_c0=token", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 3 || !page.HasMore || page.NextCursor != next {
		t.Fatalf("unexpected page: %#v", page)
	}
	if page.Items[0].ID != "2097043375547536464" || page.Items[0].Title != "标题" || page.Items[0].Excerpt != "摘要" || page.Items[0].Author != "作者" || page.Items[0].Time == "" {
		t.Fatalf("unexpected item: %#v", page.Items[0])
	}
	if page.Items[1].Kind != "article" || page.Items[2].ID != "789" || page.Items[2].Kind != "answer" {
		t.Fatal("URL fallback did not identify content")
	}
	last, err := getHistory(context.Background(), client, "d_c0=token", page.NextCursor)
	if err != nil || last.HasMore || last.Items == nil {
		t.Fatalf("invalid last page: %#v, %v", last, err)
	}
}

func TestHistoryRejectsUntrustedPaginationAndMissingCookie(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) { t.Fatal("unexpected upstream call"); return nil, nil })}
	for _, cookie := range []string{"", "session=fixture"} {
		r := httptest.NewRequest("GET", "/api/history", nil)
		r.Header.Set("X-Zhihu-Cookie", cookie)
		w := httptest.NewRecorder()
		historyHandler(client)(w, r)
		if w.Code != 401 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("expected private authentication error")
		}
	}
	for _, cursor := range []string{"http://api.zhihu.com/unify-consumption/read_history", "https://evil.example/unify-consumption/read_history", "https://api.zhihu.com/other", "https://user@api.zhihu.com/unify-consumption/read_history", historyEndpoint + "#fragment"} {
		if _, err := getHistory(context.Background(), client, "d_c0=token", cursor); err == nil {
			t.Fatalf("accepted cursor: %s", cursor)
		}
	}
}

func TestHistoryDoesNotTreatFailuresAsEmptyHistory(t *testing.T) {
	for _, tc := range []struct {
		status int
		body   string
	}{
		{401, `private-cookie-data`}, {403, `{}`}, {429, `{}`}, {200, `<html>login</html>`}, {200, `{"error":{}}`},
		{200, `{"data":[],"paging":{"next":"https://evil.example/history"}}`},
	} {
		client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
		})}
		_, err := getHistory(context.Background(), client, "d_c0=token", "")
		if err == nil || strings.Contains(err.Error(), "private-cookie-data") {
			t.Fatalf("expected sanitized failure: %v", err)
		}
	}
}

func TestHistoryStopsRepeatedCursorAndRedirects(t *testing.T) {
	client := fixtureClient(`{"data":[],"paging":{"next":"` + historyEndpoint + `?offset=0&limit=20"}}`)
	page, err := getHistory(context.Background(), client, "d_c0=token", "")
	if err != nil || page.HasMore {
		t.Fatalf("repeated cursor did not stop: %#v, %v", page, err)
	}
	calls := 0
	client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: 302, Header: http.Header{"Location": {"https://evil.example"}}, Body: io.NopCloser(strings.NewReader(""))}, nil
	})}
	if _, err = getHistory(context.Background(), client, "d_c0=token", ""); err == nil || calls != 1 {
		t.Fatal("redirect accepted")
	}
}

func TestHistoryContentLinks(t *testing.T) {
	for _, tc := range []struct{ action, kind, id string }{
		{"zhihu://answers/123", "answer", "123"}, {"https://www.zhihu.com/question/1/answer/2", "answer", "2"},
		{"https://zhuanlan.zhihu.com/p/3", "article", "3"}, {"https://www.zhihu.com/pin/4", "pin", "4"},
		{"https://zhihu.com.evil.example/answer/1", "", ""}, {"javascript:alert(1)", "", ""},
	} {
		kind, id, _ := historyContent("", "", tc.action)
		if kind != tc.kind || id != tc.id {
			t.Fatalf("%s parsed as %s:%s", tc.action, kind, id)
		}
	}
}
