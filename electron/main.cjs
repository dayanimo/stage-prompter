/**
 * Electron main process for the Stage Prompter desktop app.
 *
 * The whole UI is the existing built web app (dist/), served over a custom
 * `app://` scheme. A custom scheme gives a STABLE secure origin (app://bundle),
 * which is what lets IndexedDB / localStorage persist across launches — unlike
 * `file://`, whose opaque origin would wipe data every run. No app code changes.
 */
const { app, BrowserWindow, protocol, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.map': 'application/json',
};

// Must be registered before app `ready`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

function serveFromDist(request) {
  const url = new URL(request.url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  let filePath = path.normalize(path.join(DIST, pathname));
  // Block path traversal; fall back to the SPA entry for unknown routes.
  if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  return new Response(data, {
    headers: { 'content-type': MIME[ext] || 'application/octet-stream' },
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    title: 'Stage Prompter',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // Open http(s) links (e.g. the phone-remote URL) in the system browser, but
  // allow app:// child windows (the same-machine remote window).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://')) return { action: 'allow' };
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  win.loadURL('app://bundle/index.html');
  return win;
}

app.whenReady().then(() => {
  protocol.handle('app', serveFromDist);
  // Minimal native menu (keep Cmd+Q / Alt+F4, Reload, Fullscreen, DevTools).
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'fileMenu' },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'togglefullscreen' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
        ],
      },
    ]),
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
