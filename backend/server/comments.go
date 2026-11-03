package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

func getAnswerComments(ctx context.Context, client *http.Client, cookie, id, cursor string) (CommentPage, error) {
	return loadComments(ctx, client, cookie, zhihuContentURL("answer", id), "/api/v4/comment_v5/answers/"+id+"/root_comment", "?order_by=score&limit=20", cursor, "知乎返回了无效的评论分页地址", "无法解析评论列表")
}

func getArticleComments(ctx context.Context, client *http.Client, cookie, id, cursor string) (CommentPage, error) {
	return loadComments(ctx, client, cookie, zhihuContentURL("article", id), "/api/v4/comment_v5/articles/"+id+"/root_comment", "?order_by=score&limit=20", cursor, "知乎返回了无效的文章评论分页地址", "无法解析文章评论")
}

func loadComments(ctx context.Context, client *http.Client, cookie, referer, basePath, query, cursor, invalidCursor, parseError string) (CommentPage, error) {
	endpoint := "https://www.zhihu.com" + basePath + query
	if cursor != "" {
		resolved, err := checkedZhihuCursor(cursor, "www.zhihu.com", basePath, invalidCursor)
		if err != nil {
			return CommentPage{}, err
		}
		endpoint = resolved
	}
	b, err := zhihuWebGet(ctx, client, cookie, referer, endpoint)
	if err != nil {
		return CommentPage{}, err
	}
	var raw commentsResponse
	if err = json.Unmarshal(b, &raw); err != nil {
		return CommentPage{}, fmt.Errorf("%s：%w", parseError, err)
	}
	if raw.Data == nil {
		return CommentPage{}, fmt.Errorf("知乎列表响应缺少 data 字段")
	}
	page := commentPageFromResponse(raw)
	if page.NextCursor == endpoint {
		page.NextCursor = ""
		page.HasMore = false
	}
	return page, nil
}

func commentPageFromResponse(raw commentsResponse) CommentPage {
	out := make([]Comment, 0, len(raw.Data))
	for _, c := range raw.Data {
		if validID(rawID(c.ID)) {
			out = append(out, mapComment(c))
		}
	}
	// Zhihu may leave a next URL on the terminal page; is_end is authoritative.
	hasMore := !raw.Paging.IsEnd && raw.Paging.Next != ""
	nextCursor := raw.Paging.Next
	if !hasMore {
		nextCursor = ""
	}
	return CommentPage{Items: out, NextCursor: nextCursor, HasMore: hasMore}
}

func mapComment(c commentResponse) Comment {
	author, avatar := c.Author.Name, c.Author.Avatar
	if author == "" {
		author = c.Author.Member.Name
	}
	if avatar == "" {
		avatar = c.Author.Member.Avatar
	}
	likes := c.VoteCount
	if c.LikeCount != nil {
		likes = *c.LikeCount
	}
	replyCount := c.ChildCommentCount
	if replyCount == 0 {
		replyCount = c.RepliesCount
	}
	item := Comment{ID: rawID(c.ID), Content: plainText(c.Content), ContentHTML: c.Content, Author: author, Avatar: avatar, CreatedAt: formatUnix(c.CreatedTime), LikeCount: likes, ReplyCount: replyCount}
	// Inline child_comments are selected previews, not a prefix of the child
	// endpoint's pagination order. Mixing them with a cursor page can skip or
	// repeat replies. Load the reply list only through its own paginated endpoint.
	item.RepliesHasMore = item.ReplyCount > 0
	if item.RepliesHasMore {
		item.RepliesCursor = "https://www.zhihu.com/api/v4/comment_v5/comment/" + item.ID + "/child_comment?" + url.Values{"offset": {"0"}, "limit": {"10"}}.Encode()
	}
	return item
}

func getCommentReplies(ctx context.Context, client *http.Client, cookie, contentType, contentID, commentID, cursor string) (CommentPage, error) {
	return loadComments(ctx, client, cookie, zhihuContentURL(contentType, contentID), "/api/v4/comment_v5/comment/"+commentID+"/child_comment", "?limit=10&offset=0", cursor, "知乎返回了无效的子评论分页地址", "无法解析评论回复")
}
