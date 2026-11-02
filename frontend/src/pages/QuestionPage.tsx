import { useEffect } from 'react';
import { Button, Empty, Spin, Tag } from 'antd';
import { ExternalLink, MessageCircle, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ContentTabLink } from '../components/ContentTabLink';
import { useZhihuStore } from '../store/useZhihuStore';
import { useAutoLoad } from '../hooks/useAutoLoad';
import { RichContent } from '../components/RichContent';
import { UserAvatar } from '../components/UserAvatar';

export default function QuestionPage() {
  const { id = '' } = useParams();
  const questionId = useZhihuStore(state => state.questionId);
  const question = useZhihuStore(state => state.question);
  const questionLoading = useZhihuStore(state => state.questionLoading);
  const questionError = useZhihuStore(state => state.questionError);
  const answers = useZhihuStore(state => state.questionAnswers);
  const answersLoading = useZhihuStore(state => state.questionAnswersLoading);
  const answersError = useZhihuStore(state => state.questionAnswersError);
  const hasMore = useZhihuStore(state => state.questionAnswersHasMore);
  const moreLoading = useZhihuStore(state => state.questionAnswersMoreLoading);
  const loadQuestion = useZhihuStore(state => state.loadQuestion);
  const loadMore = useZhihuStore(state => state.loadMoreQuestionAnswers);
  const openContent = useZhihuStore(state => state.openContent);
  const { sentinel: loadSentinel, automatic } = useAutoLoad({ hasItems: answers.length > 0, hasMore: hasMore && questionId === id, loading: answersLoading, moreLoading, error: answersError, resetKey: id, loadMore });
  useEffect(() => {
    window.scrollTo(0, 0);
    if (id) void loadQuestion(id);
  }, [id, loadQuestion]);

  return <div className="question-page">
    {questionError && <div className="error-notice">{questionError} <a href={`https://www.zhihu.com/question/${id}`} target="_blank" rel="noopener noreferrer">查看知乎原页</a> <Button type="link" onClick={() => void loadQuestion(id)}>重试</Button></div>}
    {questionLoading && !question ? <div className="loading-state"><Spin/><span>正在读取知乎问题…</span></div> : question && <>
      <section className="question-heading">
        <div className="eyebrow"><span className="eyebrow-line"/> ZHIHU QUESTION</div>
        <h1>{question.title}</h1>
        <div className="question-stats">
          {question.author && <span>提问者：{question.author}</span>}
          {!question.metadataLimited && <>
            <span>{question.answerCount.toLocaleString()} 个回答</span>
            <span><Users size={14}/>{question.followerCount.toLocaleString()} 人关注</span>
            <span><MessageCircle size={14}/>{question.commentCount.toLocaleString()} 条评论</span>
          </>}
        </div>
        {question.metadataLimited && <p className="question-metadata-notice">问题补充说明及统计信息暂不可用。</p>}
        {(question.detailHtml || question.detail) && <RichContent className="question-description" html={question.detailHtml} text={question.detail}/>}
        {question.topics.length > 0 && <div className="question-topics">{question.topics.map(topic => <Tag key={topic}>{topic}</Tag>)}</div>}
        {question.metadataLimited && <div className="question-source-actions">
          <a className="source-link" href={question.url} target="_blank" rel="noopener noreferrer">在知乎打开原文 <ExternalLink size={14}/></a>
        </div>}
      </section>
    </>}
    <>
      <div className="question-answers-heading"><div><div className="eyebrow small">ANSWERS</div><h2>问题下的回答</h2></div>{question && !question.metadataLimited && <span>{question.answerCount.toLocaleString()} 个回答</span>}</div>
      {answersError && <div className="error-notice">{answersError}</div>}
      {answersLoading && answers.length === 0 ? <div className="loading-state"><Spin/><span>正在加载回答…</span></div> : answers.length
        ? <div className="question-answer-list">{answers.map((answer, index) => <article className="question-answer-card" key={answer.id}>
          <button className="question-answer-open" type="button" aria-label={`阅读${answer.author || '知乎用户'}的回答与评论`} onClick={() => void openContent('answer', answer.id)}/>
          <div className="answer-index">{index + 1}</div>
          <div className="question-answer-main">
            <div className="question-answer-meta"><UserAvatar size={25} src={answer.avatar} name={answer.author}/><b>{answer.author || '知乎用户'}</b><span>{answer.createdAt}</span><span>{answer.voteUpCount.toLocaleString()} 赞同 · {answer.commentCount.toLocaleString()} 评论</span></div>
            <p>{answer.excerpt || '打开查看完整回答'}</p>
            <div className="question-answer-actions">
              <ContentTabLink type="answer" id={answer.id}/>
              <a href={`https://www.zhihu.com/answer/${answer.id}`} target="_blank" rel="noopener noreferrer">查看原文 <ExternalLink size={13}/></a>
            </div>
          </div>
        </article>)}</div>
        : !answersError && !questionLoading && <Empty className="page-empty" description="这个问题暂时没有可展示的回答"/>}
      {hasMore && (automatic
        ? <div className="load-sentinel" ref={loadSentinel} aria-live="polite">{moreLoading ? <><Spin size="small"/> 正在加载更多回答…</> : '继续向下滚动以加载'}</div>
        : <Button className="load-question-answers" type="text" onClick={() => void loadMore()} loading={moreLoading}>继续加载回答　↓</Button>)}
    </>
    {!questionLoading && !question && !questionError && <Empty className="page-empty" description="暂时无法读取这个问题"/>}
  </div>;
}
