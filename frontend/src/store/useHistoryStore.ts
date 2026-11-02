import { create } from 'zustand';
import { zhihuService } from '../services/zhihu';
import { readZhihuCookie } from '../services/searchCredential';
import type { HistoryItem } from '../models/content';
import { contentKey, mergeUnique, nextPageState } from '../services/pagination';

type HistoryState = {
  items: HistoryItem[];
  loading: boolean;
  moreLoading: boolean;
  error: string;
  cursor: string;
  hasMore: boolean;
  initialized: boolean;
  scrollY: number;
  setScrollY: (value: number) => void;
  syncCookie: () => void;
  ensureLoaded: () => Promise<void>;
  recordSaved: (cookie: string, item: HistoryItem) => void;
  reset: () => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<number>;
};

let version = 0;
let accountCookie = '';
let savedDuringRefresh: HistoryItem[] = [];
const empty = { items: [] as HistoryItem[], loading: false, moreLoading: false, error: '', cursor: '', hasMore: false, initialized: false, scrollY: 0 };

function unique(items: HistoryItem[]) {
  return mergeUnique([], items, contentKey).items;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  ...empty,
  reset: () => { version++; accountCookie = ''; savedDuringRefresh = []; set(empty); },
  setScrollY: value => set({ scrollY: value }),
  syncCookie: () => { if (accountCookie !== readZhihuCookie().trim()) get().reset(); },
  ensureLoaded: async () => {
    if (!get().initialized || accountCookie !== readZhihuCookie().trim()) await get().refresh();
  },
  recordSaved: (cookie, item) => {
    if (!get().initialized || accountCookie !== cookie || readZhihuCookie().trim() !== cookie) return;
    if (get().loading) savedDuringRefresh = unique([item, ...savedDuringRefresh]);
    set(state => ({ items: unique([item, ...state.items]) }));
  },
  refresh: async () => {
    const current = ++version;
    const cookie = readZhihuCookie().trim();
    accountCookie = cookie;
    savedDuringRefresh = [];
    set({ ...empty, initialized: true, loading: Boolean(cookie), error: cookie ? '' : '请先在设置中配置知乎 Cookie，再查看浏览历史。' });
    if (!cookie) return;
    try {
      const page = await zhihuService.getHistory(cookie);
      if (current !== version || readZhihuCookie().trim() !== cookie) return;
      const items = unique([...savedDuringRefresh, ...page.items]);
      set({ items, ...nextPageState(page.nextCursor, page.hasMore) });
    } catch (error) {
      if (current === version && readZhihuCookie().trim() === cookie) set({ error: error instanceof Error ? error.message : '读取浏览历史失败' });
    } finally { if (current === version) set({ loading: false }); }
  },
  loadMore: async () => {
    const { cursor, hasMore, loading, moreLoading } = get();
    if (!cursor || !hasMore || loading || moreLoading) return 0;
    if (readZhihuCookie().trim() !== accountCookie) { await get().refresh(); return 0; }
    const current = version;
    const cookie = accountCookie;
    set({ moreLoading: true, error: '' });
    let freshCount = 0;
    try {
      const page = await zhihuService.getHistory(cookie, cursor);
      if (current !== version || readZhihuCookie().trim() !== cookie) return 0;
      set(state => {
        const merged = mergeUnique(state.items, page.items, contentKey);
        freshCount = merged.freshCount;
        return { items: merged.items, ...nextPageState(page.nextCursor, page.hasMore, cursor) };
      });
    } catch (error) {
      if (current === version && readZhihuCookie().trim() === cookie) set({ error: error instanceof Error ? error.message : '加载更多浏览历史失败' });
    } finally { if (current === version) set({ moreLoading: false }); }
    return freshCount;
  },
}));
