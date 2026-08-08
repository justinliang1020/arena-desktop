const { app, BrowserWindow, nativeTheme } = require("electron");
const path = require("node:path");
const { buildApplicationMenu, showContextMenu } = require("./menu.cjs");
const { initializeIpcHandlers } = require("./ipc");

// NOTE: commenting this out since i'm uninstalling electron-squirrel-startup until I want to formally add windows support
// this is since electron-squirrel-startup is currently causing type checking issues
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require("electron-squirrel-startup")) {
//   app.quit();
// }

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 300,
    webPreferences: {
      scrollBounce: true, // macOS only: native elastic/rubber-band overscroll
      preload: path.join(__dirname, "injectedTabScript.js"),
    },
    vibrancy: "sidebar", // macOS only
    backgroundMaterial: "acrylic", // Windows 10/11 only
    titleBarStyle: "hidden", // https://www.electronjs.org/docs/latest/tutorial/custom-title-bar#custom-traffic-lights-macos
    trafficLightPosition: { x: 15, y: 15 }, //TODO: adjust
  });

  mainWindow.webContents.on("context-menu", (_event, params) => {
    showContextMenu(mainWindow.webContents, params);
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

  buildApplicationMenu(() => createWindow());

  mainWindow.loadURL("https://are.na");

  try {
    // put this in a try catch so it doesn't throw an error in production, since electron-reloader is a dev dependency
    const reloader = require("./dev-reloader.cjs");
    reloader(module, { ignore: ["**/local/**", "**/web/**"] });
  } catch {}
  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  initializeIpcHandlers();
  await createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
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
