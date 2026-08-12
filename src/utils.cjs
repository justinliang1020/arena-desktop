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

module.exports = {
  isArenaUrl,
};
