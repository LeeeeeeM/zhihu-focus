# 知简 Zhihu Focus

本地知乎阅读器，提供推荐流、搜索和云端浏览历史。`frontend/` 为 React + Vite，`backend/` 为 Go API + Air，Go 最低版本为 1.27.3。

## 配置真实知乎服务

1. 点击右上角头像进入“设置与 Cookie”，粘贴知乎 Cookie。它保存在当前浏览器本地，并通过请求头发送给本机后端的知乎数据接口。可选在 `backend/.env` 配置 `ZHIHU_ACCESS_SECRET`，用于用户未设置 Cookie 或 Cookie 确认失效时的搜索兜底。没有浏览器 Cookie 时，推荐流自动改用知乎热榜。模板见 `backend/.env.example`。不要把 Cookie 发到聊天或提交到仓库。

知乎开放平台 Access Secret 在知乎开放平台个人中心获取。搜索优先使用当前浏览器 Cookie，并通过知乎站内分页接口搜索；Cookie 未设置或确认失效时，使用 Access Secret 进行兜底。临时网络错误和限流不会触发凭证回退。推荐、详情、评论、问题及回答接口使用当前浏览器 Cookie。没有 Cookie 时，推荐流使用知乎热榜接口 `https://api.zhihu.com/topstory/hot-lists/total`；详情和评论需要先在设置页配置 Cookie。问题详情接口返回知乎签名限制（403 / 10003）时，会从回答接口读取问题标题，继续展示回答；此时补充说明及统计信息标为不可用，可通过知乎原页查看。问题详情失败也不会阻止已加载回答的阅读和翻页。上述基于 Cookie 的网页及客户端接口属于内部接口，可能随知乎改版失效；分页使用知乎返回的 next 地址。推荐与搜索分为独立路由，点击回答或文章会在当前页面右侧抽屉中读取正文和评论，评论支持翻页。回答抽屉可进入知简内的问题页查看问题信息和回答列表；问题下的回答也能在抽屉内阅读。想法暂时提供知乎原页入口。

前端采用 React、React Router、Zustand、Ant Design 与 Vite，页面通过 `services/` 调用后端 API。推荐、搜索、问题回答和浏览历史列表共用个人设置里的“滚到底自动加载”开关，默认关闭，选择保存在浏览器本地。自动加载需用户先滚动页面触发；若下一页没有新增结果，会退回手动加载，避免重复扫描。

在站内抽屉成功打开回答或文章后，会使用打开时的 Cookie 向知乎 `POST https://www.zhihu.com/lastread/touch` 上报 `read` 状态（表单 `items`，携带基于 `d_c0` 的 ZSE 签名）。完整 Cookie 需包含 `d_c0`。正文加载失败、返回前关闭抽屉或切换内容/账号时不会为该次加载上报；上报异步执行，失败会在正文下方提示，下次打开会重试。仅展示卡片、进入问题页、点击外部原文链接不会主动上报。此接口是非公开接口；接入及模拟测试不代表已经通过真实账号验证，上报成功也不保证知乎后续推荐一定排除该内容。协议及调用参考：[知乎++源码](https://github.com/zly2006/zhihu-plus-plus/blob/master/shared/src/commonMain/kotlin/com/github/zly2006/zhihu/viewmodel/feed/HomeFeedViewModel.kt)、[接口文档](https://github.com/zly2006/zhurl/blob/main/docs/apis/feeds-search-history.md#上报最近阅读触达)。

侧栏“浏览历史”（`/history`）使用当前 Cookie 读取 `https://api.zhihu.com/unify-consumption/read_history`，支持刷新、手动分页及打开回答、文章和问题。需要含 `d_c0` 的有效 Cookie，后端按分页地址生成签名。历史列表、分页和滚动位置保存在 Zustand 中，切换页面会复用缓存；首次进入、手动刷新或 Cookie 变化时才重新读取。切换或清除 Cookie 会清空旧账号的缓存。刷新整个网页后会重新读取云端，历史不写入本地存储。站内抽屉成功打开回答或文章后，还会独立调用 `POST https://www.zhihu.com/api/v4/read_history/add` 写入云端历史，JSON 请求体（`content_token`、`content_type`）参与签名；保存失败会单独提示，下次打开重试。保存成功时会直接更新 Zustand 中对应的记录，保留已有分页，不会重拉第一页。加载失败、提前关闭或加载期间切换账号的内容不会写入，也不会补录过去的阅读。历史读写接口已用真实登录状态验证；保存接口实际会返回 HTTP 200 和 JSON `null`，后端按成功处理。云端列表可能有更新延迟。

## 独立阅读与分享

回答、文章和问题卡片均提供“新标签页打开”：分别进入 `/answers/:id`、`/articles/:id`、`/questions/:id`（部署在 `/zh/` 时自动保留前缀）。地址可以直接访问和分享，阅读正文及评论仍需要访问者在自己的浏览器中配置 Cookie。回答、文章的独立页与抽屉共用正文、评论、已读上报和浏览历史保存逻辑。独立页不显示“返回推荐”。

## 接口来源与复用边界

**当前并非所有功能都使用官方开放平台 API。** 所有上游数据请求直接访问知乎自有域名，没有第三方数据代理；但知乎网页/客户端内部接口和开放平台公开 API 是两种协议，不能将它们混称为“官方统一开放接口”。本项目对前端提供统一的 `/api/*`，后端按实际接口使用对应鉴权。

| 功能 | 上游接口 | 凭证与来源 |
| --- | --- | --- |
| 个性化推荐 | `api.zhihu.com/topstory/recommend` | Cookie；客户端内部接口 |
| 无 Cookie 热榜 | `api.zhihu.com/topstory/hot-lists/total` | 匿名；客户端内部接口 |
| Cookie 搜索 | `api.zhihu.com/search_v3` | Cookie；内部接口 |
| 搜索兜底 | `developer.zhihu.com/api/v1/content/zhihu_search` | Access Secret + 时间戳；官方公开 API，最多 10 条、无分页 |
| 回答正文 | `www.zhihu.com/api/v4/answers/{id}` | Cookie；网页内部接口 |
| 文章正文 | `zhuanlan.zhihu.com/api/articles/{id}` | Cookie；专栏内部接口 |
| 问题详情及回答列表 | `www.zhihu.com/api/v4/questions/{id}`、其 `/answers` | Cookie；网页内部接口 |
| 回答/文章评论 | `www.zhihu.com/api/v4/comment_v5/{answers\|articles}/{id}/root_comment` | Cookie；统一使用 v5 内部接口 |
| 评论回复 | `www.zhihu.com/api/v4/comment_v5/comment/{id}/child_comment` | Cookie；v5 内部接口 |
| 浏览历史查询 | `api.zhihu.com/unify-consumption/read_history` | Cookie；内部接口 |
| 浏览历史写入 | `www.zhihu.com/api/v4/read_history/add` | Cookie；内部接口；成功可返回 JSON `null` |
| 阅读状态上报 | `www.zhihu.com/lastread/touch` | Cookie；内部接口 |

核对依据为[知乎开放平台公开文档目录](https://developer.zhihu.com/console/api/v3/docs)。公开目录提供热榜、搜索、问题推荐、问题回答摘要及本人创作等能力；问题回答摘要不等于任意回答全文，本人创作评论不等于所有回答评论。目前该目录未提供与本项目个人首页推荐、浏览历史、已读上报完全对应的公开 API，因此保留原有 Cookie 功能，不用摘要接口替换正文，也不把创作问题推荐冒充首页推荐。开放平台有正式热榜 API，但当前无 Cookie 热榜仍走匿名内部接口，以支持只提供 Cookie 或完全未配置凭证的使用方式。

后端 `upstream.go` 集中处理 Web 请求头、可用时的 ZSE 签名、禁止重定向、响应大小限制和分页地址校验；`router.go` 负责本地接口，`content.go`、`comments.go`、`feed.go`、`search.go`、`history.go`、`reading.go` 分别承载业务。Web Cookie 与开放平台 Bearer 凭证分开使用。搜索只有确认未登录/过期才回退；签名限制、限流和临时服务错误不会切换凭证。所有 JSON 接口返回 `Cache-Control: no-store`，详情/列表缺失必要字段时显示错误，避免把失败当空结果或误写已读。

前端 `api/zhihu.ts` 集中发请求，`services/zhihu.ts` 适配显示数据与时间，`services/pagination.ts` 集中去重及分页结束判断，`hooks/useAutoLoad.ts` 统一四类列表的滚动加载，`ContentReader` 复用正文和评论，`ContentTabLink` 统一独立阅读入口。Cookie 在同页修改与跨标签页修改使用同一失效流程，旧请求不能回填已清空的数据。时间由后端输出带时区的 ISO 字符串，由浏览器统一按本地时区显示。

验证命令：`cd backend && go test ./... && go vet ./...`；`cd frontend && pnpm test && pnpm build`。浏览器交互验证使用隔离的测试数据，不将测试 Cookie 发往知乎。个人账号接口的在线表现还受登录状态、限流和接口变更影响；自动化测试不等同于全部上游接口的实时可用性保证。

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

## 服务器部署

在本机安装 Go、pnpm 和 Docker 后，执行 `./scripts/build-image.sh`，交叉编译 Linux AMD64 后端并构建前端 OpenResty 和后端镜像。脚本将前端构建到 `/zh/` 路径。通过 `docker save` / `docker load` 传输两个镜像，服务器使用 `compose.yaml` 启动；前后端仅在服务器回环地址监听 18788 和 18787。服务器已有的 HTTPS OpenResty 站点可引入 `deploy/openresty-zhijian.conf` 将 `/zh/` 转发到前端容器。

可在服务器部署目录的 `.env` 中设置 `ZHIHU_ACCESS_SECRET`，不要将该文件加入镜像或提交仓库。该设置允许能访问网站的用户使用搜索兜底；应按使用范围配置站点访问控制。`/zh/` 与同域名的其他网站共用浏览器来源，应确保同域页面可信，以免其他脚本读取浏览器中保存的 Cookie。
