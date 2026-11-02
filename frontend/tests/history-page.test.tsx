import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('history route shows its entry, opens content, and clears when the Cookie is removed', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/history' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator, Event: dom.window.Event,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
    Node: dom.window.Node, ShadowRoot: dom.window.ShadowRoot, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
  const scrolls: number[] = [];
  Object.defineProperty(dom.window, 'scrollTo', { value: (_x: number, y: number) => { scrolls.push(y); } });
  const previousFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  const { default: App } = await import('../src/pages/App');
  const { useZhihuStore } = await import('../src/store/useZhihuStore');
  const { useHistoryStore } = await import('../src/store/useHistoryStore');
  useHistoryStore.getState().reset();
  const { saveZhihuCookie, removeZhihuCookie } = await import('../src/services/searchCredential');
  const { historyChangedEvent } = await import('../src/services/zhihu');
  const opens: string[] = [];
  useZhihuStore.setState({ initialize: async () => {}, refreshFeed: async () => {}, searchQuery: '', openContent: async (kind, id) => { opens.push(`${kind}:${id}`); } });
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ items: [{ id: '123', kind: 'answer', title: '读过的回答', excerpt: '摘要', author: '作者', time: '2026-11-02 10:00', url: 'https://www.zhihu.com/answer/123' }], hasMore: false });
  };
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/history']}><App/></MemoryRouter>));
    assert.ok(dom.window.document.querySelector('a[aria-label="浏览历史"][href="/history"]'));
    assert.match(dom.window.document.body.textContent!, /请先在设置中配置知乎 Cookie/);
    assert.equal(requests, 0);
    await act(async () => { saveZhihuCookie('d_c0=fixture'); });
    assert.match(dom.window.document.body.textContent!, /读过的回答/);
    const title = dom.window.document.querySelector<HTMLButtonElement>('.history-page .content-title-button')!;
    await act(async () => title.click());
    assert.deepEqual(opens, ['answer:123']);
    const requestsBeforeSave = requests;
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event(historyChangedEvent)); });
    assert.equal(requests, requestsBeforeSave, 'save notifications must not refetch the list');
    await act(async () => {
      useHistoryStore.setState({ cursor: 'saved-next', hasMore: true });
      Object.defineProperty(dom.window, 'scrollY', { value: 480, configurable: true });
      dom.window.dispatchEvent(new dom.window.Event('scroll'));
      dom.window.document.querySelector<HTMLAnchorElement>('a[aria-label="搜索"]')!.click();
    });
    assert.equal(useHistoryStore.getState().items[0].id, '123', 'unmount preserves cached records');
    assert.equal(useHistoryStore.getState().cursor, 'saved-next');
    assert.equal(useHistoryStore.getState().scrollY, 480);
    await act(async () => dom.window.document.querySelector<HTMLAnchorElement>('a[aria-label="浏览历史"]')!.click());
    assert.equal(requests, requestsBeforeSave, 'returning to history must reuse Zustand state');
    assert.equal(scrolls.at(-1), 480, 'returning restores the history scroll position');
    assert.match(dom.window.document.body.textContent!, /读过的回答/);
    await act(async () => {
      useHistoryStore.getState().recordSaved('d_c0=fixture', { id: '456', kind: 'answer', title: '新读的回答', excerpt: '', author: '', time: '', url: 'https://www.zhihu.com/answer/456' });
    });
    assert.match(dom.window.document.body.textContent!, /新读的回答/);
    assert.equal(useHistoryStore.getState().cursor, 'saved-next', 'saving a record preserves pagination');
    assert.equal(requests, requestsBeforeSave);
    await act(async () => dom.window.document.querySelector<HTMLAnchorElement>('a[aria-label="搜索"]')!.click());
    await act(async () => { removeZhihuCookie(); });
    assert.deepEqual(useHistoryStore.getState().items, [], 'clearing Cookie invalidates history while its page is unmounted');
    await act(async () => dom.window.document.querySelector<HTMLAnchorElement>('a[aria-label="浏览历史"]')!.click());
    assert.doesNotMatch(dom.window.document.body.textContent!, /读过的回答/);
    assert.match(dom.window.document.body.textContent!, /请先在设置中配置知乎 Cookie/);
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
