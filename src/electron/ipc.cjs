const { app, ipcMain, BrowserWindow } = require("electron");
const {
  showTabStripContextMenu,
  showChannelContextMenu,
} = require("./menu.cjs");
const fs = require("fs").promises;
const writeFileAtomic = require("write-file-atomic");
const { getEvents } = require("./db.cjs");

const path = require("node:path");
const userPath = app.getPath("userData");

const STATE_FILE_PATH = path.join(userPath, "user", "state.json");

const TRAFFIC_LIGHT_POSITION = { x: 15, y: 19 };

/** @param {string} filePath */
async function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch (error) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/** @param {string | object} data */
async function writeStateFile(data) {
  try {
    await ensureDirectory(STATE_FILE_PATH);

    let content;
    if (typeof data === "object") {
      content = JSON.stringify(data, null, 2);
    } else {
      content = data;
    }

    // requires atomic file writes to prevent corrupted state saves
    await writeFileAtomic(STATE_FILE_PATH, Buffer.from(content));
    console.log(`State file written successfully: ${STATE_FILE_PATH}`);
  } catch (error) {
    console.error("Error writing state file:", error);
    throw error;
  }
}

async function readStateFile() {
  try {
    return await fs.readFile(STATE_FILE_PATH, "utf8");
  } catch (error) {
    //@ts-ignore  TODO: fix proper error handling
    if (error.code === "ENOENT") {
      console.log("State file not found, returning empty string");
      return "";
    }
    console.error("Error reading state file:", error);
    throw error;
  }
}

/**
 * @param {BrowserWindow} mainWindow
 * @param {import("./tabs.cjs").Tabs} tabs
 * @param {import("./overlay.cjs").Overlay} overlay
 */
function initializeIpcHandlers(mainWindow, tabs, overlay) {
  /** @type {import("./electron").ElectronIpcHandlers} */
  const handlers = {
    writeStateFile: async (_event, data) => writeStateFile(data),
    readStateFile: async (_event) => readStateFile(),
    setWindowButtonVisibility: async (_event, isVisible) => {
      mainWindow.setWindowButtonVisibility(isVisible);
      mainWindow.setWindowButtonPosition(TRAFFIC_LIGHT_POSITION); // there seems to be a glitch in macos tahoe that requires explicilty resetting the position
    },
    setSidebarVisible: async (_event, isVisible) =>
      tabs.setSidebarVisible(isVisible),
    toggleSidebarVisible: async (_event) =>
      tabs.setSidebarVisible(!tabs.sidebarVisible),
    createNewTab: async (_event, url) => tabs.create(url),
    selectTab: async (_event, tabId, x, y, width, height) =>
      tabs.select(tabId, { x, y, width, height }),
    removeTab: async (_event, tabId) => tabs.remove(tabId),
    reloadTab: async (_event, tabId) => tabs.reload(tabId),
    hideTab: async (_event, tabId) => tabs.hide(tabId),
    resizeTab: async (_event, tabId, x, y, width, height) =>
      tabs.resize(tabId, { x, y, width, height }),
    tabLoadUrl: async (_event, tabId, url) => tabs.loadUrl(tabId, url),
    tabGoBack: async (_event, tabId) => tabs.goBack(tabId),
    tabGoForward: async (_event, tabId) => tabs.goForward(tabId),
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
    tabGoToHistoryIndex: async (_event, tabId, index) =>
      tabs.goToHistoryIndex(tabId, index),
    tabRestoreNavigationHistory: async (
      _event,
      tabIdToBeModified,
      tabIdToCopyHistory,
      activeIndex,
    ) =>
      tabs.restoreNavigationHistory(
        tabIdToBeModified,
        tabIdToCopyHistory,
        activeIndex,
      ),
    getHistoryEvents: async () => /** @type {HistoryEvent[]} */ (getEvents()),
    focusMainWindow: async (_event) => mainWindow.webContents.focus(),
    showTabStripContextMenu: async (_event, tab, index) =>
      showTabStripContextMenu(mainWindow, tab, index),
    showChannelContextMenu: async (_event, channel, index) =>
      showChannelContextMenu(mainWindow, channel, index),
    showOverlay: async (_event, value, x, y, width, height) =>
      overlay.show(value, { x, y, width, height }),
    hideOverlay: async (_event) => overlay.hide(),
  };

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, handler);
  }

  // Fire-and-forget relay: the injected tab script parses each visited page's own
  // og: meta tags and reports channel metadata here; forward it to the app's renderer.
  ipcMain.on("arenaChannelVisited", (_event, channel) => {
    mainWindow.webContents.send("arena-channel-visited", channel);
  });

  // The injected tab script reports its own page's role="dialog" open/closed state
  // here; event.sender.id is the tab's id (see Tab constructor), so route it through
  // the same per-tab info channel the renderer already listens to for title/favicon/etc.
  ipcMain.on("dialogOpenStateChanged", (event, isDialogOpen) => {
    tabs.get(event.sender.id)?.sendTabInfoMessage({ isDialogOpen });
  });
}

module.exports = {
  initializeIpcHandlers,
  ensureDirectory,
  TRAFFIC_LIGHT_POSITION,
};
