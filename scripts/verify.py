#!/usr/bin/env python3
"""
Repository verifier for the homepage template.

Runs dependency-free checks against the working tree or a single git ref.
Exits non-zero on any ERROR finding, so it can gate a commit.

    python scripts/verify.py              # working tree
    python scripts/verify.py --ref v1.2.1 # one revision
    python scripts/verify.py --strict     # warnings fail the run
    python scripts/verify.py --verbose    # include INFO findings

Severity model:
    ERROR  broken as shipped (dead asset, syntax error, unbalanced markup,
           editor injection). Fails the run.
    WARN   off-convention. Reported; fails only under --strict.
    INFO   advisory noise. Hidden unless --verbose, never fails.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from html.parser import HTMLParser

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --------------------------------------------------------------------------
# Policy constants
# --------------------------------------------------------------------------

VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}

ASSET_EXT = re.compile(
    r"\.(css|js|mjs|svg|png|jpe?g|gif|webp|ico|ttf|woff2?|json|xml|txt)$", re.I
)

HTML_FILES = ("index.html", "404.html")

# Cross-origin stylesheets and scripts referenced straight from markup.
# Hints that never request a blocking resource are exempt, and so are the
# <meta>/og links handled elsewhere.
BLOCKING_TAG_RE = re.compile(r"<(script|link)\b([^>]*)>", re.I)

# Floating tags on a third-party origin: unreproducible builds and no long cache
UNPINNED_RE = re.compile(r"https?://[^\"'\s)]*/(?:latest|master|main|HEAD)/")
# Docs must not advertise what the tree does not ship
README_THEME_RE = re.compile(r"内置\s*(\d+)\s*套")
README_404_CLAIM = "- 🚫 **404 趣味页**"
CFG_CLASSES_RE = re.compile(r"classes:\s*\[(.*?)\]", re.S)
ATTR_RE = re.compile(r"([a-zA-Z][\w:-]*)\s*=\s*\"([^\"]*)\"")
HINT_REL = {"preconnect", "prefetch", "dns-prefetch", "canonical", "icon",
            "shortcut", "apple-touch-icon", "manifest", "modulepreload"}
CSS_DIR = "static/css"
JS_DIR = "static/js"

# A max-width and a min-width of the same value both match at that pixel.
MEDIA_RE = re.compile(r"@media[^{]*\((min|max)-width:\s*(\d+)px\)")

LEADING_COMMENT_RE = re.compile(r"\s*<!--.*?-->", re.S)


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

def read(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return None


def rel(root, path):
    return os.path.relpath(path, root).replace(os.sep, "/")


def walk(root, exts):
    for base, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs
                   if d not in (".git", ".workbuddy", "node_modules")]
        for name in names:
            if name.lower().endswith(exts):
                yield os.path.join(base, name)


class Finding:
    __slots__ = ("rule", "severity", "message", "location")

    def __init__(self, rule, severity, message, location=""):
        self.rule, self.severity = rule, severity
        self.message, self.location = message, location

    def as_dict(self):
        return {"rule": self.rule, "severity": self.severity,
                "message": self.message, "location": self.location}

    def __str__(self):
        loc = f" [{self.location}]" if self.location else ""
        return f"{self.severity:5} {self.rule:20}{loc} {self.message}"


def strip_leading_comments(text):
    """Drop BOM/whitespace and comment blocks ahead of the first element.

    The HTML parser tolerates comments before the doctype, so a leading
    license banner must not be mistaken for a missing doctype.
    """
    t = text.lstrip("\ufeff")
    while True:
        m = LEADING_COMMENT_RE.match(t)
        if not m:
            return t.lstrip("\ufeff \t\r\n")
        t = LEADING_COMMENT_RE.sub("", t, count=1)


# --------------------------------------------------------------------------
# HTML parsing
# --------------------------------------------------------------------------

class MarkupAudit(HTMLParser):
    """Collect tag balance, ids, images and blank-target links in one pass."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ids = []
        self.imgs = []
        self.blanks = []
        self.unbalanced = []
        self._svg_depth = 0

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "svg":
            self._svg_depth += 1
        elif "id" in d:
            self.ids.append(d["id"])
        if tag == "img":
            self.imgs.append((d, self.getpos()[0]))
        if tag == "a" and d.get("target") == "_blank":
            self.blanks.append((d, self.getpos()[0]))
        if tag in VOID_TAGS and self._svg_depth == 0:
            return
        self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        d = dict(attrs)
        if "id" in d:
            self.ids.append(d["id"])
        if tag == "img":
            self.imgs.append((d, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag == "svg":
            while self.stack:
                if self.stack.pop() == "svg":
                    break
            self._svg_depth = max(0, self._svg_depth - 1)
            return
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        elif tag in self.stack:
            # Optional-close markup: unwind until the matching open tag pops.
            while self.stack:
                if self.stack.pop() == tag:
                    break
        else:
            self.unbalanced.append(f"stray </{tag}> at line {self.getpos()[0]}")

    def leftovers(self):
        return [t for t in self.stack if t not in VOID_TAGS]


# --------------------------------------------------------------------------
# Reference extraction
# --------------------------------------------------------------------------

REF_RE = [
    re.compile(r"""\b(?:src|href)\s*=\s*["']([^"']+)["']""", re.I),
    re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", re.I),
]


def normalize_ref(raw, base_dir):
    ref = raw.strip()
    if not ref or ref.startswith(("http://", "https://", "//", "data:", "mailto:",
                                  "tel:", "javascript:", "#")):
        return None
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    if not ref:
        return None
    relp = ref.lstrip("/") if ref.startswith("/") else (
        f"{base_dir}/{ref}" if base_dir else ref)
    parts = []
    for seg in relp.split("/"):
        if seg in ("", "."):
            continue
        if seg == "..":
            if parts:
                parts.pop()
            continue
        parts.append(seg)
    return "/".join(parts)


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------

def check_externals(root, finding):
    """A cross-origin script or stylesheet in markup can delay first paint.

    Third-party extras belong in the post-load injector (index.html EXTERNALS),
    where a slow CDN degrades to a missing widget instead of a blank page.
    """
    for html in HTML_FILES:
        text = read(os.path.join(root, html))
        if text is None:
            continue
        for tag, attrs_src in BLOCKING_TAG_RE.findall(text):
            attrs = dict(ATTR_RE.findall(attrs_src))
            if attrs.get("rel", "").lower() in HINT_REL:
                continue
            url = attrs.get("src") or attrs.get("href") or ""
            if url.startswith(("http://", "https://")):
                finding("external.blocking", "ERROR",
                        f"external {tag} loaded from markup: {url}", html)


def check_pinned(root, finding):
    """A floating CDN ref (latest/master) makes builds unreproducible and
    uncacheable; every third-party URL must name a version."""
    for path in list(HTML_FILES) + list(walk(os.path.join(root, JS_DIR), (".js",))) \
            + list(walk(os.path.join(root, CSS_DIR), (".css",))):
        full = path if os.path.isabs(path) else os.path.join(root, path)
        text = read(full)
        if not text:
            continue
        for url in UNPINNED_RE.findall(text):
            finding("external.unpinned", "ERROR",
                    f"third-party URL has no pinned version: {url}",
                    rel(root, full))


def check_docs(root, finding):
    """README must describe what actually ships — no advertised themes or pages
    that the tree does not contain."""
    readme = read(os.path.join(root, "README.md"))
    if readme is None:
        return
    cfg = read(os.path.join(root, JS_DIR, "config.js"))
    if cfg:
        m = CFG_CLASSES_RE.search(cfg)
        if m:
            have = len(re.findall(r'"[^"]+"', m.group(1)))
            claim = README_THEME_RE.search(readme)
            if claim and int(claim.group(1)) != have:
                finding("docs.theme-count", "ERROR",
                        f"README advertises {claim.group(1)} themes, config has {have}",
                        "README.md")
    if README_404_CLAIM in readme and not os.path.exists(os.path.join(root, "404.html")):
        finding("docs.missing-page", "ERROR",
                "README advertises the 404 page but 404.html is absent", "README.md")


def check_refs(root, finding):
    for html in HTML_FILES:
        text = read(os.path.join(root, html))
        if text is None:
            continue
        for pat in REF_RE:
            for raw in pat.findall(text):
                target = normalize_ref(raw, "")
                if target and ASSET_EXT.search(target):
                    if not os.path.exists(os.path.join(root, target)):
                        finding("asset.missing", "ERROR",
                                f"missing local asset {target!r}",
                                f"{html} -> {raw.strip()}")
    css_root = os.path.join(root, CSS_DIR)
    if os.path.isdir(css_root):
        for path in walk(css_root, (".css",)):
            for pat in REF_RE:
                for raw in pat.findall(read(path) or ""):
                    target = normalize_ref(raw, CSS_DIR)
                    if target and ASSET_EXT.search(target):
                        if not os.path.exists(os.path.join(root, target)):
                            finding("asset.missing", "ERROR",
                                    f"missing local asset {target!r}",
                                    f"{rel(root, path)} -> {raw.strip()}")


def check_markup(root, finding):
    for name in HTML_FILES:
        text = read(os.path.join(root, name))
        if text is None:
            continue
        low = text.lower()
        head = strip_leading_comments(text).lower()

        if not head.startswith("<!doctype html"):
            finding("html.doctype", "ERROR", "missing <!DOCTYPE html>", name)
        if "<html" in low and not re.search(r"<html[^>]*\slang=", low):
            finding("html.lang", "WARN", "<html> has no lang attribute", name)
        charset = re.search(r"<meta[^>]+charset\s*=\s*[\"']?([\w-]+)", low)
        if not charset:
            finding("html.charset", "ERROR", "missing <meta charset>", name)
        elif charset.group(1).lower() != "utf-8":
            finding("html.charset", "WARN", f"charset is {charset.group(1)}", name)
        if 'name="viewport"' not in low:
            finding("html.viewport", "ERROR", "missing viewport meta", name)
        if not re.search(r"<title>\s*\S", text, re.I):
            finding("html.title", "ERROR", "empty or missing <title>", name)
        # A noindex page is not indexed, so a description buys nothing there.
        if 'name="description"' not in low and not re.search(
                r'name="robots"[^>]*noindex', low):
            finding("html.description", "WARN", "missing meta description", name)

        parser = MarkupAudit()
        parser.feed(text)
        parser.close()

        # A stray end tag is a spec parse error but parsers ignore it; an
        # unclosed element can actually restructure the box tree.
        for stray in parser.unbalanced:
            finding("html.stray-close", "WARN", stray, name)
        for tag in parser.leftovers():
            finding("html.balance", "ERROR", f"unclosed <{tag}>", name)

        seen = {}
        for i in parser.ids:
            seen[i] = seen.get(i, 0) + 1
        for i, n in seen.items():
            if n > 1:
                finding("html.dup-id", "ERROR", f"id={i!r} used {n} times", name)

        for attrs, line in parser.imgs:
            src = attrs.get("src", "?")
            if "alt" not in attrs:
                finding("a11y.img-alt", "ERROR",
                        f"<img> without alt ({src})", f"{name}:{line}")
            if "width" in attrs and "height" in attrs:
                continue
            finding("a11y.img-dims", "WARN",
                    f"<img> without width/height ({src})", f"{name}:{line}")
        for attrs, line in parser.blanks:
            if "noopener" not in (attrs.get("rel") or "").lower():
                finding("sec.blank-rel", "WARN",
                        "target=_blank without rel=noopener", f"{name}:{line}")


def check_css(root, finding):
    boundaries = []
    css_root = os.path.join(root, CSS_DIR)
    if not os.path.isdir(css_root):
        return
    for path in walk(css_root, (".css",)):
        text = read(path) or ""
        if text.count("{") != text.count("}"):
            finding("css.braces", "ERROR",
                    f"unbalanced braces ({text.count('{')} / {text.count('}')})",
                    rel(root, path))
        for kind, value in MEDIA_RE.findall(text):
            boundaries.append((kind, int(value), rel(root, path)))

    # Only an identical value is ambiguous (both queries match at exactly Xpx).
    # A nested layer — e.g. min-width:801 base plus a max-width:1100 tablet
    # overlay — overlaps by design, so the old "min <= max" test would false-positive.
    maxvals = {value for kind, value, _ in boundaries if kind == "max"}
    for kind, nval, nfile in boundaries:
        if kind == "min" and nval in maxvals:
            finding("css.breakpoint", "WARN",
                    f"min-width {nval}px collides with an identical max-width boundary",
                    nfile)


def check_js(root, finding):
    node = shutil.which("node")
    js_root = os.path.join(root, JS_DIR)
    if not os.path.isdir(js_root):
        return
    for path in walk(js_root, (".js",)):
        name = rel(root, path)
        text = read(path) or ""
        if re.search(r"console\.log\(", text):
            finding("js.console-log", "INFO", "console.log in shipped code", name)
        if node:
            proc = subprocess.run([node, "--check", path],
                                  capture_output=True, text=True)
            if proc.returncode != 0:
                msg = (proc.stderr.strip().splitlines() or ["syntax error"])[-1]
                finding("js.syntax", "ERROR", msg, name)


def check_versions(root, finding):
    readme = read(os.path.join(root, "README.md")) or ""
    badge = re.search(r"badge/version-([0-9]+\.[0-9]+\.[0-9]+)-", readme)
    declared = badge.group(1) if badge else None
    if not declared:
        finding("version.badge", "WARN", "no version badge in README.md")

    versions = {}
    for name in HTML_FILES:
        text = read(os.path.join(root, name))
        if text is None:
            continue
        for v in re.findall(r"\?v=([0-9]+\.[0-9]+\.[0-9]+)", text):
            versions.setdefault(v, set()).add(name)

    if declared and versions and set(versions) != {declared}:
        finding("version.mismatch", "ERROR",
                f"README says {declared} but cache-busters say {sorted(versions)}")
    if declared and not versions:
        finding("version.missing", "WARN", "no ?v= cache-busters found in HTML")

    for name in HTML_FILES:
        text = read(os.path.join(root, name))
        if text is None:
            continue
        for m in re.finditer(r"<(link|script)\b[^>]*>", text, re.I):
            chunk = m.group(0)
            is_style = "stylesheet" in chunk.lower()
            is_script = m.group(1).lower() == "script"
            if not is_style and not is_script:
                continue
            src = re.search(r"(?:href|src)\s*=\s*[\"'](\./[^\"']+)[\"']", chunk, re.I)
            if not src:
                continue
            value = src.group(1)
            path_only = value.split("?")[0]
            # config.js is the user-editable entry point: a fixed ?v= would
            # pin it in caches and hide local edits on an ordinary reload.
            if path_only.endswith("/config.js"):
                continue
            if (is_style or path_only.endswith(".js")) and "?v=" not in value:
                finding("version.coverage", "WARN",
                        f"local asset without cache-buster: {value}", name)


def check_injection(root, finding):
    for path in walk(root, (".html", ".css", ".js", ".json", ".md", ".svg",
                            ".yml", ".yaml")):
        name = rel(root, path)
        text = read(path) or ""
        if "data-page-node-id" in text:
            finding("sec.injection", "ERROR",
                    "editor-injected data-page-node-id attribute", name)


# --------------------------------------------------------------------------
# config.js content model
# --------------------------------------------------------------------------
# Rendered content lives in static/js/config.js, so the markup checks cannot
# see it. This rule evaluates the config with node (already a soft dependency
# via check_js) and validates the schema plus every local file reference.

CONFIG_CHECK_JS = r"""
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const root = process.env.MH_VERIFY_ROOT;
const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };
const exists = (p) => {
  if (!p || /^(https?:)?\/\//.test(p) || /^data:/.test(p)) return true;
  return fs.existsSync(path.join(root, p.replace(/^\.\//, "")));
};

let C = null;
try {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "static/js/config.js"), "utf8"), sandbox);
  C = sandbox.SITE_CONFIG;
} catch (e) {
  problems.push("config.js failed to evaluate: " + e.message);
}

if (C && typeof C === "object") {
  const th = C.themes || {};
  need(Array.isArray(th.classes) && th.classes.length > 0,
       "themes.classes must be a non-empty array");
  need((th.classes || []).length === (th.names || []).length
       && (th.classes || []).length === (th.icons || []).length,
       "themes classes/names/icons lengths differ");

  need(Array.isArray(C.mottos) && C.mottos.length > 0
       && C.mottos.every(m => typeof m === "string"),
       "mottos must be a non-empty string array");
  need(Number.isFinite(C.typingInterval), "typingInterval must be a number");
  need(typeof C.birthTime === "string" && !isNaN(Date.parse(C.birthTime)),
       "birthTime must be a parseable date");
  need(C.birthPendingText === undefined || typeof C.birthPendingText === "string",
       "birthPendingText must be a string when present");

  const sn = C.snake || {};
  need(exists(sn.light) && exists(sn.dark),
       "snake.light/dark must reference existing files");
  need(exists(C.avatar), "avatar must reference an existing file");
  need(typeof C.avatarAlt === "string" && C.avatarAlt,
       "avatarAlt must be a non-empty string");

  ((C.nav && C.nav.links) || []).forEach((l, i) => {
    need(l && typeof l.text === "string" && l.text,
         "nav.links[" + i + "].text missing");
    need(l && typeof l.url === "string" && l.url,
         "nav.links[" + i + "].url missing");
  });

  const hero = C.hero || {};
  need(hero.greeting && hero.name, "hero.greeting/name missing");
  (hero.social || []).forEach((s, i) => {
    need(s && s.icon, "hero.social[" + i + "].icon missing");
    need(s && (s.sponsor ? !!s.image : !!s.url),
         "hero.social[" + i + "] needs url or a sponsor image");
  });

  const sb = C.sidebar || {};
  (sb.bio || []).forEach((b, i) =>
    need(b && (b.text || b.icon), "sidebar.bio[" + i + "] needs text or icon"));
  need(Array.isArray(sb.tags) && sb.tags.length > 0,
       "sidebar.tags must be a non-empty array");
  (sb.timeline || []).forEach((t, i) =>
    need(t && (t.more || (t.text && t.date)),
         "sidebar.timeline[" + i + "] needs text+date or more:true"));

  ["site", "project"].forEach(k => {
    const sec = (C.sections || {})[k] || {};
    need(sec.title, "sections." + k + ".title missing");
    (sec.cards || []).forEach((c, i) => {
      need(c && c.title, "sections." + k + ".cards[" + i + "].title missing");
      need(c && c.url, "sections." + k + ".cards[" + i + "].url missing");
      need(c && Array.isArray(c.desc) && c.desc.length > 0,
           "sections." + k + ".cards[" + i + "].desc missing");
      need(c && exists(c.icon),
           "sections." + k + ".cards[" + i + "].icon file missing");
      need(c && c.iconAlt,
           "sections." + k + ".cards[" + i + "].iconAlt missing");
    });
  });

  ["pc", "mobile"].forEach(k => {
    const s = (C.skills || {})[k] || {};
    need(s.src && exists(s.src), "skills." + k + ".src file missing");
    need(s.alt, "skills." + k + ".alt missing");
    need(Number.isFinite(s.width) && s.width > 0
         && Number.isFinite(s.height) && s.height > 0,
         "skills." + k + " needs positive width/height");
  });

  ((C.reward && C.reward.images) || []).forEach((r, i) => {
    need(r && exists(r.src), "reward.images[" + i + "].src file missing");
    need(r && r.alt, "reward.images[" + i + "].alt missing");
  });

  // notFound only has a consumer once 404.html exists.
  if (fs.existsSync(path.join(root, "404.html"))) {
    const nf = C.notFound || {};
    need(nf.title && nf.heading && Array.isArray(nf.description)
         && nf.description.length > 0 && nf.buttonText,
         "notFound requires title/heading/description(array)/buttonText");
  }

  const br = C.brand || {};
  need(br.navBrand && br.loading && br.signature && br.siteUrl && br.footer,
       "brand requires navBrand/loading/signature/siteUrl/footer");
} else if (!problems.length) {
  problems.push("SITE_CONFIG missing or not an object");
}

problems.forEach(p => console.log(p));
"""


def check_config(root, finding):
    node = shutil.which("node")
    cfg = os.path.join(root, JS_DIR, "config.js")
    if not os.path.isfile(cfg):
        return
    if not node:
        finding("config.skipped", "INFO",
                "node not found — config schema check skipped")
        return
    env = dict(os.environ, MH_VERIFY_ROOT=root)
    proc = subprocess.run([node, "-e", CONFIG_CHECK_JS], env=env,
                          capture_output=True, text=True)
    if proc.returncode != 0:
        msg = (proc.stderr.strip().splitlines() or ["node failed"])[-1]
        finding("config.runtime", "ERROR", msg, "static/js/config.js")
    for line in proc.stdout.splitlines():
        if line.strip():
            finding("config.schema", "ERROR", line.strip(), "static/js/config.js")


CHECKS = [check_refs, check_markup, check_css, check_js, check_versions,
          check_externals, check_pinned, check_docs, check_injection, check_config]


# --------------------------------------------------------------------------
# Runners
# --------------------------------------------------------------------------

def git(args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True,
                          text=True, encoding="utf-8", errors="replace")


def materialize(sha, dest):
    """Extract one commit's tree into dest, leaving the index untouched."""
    archive = subprocess.run(["git", "archive", sha], cwd=REPO,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if archive.returncode != 0:
        raise RuntimeError(archive.stderr.decode("utf-8", "replace"))
    tar = subprocess.run(["tar", "-x", "-C", dest], input=archive.stdout,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if tar.returncode != 0:
        raise RuntimeError(tar.stderr.decode("utf-8", "replace"))


def run_checks(root):
    findings = []

    def finding(rule, severity, message, location=""):
        findings.append(Finding(rule, severity, message, location))

    for check in CHECKS:
        check(root, finding)
    return findings


def split(findings):
    return ([f for f in findings if f.severity == "ERROR"],
            [f for f in findings if f.severity == "WARN"],
            [f for f in findings if f.severity == "INFO"])


def verify_tree(root, verbose=False):
    findings = run_checks(root)
    errors, warns, infos = split(findings)
    print(f"[{'FAIL' if errors else 'PASS'}] {len(errors)} error, {len(warns)} warn")
    for f in errors + warns:
        print("      " + str(f))
    if verbose:
        for f in infos:
            print("      " + str(f))
    return errors, warns, infos


def main():
    ap = argparse.ArgumentParser(description="Homepage repository verifier")
    ap.add_argument("--ref", help="verify a single git revision")
    ap.add_argument("--json", action="store_true", help="emit JSON")
    ap.add_argument("--strict", action="store_true", help="warnings fail the run")
    ap.add_argument("--verbose", action="store_true", help="include INFO findings")
    args = ap.parse_args()

    if args.ref:
        tmp = tempfile.mkdtemp(prefix="mh-verify-")
        try:
            materialize(args.ref, tmp)
            errors, warns, infos = verify_tree(tmp, args.verbose)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        label = args.ref
    else:
        errors, warns, infos = verify_tree(REPO, args.verbose)
        label = "working tree"

    print(f"\n{label}: {len(errors)} error(s), {len(warns)} warning(s)")
    if args.json:
        out = [f.as_dict() for f in errors + warns + (infos if args.verbose else [])]
        print(json.dumps(out, ensure_ascii=False, indent=2))
    if errors:
        return 1
    return 1 if (args.strict and warns) else 0


if __name__ == "__main__":
    sys.exit(main())
