package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

func newAPIHandler(cfg Config, client *http.Client) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/read", readReportHandler(client))
	mux.HandleFunc("GET /api/history", historyHandler(client))
	mux.HandleFunc("POST /api/history", readingWriteHandler(client, addHistory))
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "configured": map[string]bool{"search": cfg.AccessSecret != ""}})
	})
	mux.HandleFunc("GET /api/feed", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r)
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
		cookie := requestZhihuCookie(r)
		if cookie == "" {
			apiError(w, newAPIStatusError(http.StatusUnauthorized, "读取详情需要在知简设置中配置知乎 Cookie"))
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
			apiError(w, newAPIStatusError(http.StatusBadRequest, "不支持的知乎内容类型"))
			return
		}
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, item)
	})
	mux.HandleFunc("GET /api/comments", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r)
		if cookie == "" {
			apiError(w, newAPIStatusError(http.StatusUnauthorized, "读取评论需要在知简设置中配置知乎 Cookie"))
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
			apiError(w, newAPIStatusError(http.StatusBadRequest, "不支持的知乎内容类型"))
			return
		}
		if err != nil {
			apiError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	})
	mux.HandleFunc("GET /api/question", func(w http.ResponseWriter, r *http.Request) {
		cookie := requestZhihuCookie(r)
		if cookie == "" {
			apiError(w, newAPIStatusError(http.StatusUnauthorized, "读取问题需要在知简设置中配置知乎 Cookie"))
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
		cookie := requestZhihuCookie(r)
		if cookie == "" {
			apiError(w, newAPIStatusError(http.StatusUnauthorized, "读取问题回答需要在知简设置中配置知乎 Cookie"))
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
		cookie := requestZhihuCookie(r)
		if cookie == "" {
			apiError(w, newAPIStatusError(http.StatusUnauthorized, "读取评论回复需要在知简设置中配置知乎 Cookie"))
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
	return withCORS(mux)
}

func requestZhihuCookie(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get("X-Zhihu-Cookie"))
}

func apiError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	var statusErr *apiStatusError
	if errors.As(err, &statusErr) {
		status = statusErr.status
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Zhihu-Cookie")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
