import { useEffect, useRef, useState } from 'react';
import { Alert, Button, ColorPicker, Input, Segmented, Switch, Tag } from 'antd';
import { Check, ChevronsDown, Copy, Image as ImageIcon, KeyRound, Minimize2, Palette, Save, Trash2, UserRound } from 'lucide-react';
import { isZhihuCookieStorageKey, readZhihuCookie, removeZhihuCookie, saveZhihuCookie, zhihuCookieChangedEvent } from '../services/searchCredential';
import { useZhihuStore } from '../store/useZhihuStore';
import { createThemePalette, defaultThemeColor, themePresets } from '../services/themePreferences';
import { UserAvatar } from '../components/UserAvatar';
import { copyTextToClipboard } from '../services/clipboard';

export default function SettingsPage() {
  const serviceConfigured = useZhihuStore(state => state.serviceConfigured);
  const minimalMode = useZhihuStore(state => state.minimalMode);
  const setMinimalMode = useZhihuStore(state => state.setMinimalMode);
  const hideUserAvatars = useZhihuStore(state => state.hideUserAvatars);
  const setHideUserAvatars = useZhihuStore(state => state.setHideUserAvatars);
  const autoLoad = useZhihuStore(state => state.autoLoad);
  const setAutoLoad = useZhihuStore(state => state.setAutoLoad);
  const themeColor = useZhihuStore(state => state.themeColor);
  const setThemeColor = useZhihuStore(state => state.setThemeColor);
  const imageDisplayMode = useZhihuStore(state => state.imageDisplayMode);
  const setImageDisplayMode = useZhihuStore(state => state.setImageDisplayMode);
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
  const [cookieCopied, setCookieCopied] = useState(false);
  const [copyingCookie, setCopyingCookie] = useState(false);
  const cookieVersion = useRef(0);

  useEffect(() => {
    const updateCredentialStatus = () => {
      cookieVersion.current += 1;
      setHasPersonalCookie(Boolean(readZhihuCookie()));
      setCookieCopied(false);
    };
    const onStorage = (event: StorageEvent) => { if (isZhihuCookieStorageKey(event.key)) updateCredentialStatus(); };
    window.addEventListener(zhihuCookieChangedEvent, updateCredentialStatus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(zhihuCookieChangedEvent, updateCredentialStatus);
      window.removeEventListener('storage', onStorage);
    };
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

  async function copyCookie() {
    const cookie = readZhihuCookie();
    setCookieCopied(false);
    setSettingsError('');
    if (!cookie) {
      setHasPersonalCookie(false);
      setSettingsError('尚未保存个人 Cookie，请先保存。');
      return;
    }
    const version = cookieVersion.current;
    setCopyingCookie(true);
    const copied = await copyTextToClipboard(cookie);
    setCopyingCookie(false);
    // Ignore results from a Cookie that changed while clipboard access was pending.
    if (version !== cookieVersion.current || readZhihuCookie() !== cookie) return;
    setCookieCopied(copied);
    if (!copied) setSettingsError('复制失败，请检查浏览器剪贴板权限后重试。');
  }

  return <div className="settings-page">
    <div className="welcome">
      <div className="eyebrow"><span className="eyebrow-line"/> PERSONAL SETTINGS</div>
      <h1>配置你的阅读空间</h1>
      <p>设置一次 Cookie，推荐、搜索、详情和评论都会使用。没有个人 Cookie 时，推荐使用知乎热榜，搜索使用 Access Secret 兜底。</p>
    </div>

    <section className="settings-panel">
      <div className="settings-panel-heading">
        <div>
          <div className="eyebrow small">ZHIHU CREDENTIAL</div>
          <h2><KeyRound size={18}/>个人知乎 Cookie</h2>
          <p>此 Cookie 用于当前浏览器发起的知乎数据请求，并保存在当前浏览器本地。</p>
        </div>
        <Tag variant="filled" className={hasPersonalCookie ? 'credential-tag is-ready' : 'credential-tag'}>{hasPersonalCookie ? '个人 Cookie 已保存' : '推荐将使用知乎热榜'}</Tag>
      </div>

      <div className="credential-status-grid">
        <div className="credential-status-item">
          <UserAvatar size={28} name={hasPersonalCookie ? '我' : '知'}/>
          <div><b>个人 Cookie</b><span>{hasPersonalCookie ? '请求会携带此 Cookie' : '未配置'}</span></div>
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

      {settingsError && <Alert type="error" showIcon title={settingsError} className="settings-alert"/>}
      {searchError && <Alert type="error" showIcon title={searchError} className="settings-alert"/>}
      {message && !searchError && <Alert type="success" showIcon title={message} className="settings-alert"/>}
      {(searchLoading || feedLoading) && <div className="settings-progress">正在用当前凭证刷新数据…</div>}

      <div className="settings-actions">
        <Button danger type="text" icon={<Trash2 size={14}/>} disabled={!hasPersonalCookie} onClick={clearCookie}>清除个人 Cookie</Button>
        <Button icon={cookieCopied ? <Check size={14}/> : <Copy size={14}/>} disabled={!hasPersonalCookie} loading={copyingCookie} onClick={() => void copyCookie()} aria-live="polite">{cookieCopied ? '已复制 Cookie' : '复制 Cookie'}</Button>
        <Button type="primary" icon={<Save size={14}/>} onClick={saveCookie}>保存 Cookie</Button>
      </div>
    </section>

    <section className="settings-panel reading-preferences">
      <div className="settings-panel-heading reading-preference-row">
        <div>
          <div className="eyebrow small">READING PREFERENCES</div>
          <h2><ImageIcon size={18}/>图片展示</h2>
          <p>选择回答、文章、问题描述和评论中的图片显示方式。此设置保存在当前浏览器。</p>
        </div>
        <Segmented
          className="image-display-options"
          aria-label="图片展示方式"
          value={imageDisplayMode}
          onChange={setImageDisplayMode}
          options={[{ label: '显示图片', value: 'show' }, { label: '占位提示', value: 'placeholder' }, { label: '完全隐藏', value: 'hide' }]}
        />
      </div>
      <div className="image-mode-preview">
        <span>占位提示示例</span>
        <span className="image-placeholder" role="img" aria-label="图片">图片</span>
        <span>图片位置会显示此提示</span>
      </div>
      <div className="reading-preference-row auto-load-setting">
        <div><h2><ChevronsDown size={18}/>滚到底自动加载</h2><p>推荐、搜索和问题回答共用此设置，关闭时可手动加载更多。</p></div>
        <Switch checked={autoLoad} onChange={setAutoLoad} aria-label="推荐、搜索和问题回答滚到底自动加载"/>
      </div>
      <div className="reading-preference-row auto-load-setting">
        <div><h2><UserRound size={18}/>隐藏用户头像</h2><p>开启后，用户头像统一显示为“知”。</p></div>
        <Switch checked={hideUserAvatars} onChange={setHideUserAvatars} aria-label="隐藏用户头像"/>
      </div>
      <div className="reading-preference-row auto-load-setting">
        <div><h2><Minimize2 size={18}/>极简模式</h2><p>隐藏页面引导文案和装饰性标题，让内容更靠前。</p></div>
        <Switch checked={minimalMode} onChange={setMinimalMode} aria-label="极简模式"/>
      </div>
    </section>

    <section className="settings-panel theme-settings">
      <div className="settings-panel-heading theme-settings-heading">
        <div><div className="eyebrow small">APPEARANCE</div><h2><Palette size={18}/>主题色</h2><p>选择喜欢的颜色，设置会保存在当前浏览器。</p></div>
        <Button type="text" onClick={() => setThemeColor(defaultThemeColor)}>恢复默认</Button>
      </div>
      <div className="theme-swatches" role="group" aria-label="主题配色">
        {themePresets.map(preset => <button key={preset.color} type="button" className="theme-swatch" aria-label={preset.name} aria-pressed={themeColor === preset.color} onClick={() => setThemeColor(preset.color)}>
          <span className="theme-swatch-color" style={{ backgroundColor: preset.color, color: createThemePalette(preset.color).onPrimary }}>{themeColor === preset.color && <Check size={17}/>}</span><span>{preset.name}</span>
        </button>)}
      </div>
      <div className="theme-custom"><span>自定义颜色</span><ColorPicker value={themeColor} disabledAlpha onChange={color => setThemeColor(color.toHexString())} showText aria-label="选择自定义主题色"/></div>
    </section>

    <section className="settings-note">
      <b>凭证如何使用</b>
      <p>Cookie 保存在当前浏览器本地，并通过请求头发送给本机后端，不会放进 URL 或写入服务端配置文件。没有 Cookie 时，推荐改用知乎热榜、搜索改用 ZHIHU_ACCESS_SECRET；详情与评论需要配置个人 Cookie。</p>
    </section>

  </div>;
}
