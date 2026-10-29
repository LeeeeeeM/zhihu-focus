import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('other tabs synchronize preferences and refresh data when the Cookie changes', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/questions/123' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
    Node: dom.window.Node, ShadowRoot: dom.window.ShadowRoot, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(dom.window, 'scrollTo', { value: () => {}, configurable: true });
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }), configurable: true });
  dom.window.localStorage.setItem('zhihu-focus-cookie', 'fixture-a');
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  const { useZhihuStore } = await import('../src/store/useZhihuStore');
  const { default: App } = await import('../src/pages/App');
  const counts = { feed: 0, search: 0, question: 0 };
  useZhihuStore.setState({
    initialize: async () => {},
    refreshFeed: async () => { counts.feed += 1; },
    search: async () => { counts.search += 1; },
    loadQuestion: async () => { counts.question += 1; },
    searchQuery: '关键词',
    question: null, questionLoading: false, questionError: '',
  });
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => { root.render(<MemoryRouter initialEntries={['/questions/123']}><App/></MemoryRouter>); });
    assert.equal(counts.question, 1);
    await act(async () => {
      dom.window.localStorage.setItem('zhihu-focus-cookie', 'fixture-b');
      dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: 'zhihu-focus-cookie' }));
    });
    assert.deepEqual(counts, { feed: 1, search: 1, question: 2 });
    await act(async () => { dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: 'zhihu-focus-search-cookie' })); });
    assert.deepEqual(counts, { feed: 1, search: 1, question: 2 }, 'unchanged effective Cookie must not reload again');
    await act(async () => {
      dom.window.localStorage.setItem('zhihu-focus-minimal-mode', 'true');
      dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: 'zhihu-focus-minimal-mode' }));
    });
    assert.ok(dom.window.document.querySelector('.app-shell.minimal-mode'));
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
