import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('question answers follow the shared auto-load setting and stop on duplicate pages', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/questions/123' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
    Node: dom.window.Node, ShadowRoot: dom.window.ShadowRoot, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  let observer: { callback: IntersectionObserverCallback; disconnect(): void } | undefined;
  class FakeIntersectionObserver {
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) { this.callback = callback; observer = this; }
    observe() {}
    disconnect() {}
  }
  globals.IntersectionObserver = FakeIntersectionObserver;
  globals.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(dom.window, 'scrollTo', { value: () => {}, configurable: true });
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }), configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter, Route, Routes } = await import('react-router-dom');
  const { zhihuService } = await import('../src/services/zhihu');
  const { useZhihuStore } = await import('../src/store/useZhihuStore');
  const { default: QuestionPage } = await import('../src/pages/QuestionPage');
  const oldQuestion = zhihuService.getQuestion;
  const oldAnswers = zhihuService.getQuestionAnswers;
  let requests = 0;
  zhihuService.getQuestion = async () => ({ id: '123', title: '问题', detail: '', author: '', createdAt: '', updatedAt: '', answerCount: 1, followerCount: 0, commentCount: 0, topics: [], url: '' });
  zhihuService.getQuestionAnswers = async () => {
    requests += 1;
    return { items: [{ id: '1', author: '作者', avatar: '', excerpt: '回答', createdAt: '', voteUpCount: 0, commentCount: 0 }], nextCursor: 'next', hasMore: true };
  };
  useZhihuStore.setState({ autoLoad: true });
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => { root.render(<MemoryRouter initialEntries={['/questions/123']}><Routes><Route path="/questions/:id" element={<QuestionPage/>}/></Routes></MemoryRouter>); });
    assert.equal(requests, 1);
    assert.match(dom.window.document.body.textContent || '', /继续加载回答/);
    Object.defineProperty(dom.window, 'scrollY', { value: 100, configurable: true });
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('scroll')); });
    assert.ok(observer, 'scrolling arms the observer');
    const oldObserver = observer;
    await act(async () => { useZhihuStore.setState({ autoLoad: false }); });
    await act(async () => { oldObserver!.callback([{ isIntersecting: true } as IntersectionObserverEntry], oldObserver as unknown as IntersectionObserver); });
    assert.equal(requests, 1, 'a queued observer callback must not load after auto-load is disabled');
    await act(async () => { useZhihuStore.setState({ autoLoad: true }); });
    await act(async () => { observer!.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as unknown as IntersectionObserver); });
    assert.equal(requests, 2);
    assert.match(dom.window.document.body.textContent || '', /继续加载回答/, 'duplicate page pauses automatic loading');
    await act(async () => { useZhihuStore.setState({ autoLoad: false }); });
    assert.match(dom.window.document.body.textContent || '', /继续加载回答/);
  } finally {
    await act(async () => root.unmount());
    zhihuService.getQuestion = oldQuestion;
    zhihuService.getQuestionAnswers = oldAnswers;
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
