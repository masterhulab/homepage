# MasterHu Homepage | 个人主页模板

![Version](https://img.shields.io/badge/version-1.0.0-blue)

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-green)
![HTML](https://img.shields.io/badge/HTML-5-orange)
![CSS](https://img.shields.io/badge/CSS-3-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)

简洁优雅的静态个人主页模板，基于原生 HTML / CSS / JavaScript 构建。零依赖、零构建工具，开箱即用，专为开发者和设计师打造。

---

## ✨ 特性

- 🎨 **多主题支持** - 内置 6 套精美配色方案，支持一键切换与 LocalStorage 持久化
- 📱 **全端响应式** - 完美适配桌面端、平板、手机，包含移动端专属交互
- ⚡ **极致轻量** - 纯原生技术栈，无 Node.js/Webpack 依赖，核心代码体积极小
- 🎭 **沉浸式体验** - 毛玻璃拟态 (Glassmorphism) 设计，配合流畅的 iOS 风格过渡动画
- ⌨️ **动态交互** - 首页打字机效果、图片画廊弹窗（支持键盘方向键切换）、多层渐变加载动画
- 📊 **数据统计** - 集成自定义访问统计，实时展示站点热度
- 🧩 **数据驱动** - 页面内容全部由 `static/js/config.js` 渲染，改配置即改页面，为未来接入后台管理预留了同一份数据契约

## 🌐 在线预览

访问示例站点: **[masterhu.com.cn](https://masterhu.com.cn/)**

## 📂 项目结构

```
homepage/
├── index.html              # 页面入口 (HTML5 语义化结构)
├── 404.html                # 趣味 404 页面
├── .gitattributes          # Git 换行符规范 (LF)
├── .gitignore              # Git 忽略规则
├── LICENSE                 # 开源协议 (CC BY-NC 4.0)
├── static/
│   ├── css/
│   │   ├── style.css       # 核心样式 (PC端布局、动画、组件)
│   │   ├── mobile.css      # 移动端适配样式
│   │   └── theme.css       # 主题变量 (CSS Variables)
│   ├── js/
│   │   ├── config.js       # 站点内容数据源（改内容就改它）
│   │   └── script.js       # 渲染层 + 交互逻辑 (无依赖，ES6+)
│   ├── img/                # 图片资源 (头像、背景、二维码)
│   ├── fonts/              # Web 字体 (Pacifico)
│   └── svg/                # SVG 图标 Sprite 系统
├── scripts/
│   ├── verify.py           # 零依赖校验器 (断链/结构/版本/外部阻塞资源)
│   └── release.py          # 版本号传播 (badge + ?v= + generator)
├── .githooks/              # 可选 commit-msg 钩子 (强制提交格式)
└── README.md               # 项目文档
```

## 🚀 快速开始

### 方式一：直接克隆 (推荐)

```bash
git clone https://github.com/masterhulab/homepage.git
cd homepage
```

### 方式二：下载 ZIP

点击右上角 "Code" -> "Download ZIP" 下载并解压。

### 本地预览

由于浏览器安全策略 (CORS)，直接双击打开 `index.html` 可能会导致部分图标或字体无法加载。建议使用本地服务器：

**Python 3:**

```bash
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

**VS Code:**
安装 "Live Server" 插件，右键 `index.html` 选择 "Open with Live Server"。

## ✅ 发布前检查清单

在部署之前，请确保你已经完成了以下修改：

- [ ]  **站点内容**: 修改 `static/js/config.js` 中的 `brand`、`nav`、`hero`、`sidebar`、`sections` 等字段——页面上的导航、卡片、时间线、页脚全部由这个文件渲染。
- [ ]  **SEO 信息**: 修改 `index.html` `<head>` 中的 `<title>`、`description`、Open Graph 与 JSON-LD。这些标签刻意保持静态——社交平台爬虫不执行 JS，动态注入会导致分享预览失效。
- [ ]  **图片资源**: 替换 `static/img/` 下的 `avatar.gif` (头像) 和 `background.webp` (背景图)。
- [ ]  **技能图标**: 替换 `static/svg/` 下的 `skills-pc.svg`（桌面）与 `skills-wap.svg`（移动），并同步 `config.js` 中 `skills` 字段的 `width`/`height`。图标已自托管，不请求外部服务。
- [ ]  **统计代码**: 在 `index.html` 底部替换默认统计脚本（`insight.masterhu.com.cn`），或删除。
- [ ]  **主题名称**: 若修改了 `config.js` 中的 `themes` 字段，`<head>` 内联 FOUC 防闪烁脚本会自动读取 `SITE_CONFIG.themes.classes`，无需额外同步。

## 🛠️ 配置指南

本项目采用**数据驱动渲染**：`static/js/config.js` 是页面内容的唯一数据源，`script.js` 的渲染层读取它构建 DOM（纯 `textContent`，不拼 HTML 字符串，天然防注入）。改任何内容字段，重新部署即生效。

### 1. 内容配置 (`config.js`)

| 字段 | 控制内容 |
|--------|----------|
| `brand` | 导航栏品牌名、加载页文案、页脚签名与版权行 |
| `nav.links` | 顶部导航链接（图标、文字、地址、是否外链） |
| `hero` | 问候语、姓名、社交按钮（GitHub / 邮箱 / 赞赏） |
| `sidebar` | 头像下方简介、标签云、时间线 |
| `sections` | "site" 与 "project" 两组卡片（标题、描述、图标、链接） |
| `skills` | 技能条图片（桌面/移动各一版，含尺寸） |
| `reward` | 赞赏弹窗中的收款二维码 |
| `themes` | 主题的 class / 名称 / 图标（三者按序一一对应） |
| `mottos` / `typingInterval` | 打字机座右铭与速度 |
| `birthTime` | 建站时间（驱动运行时长与页脚年份） |
| `notFound` | 404 页面文案 |

删掉某一项是安全的——对应区域渲染为空，不会报错。

### 2. SEO 配置 (`index.html`)

`<title>`、`meta description`、Open Graph、Twitter Card、JSON-LD **保留在 `index.html` 中静态声明**。这是刻意的设计：微信、QQ、Twitter 等平台的爬虫不执行 JavaScript，动态注入的 `og:` 标签无法被抓取。

### 3. 更换图片与图标

- **头像**: 替换 `static/img/avatar.gif`（并同步 `config.js` 的 `avatar` 字段，如路径变化）
- **背景**: 替换 `static/img/background.webp` (建议 1920x1080, WebP 格式)
- **图标**: 项目使用 SVG Sprite (`static/svg/icons.svg`)。如需新增图标，请使用 `<symbol>` 格式添加到该文件中，`config.js` 中以 `icon-xxx` id 引用。

### 4. 主题定制

项目使用 CSS 变量实现主题系统，定义在 `static/css/theme.css` 中。核心颜色变量：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `--motto-color` | 座右铭文字颜色 | `#ffffff` |
| `--timeline-dot-color` | 时间线节点颜色 | `#ffffff` |
| `--timeline-active-dot-color` | 时间线活动节点颜色 | `#09f069` |
| `--avatar-border-color` | 头像边框颜色 | `rgba(255,255,255,0.6)` |
| `--modal-bg-color` | 模态框遮罩颜色 | `rgba(20,20,20,0.6)` |
| `--modal-main-bg` | 模态框内容背景 | `rgba(18,18,18,0.96)` |

如需新增主题，复制任一现有主题并修改变量值即可。

### 5. Footer 年份

Footer 年份由 `config.js` 中的 `birthTime` 自动计算：
- 当年：只显示当前年（如 `2026`）
- 跨年：显示范围（如 `2026 - 2027`）

修改建站时间即可自动适配，无需手动更新年份。

### 6. 统计服务配置 (Analytics)

第三方资源（统计脚本、看板娘 CDN）统一在 `index.html` 末尾的 `EXTERNALS` 中声明，由注入器在
**DOMContentLoaded 之后**加载。这样任何第三方服务变慢或不可用时，首页依旧秒开——最多损失那个
挂件本身，不会白屏。

#### 默认配置 (自定义脚本)

在 `EXTERNALS` 中加入一项即可（`attrs` 支持任意属性，如 Umami 的 `data-website-id`）：

```js
// index.html
var EXTERNALS = [
  // 您自己的统计服务
  { tag: "script", attrs: { src: "https://your-analytics.com/script.js", "data-website-id": "xxxxx" } }
];
```

> ⚠️ 请勿把第三方 `<script>` / 样式表直接写进 HTML 标签——`python scripts/verify.py` 的
> `external.blocking` 检查会直接报错拦截。

#### 数据展示 (可选)

如果您希望在页脚显示 PV/UV 数据，请确保您的统计脚本能回填以下 ID 的元素：

- `mh_site_pv`: 站点总访问量
- `mh_site_uv`: 站点访客数
- `mh_page_pv`: 当前页访问量

#### 推荐替代方案

如果您还没有统计服务，推荐以下开源方案：

- **[Umami](https://umami.is/) (推荐)**:
  - ✅ 开源、免费、可私有化部署
  - ✅ 界面美观，注重隐私
- **[Counterscale](https://counterscale.dev/) (Cloudflare 专属)**:
  - ✅ 部署在 Cloudflare Workers
  - ✅ 完全免费，高性能

> **注意**: 旧版 JS 统计适配器代码已移除。统计脚本现在通过 HTML 直接引入。

## 🛫 部署

本项目是纯静态的，可以免费部署到任何静态托管平台：

- **GitHub Pages**: Settings -> Pages -> Source 选择 master 分支
- **Vercel / Netlify**: 导入仓库即可，无需构建命令
- **Cloudflare Pages**: 直接连接仓库部署

## 🛠️ 技术栈详情

- **HTML5**: 语义化标签 (main, aside, nav, header, footer, section)
- **CSS3**: CSS Variables, Flexbox, Backdrop Filter, Keyframes, `conic-gradient`, `mask`, `color-mix()`
- **JavaScript**: ES6+, IntersectionObserver, LocalStorage
- **Icons**: SVG Sprite System

## 📋 浏览器兼容性

| Chrome | Firefox | Safari | Edge | IE |
| :----: | :-----: | :----: | :--: | :-: |
| ✅ 80+ | ✅ 75+ | ✅ 13+ | ✅ 80+ | ❌ |

> **注意**: 部分高级效果（如 `color-mix()` 主题自适应发光色）需要 Chrome 111+、Firefox 113+、Safari 16.2+。旧浏览器会自动降级为固定颜色，不影响核心功能。

## 🤝 贡献与反馈

欢迎提交 Issue 或 Pull Request！

### 开发工作流

- **提交规范**：commit message 用英文，格式 `<emoji> <type>(<scope>): <描述>`，
  如 `🐛 fix(a11y): ...`；type 用 `feat` / `fix` / `perf` / `docs` / `chore` 等。
- **提交前校验**：`python scripts/verify.py`（检查断链、HTML 结构、CSS/JS 语法、版本一致性、外部阻塞资源）。
- **发布**：`python scripts/release.py --bump patch` 一次同步版本号，勿手改 `?v=`。
- **可选**：`git config core.hooksPath .githooks` 启用提交钩子，强制 message 格式。

- 🐛 [报告 Bug](https://github.com/masterhulab/homepage/issues)
- 💡 [提出建议](https://github.com/masterhulab/homepage/issues)

## 📄 开源协议

本项目采用 [CC BY-NC 4.0](LICENSE) 协议。
您可以自由地分享、修改本项目，但**禁止用于商业用途**。如需商用，请联系作者获得授权。

## 🖼️ 图片版权

- `static/img/background.webp` / `background-wap.webp`：
  基于 [ESO/F. Char](https://commons.wikimedia.org/wiki/File:Stars_Circle_over_the_Residencia_at_Cerro_Paranal.jpg)
  的摄影作品裁切、调整而成，遵循 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh) 授权。
  替换为自己图片时请一并删除本节说明。

## 🌟 支持项目

如果这个项目对您有帮助，请在 GitHub 上点个 **Star** ⭐️ 支持一下！

[![Star History Chart](https://api.star-history.com/svg?repos=masterhulab/homepage&type=Date)](https://star-history.com/#masterhulab/homepage&Date)

---

**Made with ❤️ by [MasterHu](https://masterhu.com.cn)**
