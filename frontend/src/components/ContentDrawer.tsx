import { Drawer } from 'antd';
import { useZhihuStore } from '../store/useZhihuStore';
import { ContentReader } from './ContentReader';

export function ContentDrawer() {
  const minimalMode = useZhihuStore(state => state.minimalMode);
  const open = useZhihuStore(state => state.drawerOpen);
  const type = useZhihuStore(state => state.contentType);
  const closeDrawer = useZhihuStore(state => state.closeDrawer);
  return <Drawer
    className={`content-drawer ${minimalMode ? 'minimal-drawer' : ''}`}
    title={type === 'article' ? '文章详情' : '回答详情'}
    placement="right"
    size="min(720px, 100vw)"
    open={open}
    onClose={closeDrawer}
    styles={{ body: { padding: 0 } }}
    destroyOnHidden
  ><ContentReader/></Drawer>;
}
