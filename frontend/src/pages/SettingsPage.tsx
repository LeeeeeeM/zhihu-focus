import { useEffect, useState } from 'react';
import { Alert, Avatar, Button, Input, Tag } from 'antd';
import { KeyRound, Save, Trash2 } from 'lucide-react';
import { readZhihuCookie, removeZhihuCookie, saveZhihuCookie, zhihuCookieChangedEvent } from '../services/searchCredential';
import { useZhihuStore } from '../store/useZhihuStore';

export default function SettingsPage() {
  const serviceConfigured = useZhihuStore(state => state.serviceConfigured);
  const searchQuery = useZhihuStore(state => state.searchQuery);
  const search = useZhihuStore(state => state.search);
  const refreshFeed = useZhihuStore(state => state.refreshFeed);
  const searchError = useZhihuStore(state => state.searchError);
  const searchLoading = useZhihuStore(state => state.searchLoading);
  const feedLoading = useZhihuStore(state => state.feedLoading);
  const [hasPersonalCookie, setHasPersonalCookie] = useState(() => Boolean(readZhihuCookie()));
  const [cookieDraft, setCookieDraft] = useState('');
  const [message, setMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    const updateCredentialStatus = () => setHasPersonalCookie(Boolean(readZhihuCookie()));
    window.addEventListener(zhihuCookieChangedEvent, updateCredentialStatus);
    return () => window.removeEventListener(zhihuCookieChangedEvent, updateCredentialStatus);
  }, []);

  function saveCookie() {
    const cookie = cookieDraft.trim().replace(/^cookie\s*:\s*/i, '').replace(/[\r\n]+/g, ' ');
    if (!cookie) { setSettingsError('请粘贴完整的知乎 Cookie。'); return; }
    if (!saveZhihuCookie(cookie)) { setSettingsError('浏览器无法保存 Cookie，请检查本地存储权限。'); return; }
    setHasPersonalCookie(true);
    setCookieDraft('');
    setSettingsError('');
    setMessage(searchQuery ? `Cookie 已保存，正在刷新推荐和搜索「${searchQuery}」。` : 'Cookie 已保存，正在刷新推荐内容。');
    void refreshFeed();
    if (searchQuery) void search(searchQuery);
  }

  function clearCookie() {
    if (!removeZhihuCookie()) { setSettingsError('无法清除本地 Cookie，请检查浏览器存储权限。'); return; }
    setHasPersonalCookie(false);
    setCookieDraft('');
    setSettingsError('');
    setMessage(searchQuery ? 'Cookie 已清除，正在按无个人 Cookie 的方式刷新推荐和搜索。' : 'Cookie 已清除，正在刷新推荐内容。');
    void refreshFeed();
    if (searchQuery) void search(searchQuery);
  }

  return <div className="settings-page">
    <div className="welcome">
      <div className="eyebrow"><span className="eyebrow-line"/> PERSONAL SETTINGS</div>
      <h1>配置你的阅读空间</h1>
      <p>设置一次 Cookie，推荐、搜索、详情和评论都会优先使用。没有个人 Cookie 时，推荐会使用服务端 Cookie；两边都未配置才改用知乎热榜，搜索使用 Access Secret 兜底。</p>
    </div>

    <section className="settings-panel">
      <div className="settings-panel-heading">
        <div>
          <div className="eyebrow small">ZHIHU CREDENTIAL</div>
          <h2><KeyRound size={18}/>个人知乎 Cookie</h2>
          <p>此 Cookie 用于当前浏览器发起的全部知乎数据请求；保存后会优先于本机服务配置。</p>
        </div>
        <Tag bordered={false} className={hasPersonalCookie ? 'credential-tag is-ready' : 'credential-tag'}>{hasPersonalCookie ? '个人 Cookie 已保存' : serviceConfigured.recommendation ? '使用服务端 Cookie 兜底' : '推荐将使用知乎热榜'}</Tag>
      </div>

      <div className="credential-status-grid">
        <div className="credential-status-item">
          <Avatar size={28}>{hasPersonalCookie ? '我' : '知'}</Avatar>
          <div><b>个人 Cookie</b><span>{hasPersonalCookie ? '全部知乎接口优先使用' : '未配置'}</span></div>
        </div>
        <div className="credential-status-item">
          <span className={`credential-status-dot ${serviceConfigured.recommendation ? 'is-ready' : ''}`}/>
          <div><b>服务端 Cookie 兜底</b><span>{serviceConfigured.recommendation ? '已配置' : '未配置，无 Cookie 时推荐用热榜'}</span></div>
        </div>
        <div className="credential-status-item">
          <span className={`credential-status-dot ${serviceConfigured.search ? 'is-ready' : ''}`}/>
          <div><b>Access Secret 搜索兜底</b><span>{serviceConfigured.search ? '已配置' : '未配置'}</span></div>
        </div>
      </div>

      <label className="settings-field-label" htmlFor="zhihu-cookie">知乎 Cookie</label>
      <Input.TextArea
        id="zhihu-cookie"
        value={cookieDraft}
        onChange={event => { setCookieDraft(event.target.value); setSettingsError(''); setMessage(''); }}
        placeholder="粘贴完整的 Cookie 请求头内容，例如 z_c0=…; _xsrf=…"
        autoSize={{ minRows: 5, maxRows: 9 }}
        spellCheck={false}
      />
      <p className="settings-field-hint">从浏览器开发者工具的知乎请求头中复制 Cookie 完整值。已保存的 Cookie 不会回显；输入新值会覆盖当前值。</p>

      {settingsError && <Alert type="error" showIcon message={settingsError} className="settings-alert"/>}
      {searchError && <Alert type="error" showIcon message={searchError} className="settings-alert"/>}
      {message && !searchError && <Alert type="success" showIcon message={message} className="settings-alert"/>}
      {(searchLoading || feedLoading) && <div className="settings-progress">正在用当前凭证刷新数据…</div>}

      <div className="settings-actions">
        <Button danger type="text" icon={<Trash2 size={14}/>} disabled={!hasPersonalCookie} onClick={clearCookie}>清除个人 Cookie</Button>
        <Button type="primary" icon={<Save size={14}/>} onClick={saveCookie}>保存 Cookie</Button>
      </div>
    </section>

    <section className="settings-note">
      <b>凭证如何使用</b>
      <p>Cookie 保存在当前浏览器本地，并通过请求头发送给本机后端，不会放进 URL 或写入服务端配置文件。浏览器和服务端都没有 Cookie 时，推荐改用知乎热榜、搜索改用 ZHIHU_ACCESS_SECRET；详情与评论需要配置个人 Cookie 或可选的 backend/.env ZHIHU_COOKIE。若你已在此页配置并确认 Cookie 可用，可以删除 .env 中的 ZHIHU_COOKIE。</p>
    </section>

    <footer className="footnote">知简 · 为专注阅读而做 <span>真实知乎数据</span></footer>
  </div>;
}
