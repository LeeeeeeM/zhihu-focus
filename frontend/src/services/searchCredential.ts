const zhihuCookieKey = 'zhihu-focus-cookie';
const legacySearchCookieKey = 'zhihu-focus-search-cookie';
export const zhihuCookieChangedEvent = 'zhihu-focus-cookie-changed';

export function isZhihuCookieStorageKey(key: string | null): boolean {
  return key === null || key === zhihuCookieKey || key === legacySearchCookieKey;
}

export function readZhihuCookie() {
  try { return window.localStorage.getItem(zhihuCookieKey) || window.localStorage.getItem(legacySearchCookieKey) || ''; } catch { return ''; }
}

export function saveZhihuCookie(cookie: string) {
  try {
    window.localStorage.setItem(zhihuCookieKey, cookie);
    window.localStorage.removeItem(legacySearchCookieKey);
    window.dispatchEvent(new Event(zhihuCookieChangedEvent));
    return true;
  } catch {
    return false;
  }
}

export function removeZhihuCookie() {
  try {
    window.localStorage.removeItem(zhihuCookieKey);
    window.localStorage.removeItem(legacySearchCookieKey);
    window.dispatchEvent(new Event(zhihuCookieChangedEvent));
    return true;
  } catch {
    return false;
  }
}
