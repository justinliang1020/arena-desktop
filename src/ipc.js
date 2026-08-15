const { ipcMain, BrowserWindow } = require("electron");

function initializeIpcHandlers() {
  /** @type {Record<string, (event: Electron.IpcMainInvokeEvent) => Promise<any>>} */
  const handlers = {
    tabGoBackSelf: async (event) => {
      event.sender.navigationHistory.goBack();
    },
    tabGoForwardSelf: async (event) => {
      event.sender.navigationHistory.goForward();
    },
    tabGetNavigationStateSelf: async (event) => ({
      canGoBack: event.sender.navigationHistory.canGoBack(),
      canGoForward: event.sender.navigationHistory.canGoForward(),
    }),
    tabReloadSelf: async (event) => {
      event.sender.reload();
    },
    tabGetFullScreenStateSelf: async (event) => ({
      isFullScreen:
        BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false,
    }),
  };

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, handler);
  }
}

module.exports = {
  initializeIpcHandlers,
};
