import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('answer and article pages render the shared reader and sharing links preserve a deployment basename', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/zh/answers/201' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
    Node: dom.window.Node, ShadowRoot: dom.window.ShadowRoot, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(dom.window, 'scrollTo', { value: () => {} });
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
  const previousFetch = globalThis.fetch;
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'd_c0=fixture');
  let writes = 0, details = 0;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (init?.method === 'POST') { writes++; return Response.json({ success: true }); }
    if (path.startsWith('/api/comments')) return Response.json({ items: [{ id: '1', content: '评论正文', author: '评论作者', createdAt: '', likeCount: 0, replyCount: 0 }], hasMore: false });
    details++;
    return Response.json({ id: '201', questionId: '101', title: path.includes('type=article') ? '文章示例' : '回答示例', content: '正文内容', contentHtml: '<p>正文内容</p>', author: '作者', avatar: '', createdAt: '2026-11-02T08:00:00Z', voteUpCount: 3, commentCount: 1, url: 'https://www.zhihu.com/answer/201' });
  };
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { default: ContentPage } = await import('../src/pages/ContentPage');
  const { ContentTabLink } = await import('../src/components/ContentTabLink');
  const { useZhihuStore } = await import('../src/store/useZhihuStore');
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(<MemoryRouter key="answer" basename="/zh" initialEntries={['/zh/answers/201']}><Routes><Route path="/answers/:id" element={<ContentPage type="answer"/>}/></Routes></MemoryRouter>));
    assert.match(dom.window.document.body.textContent!, /回答示例/);
    assert.match(dom.window.document.body.textContent!, /正文内容/);
    assert.match(dom.window.document.body.textContent!, /评论正文/);
    assert.doesNotMatch(dom.window.document.body.textContent!, /返回推荐/);
    assert.equal(useZhihuStore.getState().drawerOpen, false);
    assert.equal(useZhihuStore.getState().readerMode, 'page');
    assert.equal(dom.window.document.querySelector('a.question-title-button')?.getAttribute('href'), '/zh/questions/101');
    assert.equal(writes, 2, 'standalone reading saves history and reports read once each');
    await act(async () => { useZhihuStore.setState({ detail: null, detailError: '暂时失败', detailLoading: false }); });
    const retry = Array.from(dom.window.document.querySelectorAll('button')).find(button => button.textContent?.includes('重试'));
    await act(async () => { retry?.click(); });
    assert.equal(useZhihuStore.getState().readerMode, 'page', 'retry stays on the standalone page');
    assert.equal(useZhihuStore.getState().drawerOpen, false);
    assert.match(dom.window.document.body.textContent!, /回答示例/);
    await act(async () => root.render(<MemoryRouter key="article" basename="/zh" initialEntries={['/zh/articles/201']}><Routes><Route path="/articles/:id" element={<ContentPage type="article"/>}/></Routes></MemoryRouter>));
    assert.match(dom.window.document.body.textContent!, /文章示例/);
    assert.match(dom.window.document.body.textContent!, /评论正文/);
    assert.equal(useZhihuStore.getState().contentType, 'article');
    const beforeInvalid = details;
    await act(async () => root.render(<MemoryRouter key="invalid" initialEntries={['/articles/bad']}><Routes><Route path="/articles/:id" element={<ContentPage type="article"/>}/></Routes></MemoryRouter>));
    assert.match(dom.window.document.body.textContent!, /无效的文章链接/);
    assert.equal(details, beforeInvalid, 'invalid IDs never load or record content');
    await act(async () => root.render(<MemoryRouter key="links" basename="/zh" initialEntries={['/zh/recommend']}><ContentTabLink type="answer" id="201"/><ContentTabLink type="article" id="301"/><ContentTabLink type="question" id="101"/></MemoryRouter>));
    const links = Array.from(dom.window.document.querySelectorAll('a'));
    assert.deepEqual(links.map(link => link.getAttribute('href')), ['/zh/answers/201', '/zh/articles/301', '/zh/questions/101']);
    assert.ok(links.every(link => link.target === '_blank' && link.rel.includes('noopener')));
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = previousFetch;
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
