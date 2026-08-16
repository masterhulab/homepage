/* =========================================================
 * MasterHu Homepage Script
 * Author: MasterHu
 * Website: https://masterhu.com.cn
 * License: CC BY-NC 4.0
 * ========================================================= */

(function () {
  "use strict";

  /* Storage Utility (LocalStorage Wrapper) */
  const Storage = {
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn("LocalStorage access denied", e);
      }
    },
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn("LocalStorage read failed", e);
        return null;
      }
    }
  };

  /* =========================================================================
   * Configuration
   * ========================================================================= */

  // config.js is the content source. Theme data lives there and only there;
  // if it is missing, the theme list is simply empty (the page renders with
  // the :root defaults and content areas stay blank — same as everywhere else).
  const EXT_CFG = (typeof window !== "undefined" && window.SITE_CONFIG) ? window.SITE_CONFIG : null;

  const THEME_CONFIG = (EXT_CFG && EXT_CFG.themes && EXT_CFG.themes.classes && EXT_CFG.themes.classes.length)
    ? {
        classes: EXT_CFG.themes.classes.slice(),
        names: (EXT_CFG.themes.names || []).slice(),
        icons: (EXT_CFG.themes.icons || []).slice()
      }
    : { classes: [], names: [], icons: [] };

  const MOTTO_TEXTS = (EXT_CFG && EXT_CFG.mottos && EXT_CFG.mottos.length)
    ? EXT_CFG.mottos.slice()
    : [
        "不忘初心，方得始终!",
        "Stay hungry Stay foolish!"
      ];

  const HERO_TYPING_INTERVAL = (EXT_CFG && Number.isFinite(EXT_CFG.typingInterval))
    ? EXT_CFG.typingInterval
    : 200;

  const BIRTH_TIME = (EXT_CFG && EXT_CFG.birthTime) || "2026/01/01 00:00:00";
  const UPTIME_RENDER_ID = "run-time";

  // Precompute timestamp to avoid parsing the date repeatedly in the loop
  let BIRTH_TIMESTAMP = new Date(BIRTH_TIME).getTime();
  if (!Number.isFinite(BIRTH_TIMESTAMP)) {
    console.warn("Invalid birthTime:", BIRTH_TIME, "— falling back to now.");
    BIRTH_TIMESTAMP = Date.now();
  }

  /* =========================================================================
   * Render Layer
   * Builds the DOM from SITE_CONFIG with createElement/textContent only —
   * never innerHTML for config strings — so the same renderer can safely
   * consume data from a remote source later.
   * ========================================================================= */

  /** Create an element; attrs is a plain object, text is optional. */
  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          node.setAttribute(key, attrs[key]);
        }
      }
    }
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  /** SVG <use> reference into the icon sprite. */
  function iconSvg(iconId, label) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    if (label) svg.setAttribute("aria-label", label);
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "./static/svg/icons.svg#" + iconId);
    svg.appendChild(use);
    return svg;
  }

  /** Apply target/rel for external links; the renderer owns the rel attribute. */
  function linkAttrs(item) {
    const attrs = { href: item.url };
    if (item.external) {
      attrs.target = "_blank";
      attrs.rel = "noopener noreferrer";
    }
    return attrs;
  }

  /** Multi-line description: lines joined with <br>, built from text nodes. */
  function descParagraph(lines) {
    const p = el("p");
    (Array.isArray(lines) ? lines : [String(lines)]).forEach((line, i) => {
      if (i > 0) p.appendChild(document.createElement("br"));
      p.appendChild(document.createTextNode(line));
    });
    return p;
  }

  function renderBrand(cfg) {
    const brand = cfg.brand || {};
    const navBrand = document.getElementById("nav-brand");
    if (navBrand) navBrand.textContent = brand.navBrand || "";
    const loading = document.getElementById("loading-brand");
    if (loading) loading.textContent = brand.loading || "";

    const signature = document.getElementById("footer-signature");
    if (signature) signature.textContent = brand.signature || "";
    const link = document.getElementById("footer-link");
    if (link) {
      link.setAttribute("href", brand.siteUrl || "#");
      if (cfg.hero && cfg.hero.name) link.setAttribute("aria-label", cfg.hero.name);
    }
    const rights = document.getElementById("footer-rights");
    if (rights) rights.textContent = brand.footer || "";
  }

  function renderNav(cfg) {
    const list = document.getElementById("nav-links");
    if (!list) return;
    const links = (cfg.nav && cfg.nav.links) || [];

    links.forEach((item) => {
      if (!item.url || !item.text) return;
      const a = el("a", linkAttrs(item), (item.icon ? item.icon + " " : "") + item.text);
      const li = el("li");
      li.appendChild(a);
      list.appendChild(li);
    });

    // Theme toggle rides along as the last nav entry
    const toggleLi = el("li");
    toggleLi.appendChild(el("button", {
      "class": "nav-theme-toggle",
      "type": "button",
      "aria-label": "Toggle theme"
    }));
    list.appendChild(toggleLi);
  }

  function renderSidebar(cfg) {
    const avatar = document.getElementById("sidebar-avatar");
    if (avatar && cfg.avatar) {
      avatar.style.backgroundImage = 'url("' + cfg.avatar + '")';
      avatar.setAttribute("role", "img");
      if (cfg.avatarAlt) avatar.setAttribute("aria-label", cfg.avatarAlt);
    }

    const bio = document.getElementById("sidebar-bio");
    if (bio) {
      ((cfg.sidebar && cfg.sidebar.bio) || []).forEach((item) => {
        if (!item || !item.text) return;
        const row = el("div", { "class": "mh-bio-item" });
        if (item.icon) {
          row.appendChild(iconSvg(item.icon, item.label || item.text));
          row.appendChild(document.createTextNode(item.text));
        } else {
          row.appendChild(el("span", null, item.text));
        }
        bio.appendChild(row);
      });
    }

    const tags = document.getElementById("sidebar-tags");
    if (tags) {
      ((cfg.sidebar && cfg.sidebar.tags) || []).forEach((tag) => {
        tags.appendChild(el("div", { "class": "mh-tags-item" }, tag));
      });
    }

    const timeline = document.getElementById("sidebar-timeline");
    if (timeline) {
      ((cfg.sidebar && cfg.sidebar.timeline) || []).forEach((item) => {
        if (!item) return;
        const li = el("li", {
          "class": "mh-timeline-item" + (item.more ? " mh-timeline-item--more" : "")
        });
        li.appendChild(el("div", { "class": "mh-timeline-dot" }));
        li.appendChild(el("div", { "class": "mh-timeline-text" }, item.text || "..."));
        li.appendChild(el("div", { "class": "mh-timeline-date" }, item.date || "..."));
        timeline.appendChild(li);
      });
    }
  }

  function renderHero(cfg) {
    const hero = cfg.hero || {};

    const avatarBox = document.getElementById("hero-avatar");
    if (avatarBox && cfg.avatar) {
      avatarBox.appendChild(el("img", {
        src: cfg.avatar,
        alt: cfg.avatarAlt || "Avatar",
        width: "120",
        height: "120",
        loading: "eager",
        fetchpriority: "high",
        decoding: "async"
      }));
    }

    const greeting = document.getElementById("hero-greeting");
    if (greeting) {
      greeting.appendChild(document.createTextNode(hero.greeting + " "));
      greeting.appendChild(el("span", { "class": "gradient-text greeting-name" }, hero.name));
    }

    const actions = document.getElementById("hero-actions");
    if (actions) {
      (hero.social || []).forEach((item) => {
        if (!item || !item.icon) return;
        if (item.sponsor) {
          const btn = el("button", {
            "class": "hero-actions-item js-sponsor-trigger",
            "type": "button",
            "aria-label": item.label || item.tip || "Sponsor"
          });
          if (item.image) btn.setAttribute("data-image", item.image);
          btn.appendChild(iconSvg(item.icon, item.label));
          btn.appendChild(el("div", { "class": "hero-actions-item-tip" }, item.tip));
          actions.appendChild(btn);
        } else if (item.url) {
          const a = el("a", Object.assign({ "class": "hero-actions-item" }, linkAttrs(item)));
          if (item.label) a.setAttribute("aria-label", item.label);
          a.appendChild(iconSvg(item.icon, item.label));
          a.appendChild(el("div", { "class": "hero-actions-item-tip" }, item.tip));
          actions.appendChild(a);
        }
      });
    }
  }

  function renderCardGrid(gridEl, cards, cardClass) {
    const kind = cardClass === "mh-site-card" ? "site" : "project";
    cards.forEach((card) => {
      if (!card || !card.url || !card.title) return;
      const a = el("a", Object.assign({ "class": cardClass }, linkAttrs(card)));
      const content = el("div", { "class": "mh-" + kind + "-content" });
      content.appendChild(el("h3", null, card.title));
      content.appendChild(descParagraph(card.desc));
      const iconBox = el("div", { "class": "mh-" + kind + "-icon" });
      iconBox.appendChild(el("img", {
        src: card.icon,
        alt: card.iconAlt || card.title,
        loading: "lazy",
        decoding: "async"
      }));
      a.appendChild(content);
      a.appendChild(iconBox);
      gridEl.appendChild(a);
    });
  }

  function renderSections(cfg) {
    const sections = cfg.sections || {};

    const siteTitle = document.getElementById("site-section-title");
    if (siteTitle) siteTitle.textContent = (sections.site && sections.site.title) || "";
    const siteGrid = document.getElementById("site-grid");
    if (siteGrid) renderCardGrid(siteGrid, (sections.site && sections.site.cards) || [], "mh-site-card");

    const projectTitle = document.getElementById("project-section-title");
    if (projectTitle) projectTitle.textContent = (sections.project && sections.project.title) || "";
    const projectGrid = document.getElementById("project-grid");
    if (projectGrid) renderCardGrid(projectGrid, (sections.project && sections.project.cards) || [], "mh-project-card");
  }

  function renderSkills(cfg) {
    const box = document.getElementById("skills");
    if (!box || !cfg.skills) return;
    const variants = [
      { data: cfg.skills.pc, id: "skill-pc" },
      { data: cfg.skills.mobile, id: "skill-mobile" }
    ];
    variants.forEach((entry) => {
      if (!entry.data || !entry.data.src) return;
      box.appendChild(el("img", {
        id: entry.id,
        src: entry.data.src,
        alt: entry.data.alt || "Skills",
        width: String(entry.data.width || 0),
        height: String(entry.data.height || 0),
        loading: "lazy",
        decoding: "async"
      }));
    });
  }

  function renderReward(cfg) {
    const stack = document.getElementById("reward-stack");
    if (!stack) return;
    const rightArrow = stack.querySelector(".modal-arrow-right");
    ((cfg.reward && cfg.reward.images) || []).forEach((img) => {
      if (!img || !img.src) return;
      const node = el("img", {
        "class": "stack-img",
        src: img.src,
        alt: img.alt || "Reward QR Code",
        loading: "lazy",
        decoding: "async"
      });
      // Keep the arrows as first/last children of the stack
      stack.insertBefore(node, rightArrow || null);
    });
  }

  /** Fill every content container from the config object. */
  function renderConfig(cfg) {
    if (!cfg) return;
    renderBrand(cfg);
    renderNav(cfg);
    renderSidebar(cfg);
    renderHero(cfg);
    renderSections(cfg);
    renderSkills(cfg);
    renderReward(cfg);
  }

  /* =========================================================================
   * Core Logic Section
   * ========================================================================= */

  /* UI Cache */
  let UI = {};

  /**
   * Caches DOM elements to avoid repeated queries.
   * Must run after renderConfig so dynamically built nodes are included.
   */
  function cacheUI() {
    UI = {
      html: document.documentElement,
      loading: document.querySelector(".mh-loading"),

      navBurger: document.querySelector(".nav-burger"),
      navLinks: document.querySelector(".nav-links"),
      themeButton: document.querySelector(".nav-theme-toggle"),

      modal: document.querySelector(".mh-modal"),
      modalMain: document.querySelector(".modal-main"),
      modalImage: document.querySelector(".modal-img"),
      modalStack: document.querySelector(".modal-stack"),
      // Stack logic
      modalStackItems: null,
      modalStackShow: null,
      modalStackIndex: 0,

      heroMotto: document.getElementById("hero-motto"),
      snakeImage: document.getElementById("snake-img"),
      uptimeElement: document.getElementById(UPTIME_RENDER_ID)
    };
  }

  /* Uptime Counter */
  // First paint rolls the day counter up from zero; afterwards it ticks normally.
  let uptimeAnimated = false;
  let uptimeRolling = false;

  function prefersReducedMotion() {
    return window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function renderUptime(days, hours, minutes, seconds) {
    const node = UI.uptimeElement;
    if (!node) return;

    if (days < 0) {
      node.textContent = "站点筹备中...";
      return;
    }

    const years = Math.floor(days / 365);
    const remainingDays = days % 365;

    const pad = (n) => String(n).padStart(2, "0");
    const yearDayPart = years > 0
      ? `${years}年${remainingDays}天`
      : `${days}天`;

    const timePart = `${pad(hours)} : ${pad(minutes)} : ${pad(seconds)}`;

    node.textContent = "";
    node.appendChild(document.createTextNode(yearDayPart));
    node.appendChild(document.createElement("br"));
    node.appendChild(document.createTextNode(timePart));
  }

  function updateSiteUptime() {
    // A rolling first paint owns the element until it finishes
    if (uptimeRolling) return;

    const diff = Date.now() - BIRTH_TIMESTAMP;
    if (diff < 0) {
      renderUptime(-1, 0, 0, 0);
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000) % 24;
    const minutes = Math.floor(diff / 60000) % 60;
    const seconds = Math.floor(diff / 1000) % 60;

    // Roll the day figure up once, easeOutCubic, ~1s; skip under reduced motion
    if (!uptimeAnimated && days > 0 && !prefersReducedMotion()) {
      uptimeAnimated = true;
      uptimeRolling = true;
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min((now - t0) / 900, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        renderUptime(Math.round(days * eased), hours, minutes, seconds);
        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          uptimeRolling = false;
        }
      };
      requestAnimationFrame(step);
      return;
    }
    uptimeAnimated = true;

    renderUptime(days, hours, minutes, seconds);
  }

  /**
   * Determines if a color is visually dark to adjust contrast.
   * @param {string} color - Hex or RGB color string
   * @returns {boolean} True if dark, false otherwise
   */
  function isDarkColor(color) {
    if (!color) return false;

    let r, g, b;
    if (color.startsWith("#")) {
      let hex = color.slice(1);
      if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      const rgb = color.match(/\d+/g);
      if (!rgb) return false;
      [r, g, b] = rgb.map(Number);
    }

    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128;
  }

  /**
   * Apply theme by index
   * @param {number} index - Theme index
   * @returns {number} The safe index applied
   */
  function applyTheme(index) {
    const total = THEME_CONFIG.classes.length;
    // No themes configured: leave the :root defaults and do nothing
    if (!total) return 0;
    const safeIndex = (index + total) % total;

    const html = UI.html || document.documentElement;
    THEME_CONFIG.classes.forEach(cls => html.classList.remove(cls));
    html.classList.add(THEME_CONFIG.classes[safeIndex]);

    Storage.set("MH_THEME_INDEX", safeIndex);

    if (UI.themeButton) {
      const name = THEME_CONFIG.names[safeIndex];
      const icon = THEME_CONFIG.icons[safeIndex] || "🎨";
      UI.themeButton.textContent = icon + name;
      UI.themeButton.setAttribute("aria-label", name);
    }

    if (UI.snakeImage) {
      const textColor = getComputedStyle(html)
        .getPropertyValue("--primary-text-color")
        .trim();
      // White text implies a dark background, which needs the dark snake variant
      const suffix = isDarkColor(textColor) ? "Light" : "Dark";
      const snake = EXT_CFG && EXT_CFG.snake;
      if (snake && snake.light && snake.dark) {
        UI.snakeImage.src = suffix === "Dark" ? snake.dark : snake.light;
      } else {
        UI.snakeImage.src = `./static/svg/snake-${suffix}.svg`;
      }
    }

    // Keep the mobile address bar in sync with the active theme
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      // Read from CSS so a new theme only needs a variable, not a JS entry
      const themed = getComputedStyle(document.documentElement)
        .getPropertyValue("--theme-color")
        .trim();
      themeColorMeta.setAttribute("content", themed || "#1c1c1e");
    }

    return safeIndex;
  }

  /* Modal Logic */
  /* Track the element that triggered the modal for focus restoration */
  let modalTriggerElement = null;

  function openModal(imgUrl) {
    if (!UI.modal) return;

    modalTriggerElement = document.activeElement;

    // Update main image
    if (UI.modalImage && imgUrl) {
      UI.modalImage.src = imgUrl;
    }

    // Reset stack if exists
    if (UI.modalStackShow) {
      UI.modalStackIndex = 0;
      UI.modalStackShow(0);
    }

    UI.modal.classList.add("active");
    UI.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    // Animation delay
    setTimeout(() => {
        if(UI.modalMain) UI.modalMain.classList.add("active");
    }, 100);

    // Focus trap: focus the close button
    const closeBtn = UI.modal.querySelector(".modal-close");
    if (closeBtn) setTimeout(() => closeBtn.focus(), 150);
  }

  function closeModal() {
    if (!UI.modal) return;

    if (UI.modalMain) UI.modalMain.classList.remove("active");

    setTimeout(() => {
      UI.modal.classList.remove("active");
      UI.modal.setAttribute("aria-hidden", "true");
      // data:, instead of "" — an empty src re-requests the page URL
      if (UI.modalImage) UI.modalImage.src = "data:,";
      document.body.classList.remove("modal-open");

      // Restore focus to the trigger element
      if (modalTriggerElement && typeof modalTriggerElement.focus === "function") {
        modalTriggerElement.focus();
        modalTriggerElement = null;
      }
    }, 200);
  }

  /**
   * Initializes modal interactions (clicks, keyboard, swipes).
   */
  function initModal() {
    if (!UI.modal) return;

    // Event Delegation for Sponsors
    document.addEventListener("click", (e) => {
        const trigger = e.target.closest(".js-sponsor-trigger");
        if (trigger) {
            e.preventDefault();
            const imgUrl = trigger.getAttribute("data-image");
            openModal(imgUrl);
        }
    });

    // Close on click outside
    UI.modal.addEventListener("click", (e) => {
      if (e.target === UI.modal) closeModal();
    });

    // Close on button click
    const closeBtn = UI.modal.querySelector(".modal-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    });

    // Focus Trap + Arrow Key Navigation
    UI.modal.addEventListener("keydown", (e) => {
      if (!UI.modal.classList.contains("active")) return;

      // Arrow keys to switch images in stack
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && UI.modalStackItems) {
        e.preventDefault();
        if (e.key === "ArrowLeft") {
          UI.modalStackIndex = (UI.modalStackIndex - 1 + UI.modalStackItems.length) % UI.modalStackItems.length;
        } else {
          UI.modalStackIndex = (UI.modalStackIndex + 1) % UI.modalStackItems.length;
        }
        UI.modalStackShow(UI.modalStackIndex);
        return;
      }

      // Tab focus trap
      if (e.key !== "Tab") return;

      const focusable = UI.modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Mobile Stack Swipe Logic
    if (UI.modalStack) {
      const items = Array.from(UI.modalStack.querySelectorAll(".stack-img"));
      const arrowLeft = UI.modalStack.querySelector(".modal-arrow-left");
      const arrowRight = UI.modalStack.querySelector(".modal-arrow-right");

      if (items.length) {
        UI.modalStackItems = items;
        UI.modalStackIndex = 0;

        UI.modalStackShow = (i) => {
          items.forEach((img, idx) => {
            img.style.display = idx === i ? "block" : "none";
          });
        };

        // Initialize first show
        UI.modalStackShow(0);

        const goNext = () => {
          UI.modalStackIndex = (UI.modalStackIndex + 1) % items.length;
          UI.modalStackShow(UI.modalStackIndex);
        };

        const goPrev = () => {
          UI.modalStackIndex = (UI.modalStackIndex - 1 + items.length) % items.length;
          UI.modalStackShow(UI.modalStackIndex);
        };

        // Touch events
        let startX = 0;
        let touching = false;
        const threshold = 40;

        UI.modalStack.addEventListener("touchstart", (e) => {
          if (!e.touches || !e.touches[0]) return;
          touching = true;
          startX = e.touches[0].clientX;
        });

        UI.modalStack.addEventListener("touchend", (e) => {
          if (!touching || !e.changedTouches || !e.changedTouches[0]) return;
          touching = false;
          const endX = e.changedTouches[0].clientX;
          const diff = endX - startX;

          if (Math.abs(diff) < threshold) return;
          diff < 0 ? goNext() : goPrev();
        });

        // Arrow clicks
        arrowLeft?.addEventListener("click", (e) => {
          e.stopPropagation();
          goPrev();
        });

        arrowRight?.addEventListener("click", (e) => {
          e.stopPropagation();
          goNext();
        });
      }
    }
  }

  /* Initializers */

  function initTheme() {
    let idx = parseInt(Storage.get("MH_THEME_INDEX"), 10);
    if (!Number.isFinite(idx)) idx = 0;
    idx = applyTheme(idx);
    UI.themeButton?.addEventListener("click", () => {
      idx = applyTheme(idx + 1);
    });
  }

  function initMobileNav() {
    if (!UI.navBurger || !UI.navLinks) return;

    const isMobile = !window.matchMedia("(min-width: 801px)").matches;

    // Mobile: nav is visually hidden on load — hide from screen readers too
    if (isMobile) {
      UI.navLinks.setAttribute("aria-hidden", "true");
    }

    const closeNav = () => {
      UI.navLinks.classList.remove("nav-active");
      UI.navBurger.classList.remove("toggle");
      document.body.classList.remove("nav-open");
      UI.navBurger.setAttribute("aria-expanded", "false");
      UI.navLinks.setAttribute("aria-hidden", "true");
    };

    UI.navBurger.addEventListener("click", () => {
      UI.navLinks.classList.toggle("nav-active");
      UI.navBurger.classList.toggle("toggle");
      document.body.classList.toggle("nav-open");

      const expanded = UI.navBurger.getAttribute("aria-expanded") === "true";
      UI.navBurger.setAttribute("aria-expanded", expanded ? "false" : "true");
      UI.navLinks.setAttribute("aria-hidden", expanded ? "true" : "false");
    });

    UI.navBurger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        UI.navBurger.click();
      }
    });

    // Reset nav state when the viewport crosses the 801px breakpoint (see mobile.css)
    const mq = window.matchMedia("(min-width: 801px)");
    const syncNavForViewport = (e) => {
      if (e.matches) {
        UI.navLinks.classList.remove("nav-active");
        UI.navBurger.classList.remove("toggle");
        document.body.classList.remove("nav-open");
        UI.navBurger.setAttribute("aria-expanded", "false");
        UI.navLinks.removeAttribute("aria-hidden");
      } else if (!UI.navLinks.classList.contains("nav-active")) {
        UI.navLinks.setAttribute("aria-hidden", "true");
      }
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", syncNavForViewport);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(syncNavForViewport);
    }

    UI.navLinks.addEventListener("click", (e) => {
      if (e.target.closest("a, .nav-theme-toggle")) {
        closeNav();
      }
    });

    document.addEventListener("click", (e) => {
      if (
        UI.navLinks.classList.contains("nav-active") &&
        !e.target.closest(".nav-burger") &&
        !e.target.closest(".nav-links")
      ) {
        closeNav();
      }
    });
  }

  /**
   * Initializes the typewriter effect for the hero section motto.
   */
  function initHeroTyping() {
    if (!UI.heroMotto) return;
    if (!MOTTO_TEXTS.length) {
      UI.heroMotto.textContent = "";
      return;
    }

    // The typewriter is aria-hidden, so mirror the motto as static text
    const mottoAlt = document.getElementById("hero-motto-alt");
    if (mottoAlt) mottoAlt.textContent = MOTTO_TEXTS[0];

    let mottoIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let pauseTicks = 0;

    const tick = () => {
      if (pauseTicks-- > 0) return;

      const text = MOTTO_TEXTS[mottoIndex];
      if (!deleting) {
        charIndex += 1;
        UI.heroMotto.textContent = text.slice(0, charIndex);
        if (charIndex === text.length) {
          deleting = true;
          pauseTicks = 20;
        }
      } else {
        charIndex -= 1;
        UI.heroMotto.textContent = text.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          mottoIndex = (mottoIndex + 1) % MOTTO_TEXTS.length;
          pauseTicks = 10;
        }
      }
    };

    let timer = setInterval(tick, HERO_TYPING_INTERVAL);
    document.addEventListener("visibilitychange", () => {
      clearInterval(timer);
      if (!document.hidden) {
        timer = setInterval(tick, HERO_TYPING_INTERVAL);
      }
    });
  }

  /**
   * Updates the footer year dynamically.
   */
  function updateFooterYear() {
    const node = document.getElementById("footer-year");
    if (!node) return;

    const now = new Date().getFullYear();
    const birthYear = new Date(BIRTH_TIME).getFullYear();

    node.textContent = now > birthYear
      ? birthYear + " - " + now
      : String(now);
    node.setAttribute("datetime", String(now));
  }

  /**
   * Replaces indefinitely-pending stats placeholders.
   */
  function initStatsFallback() {
    setTimeout(() => {
      ["mh_site_pv", "mh_site_uv", "mh_page_pv"].forEach((id) => {
        const node = document.getElementById(id);
        if (node && node.querySelector(".mh-inline-loading")) {
          node.textContent = "—";
        }
      });
    }, 8000);
  }

  /**
   * Reveal-on-scroll for cards and the skills banner: elements start hidden
   * (CSS) and get .mh-in the first time they enter the viewport. The same
   * observer keeps pausing/resuming the card icon float animation off-screen.
   */
  function initCardAnimationObserver() {
    const cards = document.querySelectorAll(
      ".mh-site-card, .mh-project-card, .mh-skills img"
    );
    if (!cards.length) return;

    if (!("IntersectionObserver" in window)) {
      // No observer support: show everything immediately
      cards.forEach((card) => card.classList.add("mh-in"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("mh-in");
          observer.unobserve(entry.target);
        }
        const icon = entry.target.querySelector("img");
        if (icon) {
          icon.style.animationPlayState = entry.isIntersecting ? "running" : "paused";
        }
      });
    }, { threshold: 0.1 });

    cards.forEach((card) => observer.observe(card));
  }

  /**
   * Nav scroll state: the pill shrinks and its glass darkens once the page
   * scrolls past the top. rAF-throttled so the scroll handler stays cheap.
   */
  function initNavScrollState() {
    const nav = document.querySelector(".mh-nav");
    if (!nav) return;

    let ticking = false;
    const update = () => {
      nav.classList.toggle("mh-scrolled", window.scrollY > 24);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  // Loading removal logic with safety timeout
  function removeLoading() {
    if (!UI.loading || UI.loading.classList.contains("hide")) return;

    UI.loading.classList.add("hide");
    setTimeout(() => {
      UI.loading.style.display = "none";
    }, 600);
  }

  /* Bootstrap */
  document.addEventListener("DOMContentLoaded", () => {
    // The overlay only guards the first render pass. Waiting for window.load
    // would keep it up until every third-party asset arrives, and those can
    // hang for minutes behind a proxy.
    setTimeout(removeLoading, 400);
    // Last resort in case any bootstrap step below throws
    setTimeout(removeLoading, 5000);

    // Content first: the render layer must fill the containers before
    // cacheUI snapshots them and the interaction layer binds events.
    renderConfig(EXT_CFG);
    cacheUI();
    initTheme();
    initMobileNav();
    initModal();
    initHeroTyping();
    updateFooterYear();

    // Uptime timer: only starts after DOM is ready
    let uptimeTimer = setInterval(updateSiteUptime, 1000);
    updateSiteUptime();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearInterval(uptimeTimer);
      } else {
        updateSiteUptime();
        clearInterval(uptimeTimer);
        uptimeTimer = setInterval(updateSiteUptime, 1000);
      }
    });

    // Fall back to placeholders if the tracker script is blocked
    initStatsFallback();

    // Reveal cards on scroll; pause float animations off-screen
    initCardAnimationObserver();

    // Shrink the nav pill once the page scrolls
    initNavScrollState();

  });
})();
