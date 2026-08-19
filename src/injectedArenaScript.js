// Edit this file to change what runs in each tab - it's read fresh on every launch.

const { ipcRenderer } = require("electron");

// this preload script also runs inside every iframe on the page, not just the
// top-level document - guard the entry points below so nothing ever touches
// an iframe's body.
const isTopFrame = window.top === window.self;

const backwardsIconSvg = `<svg width="11" height="19" viewBox="0 0 11 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9.91421 17.7071L1.41421 9.20711L9.91421 0.707108" stroke="currentColor" stroke-width="2"/>
</svg>`;
const forwardsIconSvg = `<svg width="11" height="19" viewBox="0 0 11 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.707108 17.7071L9.20711 9.20711L0.707108 0.707108" stroke="currentColor" stroke-width="2"/>
</svg>`;
const reloadIconSvg = `<svg width="17" height="19" viewBox="0 0 17 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M16 9.78802C15.6333 13.8478 12.4232 17.0221 8.51745 17.0221C4.36568 17.0221 1 13.4354 1 9.01103C1 4.58666 4.36568 1 8.51745 1C11.3555 1 14.4663 2.67597 15.7458 5.14983M11.2511 5.08589L15.7458 5.14983V0.0220642" stroke="currentColor" stroke-width="2"/>
</svg>`;

const injectedStyle = `
nav { app-region: drag; position: relative; border-bottom: 1px solid; border-color: var(--colors-gray1); background-color: color-mix(in srgb, var(--colors-background, white) 50%, transparent) !important; backdrop-filter: blur(4px); }
nav * { app-region: no-drag; }
/* center the are.na logo + search bar */
nav > *:nth-child(1) {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  min-width: 210px;
  *:nth-child(2) {
     max-width: 100%
  }
}
nav > *:nth-child(2) { position: absolute; right: 0; }
html.arena-dialog-open nav { app-region: no-drag !important; }
/* to allow space for nav buttons and traffic lights, add extra top margin for dialogs */
[role="dialog"] { margin-top: 44px; }
#arena-electron-nav-buttons {
  position: fixed;
  top: 14px;
  left: 80px;
  display: flex;
  gap: 4px;
  z-index: 2147483647;
  app-region: no-drag;
  pointer-events: auto;
  transition: left 0.1s ease 
}
/* no traffic lights to clear space for when the window is full screen */
html.arena-fullscreen #arena-electron-nav-buttons { left: 10px; }
#arena-electron-nav-buttons button { cursor: pointer; }
#arena-electron-nav-buttons button:disabled { cursor: default; }
#arena-electron-nav-buttons button:not(:disabled) { color: hsl(0 0% 41%); }
#arena-electron-nav-buttons button:disabled { color: hsl(0 0% 85%); }
#arena-electron-nav-buttons button:hover:not(:disabled) { color: hsl(0 0 0%); }
@media (prefers-color-scheme: dark) {
  #arena-electron-nav-buttons button:not(:disabled) { color: hsl(0 0% 70%); }
  #arena-electron-nav-buttons button:disabled { color: hsl(0 0% 20%); }
  #arena-electron-nav-buttons button:hover:not(:disabled) { color: hsl(0 0% 100%); }
}

/* width */
::-webkit-scrollbar {
  width: 8px;
  background : transparent;
  border-radius: 10px;
}

/* Track */
::-webkit-scrollbar-track {
  border-radius: 10px;
}
 
/* Handle */
::-webkit-scrollbar-thumb {
  background: #818181;
  border-radius: 10px;
  width : 8px;
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: #8F8F8F; 
}

/* are.na's top route-change loading bar; targeted structurally (first child of the Next.js root). hide this since it doesn't fully complete sometimes and becomes visually annoying */
#__next > div:first-child { display: none !important; }
`;

function injectCSS() {
  const style = document.createElement("style");
  style.textContent = injectedStyle;
  document.head.appendChild(style);
}

/**
 * @param {string} iconSvg
 * @param {() => void} onClick
 */
function createNavButton(iconSvg, onClick) {
  const button = document.createElement("button");
  button.innerHTML = iconSvg;
  button.style.cssText =
    "border: none; background: transparent; min-width: 36px; height: 28px; display: flex; align-items: center; justify-content: center;";
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

/**
 * @param {{ isFullScreen: boolean }} state
 */
function applyFullScreenState(state) {
  document.documentElement.classList.toggle(
    "arena-fullscreen",
    state.isFullScreen,
  );
}

if (isTopFrame) {
  ipcRenderer.on("tab-navigation-state", (_event, state) => {
    applyNavState(state);
    // fires on both did-navigate and did-navigate-in-page, so this is also
    // how we catch SPA navigations (e.g. logout) that never re-run init()
    maybeAutoOpenLogin();
  });
  ipcRenderer.on("window-fullscreen-state", (_event, isFullScreen) =>
    applyFullScreenState({ isFullScreen }),
  );
}

// Always floats on top of the page (not injected into nav or a dialog), so
// it stays put regardless of what the SPA renders/replaces underneath it.
function injectNavButtons() {
  // deduplicate
  if (document.querySelector("#arena-electron-nav-buttons")) return;

  backButtonEl = createNavButton(backwardsIconSvg, () =>
    ipcRenderer.invoke("tabGoBackSelf"),
  );
  forwardButtonEl = createNavButton(forwardsIconSvg, () =>
    ipcRenderer.invoke("tabGoForwardSelf"),
  );
  backButtonEl.disabled = true;
  forwardButtonEl.disabled = true;

  const reloadButtonEl = createNavButton(reloadIconSvg, () =>
    ipcRenderer.invoke("tabReloadSelf"),
  );

  const group = document.createElement("div");
  group.id = "arena-electron-nav-buttons";
  group.append(backButtonEl, forwardButtonEl, reloadButtonEl);
  document.body.append(group);

  ipcRenderer.invoke("tabGetNavigationStateSelf").then(applyNavState);
  ipcRenderer.invoke("tabGetFullScreenStateSelf").then(applyFullScreenState);
}

/** @type {boolean | null} */
let lastReportedDialogOpen = null;

function updateDialogOpenState() {
  const hasDialog = !!document.querySelector('div[role="dialog"]');
  document.documentElement.classList.toggle("arena-dialog-open", hasDialog);

  if (hasDialog !== lastReportedDialogOpen) {
    lastReportedDialogOpen = hasDialog;
  }
}

function observeDialogState() {
  updateDialogOpenState();
  const observer = new MutationObserver(updateDialogOpenState);
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * @param {string} url
 */
function isArenaUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "are.na" || hostname.endsWith(".are.na");
  } catch {
    return false;
  }
}

// open non-are.na links in a new tab (routed to the system browser by
// setWindowOpenHandler in index.js) instead of navigating this window away.
// this is needed for edge cases such as links in comments
function tagExternalLinks() {
  for (const a of document.querySelectorAll("a[href]")) {
    const anchor = /** @type {HTMLAnchorElement} */ (a);
    if (!isArenaUrl(anchor.href)) {
      anchor.target = "_blank";
    }
  }
}

function observeExternalLinks() {
  tagExternalLinks();
  const observer = new MutationObserver(tagExternalLinks);
  observer.observe(document.body, { childList: true, subtree: true });
}

// how long to wait for the Next.js landing header to hydrate before giving up
const AUTO_LOGIN_WAIT_MS = 5000;

/**
 * Finds a landing-nav trigger by its exact trimmed text (e.g. "Log in",
 * "Sign up"). Scoped to `nav` and excludes anything inside the login
 * dialog, since the dialog has its own "Not a member? Sign up" link that
 * must stay untouched. Logged-in users never render these, so callers
 * treat "not found" as normal.
 * @param {string} text
 * @returns {HTMLElement | null}
 */
function findNavTrigger(text) {
  const nav = document.querySelector("nav");
  if (!nav) return null;
  for (const el of nav.querySelectorAll("a, button")) {
    if (el.closest('div[role="dialog"]')) continue;
    if (el.textContent && el.textContent.trim() === text) {
      return /** @type {HTMLElement} */ (el);
    }
  }
  return null;
}

// Hides the logged-out landing's top-nav "Sign up" button; we want the only
// signup entry point to be the link inside the login dialog itself. Called
// on every mutation (see observeSignUpButton) so it keeps re-hiding across
// the SPA's re-renders of the nav.
function hideSignUpButton() {
  if (location.pathname !== "/") return;
  const trigger = findNavTrigger("Sign up");
  if (trigger) trigger.style.display = "none";
}

function observeSignUpButton() {
  hideSignUpButton();
  const observer = new MutationObserver(hideSignUpButton);
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * @param {HTMLElement} trigger
 */
function clickLogInTrigger(trigger) {
  autoLoginTriggeredForCurrentLanding = true;
  trigger.click();

  // give the dialog a moment to mount, then verify and log either way
  setTimeout(() => {
    const opened = !!document.querySelector('div[role="dialog"]');
    console.log(
      opened
        ? "[arena-electron] auto-login: login dialog opened"
        : "[arena-electron] auto-login: clicked 'Log in' but no dialog appeared",
    );
  }, 500);
}

// whether we've already auto-clicked "Log in" for the landing the user is
// currently on; reset whenever we observe a navigation away from "/", so
// coming back to the landing (e.g. right after logout) auto-opens again,
// but closing the dialog and staying put does not reopen it
let autoLoginTriggeredForCurrentLanding = false;
/** @type {MutationObserver | null} */
let autoLoginObserver = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let autoLoginTimeoutId = null;

function cancelPendingAutoLoginWait() {
  if (autoLoginObserver) {
    autoLoginObserver.disconnect();
    autoLoginObserver = null;
  }
  if (autoLoginTimeoutId !== null) {
    clearTimeout(autoLoginTimeoutId);
    autoLoginTimeoutId = null;
  }
}

// On the logged-out marketing landing ("/"), auto-open are.na's own login
// dialog so launch drops straight into the login flow instead of the pitch
// page. There's no DOMContentLoaded to hook for SPA navigations (e.g.
// logout), so this is called both at init and on every
// "tab-navigation-state" event instead. The landing is a Next.js SPA, so
// the "Log in" trigger may not exist yet when this first runs; wait for it
// with a MutationObserver, capped so we don't wait forever if the markup
// changes or the user is actually logged in.
function maybeAutoOpenLogin() {
  // a previous navigation's wait is now stale regardless of outcome
  cancelPendingAutoLoginWait();

  if (location.pathname !== "/") {
    autoLoginTriggeredForCurrentLanding = false;
    return;
  }
  if (autoLoginTriggeredForCurrentLanding) return;

  const existing = findNavTrigger("Log in");
  if (existing) {
    clickLogInTrigger(existing);
    return;
  }

  autoLoginObserver = new MutationObserver(() => {
    const found = findNavTrigger("Log in");
    if (found) {
      cancelPendingAutoLoginWait();
      clickLogInTrigger(found);
    }
  });
  autoLoginObserver.observe(document.body, { childList: true, subtree: true });

  autoLoginTimeoutId = setTimeout(() => {
    cancelPendingAutoLoginWait();
    console.log(
      "[arena-electron] auto-login: no 'Log in' trigger appeared within timeout, skipping",
    );
  }, AUTO_LOGIN_WAIT_MS);
}

let initialized = false;

function init() {
  // for some reason i don't know, electron causes the "init" function to be triggered twice on page load.
  // DOMContentLoaded happens twice?? i don't know why.
  // to prevent this, add a manual check to only initialize once
  if (initialized) return;
  initialized = true;
  console.log("Welcome to the are.na desktop app!");
  injectCSS();
  injectNavButtons();
  observeDialogState();
  observeExternalLinks();
  observeSignUpButton();
  maybeAutoOpenLogin();
}

if (isTopFrame) {
  document.addEventListener("DOMContentLoaded", init);
}
