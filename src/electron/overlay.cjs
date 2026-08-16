const { WebContentsView } = require("electron");
const path = require("node:path");

class Overlay {
  #visible = false;

  /**
   * @param {import("electron").BrowserWindow} parentWindow
   */
  constructor(parentWindow) {
    this.parentWindow = parentWindow;
    this.view = new WebContentsView();
    this.view.webContents.loadFile(
      path.join(__dirname, "../core/overlay.html"),
    );
  }

  /**
   * @param {string} value
   * @param {Electron.Rectangle} bounds
   */
  show(value, bounds) {
    this.view.webContents.executeJavaScript(
      `document.getElementById('content').src = ${JSON.stringify(value)}`,
    );
    this.view.setBounds(bounds);
    this.parentWindow.contentView.addChildView(this.view);
    this.view.setVisible(true);
    this.#visible = true;
  }

  hide() {
    this.view.setVisible(false);
    this.#visible = false;
  }

  // hack to bring to front
  bringToFront() {
    if (!this.#visible) return;
    this.parentWindow.contentView.removeChildView(this.view);
    this.parentWindow.contentView.addChildView(this.view);
  }
}

module.exports = { Overlay };
