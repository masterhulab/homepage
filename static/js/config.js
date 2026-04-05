/* =========================================================
 *  MasterHu Homepage — site configuration
 * =========================================================
 *
 *  Single source of truth for the content the page renders.
 *  Edit a value, redeploy, and the next load reflects it.
 *
 *  Scope: rendered content only (nav, hero, sidebar, cards,
 *  skills, reward, 404 copy). Document metadata — <title>,
 *  description, Open Graph, JSON-LD — lives in index.html on
 *  purpose: social crawlers do not execute JS, so those tags
 *  must be static for share previews to work.
 *
 *  Every field below has a consumer. The renderer builds the
 *  DOM from this object with textContent-only helpers, so a
 *  future admin panel can serve the same shape as remote JSON
 *  without touching the renderer.
 * ========================================================= */

var SITE_CONFIG = {

  /* ---- Brand & footer text ---- */
  brand: {
    navBrand: "MasterHu's Home",
    loading: "MasterHu",
    signature: "𝓜𝓪𝓼𝓽𝓮𝓻𝓱𝓾",
    siteUrl: "https://masterhu.com.cn/",
    footer: "All Rights Reserved."
  },

  /* ---- Avatar (sidebar background, mobile hero image, 404) ---- */
  avatar: "./static/img/avatar.gif",
  avatarAlt: "MasterHu Avatar",

  /* ---- Navigation links (rendered into .nav-links) ---- */
  nav: {
    links: [
      { icon: "📖", text: "博客", url: "https://blog.masterhu.com.cn", external: true },
      { icon: "💬", text: "留言板", url: "https://blog.masterhu.com.cn/message", external: true },
      { icon: "🤝", text: "友情链接", url: "https://blog.masterhu.com.cn/friends", external: true },
      { icon: "ℹ️", text: "关于", url: "https://blog.masterhu.com.cn/about", external: true }
    ]
  },

  /* ---- Hero: greeting, name and action buttons ---- */
  hero: {
    greeting: "Hello I'm",
    name: "MasterHu",
    social: [
      {
        icon: "icon-github",
        label: "Github Profile",
        tip: "Github",
        url: "https://github.com/masterhulab",
        external: true
      },
      {
        icon: "icon-mail",
        label: "Email Contact",
        tip: "Mail",
        url: "mailto:i@masterhu.com.cn"
      },
      {
        icon: "icon-sponsor",
        label: "Sponsor/Donate",
        tip: "赞助",
        sponsor: true,
        image: "./static/img/reward.webp"
      }
    ]
  },

  /* ---- Sidebar: bio, tags, timeline ---- */
  sidebar: {
    bio: [
      { icon: "icon-location", label: "Location: China", text: "China" },
      { icon: "icon-secret", label: "Identity: Private", text: "Secret" },
      { text: "🏷️ Developer" }
    ],
    tags: ["嵌入式", "linux", "后端", "前端", "C/C++", "骑行", "跑者", "电子竞技"],
    timeline: [
      { text: "创建个人主页", date: "2026.1" },
      { text: "搭建博客", date: "2025.1" },
      { text: "搭建第一个网站(自用)", date: "2024.3" },
      { text: "注册域名 masterhu.com.cn", date: "2024.1" },
      { more: true },
      { text: "第一篇博客", date: "2020.2" }
    ]
  },

  /* ---- Content sections: the "site" and "project" card grids ---- */
  sections: {
    site: {
      title: "site",
      cards: [
        {
          title: "📖博客",
          desc: ["📝记录&分享", "The Joy of Sharing"],
          icon: "./static/svg/blog.svg",
          iconAlt: "Blog Icon",
          url: "https://blog.masterhu.com.cn",
          external: true
        },
        {
          title: "💬 留言板",
          desc: ["🤙 欢迎留言交流"],
          icon: "./static/svg/message.svg",
          iconAlt: "Message Icon",
          url: "https://blog.masterhu.com.cn/message",
          external: true
        },
        {
          title: "🤝 友情链接",
          desc: ["👥 小伙伴们"],
          icon: "./static/svg/friends.svg",
          iconAlt: "Friends",
          url: "https://blog.masterhu.com.cn/friends",
          external: true
        },
        {
          title: "ℹ️ 关于",
          desc: ["👨‍💻 了解更多"],
          icon: "./static/svg/about.svg",
          iconAlt: "About",
          url: "https://blog.masterhu.com.cn/about",
          external: true
        }
      ]
    },
    project: {
      title: "project",
      cards: [
        {
          title: "🏠 个人主页",
          desc: ["🚀一键部署的静态个人主页"],
          icon: "./static/svg/homepage.svg",
          iconAlt: "Homepage",
          url: "https://github.com/masterhulab/homepage",
          external: true
        },
        {
          title: "📊 MHAnalytics",
          desc: ["📈 网站访问分析系统"],
          icon: "./static/svg/analytics.svg",
          iconAlt: "Analytics",
          url: "https://github.com/masterhulab/MHAnalytics",
          external: true
        }
      ]
    }
  },

  /* ---- Skills banner (hotlinked from skillicons.dev; edit the i= list). ---- */
  skills: {
    pc: { src: "https://skillicons.dev/icons?i=html,css,js,ts,react,vue,nodejs,python,go,c,cpp,linux,docker,git,github,postman,vscode,markdown,photoshop,bash&perline=16", alt: "Technical Skills Icons", width: 960, height: 64 },
    mobile: { src: "https://skillicons.dev/icons?i=html,css,js,ts,react,vue,nodejs,python,go,c,cpp,linux,docker,git,github,postman,vscode,markdown,photoshop,bash&perline=8", alt: "Technical Skills Icons", width: 360, height: 128 }
  },

  /* ---- Reward modal images (sponsor QR codes). ---- */
  reward: {
    images: [
      { src: "./static/img/alipay.webp", alt: "Alipay QR Code" },
      { src: "./static/img/wechat.webp", alt: "WeChat QR Code" }
    ]
  },

  /* ---- Theme switcher: classes / names / icons must stay 1:1. ---- */
    themes: {
    classes: [
      "theme-clear", "theme-dim", "theme-fresh",
      "theme-blur", "theme-sky"
    ],
    names: [
      "清晰原图", "暗淡原图", "清新卡片",
      "背景模糊", "蔚蓝天际"
    ],
    icons: ["🖼️", "🌗", "🍃", "🌫️", "🌊"]
  },

  /* ---- Hero motto (typewriter). ---- */
  mottos: [
    "不忘初心，方得始终!",
    "Stay hungry Stay foolish!"
  ],
  typingInterval: 200,

  /* ---- Build date — drives the "running time" counter and footer year. ---- */
  birthTime: "2026/01/01 00:00:00",

  /* ---- GitHub contribution snake, one variant per background tone. ---- */
  snake: {
    light: "./static/svg/snake-Light.svg",
    dark: "./static/svg/snake-Dark.svg"
  }
};
