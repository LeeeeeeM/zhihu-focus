import { useEffect } from 'react';
import { Avatar, Button, Empty, Spin, Tag } from 'antd';
import { ArrowLeft, ArrowRight, ExternalLink, MessageCircle, Users } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useZhihuStore } from '../store/useZhihuStore';

export default function QuestionPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from?.startsWith('/') ? from : '/recommend';
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

  useEffect(() => { if (id) void loadQuestion(id); }, [id, loadQuestion]);

  return <div className="question-page">
    <Link className="back-button question-back" to={backTo}><ArrowLeft size={16}/>返回上一页</Link>
    {questionError && <div className="error-notice">{questionError} <Button type="link" onClick={() => void loadQuestion(id)}>重试</Button></div>}
    {questionLoading && !question ? <div className="loading-state"><Spin/><span>正在读取知乎问题…</span></div> : question && <>
      <section className="question-heading">
        <div className="eyebrow"><span className="eyebrow-line"/> ZHIHU QUESTION</div>
        <h1>{question.title}</h1>
        <div className="question-stats">
          {question.author && <span>提问者：{question.author}</span>}
          <span>{question.answerCount.toLocaleString()} 个回答</span>
          <span><Users size={14}/>{question.followerCount.toLocaleString()} 人关注</span>
          <span><MessageCircle size={14}/>{question.commentCount.toLocaleString()} 条评论</span>
        </div>
        {question.detail && <p className="question-description">{question.detail}</p>}
        {question.topics.length > 0 && <div className="question-topics">{question.topics.map(topic => <Tag key={topic}>{topic}</Tag>)}</div>}
      </section>
      <div className="question-answers-heading"><div><div className="eyebrow small">ANSWERS</div><h2>问题下的回答</h2></div><span>{question.answerCount.toLocaleString()} 个回答</span></div>
      {answersError && <div className="error-notice">{answersError}</div>}
      {answersLoading && answers.length === 0 ? <div className="loading-state"><Spin/><span>正在加载回答…</span></div> : answers.length
        ? <div className="question-answer-list">{answers.map((answer, index) => <article className="question-answer-card" key={answer.id}>
          <div className="answer-index">{index + 1}</div>
          <div className="question-answer-main">
            <div className="question-answer-meta"><Avatar size={25} src={answer.avatar}>{answer.author?.slice(0, 1) || '知'}</Avatar><b>{answer.author || '知乎用户'}</b><span>{answer.createdAt}</span><span>{answer.voteUpCount.toLocaleString()} 赞同</span></div>
            <p>{answer.excerpt || '打开查看完整回答'}</p>
            <div className="question-answer-actions">
              <Button type="link" onClick={() => void openContent('answer', answer.id)}>阅读回答与评论 <ArrowRight size={14}/></Button>
              <a href={`https://www.zhihu.com/answer/${answer.id}`} target="_blank" rel="noopener noreferrer">查看原文 <ExternalLink size={13}/></a>
            </div>
          </div>
        </article>)}</div>
        : !answersError && <Empty className="page-empty" description="这个问题暂时没有可展示的回答"/>}
      {hasMore && <Button className="load-question-answers" type="text" onClick={() => void loadMore()} loading={moreLoading}>继续加载回答　↓</Button>}
    </>}
    {!questionLoading && !question && !questionError && <Empty className="page-empty" description="暂时无法读取这个问题"/>}
    <footer className="footnote">知简 · 为专注阅读而做 <span>真实知乎数据</span></footer>
  </div>;
}
