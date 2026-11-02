import type { RefObject } from 'react';
import { Button, Spin } from 'antd';

type Props = {
  hasMore: boolean;
  automatic: boolean;
  sentinel: RefObject<HTMLDivElement | null>;
  moreLoading: boolean;
  blocked?: boolean;
  idleText: string;
  loadingText: string;
  buttonText: string;
  buttonClassName?: string;
  showEnd?: boolean;
  onLoadMore: () => void;
};

export function LoadMoreFooter({ hasMore, automatic, sentinel, moreLoading, blocked = false, idleText, loadingText, buttonText, buttonClassName = 'load-more', showEnd = false, onLoadMore }: Props) {
  return <>
    {hasMore && !blocked && (automatic
      ? <div className="load-sentinel" ref={sentinel} aria-live="polite">{moreLoading ? <><Spin size="small"/> {loadingText}</> : idleText}</div>
      : <Button className={buttonClassName} type="text" onClick={onLoadMore} loading={moreLoading}>{buttonText}　↓</Button>)}
    {showEnd && <div className="feed-end">已经到底了</div>}
  </>;
}
