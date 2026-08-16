// Initial code from: https://github.com/samuelmaddock/electron-browser-shell/blob/master/packages/shell/browser/tabs.js

const { EventEmitter } = require("events");
const { WebContentsView, shell } = require("electron");
const path = require("node:path");
const { showTabContextMenu } = require("./menu.cjs");
const { logUrlVisit } = require("./db.cjs");

const INJECTED_TAB_SCRIPT_PATH = path.join(__dirname, "injectedTabScript.js");

/**
 * @param {string} url
 * @returns {boolean}
 */
function isArenaUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "are.na" || hostname.endsWith(".are.na");
  } catch {
    return false;
  }
}

class Tab {
  /** @type {string | null} */
  #lastLoggedUrl = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #inPageNavDebounce = null;

  /**
   * @param {import("electron").BrowserWindow} parentWindow
   * @param {Tabs} tabs
   */
  constructor(parentWindow, tabs) {
    this.view = new WebContentsView({
      webPreferences: {
        scrollBounce: true,
        preload: INJECTED_TAB_SCRIPT_PATH,
      },
    });
    this.id = this.view.webContents.id;
    this.parentWindow = parentWindow;
    this.tabs = tabs;
    this.webContents = this.view.webContents;
    this.parentWindow.contentView.addChildView(this.view);
    /** @type {number[]} */
    this.navigationHistoryTimes = [];

    this.#addEventListeners();
    this.webContents.on("will-navigate", (event, url) => {
      if (isArenaUrl(url)) return;
      event.preventDefault();
      shell.openExternal(url);
    });
    this.webContents.on("will-redirect", (event, url) => {
      if (isArenaUrl(url)) return;
      event.preventDefault();
      shell.openExternal(url);
    });
    //TODO: make into function
    this.webContents.setWindowOpenHandler((details) => {
      if (!isArenaUrl(details.url)) {
        shell.openExternal(details.url);
        return {
          action: "deny",
        };
      }
      if (
        details.disposition === "background-tab" ||
        details.disposition === "foreground-tab"
      ) {
        this.parentWindow.webContents.send("window-open", {
          tabId: this.id,
          url: details.url,
          details: details.disposition,
        });

        // emit some event to say new bg tab should be created
        return {
          action: "deny",
        };
      }
      return {
        action: "allow",
      };
    });
    this.webContents.on("context-menu", (_event, params) => {
      showTabContextMenu(this.parentWindow, this.webContents, params);
    });
  }

  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;

    this.hide();

    this.parentWindow.contentView.removeChildView(this.view);
    // this.window = undefined;

    if (!this.webContents.isDestroyed()) {
      if (this.webContents.isDevToolsOpened()) {
        this.webContents.closeDevTools();
      }

      // TODO: why is this no longer called?
      this.webContents.emit("destroyed");
      //TODO: look more into how to properly destroy WebContentsView

      //@ts-ignore
      this.webContents.destroy();
    }

    // this.webContents = undefined;
    // this.view = undefined;
  }

  /**
   * @param {string} url
   */
  loadURL(url) {
    return this.view.webContents.loadURL(url);
  }

  /**
   * @param {Electron.Rectangle} bounds
   */
  show(bounds) {
    this.setBounds(bounds);
    this.view.setVisible(true);
  }

  /**
   * @param {Electron.Rectangle} bounds
   */
  resize(bounds) {
    this.setBounds(bounds);
  }

  hide() {
    // this.stopResizeListener();
    this.view.setVisible(false);
  }

  reload() {
    this.view.webContents.reload();
  }

  // calculateLayout() {
  //   const [width, height] = this.parentWindow.getSize();
  //   this.view.setBounds({
  //     x: LEFT_VIEW_WIDTH,
  //     y: 0,
  //     width: width - LEFT_VIEW_WIDTH,
  //     height: height,
  //   });
  //   this.view.setBorderRadius(8);
  // }

  /**
   * @param {Electron.Rectangle} bounds
   */
  setBounds(bounds) {
    this.view.setBounds(bounds);
  }

  // Replacement for BrowserView.setAutoResize. This could probably be better...
  // startResizeListener() {
  //   this.stopResizeListener();
  //   this.parentWindow.on("resize", () => {
  //     this.calculateLayout();
  //   });
  // }
  // stopResizeListener() {
  //   this.parentWindow.off("resize", () => {
  //     this.calculateLayout();
  //   });
  // }

  /**
   */
  goBack() {
    this.webContents.navigationHistory.goBack();
  }

  goForward() {
    this.webContents.navigationHistory.goForward();
  }

  /**
   * @param {number} index
   */
  goToHistoryIndex(index) {
    this.webContents.navigationHistory.goToIndex(index);
  }

  /**
   * @param {string} url
   */
  loadUrl(url) {
    this.view.webContents.loadURL(url);
  }

  #addEventListeners() {
    // did-frame-navigate will also fire for iframe navigations, which we don't want whne setting URL history
    this.webContents.addListener("did-navigate", (_event, url) => {
      this.#sendNavigationState(url, true);
    });
    this.webContents.addListener(
      "did-navigate-in-page",
      (_event, url, isMainFrame) => {
        if (!isMainFrame) return;
        //TODO: look into this it's kinda weird
        if (this.#inPageNavDebounce) clearTimeout(this.#inPageNavDebounce);
        this.#inPageNavDebounce = setTimeout(() => {
          this.#inPageNavDebounce = null;
          this.#sendNavigationState(url, true);
        }, 500);
      },
    );
    this.webContents.addListener("page-title-updated", (_event, title) => {
      if (title !== "") this.sendTabInfoMessage({ title: title });
    });
    this.webContents.addListener("dom-ready", () => {
      this.sendTabInfoMessage({ domReady: true });
      this.webContents.send(
        "sidebar-visibility-changed",
        this.tabs.sidebarVisible,
      );
    });
    this.webContents.addListener("page-favicon-updated", (_event, favicons) => {
      this.sendTabInfoMessage({ faviconUrl: favicons[0] });
    });
  }

  /**
   * @param {Partial<TabInfo>} tabInfoPartial
   */
  sendTabInfoMessage(tabInfoPartial) {
    this.parentWindow.webContents.send("tabs-state-updated", {
      tabId: this.id,
      ...tabInfoPartial,
    });
  }

  /**
   * @param {string} url
   */
  /**
   * @param {string} url
   * @param {boolean} dedupe - skip logging if URL hasn't changed since last log
   */
  async #sendNavigationState(url, dedupe) {
    if (dedupe && url === this.#lastLoggedUrl) return;
    this.#lastLoggedUrl = url;
    logUrlVisit(this.id, url, this.webContents.getTitle());

    const activeIndex = this.webContents.navigationHistory.getActiveIndex();
    this.navigationHistoryTimes[activeIndex] = Date.now();

    const canGoBack = this.webContents.navigationHistory.canGoBack();
    const canGoForward = this.webContents.navigationHistory.canGoForward();
    this.webContents.send("tab-navigation-state", { canGoBack, canGoForward });

    this.sendTabInfoMessage({
      url: url,
      title: this.webContents.getTitle(),
      canGoBack: canGoBack,
      canGoForward: canGoForward,
      navigationHistory: this.webContents.navigationHistory
        .getAllEntries()
        .map((entry, i) => {
          return {
            title: entry.title,
            url: entry.url,
            time: this.navigationHistoryTimes[i],
          };
        }),
      activeIndex: this.webContents.navigationHistory.getActiveIndex(),
      lastNavigatedTime: Date.now(),
    });
  }
}

class Tabs extends EventEmitter {
  /** @type {Tab[]}*/
  tabList = [];
  /** @type {number | null} */
  activeTabId = null;
  sidebarVisible = false;

  /**
   * @param {import("electron").BrowserWindow} parentWindow
   */
  constructor(parentWindow) {
    super();
    /** @type {import("electron").BrowserWindow} It's possible for the parentWindow to be destroyed on exit*/
    this.parentWindow = parentWindow;
    /** @type {Map<number,import("electron").NavigationEntry[]>}*/
    this.deletedTabNavigationHistories = new Map();
  }

  /**
   * @param {number} tabId
   */
  get(tabId) {
    return this.tabList.find((tab) => tab.id === tabId);
  }

  getActiveTab() {
    return this.activeTabId === null ? null : this.get(this.activeTabId);
  }

  /**
   * @param {string} url
   * @returns {Promise<number>} id
   */
  async create(url) {
    const tab = new Tab(this.parentWindow, this);
    tab.hide();
    this.tabList.push(tab);
    tab.loadURL(url); // this method is async but we don't care about waiting for it to finish before returning
    this.emit("tab-created", tab);
    return tab.id;
  }

  /**
   * @param {number} tabId
   */
  remove(tabId) {
    const tabIndex = this.tabList.findIndex((tab) => tab.id === tabId);
    if (tabIndex < 0) {
      throw new Error(`Tabs.remove: unable to find tab.id = ${tabId}`);
    }
    const tab = this.tabList[tabIndex];
    this.tabList.splice(tabIndex, 1);
    this.deletedTabNavigationHistories.set(
      tab.id,
      tab.webContents.navigationHistory.getAllEntries(),
    );
    tab.destroy();
    // this.emit("tab-destroyed", tab);
  }

  removeAllTabs() {
    for (const tab of this.tabList) {
      tab.destroy();
    }
    this.tabList = [];
  }

  /**
   * @param {number} tabId
   */
  hide(tabId) {
    const tab = this.get(tabId);
    if (!tab) return;
    tab.hide();
  }

  /**
   * @param {number} tabId
   * @param {Electron.Rectangle} bounds
   */
  resize(tabId, bounds) {
    const tab = this.get(tabId);
    if (!tab) return;
    tab.resize(bounds);
  }

  /**
   * @param {number} tabId
   */
  reload(tabId) {
    const tab = this.get(tabId);
    if (!tab) return;
    tab.reload();
  }

  /**
   * @param {number} tabId
   * @param {string} url
   */
  loadUrl(tabId, url) {
    const tab = this.get(tabId);
    if (!tab) return;
    tab.loadUrl(url);
  }

  /**
   * @param {number} tabIdToBeModified
   * @param {number} tabIdToBeCopied
   * @param {number} activeIndex
   */

  restoreNavigationHistory(tabIdToBeModified, tabIdToBeCopied, activeIndex) {
    const tabToBeModified = this.get(tabIdToBeModified);
    if (!tabToBeModified) return;
    const tabToBeCopied = this.get(tabIdToBeCopied);
    const navigationHistory = tabToBeCopied
      ? tabToBeCopied.webContents.navigationHistory.getAllEntries()
      : this.deletedTabNavigationHistories.get(tabIdToBeCopied);
    if (!navigationHistory) return;
    tabToBeModified.webContents.navigationHistory.restore({
      index: activeIndex,
      entries: navigationHistory,
    });
  }

  /**
   * @param {number} tabId
   */
  goBack(tabId) {
    const tab = this.get(tabId);
    if (!tab) return;
    tab.goBack();
  }

  /**
   * @param {number} tabId
   */
  goForward(tabId) {
    const tab = this.get(tabId);
    if (!tab) return;
    tab.goForward();
  }

  /**
   * @param {number} tabId
   * @param {number} index
   */
  goToHistoryIndex(tabId, index) {
    const tab = this.get(tabId);
    if (!tab) return;
    tab.goToHistoryIndex(index);
  }

  /**
   * @param {number} tabId
   * @param {Electron.Rectangle} bounds
   */
  async select(tabId, bounds) {
    const tab = this.get(tabId);
    if (!tab) return;
    if (this.activeTabId !== tabId) {
      this.activeTabId = tabId;
      if (!this.parentWindow.isDestroyed()) {
        this.parentWindow.webContents.send("active-tab-changed", tabId);
      }
    }
    tab.show(bounds);
    tab.webContents.focus();
  }

  /**
   * @param {boolean} isVisible
   */
  setSidebarVisible(isVisible) {
    this.sidebarVisible = isVisible;
    if (!this.parentWindow.isDestroyed()) {
      this.parentWindow.webContents.send(
        "sidebar-visibility-changed",
        isVisible,
      );
    }
    for (const tab of this.tabList) {
      if (tab.webContents.isDestroyed()) continue;
      tab.webContents.send("sidebar-visibility-changed", isVisible);
    }
  }
}

module.exports = {
  Tabs,
  Tab,
};
