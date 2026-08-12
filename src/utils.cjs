const { BrowserWindow, nativeTheme } = require("electron");

/**
 * @param {string} url
 */
function isArenaUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "are.na" || hostname.endsWith(".are.na");
  } catch {
    return false;
  }
}

/**
 * @param {string} url
 */
function createNonArenaWindow(url) {
  const w = new BrowserWindow({
    backgroundColor: nativeTheme.shouldUseDarkColors ? "black" : "white",
  });
  w.loadURL(url);
}

module.exports = {
  isArenaUrl,
  createNonArenaWindow,
};
