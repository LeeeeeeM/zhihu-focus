import { Avatar } from 'antd';
import { useZhihuStore } from '../store/useZhihuStore';

export function UserAvatar({ src, name, size }: { src?: string; name?: string; size: number }) {
  const hidden = useZhihuStore(state => state.hideUserAvatars);
  return <Avatar
    size={size}
    src={hidden ? undefined : src?.trim() || undefined}
    style={hidden ? { backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text)' } : undefined}
  >{hidden ? '知' : name?.slice(0, 1) || '知'}</Avatar>;
}
