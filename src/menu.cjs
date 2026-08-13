const { isArenaUrl, createNonArenaWindow } = require("./utils.cjs");
const { Menu, clipboard, shell, BrowserWindow, dialog } = require("electron");

/**
 * @param {import('electron').WebContents} webContents
 * @param {Electron.ContextMenuParams} params
 * @param {(url: string) => void} onNewWindow
 */
function showContextMenu(webContents, params, onNewWindow) {
  /** @type{Array<(Electron.MenuItemConstructorOptions) | (Electron.MenuItem)>}*/
  const menuItems = [];

  if (params.selectionText) {
    menuItems.push({ label: "Copy", role: "copy" });
    menuItems.push({ type: "separator" });
  }

  if (params.linkURL) {
    menuItems.push(
      {
        label: "Open Link in New Window",
        click: () => {
          if (isArenaUrl(params.linkURL)) {
            onNewWindow(params.linkURL);
          } else {
            createNonArenaWindow(params.linkURL);
          }
        },
      },
      {
        label: "Open Link in Default Browser",
        click: () => shell.openExternal(params.linkURL),
      },
      {
        label: "Copy Link Address",
        click: () => clipboard.writeText(params.linkURL),
      },
      { type: "separator" },
    );
  }

  if (params.mediaType === "image") {
    menuItems.push(
      {
        label: "Save Image As...",
        click: () => webContents.downloadURL(params.srcURL),
      },
      {
        label: "Copy Image",
        enabled: params.hasImageContents,
        click: () => webContents.copyImageAt(params.x, params.y),
      },
      {
        label: "Copy Image Address",
        click: () => clipboard.writeText(params.srcURL),
      },

      { type: "separator" },
    );
  }

  menuItems.push(
    {
      label: "Back",
      enabled: webContents.navigationHistory.canGoBack(),
      click: () => webContents.navigationHistory.goBack(),
    },
    {
      label: "Forward",
      enabled: webContents.navigationHistory.canGoForward(),
      click: () => webContents.navigationHistory.goForward(),
    },
    { label: "Reload", click: () => webContents.reload() },
  );

  if (!params.linkURL) {
    menuItems.push({
      label: "Copy URL",
      click: () => clipboard.writeText(params.pageURL),
    });
  }

  menuItems.push(
    { type: "separator" },
    {
      label: "Inspect Element",
      click: () => webContents.inspectElement(params.x, params.y),
    },
  );

  const menu = Menu.buildFromTemplate(menuItems);
  menu.popup();
}

/**
 * On macOS there is exactly one application menu shared by every window, so
 * its handlers must act on whichever window is currently focused rather than
 * a webContents captured at build time - otherwise Back/Forward silently act
 * on (and reflect the state of) a stale, no-longer-focused window as soon as
 * more than one window is open.
 *
 * @param {() => void} onNewWindow
 */
function buildApplicationMenu(onNewWindow) {
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [];

  if (process.platform === "darwin") {
    template.push({ role: "appMenu" });
  }

  template.push(
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => onNewWindow(),
        },
        { type: "separator" },
        { role: "close", label: "Close Window" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
      ],
    },
    { role: "windowMenu" },
    {
      label: "History",
      submenu: [
        {
          id: "history-back",
          label: "Back",
          accelerator: "CmdOrCtrl+[",
          enabled: false,
          click: () =>
            BrowserWindow.getFocusedWindow()?.webContents.navigationHistory.goBack(),
        },
        {
          id: "history-forward",
          label: "Forward",
          accelerator: "CmdOrCtrl+]",
          enabled: false,
          click: () =>
            BrowserWindow.getFocusedWindow()?.webContents.navigationHistory.goForward(),
        },
      ],
    },
  );

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// menu item `enabled` is only evaluated once at build time, so re-apply it on
// the actual MenuItem instances whenever navigation or window focus changes.
// Always reads from the currently focused window, not the window that
// triggered the update, so it stays correct regardless of which window's
// event fired.
function updateHistoryMenuState() {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;

  const backItem = menu.getMenuItemById("history-back");
  const forwardItem = menu.getMenuItemById("history-forward");
  const focusedWebContents = BrowserWindow.getFocusedWindow()?.webContents;

  if (backItem)
    backItem.enabled =
      focusedWebContents?.navigationHistory.canGoBack() ?? false;
  if (forwardItem)
    forwardItem.enabled =
      focusedWebContents?.navigationHistory.canGoForward() ?? false;
}

module.exports = {
  buildApplicationMenu,
  updateHistoryMenuState,
  showContextMenu,
};
