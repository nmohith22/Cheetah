const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

// Aggressive performance optimizations
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization,UseSkiaRenderer');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-gpu-blocklist'); // Force GPU acceleration
app.commandLine.appendSwitch('enable-quic'); // Faster YouTube streaming
app.commandLine.appendSwitch('enable-accelerated-video-decode'); // Hardware video decoding
app.commandLine.appendSwitch('v8-cache-options', 'code'); // Aggressive JS caching

// AdBlock IPC Batching Buffer
let adBlockBuffer = [];
let adBlockTimer = null;

let isAdblockerInitialized = false;
let isShieldEnabled = true;
const activeDownloads = new Map();

// Listen for shield toggle
ipcMain.on('set-shield-enabled', (event, enabled) => {
  isShieldEnabled = enabled;
});

let allow3PC = false;
ipcMain.on('set-third-party-cookies', (event, allow) => {
  allow3PC = allow;
});

// Suppress harmless script injection errors when webviews navigate away
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.message && reason.message.includes('Script failed to execute')) return;
  console.error('Unhandled Rejection:', reason);
});

// Fix MaxListenersExceeded warning across all internal WebContents
// And register global hotkeys that work regardless of webview focus
app.on('web-contents-created', (event, contents) => {
  contents.setMaxListeners(200);
  
  contents.on('before-input-event', (event, input) => {
    const isCmdOrCtrl = input.control || input.meta;
    const key = input.key.toLowerCase();
    
    if (isCmdOrCtrl && key === 't') {
      BrowserWindow.getAllWindows()[0]?.webContents.send('shortcut-new-tab');
      event.preventDefault();
    } else if (isCmdOrCtrl && key === 'w') {
      BrowserWindow.getAllWindows()[0]?.webContents.send('shortcut-close-tab');
      event.preventDefault();
    } else if ((isCmdOrCtrl && key === 'r') || input.key === 'F5') {
      BrowserWindow.getAllWindows()[0]?.webContents.send('shortcut-reload');
      event.preventDefault();
    }
  });
});

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Cheetah Browser',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true // Critical for multi-tab UI
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.setMaxListeners(100);

  // Set up both partitions
  const incognitoSession = session.fromPartition('incognito');
  const standardSession = session.fromPartition('persist:standard');

  // Only initialize session-level hooks once
  if (!isAdblockerInitialized) {
    const setupSessionHooks = (sess) => {
      // Privacy: Enforce Do Not Track (DNT) and aggressively block 3rd-Party Cookies
      sess.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['DNT'] = '1';
        
        if (!allow3PC && details.requestHeaders['Cookie']) {
          try {
            const reqHost = new URL(details.url).hostname;
            const refUrl = details.referrer || (details.requestHeaders['Origin'] ? details.requestHeaders['Origin'] : '');
            if (refUrl) {
              const refHost = new URL(refUrl).hostname;
              const cleanReq = reqHost.replace(/^www\./i, '');
              const cleanRef = refHost.replace(/^www\./i, '');
              // If domain mismatch, strictly drop the tracking cookie
              if (!cleanReq.endsWith(cleanRef) && !cleanRef.endsWith(cleanReq)) {
                delete details.requestHeaders['Cookie'];
              }
            }
          } catch(e) {}
        }
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      });

      // Intercept Set-Cookie responses to prevent writing 3rd party cookies
      sess.webRequest.onHeadersReceived((details, callback) => {
        if (!allow3PC && details.responseHeaders) {
          const hasSetCookie = details.responseHeaders['Set-Cookie'] || details.responseHeaders['set-cookie'];
          if (hasSetCookie) {
            try {
              const reqHost = new URL(details.url).hostname;
              const refUrl = details.referrer || '';
              if (refUrl) {
                const refHost = new URL(refUrl).hostname;
                const cleanReq = reqHost.replace(/^www\./i, '');
                const cleanRef = refHost.replace(/^www\./i, '');
                if (!cleanReq.endsWith(cleanRef) && !cleanRef.endsWith(cleanReq)) {
                  delete details.responseHeaders['Set-Cookie'];
                  delete details.responseHeaders['set-cookie'];
                }
              }
            } catch(e) {}
          }
        }
        callback({ cancel: false, responseHeaders: details.responseHeaders });
      });

      // Set up native Downloads management
      sess.on('will-download', (event, item, webContents) => {
        const filename = item.getFilename();
        const totalBytes = item.getTotalBytes();
        const downloadId = Date.now().toString() + Math.random().toString(36).substr(2, 5);

        activeDownloads.set(downloadId, item);

        webContents.send('download-started', {
          id: downloadId,
          filename,
          totalBytes
        });

        item.on('updated', (ev, state) => {
          if (state === 'interrupted') {
            webContents.send('download-updated', { id: downloadId, state: 'interrupted', receivedBytes: item.getReceivedBytes() });
          } else if (state === 'progressing') {
            webContents.send('download-updated', { id: downloadId, state: item.isPaused() ? 'paused' : 'progressing', receivedBytes: item.getReceivedBytes() });
          }
        });

        item.once('done', (ev, state) => {
          activeDownloads.delete(downloadId);
          webContents.send('download-done', { id: downloadId, state, savePath: item.getSavePath(), receivedBytes: item.getReceivedBytes() });
        });
      });
    };

    setupSessionHooks(incognitoSession);
    setupSessionHooks(standardSession);

    // Set up Ad Blocker with caching
    try {
      const cachePath = path.join(app.getPath('userData'), 'adblocker_engine.bin');
      let blocker;
      if (fs.existsSync(cachePath)) {
        blocker = await ElectronBlocker.deserialize(fs.readFileSync(cachePath));
      } else {
        blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
        fs.writeFileSync(cachePath, blocker.serialize());
      }

      const originalOnBeforeRequest = blocker.onBeforeRequest.bind(blocker);
      blocker.onBeforeRequest = (details, callback) => {
        if (!isShieldEnabled) {
          callback({});
          return;
        }
        
        if (details.url.includes('.googlevideo.com/videoplayback') || details.resourceType === 'media') {
          callback({});
          return;
        }

        originalOnBeforeRequest(details, (res) => {
          callback(res);
          if (res.cancel || res.redirectURL) {
            adBlockBuffer.push({ url: details.url, tabId: details.webContentsId });
            if (!adBlockTimer) {
              adBlockTimer = setTimeout(() => {
                const payload = [...adBlockBuffer];
                adBlockBuffer = [];
                adBlockTimer = null;
                try {
                  const windows = BrowserWindow.getAllWindows();
                  for (const win of windows) {
                    if (!win.isDestroyed()) win.webContents.send('ad-blocked-batch', payload);
                  }
                } catch (err) {}
              }, 250);
            }
          }
        });
      };

      blocker.enableBlockingInSession(incognitoSession);
      
      // Clean up global IPC channels registered by Ghostery before enabling the second session
      try { ipcMain.removeHandler('@ghostery/adblocker/inject-cosmetic-filters'); } catch(e) {}
      try { ipcMain.removeHandler('@ghostery/adblocker/get-cosmetic-filters'); } catch(e) {}
      try { ipcMain.removeHandler('@ghostery/adblocker/is-mutation-observer-enabled'); } catch(e) {}
      
      blocker.enableBlockingInSession(standardSession);
      isAdblockerInitialized = true;
      console.log('Cheetah AdBlocker and Multi-Session Policies enabled successfully!');
    } catch (err) {
      console.error('Failed to initialize AdBlocker:', err);
    }
  }

  // Handle IPC for Multi-Window
  ipcMain.removeAllListeners('new-window');
  ipcMain.on('new-window', () => {
    createWindow();
  });

  // Relay fullscreen events to the renderer
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', true);
  });
  
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', false);
  });
}

// Download cancellations and folder opens
ipcMain.on('cancel-download', (event, downloadId) => {
  const item = activeDownloads.get(downloadId);
  if (item) {
    item.cancel();
    activeDownloads.delete(downloadId);
  }
});

ipcMain.on('show-item-in-folder', (event, fullPath) => {
  if (fullPath) {
    try {
      shell.showItemInFolder(fullPath);
    } catch (e) {
      console.error('Failed to show file in folder:', e);
    }
  }
});

// Spoof standard Chrome User-Agent
app.userAgentFallback = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  try {
    // Ensure all data is explicitly wiped from the incognito session before closing
    const incognitoSession = session.fromPartition('incognito');
    await incognitoSession.clearStorageData();
    await incognitoSession.clearCache();
  } catch(e) {}
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
