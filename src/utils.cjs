const { BrowserWindow, nativeTheme } = require("electron");

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
 * @param {string} url
 */
function createNonArenaWindow(url) {
  const w = new BrowserWindow({
    backgroundColor: nativeTheme.shouldUseDarkColors ? "black" : "white",
  });
  w.loadURL(url);
  return w;
}

module.exports = {
  isArenaUrl,
  createNonArenaWindow,
};
