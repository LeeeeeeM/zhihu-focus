package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func replyIDs(start, end int) []string {
	ids := []string{}
	for i := start; i <= end; i++ {
		ids = append(ids, strconv.Itoa(i))
	}
	return ids
}

func TestReplyAPIReconcilesTotalsWithoutFilteringOrProbing(t *testing.T) {
	ptr := func(i int) *int { return &i }
	for _, tc := range []struct {
		name                      string
		items, loaded             []string
		total, pagingTotal, known *int
		isEnd, hasMore            bool
	}{
		{name: "ten replies on a full terminal page", items: replyIDs(1, 10), total: ptr(10), known: ptr(10)},
		{name: "first of two full pages", items: replyIDs(1, 10), total: ptr(20), hasMore: true},
		{name: "second full page", items: replyIDs(11, 20), loaded: replyIDs(1, 10), total: ptr(20)},
		{name: "partial final page", items: replyIDs(21, 25), loaded: replyIDs(1, 20), total: ptr(25)},
		{name: "overlap does not overcount progress", items: replyIDs(10, 19), loaded: replyIDs(1, 10), total: ptr(20), hasMore: true},
		{name: "duplicate rows retained", items: []string{"1", "1", "2"}, total: ptr(2)},
		{name: "fresh reply total overrides parent snapshot", items: replyIDs(1, 10), total: ptr(11), known: ptr(10), hasMore: true},
		{name: "observably stale total", items: replyIDs(1, 10), total: ptr(3), hasMore: true},
		{name: "paging totals fallback", items: replyIDs(1, 10), pagingTotal: ptr(10)},
		{name: "known total fallback", items: replyIDs(1, 10), known: ptr(10)},
		{name: "unknown total uses upstream cursor", items: replyIDs(1, 10), hasMore: true},
		{name: "upstream end wins over larger total", items: replyIDs(1, 2), total: ptr(10), isEnd: true},
		{name: "zero is a known total", total: ptr(0)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				calls++
				if r.Method != http.MethodGet || r.URL.Query().Get("limit") != "10" || r.URL.Query().Get("loadedIds") != "" {
					t.Fatalf("progress leaked into upstream request: %s %s", r.Method, r.URL)
				}
				data := []any{}
				for _, id := range tc.items {
					data = append(data, map[string]any{"id": id, "content": "reply"})
				}
				body, _ := json.Marshal(map[string]any{"data": data, "counts": map[string]any{"total_counts": tc.total}, "paging": map[string]any{"totals": tc.pagingTotal, "is_end": tc.isEnd, "next": "https://www.zhihu.com/api/v4/comment_v5/comment/100/child_comment?limit=10&offset=next-page"}})
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body)))}, nil
			})}
			body, _ := json.Marshal(replyProgress{LoadedIDs: tc.loaded, KnownTotal: tc.known})
			r := httptest.NewRequest(http.MethodPost, "/api/comment-replies?type=answer&contentId=1&commentId=100", strings.NewReader(string(body)))
			r.Header.Set("X-Zhihu-Cookie", "d_c0=fixture")
			w := httptest.NewRecorder()
			newAPIHandler(Config{}, client).ServeHTTP(w, r)
			if w.Code != 200 || calls != 1 {
				t.Fatalf("status=%d upstream calls=%d response=%s", w.Code, calls, w.Body.String())
			}
			var page CommentPage
			if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil {
				t.Fatal(err)
			}
			if page.HasMore != tc.hasMore || (page.NextCursor != "") != tc.hasMore {
				t.Fatalf("wrong continuation: %#v", page)
			}
			if len(page.Items) != len(tc.items) {
				t.Fatal("reply items were filtered")
			}
			for i, item := range page.Items {
				if item.ID != tc.items[i] {
					t.Fatal("reply order changed")
				}
			}
			expected := tc.total
			if expected == nil {
				expected = tc.pagingTotal
			}
			if expected == nil {
				expected = tc.known
			}
			if (page.TotalCount == nil) != (expected == nil) || expected != nil && *page.TotalCount != *expected {
				t.Fatalf("wrong total: %#v", page)
			}
		})
	}
}

func TestReplyProgressValidationPrecedesUpstreamRequest(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("invalid progress reached upstream")
		return nil, nil
	})}
	handler := newAPIHandler(Config{}, client)
	for _, body := range []string{`{`, `{"knownTotal":-1}`, `{"loadedIds":["invalid"]}`, `{"loadedIds":[1]}`, `{"loadedIds":[]} {}`, `{"unknown":1}`} {
		r := httptest.NewRequest(http.MethodPost, "/api/comment-replies?type=answer&contentId=1&commentId=100", strings.NewReader(body))
		r.Header.Set("X-Zhihu-Cookie", "d_c0=fixture")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("accepted invalid progress %s: %d", body, w.Code)
		}
	}
	r := httptest.NewRequest(http.MethodPost, "/api/comment-replies?type=answer&contentId=1&commentId=100", strings.NewReader(`{"loadedIds":[]}`))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated progress accepted: %d", w.Code)
	}
}

func TestReplyGETCompatibilityUsesCurrentTotal(t *testing.T) {
	client := fixtureClient(`{"counts":{"total_counts":1},"data":[{"id":"2"}],"paging":{"is_end":false,"next":"https://www.zhihu.com/api/v4/comment_v5/comment/100/child_comment?limit=10&offset=next"}}`)
	r := httptest.NewRequest(http.MethodGet, "/api/comment-replies?type=answer&contentId=1&commentId=100", nil)
	r.Header.Set("X-Zhihu-Cookie", "d_c0=fixture")
	w := httptest.NewRecorder()
	newAPIHandler(Config{}, client).ServeHTTP(w, r)
	var page CommentPage
	if w.Code != 200 {
		t.Fatalf("legacy GET failed: %d", w.Code)
	}
	if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if page.HasMore || page.NextCursor != "" || len(page.Items) != 1 {
		t.Fatalf("wrong legacy page: %#v", page)
	}
}

func TestOptionalReplyTotalsCannotBreakAnOtherwiseValidPage(t *testing.T) {
	for _, counts := range []string{`"unknown"`, `-1`, `1.5`, `{}`, `null`} {
		raw := `{"counts":{"total_counts":` + counts + `},"data":[{"id":"2"}],"paging":{"totals":1,"is_end":false,"next":"https://www.zhihu.com/api/v4/comment_v5/comment/100/child_comment?limit=10&offset=next"}}`
		r := httptest.NewRequest(http.MethodGet, "/api/comment-replies?type=answer&contentId=1&commentId=100", nil)
		r.Header.Set("X-Zhihu-Cookie", "d_c0=fixture")
		w := httptest.NewRecorder()
		newAPIHandler(Config{}, fixtureClient(raw)).ServeHTTP(w, r)
		var page CommentPage
		if w.Code != 200 {
			t.Fatalf("optional count broke valid data: %s: %s", counts, w.Body.String())
		}
		if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		if page.TotalCount == nil || *page.TotalCount != 1 || page.HasMore {
			t.Fatalf("did not use valid fallback: %#v", page)
		}
	}
}
