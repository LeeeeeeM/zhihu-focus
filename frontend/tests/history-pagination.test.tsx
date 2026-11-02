import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('history follows shared auto-load, pauses duplicate pages, and supports retry after failure', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/history' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let observer: { callback: IntersectionObserverCallback; disconnect(): void } | undefined;
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
    Node: dom.window.Node, ShadowRoot: dom.window.ShadowRoot, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) { this.callback = callback; observer = this; }
      observe() {} disconnect() {}
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(dom.window, 'scrollTo', { value: () => {} });
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  const previousFetch = globalThis.fetch;
  let requests = 0;
  const item = (id: string) => ({ id, kind: 'answer', title: `历史 ${id}`, excerpt: '', author: '', time: '', url: `https://www.zhihu.com/answer/${id}` });
  globalThis.fetch = async () => {
    requests++;
    if (requests === 4) return Response.json({ error: '分页暂不可用' }, { status: 502 });
    const id = requests === 1 ? '1' : requests < 5 ? '2' : '3';
    return Response.json({ items: [item(id)], nextCursor: requests < 5 ? `page-${requests + 1}` : '', hasMore: requests < 5 });
  };
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  const { useHistoryStore } = await import('../src/store/useHistoryStore');
  const { useZhihuStore } = await import('../src/store/useZhihuStore');
  const { default: HistoryPage } = await import('../src/pages/HistoryPage');
  useHistoryStore.getState().reset();
  useZhihuStore.setState({ autoLoad: true });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const intersect = (target = observer!) => target.callback([{ isIntersecting: true } as IntersectionObserverEntry], target as unknown as IntersectionObserver);
  try {
    await act(async () => root.render(<MemoryRouter><HistoryPage/></MemoryRouter>));
    assert.equal(requests, 1);
    assert.equal(observer, undefined, 'entering the tab alone does not start scanning pages');
    Object.defineProperty(dom.window, 'scrollY', { value: 120, configurable: true });
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('scroll')); });
    assert.ok(observer);
    const oldObserver = observer!;
    await act(async () => { useZhihuStore.setState({ autoLoad: false }); });
    await act(async () => { intersect(oldObserver); });
    assert.equal(requests, 1, 'queued callbacks stop after the shared switch is disabled');
    assert.ok(dom.window.document.querySelector('.load-more'));
    await act(async () => { useZhihuStore.setState({ autoLoad: true }); });
    await act(async () => { intersect(); });
    assert.equal(requests, 2);
    assert.equal(useHistoryStore.getState().items.length, 2);
    assert.ok(dom.window.document.querySelector('.load-sentinel'));
    await act(async () => { intersect(); });
    assert.equal(requests, 3);
    assert.ok(dom.window.document.querySelector('.load-more'), 'a duplicate-only page falls back to manual loading');
    await act(async () => { intersect(); });
    assert.equal(requests, 3, 'the previous observer cannot keep loading duplicate pages');
    await act(async () => { dom.window.document.querySelector<HTMLButtonElement>('.load-more')!.click(); });
    assert.equal(requests, 4);
    assert.equal(useHistoryStore.getState().items.length, 2, 'failure preserves cached records');
    assert.match(dom.window.document.body.textContent!, /重试加载/);
    await act(async () => { dom.window.document.querySelector<HTMLButtonElement>('.load-more')!.click(); });
    assert.equal(requests, 5);
    assert.equal(useHistoryStore.getState().items.length, 3);
    assert.equal(useHistoryStore.getState().hasMore, false);
  } finally {
    await act(async () => root.unmount());
    useHistoryStore.getState().reset();
    globalThis.fetch = previousFetch;
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
