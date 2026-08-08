const { Menu, clipboard } = require("electron");

/**
 * @param {import('electron').BrowserWindow} mainWindow
 * @returns {(action: MenuAction) => () => void}
 */
const makeSend = (mainWindow) => (action) => () =>
  mainWindow.webContents.send("menu-action", action);

/**
 * @param {import('electron').WebContents} webContents
 * @param {Electron.ContextMenuParams} params
 */
function showTabContextMenu(webContents, params) {
  /** @type{Array<(Electron.MenuItemConstructorOptions) | (Electron.MenuItem)>}*/
  const menuItems = [];

  if (params.selectionText) {
    menuItems.push({ label: "Copy", role: "copy" });
    menuItems.push({ type: "separator" });
  }

  if (params.linkURL) {
    menuItems.push(
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
        click: () => {
          /* download logic */
        },
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
 * @param {import('electron').BrowserWindow} mainWindow
 */
function buildApplicationMenu(mainWindow) {
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [];

  if (process.platform === "darwin") {
    template.push({ role: "appMenu" });
  }

  const send = makeSend(mainWindow);

  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const selectTabMenuItems = Array.from({ length: 9 }, (_, i) => {
    const n = i + 1;
    return {
      label: `Select Tab ${n}`,
      accelerator: `CmdOrCtrl+${n}`,
      // 9 conventionally means "last tab" (matches Chrome/Firefox/Safari), since the
      // menu is only built once at startup and can't know the tab count at click time.
      click:
        n === 9
          ? send({ type: "selectLastTab" })
          : send({ type: "selectTabAtIndex", tabIndex: i }),
    };
  });

  template.push(
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+T",
          click: send({ type: "newTab" }),
        },
        {
          label: "Reload Tab",
          accelerator: "CmdOrCtrl+R",
          click: send({ type: "reloadTab" }),
        },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: send({ type: "closeActiveTab" }),
        },
        { type: "separator" },
        { type: "separator" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
      ],
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Next Tab",
          accelerator: "Ctrl+Tab",
          click: send({ type: "nextTab" }),
        },
        {
          label: "Previous Tab",
          accelerator: "Ctrl+Shift+Tab",
          click: send({ type: "previousTab" }),
        },
        { type: "separator" },
        ...selectTabMenuItems,
      ],
    },
    { role: "windowMenu" },
  );

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = {
  buildApplicationMenu,
  showTabContextMenu,
};
