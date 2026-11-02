import { Button, Empty, Spin, Typography } from 'antd';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useZhihuStore } from '../store/useZhihuStore';
import type { CommentItem } from '../models/content';
import { RichContent } from './RichContent';
import { UserAvatar } from './UserAvatar';

const { Title } = Typography;

export function ContentReader() {
  const type = useZhihuStore(state => state.contentType);
  const readerMode = useZhihuStore(state => state.readerMode);
  const contentId = useZhihuStore(state => state.contentId);
  const detail = useZhihuStore(state => state.detail);
  const detailLoading = useZhihuStore(state => state.detailLoading);
  const detailError = useZhihuStore(state => state.detailError);
  const readingReportError = useZhihuStore(state => state.readingReportError);
  const historyWriteError = useZhihuStore(state => state.historyWriteError);
  const comments = useZhihuStore(state => state.comments);
  const commentsLoading = useZhihuStore(state => state.commentsLoading);
  const commentsError = useZhihuStore(state => state.commentsError);
  const commentsHasMore = useZhihuStore(state => state.commentsHasMore);
  const commentsMoreLoading = useZhihuStore(state => state.commentsMoreLoading);
  const openContent = useZhihuStore(state => state.openContent);
  const loadMoreComments = useZhihuStore(state => state.loadMoreComments);
  return (
    <div className="drawer-content">
      {detailError && <div className="error-notice">{detailError} {type && contentId && <Button type="link" onClick={() => void openContent(type, contentId, readerMode === 'page' ? 'page' : 'drawer')}>重试</Button>}</div>}
      {detailLoading && !detail && <div className="drawer-loading"><Spin size="large"/><span>正在读取知乎内容…</span></div>}
      {detail && <article className="reader-article drawer-article">
        <div className="reader-kicker">知乎{type === 'article' ? '文章' : '回答'}</div>
        {type === 'answer' && detail.questionId
          ? <Link className="question-title-button" to={`/questions/${detail.questionId}`} target="_blank" rel="noopener noreferrer"><span>{detail.title}</span><small>查看问题与其他回答 <ArrowRight size={14}/></small></Link>
          : <Title level={2}>{detail.title}</Title>}
        <div className="reader-byline"><UserAvatar size={28} src={detail.avatar} name={detail.author}/><b>{detail.author || '知乎用户'}</b><span>{detail.createdAt}</span><span>{detail.voteUpCount.toLocaleString()} 赞同</span></div>
        <RichContent className="reader-body" html={detail.contentHtml} text={detail.content}/>
        {readingReportError && <div className="error-notice" role="status">已读状态未同步到知乎：{readingReportError}。下次打开时会重试。</div>}
        {historyWriteError && <div className="error-notice" role="status">浏览历史未保存到知乎：{historyWriteError}。下次打开时会重试。</div>}
        <a className="source-link" href={detail.url} target="_blank" rel="noopener noreferrer">在知乎打开原文 <ExternalLink size={14}/></a>
      </article>}
      {!detail && !detailLoading && !detailError && <Empty className="drawer-empty" description="暂时无法读取内容"/>}

      <section className="reader-comments">
        <div className="comments-heading"><div className="eyebrow small">COMMENTS</div><h2>评论（含回复）{detail ? ` · ${detail.commentCount.toLocaleString()}` : ''}</h2></div>
        {commentsError && <div className="error-notice">{commentsError}</div>}
        {commentsLoading && comments.length === 0 ? <div className="comments-loading"><Spin size="small"/> 正在读取评论…</div>
          : comments.length ? comments.map(comment => <Comment key={comment.id} item={comment}/>)
            : !commentsError && <Empty className="comments-empty" description="暂时没有评论"/>}
        {commentsHasMore && <Button className="load-comments" type="text" onClick={() => void loadMoreComments()} loading={commentsMoreLoading}>继续看评论　↓</Button>}
      </section>
    </div>
  );
}

function Comment({ item }: { item: CommentItem }) {
  const isLoadingReplies = useZhihuStore(state => state.commentRepliesLoading[item.id] || false);
  const repliesError = useZhihuStore(state => state.commentRepliesErrors[item.id] || '');
  const loadCommentReplies = useZhihuStore(state => state.loadCommentReplies);
  const replies = item.replies || [];
  const remainingReplies = Math.max(0, item.replyCount - replies.length);
  const canLoadReplies = item.repliesLoaded ? Boolean(item.repliesHasMore) : item.repliesHasMore || remainingReplies > 0;

  return <article className="comment">
    <UserAvatar size={26} src={item.avatar} name={item.author}/>
    <div className="comment-main"><div className="comment-meta"><b>{item.author || '知乎用户'}</b><span>{item.createdAt}</span></div>
      <RichContent className="comment-text" html={item.contentHtml} text={item.content}/>
      <div className="comment-stats">{item.likeCount.toLocaleString()} 赞同{item.replyCount ? ` · ${item.replyCount} 条回复` : ''}</div>
      {replies.map(reply => <div className="comment-reply" key={reply.id}><b>{reply.author || '知乎用户'}</b><RichContent className="comment-reply-text" html={reply.contentHtml} text={reply.content}/><span>{reply.createdAt}</span></div>)}
      {canLoadReplies && <div className="comment-replies-action"><Button type="link" size="small" onClick={() => void loadCommentReplies(item.id)} loading={isLoadingReplies}>
        {replies.length ? (remainingReplies ? `加载剩余 ${remainingReplies} 条回复` : '继续加载回复') : `查看 ${item.replyCount} 条回复`}
      </Button></div>}
      {repliesError && <div className="comment-replies-error">{repliesError}</div>}
    </div>
  </article>;
}
