import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Compass, Feather, PanelLeftClose, Search, Settings2 } from 'lucide-react';
import { ContentDrawer } from '../components/ContentDrawer';
import { useZhihuStore } from '../store/useZhihuStore';
import RecommendationPage from './RecommendationPage';
import QuestionPage from './QuestionPage';
import SearchPage from './SearchPage';
import SettingsPage from './SettingsPage';

export default function App() {
  const initialize = useZhihuStore(state => state.initialize);
  const searchQuery = useZhihuStore(state => state.searchQuery);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { void initialize(); }, [initialize]);

  const activePage = location.pathname.startsWith('/search') ? '搜索' : location.pathname.startsWith('/questions/') ? '问题详情' : location.pathname.startsWith('/settings') ? '设置' : '推荐';
  const profileMenu: MenuProps = {
    items: [{ key: 'settings', icon: <Settings2 size={15}/>, label: '设置与 Cookie' }],
    onClick: ({ key }) => { if (key === 'settings') navigate('/settings'); },
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Feather size={19}/></div><span>知简</span><span className="collapse"><PanelLeftClose size={17}/></span></div>
      <div className="nav-label">阅读</div>
      <NavLink to="/recommend" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Compass size={18}/>推荐</NavLink>
      <NavLink to={searchQuery ? `/search?q=${encodeURIComponent(searchQuery)}` : '/search'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Search size={18}/>搜索</NavLink>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">我的空间 <span>/</span> <b>{activePage}</b></div><div className="top-actions"><span className="sync"><span/> 实时知乎数据</span><Dropdown menu={profileMenu} trigger={['click']} placement="bottomRight"><button className="top-avatar" type="button" aria-label="打开个人设置" title="个人设置">L</button></Dropdown></div></header>
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
    </main>
    <ContentDrawer/>
  </div>;
}
