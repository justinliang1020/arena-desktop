// Edit this file to change what runs in each tab - it's read fresh on every launch.

const { ipcRenderer } = require("electron");

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
nav { app-region: drag; position: relative; border-bottom: 1px solid; border-color: hsl(0 0 90% / 0.5); background-color: hsl(0 0 100% / 0.5) !important; backdrop-filter: blur(4px); }
nav * { app-region: no-drag; }
nav > *:nth-child(1) { position: absolute; left: 50%; transform: translateX(-50%); min-width: 265px; }
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
}
#arena-electron-nav-buttons button { cursor: pointer; }
#arena-electron-nav-buttons button:disabled { cursor: default; }
#arena-electron-nav-buttons button:not(:disabled) { color: hsl(0 0% 41%); }
#arena-electron-nav-buttons button:disabled { color: hsl(0 0% 85%); }
#arena-electron-nav-buttons button:hover:not(:disabled) { color: hsl(0 0 0%); }
@media (prefers-color-scheme: dark) {
  nav { border-color: hsl(0 0 20% / 0.5); background-color: hsl(0 0 0% / 0.5) !important; }
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

ipcRenderer.on("tab-navigation-state", (_event, state) => applyNavState(state));

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

let initialized = false;

function init() {
  // for some reason i don't know, electron causes the "init" function to be triggered twice on page load.
  // DOMContentLoaded happens twice?? i don't know why.
  // to prevent this, add a manual check to only initialize once
  if (initialized) return;
  initialized = true;
  injectCSS();
  injectNavButtons();
  observeDialogState();
}

document.addEventListener("DOMContentLoaded", init);
