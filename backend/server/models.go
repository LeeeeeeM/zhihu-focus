package main

import "encoding/json"

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
	ContentHTML  string `json:"contentHtml,omitempty"`
	Author       string `json:"author"`
	Avatar       string `json:"avatar"`
	CreatedAt    string `json:"createdAt"`
	VoteUpCount  int    `json:"voteUpCount"`
	CommentCount int    `json:"commentCount"`
	URL          string `json:"url"`
}
type QuestionInfo struct {
	MetadataLimited bool     `json:"metadataLimited,omitempty"`
	ID              string   `json:"id"`
	Title           string   `json:"title"`
	Detail          string   `json:"detail"`
	DetailHTML      string   `json:"detailHtml,omitempty"`
	Author          string   `json:"author"`
	CreatedAt       string   `json:"createdAt"`
	UpdatedAt       string   `json:"updatedAt"`
	AnswerCount     int      `json:"answerCount"`
	FollowerCount   int      `json:"followerCount"`
	CommentCount    int      `json:"commentCount"`
	Topics          []string `json:"topics"`
	URL             string   `json:"url"`
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
	ContentHTML    string    `json:"contentHtml,omitempty"`
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
}

type apiStatusError struct {
	status  int
	message string
}

func (e *apiStatusError) Error() string { return e.message }

func newAPIStatusError(status int, message string) error {
	return &apiStatusError{status: status, message: message}
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
type commentAuthor struct {
	Name   string `json:"name"`
	Avatar string `json:"avatar_url"`
	Member struct {
		Name   string `json:"name"`
		Avatar string `json:"avatar_url"`
	} `json:"member"`
}
type commentResponse struct {
	ID                     json.RawMessage   `json:"id"`
	Content                string            `json:"content"`
	CreatedTime            int64             `json:"created_time"`
	VoteCount              int               `json:"vote_count"`
	LikeCount              *int              `json:"like_count"`
	ChildCommentCount      int               `json:"child_comment_count"`
	RepliesCount           int               `json:"replies_count"`
	ChildCommentNextOffset json.RawMessage   `json:"child_comment_next_offset"`
	Author                 commentAuthor     `json:"author"`
	ChildComments          []commentResponse `json:"child_comments"`
}
type commentsResponse struct {
	Data   []commentResponse `json:"data"`
	Paging struct {
		Next  string `json:"next"`
		IsEnd bool   `json:"is_end"`
	} `json:"paging"`
}
