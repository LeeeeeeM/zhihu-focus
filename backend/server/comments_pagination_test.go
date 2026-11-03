package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
)

func TestReplyPagesDoNotMixNonPrefixPreviews(t *testing.T) {
	for _, total := range []int{3, 12} {
		t.Run(strconv.Itoa(total), func(t *testing.T) {
			calls, replyCalls := 0, 0
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				calls++
				var payload any
				if strings.HasSuffix(r.URL.Path, "/root_comment") {
					payload = map[string]any{"data": []any{map[string]any{
						"id": "100", "child_comment_count": total,
						"child_comment_next_offset": "preview-boundary",
						"child_comments":            []any{map[string]any{"id": strconv.Itoa(total)}, map[string]any{"id": "2"}},
					}}, "paging": map[string]any{"is_end": true}}
				} else {
					expectedOffset := "0"
					if replyCalls > 0 {
						expectedOffset = "next-page"
					}
					if r.URL.Query().Get("offset") != expectedOffset || r.URL.Query().Get("limit") != "10" {
						t.Fatalf("wrong continuation: %s", r.URL)
					}
					start := replyCalls*10 + 1
					end := min(start+9, total)
					items := []any{}
					for id := start; id <= end; id++ {
						items = append(items, map[string]any{"id": strconv.Itoa(id), "content": fmt.Sprintf("reply %d", id)})
					}
					replyCalls++
					payload = map[string]any{"data": items, "paging": map[string]any{
						"is_end": end == total,
						"next":   "https://www.zhihu.com/api/v4/comment_v5/comment/100/child_comment?limit=10&offset=next-page",
					}}
				}
				body, _ := json.Marshal(payload)
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body)))}, nil
			})}
			roots, err := getAnswerComments(context.Background(), client, "d_c0=fixture", "1", "")
			if err != nil {
				t.Fatal(err)
			}
			root := roots.Items[0]
			if len(root.Replies) != 0 || !root.RepliesHasMore {
				t.Fatalf("preview was treated as a loaded page: %#v", root)
			}
			cursor := root.RepliesCursor
			all := []Comment{}
			for {
				before := calls
				page, err := getCommentReplies(context.Background(), client, "d_c0=fixture", "answer", "1", root.ID, cursor)
				if err != nil {
					t.Fatal(err)
				}
				if calls != before+1 {
					t.Fatal("one page request made multiple upstream calls")
				}
				all = append(all, page.Items...)
				if !page.HasMore {
					if page.NextCursor != "" {
						t.Fatal("terminal page retained a continuation")
					}
					break
				}
				cursor = page.NextCursor
			}
			if len(all) != total || replyCalls != (total+9)/10 {
				t.Fatalf("missing or repeated replies: items=%d requests=%d", len(all), replyCalls)
			}
			for i, item := range all {
				if item.ID != strconv.Itoa(i+1) {
					t.Fatalf("reply skipped or repeated at %d: %s", i, item.ID)
				}
			}
		})
	}
}

func TestCommentContinuationUsesTerminalFlagAndActualRequestURL(t *testing.T) {
	const firstURL = "https://www.zhihu.com/api/v4/comment_v5/answers/1/root_comment?order_by=score&limit=20"
	const nextURL = "https://www.zhihu.com/api/v4/comment_v5/answers/1/root_comment?limit=20&offset=opaque"
	for _, tc := range []struct {
		name, cursor, next string
		isEnd, hasMore     bool
	}{
		{"first-page self link", "", firstURL, false, false},
		{"continuation self link", nextURL, nextURL, false, false},
		{"terminal page with leftover next", "", nextURL, true, false},
		{"missing next", "", "", false, false},
		{"empty page with advancing cursor", "", nextURL, false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body, err := json.Marshal(map[string]any{"data": []any{}, "paging": map[string]any{"next": tc.next, "is_end": tc.isEnd}})
			if err != nil {
				t.Fatal(err)
			}
			page, err := getAnswerComments(context.Background(), fixtureClient(string(body)), "d_c0=fixture", "1", tc.cursor)
			if err != nil {
				t.Fatal(err)
			}
			if page.HasMore != tc.hasMore {
				t.Fatalf("unexpected paging: %#v", page)
			}
			if tc.hasMore && page.NextCursor != tc.next || !tc.hasMore && page.NextCursor != "" {
				t.Fatalf("cursor disagrees with hasMore: %#v", page)
			}
		})
	}
}
