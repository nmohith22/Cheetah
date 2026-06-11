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

let isAdblockerInitialized = false;
let isShieldEnabled = true;
const activeDownloads = new Map();

// Listen for shield toggle
ipcMain.on('set-shield-enabled', (event, enabled) => {
  isShieldEnabled = enabled;
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

  // Enforce an entirely in-memory, incognito session for all tabs
  const incognitoSession = session.fromPartition('incognito');

  // Only initialize session-level hooks once
  if (!isAdblockerInitialized) {
    // Privacy: Enforce Do Not Track (DNT)
    incognitoSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['DNT'] = '1';
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

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

      // Intercept blocked requests and notify the renderer process
      const originalOnBeforeRequest = blocker.onBeforeRequest;
      blocker.onBeforeRequest = (details, callback) => {
        if (!isShieldEnabled) {
          callback({});
          return;
        }
        originalOnBeforeRequest(details, (res) => {
          // Unblock the network request instantly!
          callback(res);

          // Relay telemetry asynchronously to avoid blocking Chromium's network loop
          if (res.cancel || res.redirectURL) {
            process.nextTick(() => {
              try {
                const windows = BrowserWindow.getAllWindows();
                for (const win of windows) {
                  if (!win.isDestroyed()) {
                    win.webContents.send('ad-blocked', { url: details.url, tabId: details.webContentsId });
                  }
                }
              } catch (err) {
                console.error('Error sending adblock details to renderer:', err);
              }
            });
          }
        });
      };

      blocker.enableBlockingInSession(incognitoSession);
      isAdblockerInitialized = true;
      console.log('Cheetah AdBlocker enabled successfully on Incognito Session!');
    } catch (err) {
      console.error('Failed to initialize AdBlocker:', err);
    }

    // Set up native Downloads management inside incognito partition
    incognitoSession.on('will-download', (event, item, webContents) => {
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
          webContents.send('download-updated', {
            id: downloadId,
            state: 'interrupted',
            receivedBytes: item.getReceivedBytes()
          });
        } else if (state === 'progressing') {
          webContents.send('download-updated', {
            id: downloadId,
            state: item.isPaused() ? 'paused' : 'progressing',
            receivedBytes: item.getReceivedBytes()
          });
        }
      });

      item.once('done', (ev, state) => {
        activeDownloads.delete(downloadId);
        webContents.send('download-done', {
          id: downloadId,
          state, // 'completed', 'cancelled', 'interrupted'
          savePath: item.getSavePath(),
          receivedBytes: item.getReceivedBytes()
        });
      });
    });
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
