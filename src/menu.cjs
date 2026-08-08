const { Menu, clipboard, shell, BrowserWindow, dialog } = require("electron");

/**
 * @param {import('electron').WebContents} webContents
 * @param {Electron.ContextMenuParams} params
 */
function showContextMenu(webContents, params) {
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
          new BrowserWindow().loadURL(params.linkURL);
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
    {
      label: "Copy Page Link Address",
      click: () => clipboard.writeText(params.pageURL),
    },
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
  );

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = {
  buildApplicationMenu,
  showContextMenu,
};
