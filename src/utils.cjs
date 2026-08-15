const { showContextMenu, updateHistoryMenuState } = require("./menu.cjs");

const { BrowserWindow, nativeTheme } = require("electron");
const path = require("node:path");

/**
 * only returns true for are.na
 * returns false for non-are.na website or subodmains such as help.are.na
 * @param {string} url
 */
function isArenaUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "are.na" || hostname === "www.are.na";
  } catch {
    return false;
  }
}

/**
 * @param {boolean} openMaximized
 * @param {string} url - url to create new window with. if undefined, open are.na home page
 */
const createWindow = async (openMaximized, url) => {
  const isArena = isArenaUrl(url);
  const mainWindow = new BrowserWindow({
    minWidth: 640,
    minHeight: 300,
    webPreferences: {
      scrollBounce: true, // macOS only: native elastic/rubber-band overscroll
      preload: isArena ? path.join(__dirname, "injectedTabScript.js") : "",
    },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "black" : "white",
    titleBarStyle: isArena ? "hidden" : undefined, // https://www.electronjs.org/docs/latest/tutorial/custom-title-bar#custom-traffic-lights-macos
    trafficLightPosition: isArena ? { x: 15, y: 20 } : undefined,
  });

  if (openMaximized) {
    mainWindow.maximize();
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    createWindow(false, url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("context-menu", (_event, params) => {
    showContextMenu(mainWindow.webContents, params, (url) =>
      createWindow(false, url),
    );
  });

  const sendNavigationState = () => {
    const canGoBack = mainWindow.webContents.navigationHistory.canGoBack();
    const canGoForward =
      mainWindow.webContents.navigationHistory.canGoForward();
    mainWindow.webContents.send("tab-navigation-state", {
      canGoBack,
      canGoForward,
    });
  };

  mainWindow.webContents.addListener("did-navigate", (_event) => {
    sendNavigationState();
    updateHistoryMenuState();
  });

  mainWindow.webContents.addListener("did-navigate-in-page", (_event) => {
    sendNavigationState();
    updateHistoryMenuState();
  });

  mainWindow.loadURL(url ?? "https://are.na");

  return mainWindow;
};

module.exports = {
  isArenaUrl,
  createWindow,
};
