/**
 * TypeScript declarations for Electron API exposed through preload script
 */

export interface ElectronIpc {
  writeStateFile: (data: string | object) => Promise<void>;
  readStateFile: () => Promise<string>;
  setWindowButtonVisibility: (isVisible: boolean) => Promise<void>; // traffic lights
  setSidebarVisible: (isVisible: boolean) => Promise<void>;
  toggleSidebarVisible: () => Promise<void>;
  selectTab: (
    tabId: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<void>;
  createNewTab: (url: string) => Promise<number>;
  removeTab: (tabId: number) => Promise<void>;
  hideTab: (tabId: number) => Promise<void>;
  resizeTab: (
    tabId: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<void>;
  reloadTab: (tabId: number) => Promise<void>;
  tabLoadUrl: (tabId: number, url: string) => Promise<void>;
  tabGoBack: (tabId: number) => Promise<void>;
  tabGoForward: (tabId: number) => Promise<void>;
  tabGoBackSelf: () => Promise<void>;
  tabGoForwardSelf: () => Promise<void>;
  tabGetNavigationStateSelf: () => Promise<{
    canGoBack: boolean;
    canGoForward: boolean;
  }>;
  tabReloadSelf: () => Promise<void>;
  tabGoToHistoryIndex: (tabId: number, index: number) => Promise<void>;
  tabRestoreNavigationHistory: (
    tabId: number,
    tabIdToCopyHistory: number,
    activeIndex: number,
  ) => Promise<void>;
  focusMainWindow: () => Promise<void>;
  showOverlay: (
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<void>;
  hideOverlay: () => Promise<void>;
  showTabStripContextMenu: (tab: Tab, index: number) => Promise<void>;
  showChannelContextMenu: (channel: ArenaChannel, index: number) => Promise<void>;
  getHistoryEvents: () => Promise<HistoryEvent[]>;
  onTabsStateUpdated: (callback: any) => IpcRenderer;
  onTabOpen: (callback: any) => IpcRenderer;
  onMenuAction: (callback: (action: MenuAction) => void) => void;
  onHistoryEventsChanged: (callback: (events: HistoryEvent[]) => void) => void;
  onArenaChannelVisited: (
    callback: (channel: ArenaChannelVisitedEvent) => void,
  ) => void;
  onSidebarVisibilityChanged: (callback: (isVisible: boolean) => void) => void;
  onActiveTabChanged: (callback: (tabId: number) => void) => void;
}

type IpcHandler<T extends (...args: any[]) => any> = (
  event: import("electron").IpcMainInvokeEvent,
  ...args: Parameters<T>
) => ReturnType<T>;

type InvokeKeys = Exclude<keyof ElectronIpc, `on${string}`>;

type ElectronIpcHandlers = {
  [K in InvokeKeys]: IpcHandler<ElectronIpc[K]>;
};

declare global {
  interface Window {
    electronIpc: ElectronIpc;
  }

  interface TabInfo {
    url: string;
    title: string;
    tabId: number;
    domReady: boolean;
    faviconUrl: string;
    canGoBack: boolean;
    canGoForward: boolean;
    //TODO: make this a ModifiedNavigationEntry that keeps track of pageState in a separate data structure,
    //to avoid passing pageState through a heavy IPC call as well as adding it to the app state, wince pageState is very large
    navigationHistory: ModifiedNavigationEntry[];
    activeIndex: number;
    lastNavigatedTime: number;
    isDialogOpen: boolean;
  }

  type ModifiedNavigationEntry = {
    time: number;
    title: string;
    url: string;
  };

  interface OpenTabEvent {
    tabId: number;
    url: string;
    disposition: "default" | "foreground-tab" | "background-tab" | "new-window";
  }

  // MenuAction entry must contain the field "type" for discrimanted union
  type MenuAction =
    | { type: "newTab" }
    | { type: "reloadTab" }
    | { type: "closeActiveTab" }
    | { type: "nextTab" }
    | { type: "previousTab" }
    | { type: "deleteTabAtIndex"; tabIndex: number }
    | { type: "duplicateTabAtIndex"; tabIndex: number }
    | { type: "selectTabAtIndex"; tabIndex: number }
    | { type: "selectLastTab" }
    | { type: "toggleChannelPinnedAtIndex"; channelIndex: number }
    | { type: "deleteChannelAtIndex"; channelIndex: number };
}
