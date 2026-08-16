// Edit this file to change what runs in each tab - it's read fresh on every launch.

const { ipcRenderer } = require("electron");

const injectedStyle = `
nav { app-region: drag; position: relative; border-bottom: 1px solid; border-color: hsl(0 0 90%); background-color: hsl(0 0 100% / 0.5) !important; backdrop-filter: blur(4px); }
nav * { app-region: no-drag; }
nav > *:nth-child(1) { position: absolute; left: 50%; transform: translateX(-50%); min-width: 265px; }
nav > *:nth-child(2) { position: absolute; right: 0; }
html.arena-dialog-open nav { app-region: no-drag !important; }
/* to allow space for nav buttons and traffic lights, add extra top margin for dialogs */
[role="dialog"] { margin-top: 30px; }
#arena-electron-nav-buttons {
  position: fixed;
  top: 7px;
  left: 80px;
  display: flex;
  gap: 4px;
  z-index: 2147483647;
  app-region: no-drag;
  pointer-events: auto;
}
#arena-electron-nav-buttons button { cursor: pointer; }
#arena-electron-nav-buttons button:disabled { cursor: default; }
#arena-electron-nav-buttons button:not(:disabled) { color: hsl(0 0% 41%); }
#arena-electron-nav-buttons button:disabled { color: hsl(0 0% 85%); }
#arena-electron-nav-buttons button:hover:not(:disabled) { color: hsl(0 0 0%); }
@media (prefers-color-scheme: dark) {
  nav { border-color: hsl(0 0 20%); background-color: hsl(0 0 0% / 0.5) !important; }
  #arena-electron-nav-buttons button:not(:disabled) { color: hsl(0 0% 70%); }
  #arena-electron-nav-buttons button:disabled { color: hsl(0 0% 20%); }
  #arena-electron-nav-buttons button:hover:not(:disabled) { color: hsl(0 0% 100%); }
}
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(0 0% 50% / 0.4); border-radius: 4px; }
/* are.na's top route-change loading bar; targeted structurally (first child of the Next.js root). hide this since it doesn't fully complete sometimes and becomes visually annoying */
#__next > div:first-child { display: none !important; }
`;

function injectCSS() {
  const style = document.createElement("style");
  style.textContent = injectedStyle;
  document.head.appendChild(style);
}

/**
 * @param {string} label
 * @param {() => void} onClick
 */
function createNavButton(label, onClick) {
  const button = document.createElement("button");
  button.textContent = label;
  button.style.cssText =
    "border: none; background: transparent; min-width: 36px; font-size: 1.7em;";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

/** @type {HTMLButtonElement | null} */
let backButtonEl = null;
/** @type {HTMLButtonElement | null} */
let forwardButtonEl = null;

/**
 * @param {{ canGoBack: boolean, canGoForward: boolean }} state
 */
function applyNavState(state) {
  if (backButtonEl) backButtonEl.disabled = !state.canGoBack;
  if (forwardButtonEl) forwardButtonEl.disabled = !state.canGoForward;
}

ipcRenderer.on("tab-navigation-state", (_event, state) => applyNavState(state));

// Always floats on top of the page (not injected into nav or a dialog), so
// it stays put regardless of what the SPA renders/replaces underneath it.
function injectNavButtons() {
  // deduplicate
  if (document.querySelector("#arena-electron-nav-buttons")) return;

  backButtonEl = createNavButton("←", () =>
    ipcRenderer.invoke("tabGoBackSelf"),
  );
  forwardButtonEl = createNavButton("→", () =>
    ipcRenderer.invoke("tabGoForwardSelf"),
  );
  backButtonEl.disabled = true;
  forwardButtonEl.disabled = true;

  const reloadButtonEl = createNavButton("⟳", () =>
    ipcRenderer.invoke("tabReloadSelf"),
  );

  const group = document.createElement("div");
  group.id = "arena-electron-nav-buttons";
  group.append(backButtonEl, forwardButtonEl, reloadButtonEl);
  document.body.append(group);

  ipcRenderer.invoke("tabGetNavigationStateSelf").then(applyNavState);
}

/**
 * @param {string} property
 * @returns {string | null}
 */
function getOgMeta(property) {
  return (
    document.head
      .querySelector(`meta[property="${property}"]`)
      ?.getAttribute("content") ?? null
  );
}

/**
 * Reads a <dt>label</dt><dd>value</dd> pair from are.na's channel metadata table.
 * @param {string} label
 * @returns {string | null}
 */
function getDefinitionListValue(label) {
  for (const dt of document.querySelectorAll("dt")) {
    if (dt.textContent?.trim() !== label) continue;
    const dd = dt.nextElementSibling;
    if (dd?.tagName === "DD") return dd.textContent?.trim() ?? null;
  }
  return null;
}

/**
 * @typedef {{ title: string | null, imageUrl: string | null, description: string | null, length: string | null }} PageMeta
 */

/**
 * @param {string} url
 * @param {PageMeta} meta
 */
function reportChannelVisit(url, meta) {
  ipcRenderer.send("arenaChannelVisited", { url, ...meta });
}

/**
 * Second path segments (are.na/<user>/<segment>) that look like a channel URL but
 * are actually one of are.na's own special pages, e.g. are.na/justin-liang/blocks is
 * "all my blocks", not a channel named "blocks".
 */
const NON_CHANNEL_SLUGS = new Set([
  "channels",
  "blocks",
  "index",
  "table",
  "all",
  "following",
  "followers",
  "groups",
]);

/**
 * @param {string} href
 * @returns {boolean}
 */
function isNonChannelUrl(href) {
  /** @type {URL} */
  let parsed;
  try {
    parsed = new URL(href);
  } catch {
    return false;
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  return segments.length === 2 && NON_CHANNEL_SLUGS.has(segments[1]);
}

/** @returns {PageMeta} */
function currentOgMeta() {
  return {
    title: getOgMeta("og:title"),
    imageUrl: getOgMeta("og:image"),
    description: getOgMeta("og:description"),
    length: getDefinitionListValue("Length"),
  };
}

// are.na sets each page's og:url/og:title/og:image/og:description via next/head, but
// on client-side SPA transitions the URL can update (location.href, pushState) before
// the <head> tags catch up, and the tags themselves can land in separate mutations
// (e.g. og:url flips to the new page before og:title/og:image do) - so checking
// og:url === href at the instant a single mutation/navigation fires isn't enough; it
// can catch a half-updated <head> still showing the previous channel's title/image.
// Instead, wait for things to go quiet (no new mutation/navigation for a bit) before
// checking - by then a real transition has almost certainly finished landing all its
// tags together, so og:url matching href is actually trustworthy.
const REPORT_SETTLE_DELAY_MS = 300;

/** @type {ReturnType<typeof setTimeout> | null} */
let reportSettleTimer = null;

function maybeReportChannelVisit() {
  const href = location.href;
  if (isNonChannelUrl(href)) return;

  if (reportSettleTimer) clearTimeout(reportSettleTimer);
  reportSettleTimer = setTimeout(() => {
    reportSettleTimer = null;
    if (location.href !== href) return; // navigated elsewhere before settling
    if (getOgMeta("og:url") !== href) return;

    reportChannelVisit(href, currentOgMeta());
  }, REPORT_SETTLE_DELAY_MS);
}

function observeChannelMeta() {
  maybeReportChannelVisit();

  const headObserver = new MutationObserver(maybeReportChannelVisit);
  headObserver.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  // <head> mutations alone miss the stale-tag SPA transition described above (nothing
  // in <head> actually changes), so also recheck on every history navigation.
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = function (...args) {
    const result = originalPushState(...args);
    maybeReportChannelVisit();
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState(...args);
    maybeReportChannelVisit();
    return result;
  };
  window.addEventListener("popstate", maybeReportChannelVisit);
}

/** @type {boolean | null} */
let lastReportedDialogOpen = null;

function updateDialogOpenState() {
  const hasDialog = !!document.querySelector('div[role="dialog"]');
  document.documentElement.classList.toggle("arena-dialog-open", hasDialog);

  if (hasDialog !== lastReportedDialogOpen) {
    lastReportedDialogOpen = hasDialog;
    ipcRenderer.send("dialogOpenStateChanged", hasDialog);
  }
}

function observeDialogState() {
  updateDialogOpenState();
  const observer = new MutationObserver(updateDialogOpenState);
  observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
  console.log("init");
  injectCSS();
  injectNavButtons();
  observeDialogState();
  observeChannelMeta();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  // init();
}
