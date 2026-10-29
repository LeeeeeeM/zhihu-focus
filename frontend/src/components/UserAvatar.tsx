import { Avatar } from 'antd';
import { useZhihuStore } from '../store/useZhihuStore';

export function UserAvatar({ src, name, size }: { src?: string; name?: string; size: number }) {
  const hidden = useZhihuStore(state => state.hideUserAvatars);
  return <Avatar
    size={size}
    src={hidden ? undefined : src?.trim() || undefined}
    style={{
      fontSize: Math.round(size * 0.48),
      ...(hidden ? { backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text)' } : {}),
    }}
  >{hidden ? '知' : name?.slice(0, 1) || '知'}</Avatar>;
}
