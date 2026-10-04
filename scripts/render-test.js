/* Render consistency check: the DOM contract between index.html containers,
 * script.js render layer and the CSS selectors. Run with node.
 *   node scripts/render-test.js
 */
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "static/js/script.js"), "utf8");
const css = ["style.css", "mobile.css", "theme.css"]
  .map(f => fs.readFileSync(path.join(root, "static/css", f), "utf8"))
  .join("\n");

let failures = 0;
const fail = (msg) => { failures++; console.log("FAIL: " + msg); };
const ok = (msg) => console.log("ok  : " + msg);

// 1. Every literal id referenced by script.js exists in index.html
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const scriptIds = new Set(
  [...script.matchAll(/getElementById\("([^"]+)"\)/g)].map(m => m[1])
);
for (const id of scriptIds) {
  if (!htmlIds.has(id)) fail(`script.js queries #${id} but index.html lacks it`);
}
ok("id contract checked (" + scriptIds.size + " literal ids, " + htmlIds.size + " in html)");

// 2. Classes the render layer emits must be styled (or intentional)
//    greeting-name: decorative marker carried over from the original markup,
//    never had its own rule. js-sponsor-trigger: behavior hook, no styling.
const intentional = new Set(["greeting-name", "js-sponsor-trigger"]);
const classChecks = [
  ["mh-bio-item"], ["mh-tags-item"], ["mh-timeline-item"],
  ["mh-timeline-item--more"], ["mh-timeline-dot"], ["mh-timeline-text"],
  ["mh-timeline-date"], ["gradient-text"], ["hero-actions-item"],
  ["hero-actions-item-tip"], ["mh-site-card"], ["mh-site-content"],
  ["mh-site-icon"], ["mh-project-card"], ["mh-project-content"],
  ["mh-project-icon"], ["stack-img"], ["nav-theme-toggle"],
];
for (const [cls] of classChecks) {
  if (intentional.has(cls)) continue;
  if (!css.includes("." + cls)) fail(`render layer emits .${cls} but no CSS rule matches`);
}
ok("emitted class coverage checked (" + classChecks.length + " classes)");

// 3. Selector queries in script.js: either in static html or in the render output
const staticClasses = ["mh-loading", "nav-burger", "nav-links", "mh-modal",
  "modal-main", "modal-img", "modal-stack", "modal-close",
  "modal-arrow-left", "modal-arrow-right"];
for (const cls of staticClasses) {
  if (!html.includes(cls)) fail(`script.js queries .${cls} but index.html lacks it`);
}
// These are created by the render layer itself (el("...","class",...))
const renderedClasses = ["nav-theme-toggle", "mh-site-card", "mh-project-card"];
for (const cls of renderedClasses) {
  const inScript = new RegExp('"class":\\s*"[^"]*' + cls).test(script)
    || script.includes('"' + cls + '"');
  if (!inScript) fail(`script.js queries .${cls} but neither html nor render output provides it`);
}
ok("selector queries checked (" + (staticClasses.length + renderedClasses.length) + " selectors)");

// 4. Containers the renderers fill must exist in index.html
const containers = ["nav-brand", "nav-links", "loading-brand", "sidebar-avatar",
  "sidebar-bio", "sidebar-tags", "sidebar-timeline", "hero-avatar",
  "hero-greeting", "hero-actions", "site-section-title", "site-grid",
  "project-section-title", "project-grid", "skills", "reward-stack",
  "footer-signature", "footer-link", "footer-rights", "snake-img",
  "hero-motto", "hero-motto-alt", "footer-year"];
for (const id of containers) {
  if (!htmlIds.has(id)) fail(`render container #${id} missing from index.html`);
}
ok("render containers checked (" + containers.length + " targets)");

// 5. config.js evaluates and every icon reference exists in the sprite
const vm = require("vm");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "static/js/config.js"), "utf8"), sandbox);
const C = sandbox.SITE_CONFIG;
const sprite = fs.readFileSync(path.join(root, "static/svg/icons.svg"), "utf8");
const spriteIds = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
for (const b of C.sidebar.bio) {
  if (b.icon && !spriteIds.has(b.icon)) fail(`sidebar.bio icon ${b.icon} missing from sprite`);
}
for (const s of C.hero.social) {
  if (s.icon && !spriteIds.has(s.icon)) fail(`hero.social icon ${s.icon} missing from sprite`);
}
ok("sprite icon references checked");

// 6. Card icons referenced in config exist on disk
for (const k of ["site", "project"]) {
  for (const c of C.sections[k].cards) {
    if (!fs.existsSync(path.join(root, c.icon))) fail(`card icon missing: ${c.icon}`);
  }
}
ok("card icon files checked");

// 7. Renderer ordering: renderConfig must run before cacheUI in bootstrap
const renderPos = script.indexOf("renderConfig(EXT_CFG);");
const cachePos = script.indexOf("cacheUI();");
if (renderPos < 0 || cachePos < 0 || renderPos > cachePos) {
  fail("bootstrap must call renderConfig before cacheUI");
} else {
  ok("bootstrap ordering: renderConfig precedes cacheUI");
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL RENDER CHECKS PASSED");
process.exit(failures ? 1 : 0);
