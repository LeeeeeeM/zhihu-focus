import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Compass, Feather, PanelLeftClose, PanelLeftOpen, Search, Settings2 } from 'lucide-react';
import { ContentDrawer } from '../components/ContentDrawer';
import { useZhihuStore } from '../store/useZhihuStore';
import { autoLoadStorageKey, hideUserAvatarsStorageKey, imageDisplayModeStorageKey, legacyFeedAutoLoadStorageKey, legacySearchAutoLoadStorageKey, legacyShowImagesStorageKey, minimalModeStorageKey, readAutoLoadPreference, readHideUserAvatars, readImageDisplayMode, readMinimalMode } from '../services/readingPreferences';
import { readThemeColor, themeColorStorageKey } from '../services/themePreferences';
import { isZhihuCookieStorageKey, readZhihuCookie, zhihuCookieChangedEvent } from '../services/searchCredential';
import RecommendationPage from './RecommendationPage';
import QuestionPage from './QuestionPage';
import SearchPage from './SearchPage';
import SettingsPage from './SettingsPage';

export default function App() {
  const initialize = useZhihuStore(state => state.initialize);
  const searchQuery = useZhihuStore(state => state.searchQuery);
  const hideUserAvatars = useZhihuStore(state => state.hideUserAvatars);
  const minimalMode = useZhihuStore(state => state.minimalMode);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = window.localStorage.getItem('zhihu-focus-sidebar-collapsed');
      if (saved !== null) return saved === 'true';
    } catch { /* Storage is optional. */ }
    return window.innerWidth <= 820;
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    let currentCookie = readZhihuCookie();
    const rememberLocalCookie = () => { currentCookie = readZhihuCookie(); };
    const syncReadingPreferences = (event: StorageEvent) => {
      if (event.key === imageDisplayModeStorageKey || event.key === legacyShowImagesStorageKey || event.key === null) {
        useZhihuStore.setState({ imageDisplayMode: readImageDisplayMode() });
      }
      if (event.key === themeColorStorageKey || event.key === null) {
        useZhihuStore.setState({ themeColor: readThemeColor() });
      }
      if (event.key === autoLoadStorageKey || event.key === legacyFeedAutoLoadStorageKey || event.key === legacySearchAutoLoadStorageKey || event.key === null) {
        useZhihuStore.setState({ autoLoad: readAutoLoadPreference() });
      }
      if (event.key === hideUserAvatarsStorageKey || event.key === null) {
        useZhihuStore.setState({ hideUserAvatars: readHideUserAvatars() });
      }
      if (event.key === minimalModeStorageKey || event.key === null) {
        useZhihuStore.setState({ minimalMode: readMinimalMode() });
      }
      if (isZhihuCookieStorageKey(event.key)) {
        const cookie = readZhihuCookie();
        if (cookie !== currentCookie) {
          currentCookie = cookie;
          const state = useZhihuStore.getState();
          void state.refreshFeed();
          if (state.searchQuery) void state.search(state.searchQuery);
          if (state.drawerOpen && state.contentType && state.contentId) void state.openContent(state.contentType, state.contentId);
          const base = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
          const pathname = window.location.pathname;
          const questionId = /^\/questions\/(\d+)\/?$/.exec(base && pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname)?.[1];
          if (questionId) void state.loadQuestion(questionId);
        }
      }
    };
    window.addEventListener('storage', syncReadingPreferences);
    window.addEventListener(zhihuCookieChangedEvent, rememberLocalCookie);
    return () => {
      window.removeEventListener('storage', syncReadingPreferences);
      window.removeEventListener(zhihuCookieChangedEvent, rememberLocalCookie);
    };
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem('zhihu-focus-sidebar-collapsed', String(sidebarCollapsed)); } catch { /* Storage is optional. */ }
  }, [sidebarCollapsed]);

  const activePage = location.pathname.startsWith('/search') ? '搜索' : location.pathname.startsWith('/questions/') ? '问题详情' : location.pathname.startsWith('/settings') ? '设置' : '推荐';
  const profileMenu: MenuProps = {
    items: [{ key: 'settings', icon: <Settings2 size={15}/>, label: '设置与 Cookie' }],
    onClick: ({ key }) => { if (key === 'settings') navigate('/settings'); },
  };

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${minimalMode ? 'minimal-mode' : ''}`}>
    <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><Feather size={19}/></div>
        <span className="brand-title">知简</span>
        <button
          className="collapse"
          type="button"
          aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          onClick={() => setSidebarCollapsed(value => !value)}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}
        </button>
      </div>
      <Tooltip title={sidebarCollapsed ? '推荐' : undefined} placement="right" trigger={['hover', 'focus']}>
        <NavLink aria-label="推荐" to="/recommend" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Compass size={18}/><span>推荐</span></NavLink>
      </Tooltip>
      <Tooltip title={sidebarCollapsed ? '搜索' : undefined} placement="right" trigger={['hover', 'focus']}>
        <NavLink aria-label="搜索" to={searchQuery ? `/search?q=${encodeURIComponent(searchQuery)}` : '/search'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Search size={18}/><span>搜索</span></NavLink>
      </Tooltip>
    </aside>
    <main className={`main ${sidebarCollapsed ? 'main-sidebar-collapsed' : ''}`}>
      <header className="topbar"><div className="crumb">我的空间 <span>/</span> <b>{activePage}</b></div><div className="top-actions"><Dropdown menu={profileMenu} trigger={['click']} placement="bottomRight"><button className="user-settings-trigger" type="button" aria-label="打开用户设置"><span>用户设置</span><span className="top-avatar" style={hideUserAvatars ? { backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text)' } : undefined}>{hideUserAvatars ? '知' : 'L'}</span></button></Dropdown></div></header>
      <section className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/recommend" replace/>}/>
          <Route path="/recommend" element={<RecommendationPage/>}/>
          <Route path="/search" element={<SearchPage/>}/>
          <Route path="/questions/:id" element={<QuestionPage/>}/>
          <Route path="/settings" element={<SettingsPage/>}/>
          <Route path="*" element={<Navigate to="/recommend" replace/>}/>
        </Routes>
      </section>
      <footer className="app-footer">
        <div className="footnote app-footer-inner">知简 · 为专注阅读而做 <span>真实知乎数据</span></div>
      </footer>
    </main>
    <ContentDrawer/>
  </div>;
}
