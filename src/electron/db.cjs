const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), "user", "history.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS url_visits (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    ts     INTEGER NOT NULL,
    tab_id INTEGER,
    url    TEXT,
    title  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ts     ON url_visits(ts);
  CREATE INDEX IF NOT EXISTS idx_tab_id ON url_visits(tab_id);
`);

// Add title column to existing databases that predate this field
try {
  db.exec("ALTER TABLE url_visits ADD COLUMN title TEXT");
} catch {}

const insert = db.prepare(
  "INSERT INTO url_visits (ts, tab_id, url, title) VALUES (?, ?, ?, ?)",
);
const selectAll = db.prepare(
  "SELECT * FROM url_visits ORDER BY ts DESC LIMIT 200",
);

/** @type {import("electron").BrowserWindow | null} */
let _mainWindow = null;

/** @param {import("electron").BrowserWindow} win */
function setMainWindow(win) {
  _mainWindow = win;
}

/** @param {number|null} tabId @param {string|null} url @param {string|null} title */
function logUrlVisit(tabId = null, url = null, title = null) {
  insert.run(Date.now(), tabId, url, title);
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send("history-events-changed", selectAll.all());
  }
}

function getEvents() {
  return selectAll.all();
}

module.exports = {
  logUrlVisit,
  getEvents,
  setMainWindow,
  db,
};
