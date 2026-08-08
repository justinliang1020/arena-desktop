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

function init() {
  injectCSS();
  injectNavButtons();
  observeDialogState();
}

document.addEventListener("DOMContentLoaded", init);
