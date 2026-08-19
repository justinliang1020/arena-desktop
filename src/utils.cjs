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
  const isDark = nativeTheme.shouldUseDarkColors;

  // are.na windows hide the native title bar to make room for the injected
  // nav buttons. On macOS this pairs with custom traffic-light positioning;
  // on Windows the caption buttons instead render as a Window Controls
  // Overlay so minimize/maximize/close still work. Linux gets a normal
  // title bar for now.
  /** @type {Electron.BrowserWindowConstructorOptions} */
  const chromeOptions = {};
  if (isArena && process.platform === "darwin") {
    chromeOptions.titleBarStyle = "hidden"; // https://www.electronjs.org/docs/latest/tutorial/custom-title-bar#custom-traffic-lights-macos
    chromeOptions.trafficLightPosition = { x: 15, y: 20 };
  } else if (isArena && process.platform === "win32") {
    chromeOptions.titleBarStyle = "hidden";
    chromeOptions.titleBarOverlay = {
      color: isDark ? "#000000" : "#ffffff",
      symbolColor: isDark ? "#ffffff" : "#000000",
      height: 40,
    };
  }

  const mainWindow = new BrowserWindow({
    minWidth: 640,
    minHeight: 300,
    webPreferences: {
      scrollBounce: true, // macOS only: native elastic/rubber-band overscroll
      preload: isArena ? path.join(__dirname, "injectedArenaScript.js") : "",
    },
    backgroundColor: isDark ? "black" : "white",
    // in dev, Electron otherwise shows its own default icon in the Windows
    // taskbar / Linux window list instead of are.na's. On macOS the dock
    // icon always comes from the packaged app bundle, so this is skipped there.
    ...(process.platform !== "darwin"
      ? { icon: path.join(__dirname, "../icon/arena.png") }
      : {}),
    ...chromeOptions,
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

  mainWindow.on("enter-full-screen", () => {
    mainWindow.webContents.send("window-fullscreen-state", true);
  });

  mainWindow.on("leave-full-screen", () => {
    mainWindow.webContents.send("window-fullscreen-state", false);
  });

  mainWindow.loadURL(url ?? "https://are.na");

  return mainWindow;
};

module.exports = {
  isArenaUrl,
  createWindow,
};
