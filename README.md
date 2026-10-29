# 知简 Zhihu Focus

本地知乎阅读器，只提供推荐流和搜索。`frontend/` 为 React + Vite，`backend/` 为 Go API + Air。

## 配置真实知乎服务

1. 点击右上角头像进入“设置与 Cookie”，粘贴知乎 Cookie。它保存在当前浏览器本地，并通过请求头发送给本机后端的知乎数据接口。可选在 `backend/.env` 配置 `ZHIHU_ACCESS_SECRET`，用于用户未设置 Cookie 或 Cookie 确认失效时的搜索兜底。没有浏览器 Cookie 时，推荐流自动改用知乎热榜。模板见 `backend/.env.example`。不要把 Cookie 发到聊天或提交到仓库。

知乎开放平台 Access Secret 在知乎开放平台个人中心获取。搜索优先使用当前浏览器 Cookie，并通过知乎站内分页接口搜索；Cookie 未设置或确认失效时，使用 Access Secret 进行兜底。临时网络错误和限流不会触发凭证回退。推荐、详情、评论、问题及回答接口使用当前浏览器 Cookie。没有 Cookie 时，推荐流使用知乎热榜接口 `https://api.zhihu.com/topstory/hot-lists/total`；详情和评论需要先在设置页配置 Cookie。这些均为非公开接口，可能随知乎改版失效；分页使用知乎返回的 next 地址。推荐与搜索分为独立路由，点击回答或文章会在当前页面右侧抽屉中读取正文和评论，评论支持翻页。回答抽屉可进入知简内的问题页查看问题信息和回答列表；问题下的回答也能在抽屉内阅读。想法暂时提供知乎原页入口。

前端采用 React、React Router、Zustand、Ant Design 与 Vite，页面通过 `services/` 调用后端 API。推荐、搜索和问题回答列表共用个人设置里的“滚到底自动加载”开关，默认关闭，选择保存在浏览器本地。自动加载需用户先滚动页面触发；若下一页没有新增结果，会退回手动加载，避免重复扫描。

## 启动

终端一（Go 后端热重载）：

```bash
cd ~/work/zhihu-focus
./scripts/start-backend.sh
```

Air 未安装时，在项目根目录运行 `./scripts/install-air.sh`。

终端二（React 前端）：

```bash
cd ~/work/zhihu-focus/frontend
pnpm dev
```

打开 Vite 输出的本机地址，默认 `http://127.0.0.1:5173`。同一局域网内的其他设备也可使用 Vite 输出的 Network 地址，例如 `http://电脑的局域网IP:5173`。macOS 可用 `ipconfig getifaddr en0` 查看 Wi-Fi 地址。前端 `/api` 请求代理到本机 Go 服务 `127.0.0.1:8787`，不需要单独把后端开放到局域网。

不同地址和设备的浏览器各自保存 Cookie 和阅读设置。局域网开发地址使用 HTTP，请只在可信网络中使用；同一局域网能访问该地址的设备也能使用服务端配置的搜索兜底。凭证未配置或上游接口异常时，页面会显示错误，不会用演示数据代替。
