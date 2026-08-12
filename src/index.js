const { app, BrowserWindow, nativeTheme, shell } = require("electron");
const path = require("node:path");
const { buildApplicationMenu, showContextMenu } = require("./menu.cjs");
const { initializeIpcHandlers } = require("./ipc");
const { isArenaUrl, createNonArenaWindow } = require("./utils.cjs");

// NOTE: commenting this out since i'm uninstalling electron-squirrel-startup until I want to formally add windows support
// this is since electron-squirrel-startup is currently causing type checking issues
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require("electron-squirrel-startup")) {
//   app.quit();
// }

/**
 * @param {boolean} openMaximized
 * @param {string} [url] - url to create new window with. if undefined, open are.na home page
 */
const createArenaWindow = async (openMaximized, url) => {
  const mainWindow = new BrowserWindow({
    minWidth: 640,
    minHeight: 300,
    webPreferences: {
      scrollBounce: true, // macOS only: native elastic/rubber-band overscroll
      preload: path.join(__dirname, "injectedTabScript.js"),
    },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "black" : "white",
    titleBarStyle: "hidden", // https://www.electronjs.org/docs/latest/tutorial/custom-title-bar#custom-traffic-lights-macos
    trafficLightPosition: { x: 15, y: 20 },
  });

  if (openMaximized) {
    mainWindow.maximize();
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isArenaUrl(url)) {
      createArenaWindow(false, url);
    } else {
      createNonArenaWindow(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("context-menu", (_event, params) => {
    showContextMenu(mainWindow.webContents, params, (url) =>
      createArenaWindow(false, url),
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
  });

  mainWindow.webContents.addListener("did-navigate-in-page", (_event) => {
    sendNavigationState();
  });

  buildApplicationMenu(mainWindow.webContents, () => createArenaWindow(false));

  mainWindow.loadURL(url ?? "https://are.na");

  try {
    // put this in a try catch so it doesn't throw an error in production, since electron-reloader is a dev dependency
    const reloader = require("electron-reloader");
    reloader(module, { ignore: ["**/local/**", "**/web/**"] });
  } catch {}
  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  initializeIpcHandlers();
  await createArenaWindow(true);

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createArenaWindow(true);
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  app.quit();
  // if (process.platform !== "darwin") {
  //   app.quit();
  // }
});
