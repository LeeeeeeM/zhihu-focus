package main

import (
	"encoding/json"
	"io"
	"net/http"
)

// POST accepts reading progress; GET remains available for existing clients.
func commentRepliesHandler(client *http.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, ok := requireZhihuCookie(w, r, "读取评论回复需要在知简设置中配置知乎 Cookie")
		if !ok {
			return
		}
		contentType, contentID, commentID := r.URL.Query().Get("type"), r.URL.Query().Get("contentId"), r.URL.Query().Get("commentId")
		if (contentType != "answer" && contentType != "article") || !validID(contentID) || !validID(commentID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的内容或评论 ID"})
			return
		}
		var progress replyProgress
		if r.Method == http.MethodPost {
			// A body keeps long reply-ID lists out of URL/header size limits.
			decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&progress); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的回复加载进度"})
				return
			}
			if err := decoder.Decode(new(any)); err != io.EOF {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的回复加载进度"})
				return
			}
		}
		if progress.KnownTotal != nil && *progress.KnownTotal < 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的回复总数"})
			return
		}
		for _, id := range progress.LoadedIDs {
			if !validID(id) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的已加载回复 ID"})
				return
			}
		}
		page, err := getCommentReplies(r.Context(), client, cookie, contentType, contentID, commentID, r.URL.Query().Get("cursor"), progress)
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	}
}
