const { app, BrowserWindow } = require("electron");
const { buildApplicationMenu, updateHistoryMenuState } = require("./menu.cjs");
const { initializeIpcHandlers } = require("./ipc");
const { createWindow } = require("./utils.cjs");
const { updateElectronApp } = require("update-electron-app");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

try {
  // put this in a try catch so it doesn't throw an error in production, since electron-reloader is a dev dependency
  const reloader = require("electron-reloader");
  reloader(module, { ignore: ["**/local/**", "**/web/**"] });
} catch {}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  initializeIpcHandlers();
  buildApplicationMenu(() => createWindow(false, "https://are.na"));
  app.on("browser-window-focus", updateHistoryMenuState);
  await createWindow(true, "https://are.na");

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(true, "https://are.na");
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

// > By default your repository URL is found in your app's package.json file.
// https://github.com/electron/update-electron-app
updateElectronApp();
