// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

/** @type {import("./electron").InvokeKeys[]} */
const invokeChannels = [
  "writeStateFile",
  "readStateFile",
  "setWindowButtonVisibility",
  "setSidebarVisible",
  "toggleSidebarVisible",
  "createNewTab",
  "selectTab",
  "removeTab",
  "hideTab",
  "reloadTab",
  "tabLoadUrl",
  "tabGoBack",
  "tabGoForward",
  "tabGoToHistoryIndex",
  "focusMainWindow",
  "showOverlay",
  "hideOverlay",
  "tabRestoreNavigationHistory",
  "showTabStripContextMenu",
  "showChannelContextMenu",
  "getHistoryEvents",
];

/** @type {import("./electron").ElectronIpc} */
const electronIpc = {
  .../** @type {any} */ (
    Object.fromEntries(
      invokeChannels.map((ch) => [
        ch,
        /** @type {(...args: any[]) => Promise<any>} */ (
          (...args) => ipcRenderer.invoke(ch, ...args)
        ),
      ]),
    )
  ),
  onTabsStateUpdated: (callback) =>
    ipcRenderer.on("tabs-state-updated", (_event, value) => callback(value)),
  onTabOpen: (callback) =>
    ipcRenderer.on("window-open", (_event, value) => callback(value)),
  onMenuAction: (callback) =>
    ipcRenderer.on("menu-action", (_event, action) => callback(action)),
  onHistoryEventsChanged: (callback) =>
    ipcRenderer.on("history-events-changed", (_event, events) => callback(events)),
  onArenaChannelVisited: (callback) =>
    ipcRenderer.on("arena-channel-visited", (_event, channel) =>
      callback(channel),
    ),
  onSidebarVisibilityChanged: (callback) =>
    ipcRenderer.on("sidebar-visibility-changed", (_event, isVisible) =>
      callback(isVisible),
    ),
  onActiveTabChanged: (callback) =>
    ipcRenderer.on("active-tab-changed", (_event, tabId) => callback(tabId)),
};

contextBridge.exposeInMainWorld("electronIpc", electronIpc);
