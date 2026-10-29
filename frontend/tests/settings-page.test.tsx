import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('settings controls update and persist reading preferences and theme', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/settings' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
    Node: dom.window.Node, ShadowRoot: dom.window.ShadowRoot, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }), configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ConfigProvider } = await import('antd');
  const { default: SettingsPage } = await import('../src/pages/SettingsPage');
  const { useZhihuStore } = await import('../src/store/useZhihuStore');
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => { root.render(<ConfigProvider><SettingsPage/></ConfigProvider>); });
    for (const [label, key] of [
      ['推荐、搜索和问题回答滚到底自动加载', 'zhihu-focus-global-auto-load'],
      ['隐藏用户头像', 'zhihu-focus-hide-user-avatars'],
      ['极简模式', 'zhihu-focus-minimal-mode'],
    ]) {
      const button = dom.window.document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      assert.ok(button, `missing ${label} switch`);
      await act(async () => { button.click(); });
      assert.equal(button.getAttribute('aria-checked'), 'true');
      assert.equal(dom.window.localStorage.getItem(key), 'true');
    }
    const blue = dom.window.document.querySelector<HTMLButtonElement>('button[aria-label="海蓝"]');
    assert.ok(blue);
    await act(async () => { blue.click(); });
    assert.equal(useZhihuStore.getState().themeColor, '#356687');
    assert.equal(dom.window.localStorage.getItem('zhihu-focus-theme-color'), '#356687');
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
