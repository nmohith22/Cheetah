// State Management
let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let isFullscreen = false;
let activeSidebarSection = 'bookmarks'; // default open section

// DOM Elements - Navigation & Tabbar
const tabsList = document.getElementById('tabs-list');
const addTabBtn = document.getElementById('add-tab-btn');
const tabsOverviewBtn = document.getElementById('tabs-overview-btn');
const tabsContainer = document.getElementById('tabs-container');
const urlInput = document.getElementById('url-input');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const homeBtn = document.getElementById('home-btn');

// DOM Elements - Badges & Status Indicators
const shieldStatusBtn = document.getElementById('shield-status-btn');
const shieldCountBadge = document.getElementById('shield-count-badge');
const bookmarkPageBtn = document.getElementById('bookmark-page-btn');
const searchSettingsBtn = document.getElementById('search-settings-btn');

// DOM Elements - Bookmarks Bar
const bookmarksBar = document.getElementById('bookmarks-bar');
const bookmarksBarList = document.getElementById('bookmarks-bar-list');

// DOM Elements - New Tab Dashboard
const newtabView = document.getElementById('newtab-view');
const ntClock = document.getElementById('newtab-clock');
const ntGreeting = document.getElementById('newtab-greeting');
const ntSearchInput = document.getElementById('newtab-search-input');
const ntSearchBtn = document.getElementById('newtab-search-btn');
const ntEngineName = document.getElementById('newtab-engine-name');
const speedDialGrid = document.getElementById('speed-dial-grid');
const statAdsBlocked = document.getElementById('stat-ads-blocked');

// DOM Elements - Modals & Dialogs
const tabModal = document.getElementById('tab-modal');
const tabGrid = document.getElementById('tab-grid');
const newTabModalBtn = document.getElementById('new-tab-btn');
const newWindowBtn = document.getElementById('new-window-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const sdDialog = document.getElementById('speed-dial-dialog');
const sdNameInput = document.getElementById('dialog-sd-name');
const sdUrlInput = document.getElementById('dialog-sd-url');

// DOM Elements - Collapsible Sidebar
const sidebar = document.getElementById('sidebar');
const sidebarTitle = document.getElementById('sidebar-title');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sbDownloadsBadge = document.getElementById('sb-downloads-badge');

// Sidebar Tabs & Panels Maps
const sidebarTabs = {
  bookmarks: document.getElementById('sb-tab-bookmarks'),
  history: document.getElementById('sb-tab-history'),
  downloads: document.getElementById('sb-tab-downloads'),
  themes: document.getElementById('sb-tab-themes'),
  settings: document.getElementById('sb-tab-settings')
};

const sidebarPanels = {
  bookmarks: document.getElementById('sb-panel-bookmarks'),
  history: document.getElementById('sb-panel-history'),
  downloads: document.getElementById('sb-panel-downloads'),
  themes: document.getElementById('sb-panel-themes'),
  settings: document.getElementById('sb-panel-settings')
};

// Persistent Local Storage Variables
let currentSearchEngine = localStorage.getItem('cheetah-search-engine') || 'https://duckduckgo.com/?q=';
let bookmarks = JSON.parse(localStorage.getItem('cheetah-bookmarks') || '[]');
let history = JSON.parse(localStorage.getItem('cheetah-history') || '[]');
let speedDials = JSON.parse(localStorage.getItem('cheetah-speed-dials') || '[]');
let isShieldEnabled = localStorage.getItem('cheetah-shield-enabled') !== 'false';

// Default Speed Dials if empty
if (speedDials.length === 0) {
  speedDials = [
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com' },
    { name: 'Mojeek', url: 'https://www.mojeek.com' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'YouTube', url: 'https://youtube.com' },
    { name: 'Reddit', url: 'https://reddit.com' }
  ];
  localStorage.setItem('cheetah-speed-dials', JSON.stringify(speedDials));
}

// -------------------------------------------------------------
// Collapsible Sidebar Controller
// -------------------------------------------------------------

function selectSidebarSection(section) {
  activeSidebarSection = section;

  // Toggle active icons
  Object.entries(sidebarTabs).forEach(([key, btn]) => {
    if (key === section) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Toggle visible panels
  Object.entries(sidebarPanels).forEach(([key, panel]) => {
    if (key === section) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  });

  // Update panel title
  sidebarTitle.innerText = section.charAt(0).toUpperCase() + section.slice(1);

  // Trigger specific renders
  if (section === 'bookmarks') renderBookmarksPanel();
  if (section === 'history') renderHistoryPanel();
  if (section === 'downloads') renderDownloadsPanel();
  if (section === 'themes') renderThemeGrid();
  if (section === 'settings') updateMemorySaverUI();
}

function openSidebar(section) {
  sidebar.classList.remove('collapsed');
  sidebar.classList.add('open');
  selectSidebarSection(section);
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebar.classList.add('collapsed');
  // Remove active visual class on icons when collapsed
  Object.values(sidebarTabs).forEach(btn => btn.classList.remove('active'));
}

// Bind Sidebar Tab Buttons
Object.entries(sidebarTabs).forEach(([key, btn]) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isSidebarOpen = sidebar.classList.contains('open');
    if (isSidebarOpen && activeSidebarSection === key) {
      closeSidebar();
    } else {
      openSidebar(key);
    }
  });
});

closeSidebarBtn.addEventListener('click', closeSidebar);

// -------------------------------------------------------------
// Memory Saver: Tab Sleeping (Unloading)
// -------------------------------------------------------------

function attachWebviewListeners(tabData) {
  const { id, webview } = tabData;

  webview.addEventListener('did-start-navigation', (e) => {
    if (e.isMainFrame) {
      tabData.url = e.url;
      hideAllPopovers();
    }
    if (activeTabId === id) updateUI();
  });

  webview.addEventListener('page-title-updated', (e) => {
    tabData.title = e.title;
    if (activeTabId === id) {
      document.title = `Cheetah - ${e.title}`;
      updateBookmarkStarUI();
    }
    renderTabBar();
    
    // Add page to History
    if (tabData.url && !tabData.url.startsWith('cheetah://newtab') && !tabData.url.startsWith('about:blank')) {
      addHistoryEntry(e.title, tabData.url);
    }
  });

  webview.addEventListener('did-finish-load', () => {
    tabData.url = webview.getURL();
    if (activeTabId === id) updateUI();
  });

  webview.addEventListener('dom-ready', () => {
    try {
      tabData.webContentsId = webview.getWebContentsId();
    } catch (e) {
      console.error('Failed to get WebContents ID:', e);
    }
  });

  webview.addEventListener('new-window', (e) => {
    createTab(e.url);
  });
}

function sleepTab(tab) {
  if (tab.isAsleep || tab.id === activeTabId || tab.url.startsWith('cheetah://newtab')) return;
  
  try {
    tab.sleepUrl = tab.webview.getURL() || tab.url;
  } catch(e) {
    tab.sleepUrl = tab.url;
  }
  
  tab.webview.remove();
  tab.webview = null;
  tab.isAsleep = true;
  
  renderTabBar();
  updateMemorySaverUI();
  console.log(`Tab ${tab.id} went to sleep to save memory.`);
}

function wakeTab(tab) {
  if (!tab.isAsleep) return;
  
  const webview = document.createElement('webview');
  webview.id = tab.id;
  webview.src = tab.sleepUrl || 'https://duckduckgo.com';
  webview.className = 'webview-tab';
  webview.allowpopups = true;
  webview.webpreferences = "contextIsolation=yes";
  webview.partition = "incognito";
  
  tabsContainer.appendChild(webview);
  tab.webview = webview;
  tab.isAsleep = false;
  
  // Re-attach WebView Listeners
  attachWebviewListeners(tab);
  
  renderTabBar();
  updateMemorySaverUI();
  console.log(`Tab ${tab.id} woke up.`);
}

// Background scheduler checking inactive tabs to freeze them
function manageSleepingTabs() {
  const now = Date.now();
  const sleepTimeout = 180000; // 3 minutes
  
  tabs.forEach(tab => {
    if (tab.id !== activeTabId && !tab.isAsleep && !tab.url.startsWith('cheetah://newtab')) {
      if (now - tab.lastActiveTime > sleepTimeout) {
        sleepTab(tab);
      }
    }
  });
}

// Run monitor every 20 seconds
setInterval(manageSleepingTabs, 20000);

function updateMemorySaverUI() {
  const statsLabel = document.getElementById('memory-saver-stats');
  if (!statsLabel) return;
  const sleepingCount = tabs.filter(t => t.isAsleep).length;
  const mbSaved = sleepingCount * 120; // estimate 120MB saved per frozen process
  statsLabel.innerText = `${mbSaved} MB Saved (${sleepingCount} Tab${sleepingCount === 1 ? '' : 's'} Asleep)`;
}

// -------------------------------------------------------------
// Tab Management
// -------------------------------------------------------------

function createTab(url = 'cheetah://newtab') {
  tabCounter++;
  const id = `tab-${tabCounter}`;
  
  const webview = document.createElement('webview');
  webview.id = id;
  webview.src = url.startsWith('cheetah://') ? 'about:blank' : url;
  webview.className = 'webview-tab';
  webview.allowpopups = true;
  webview.webpreferences = "contextIsolation=yes";
  webview.partition = "incognito"; // Force fully in-memory private session

  tabsContainer.appendChild(webview);

  const tabData = { 
    id, 
    webview, 
    title: 'New Tab', 
    url,
    webContentsId: null,
    blockedCount: 0,
    blockedTrackers: [],
    lastActiveTime: Date.now(),
    isAsleep: false
  };
  
  tabs.push(tabData);
  attachWebviewListeners(tabData);
  switchTab(id);
}

function switchTab(id) {
  const prevActive = tabs.find(t => t.id === activeTabId);
  if (prevActive) {
    prevActive.lastActiveTime = Date.now();
  }

  activeTabId = id;
  const activeTab = tabs.find(t => t.id === id);
  if (!activeTab) return;

  // Re-awaken tab if sleeping
  if (activeTab.isAsleep) {
    wakeTab(activeTab);
  }

  activeTab.lastActiveTime = Date.now();

  tabs.forEach(tab => {
    if (tab.id === id) {
      if (tab.url.startsWith('cheetah://newtab')) {
        if (tab.webview) tab.webview.classList.remove('active');
        newtabView.classList.remove('hidden');
        urlInput.value = '';
      } else {
        if (tab.webview) tab.webview.classList.add('active');
        newtabView.classList.add('hidden');
        urlInput.value = tab.url;
        try { tab.webview.focus(); } catch(e) {}
      }
      document.title = tab.url.startsWith('cheetah://newtab') ? 'Cheetah - New Tab' : `Cheetah - ${tab.title}`;
    } else {
      if (tab.webview) tab.webview.classList.remove('active');
    }
  });

  tabModal.classList.add('hidden');
  updateUI();
  renderTabBar();
  updateShieldUI();
  updateBookmarkStarUI();
}

function closeTab(id, e) {
  if (e) e.stopPropagation();
  
  const tabIndex = tabs.findIndex(t => t.id === id);
  if (tabIndex === -1) return;

  const tab = tabs[tabIndex];
  if (tab.webview) tab.webview.remove();
  tabs.splice(tabIndex, 1);

  if (tabs.length === 0) {
    createTab();
  } else if (activeTabId === id) {
    switchTab(tabs[Math.max(0, tabIndex - 1)].id);
  } else {
    renderTabBar();
    renderTabGrid();
  }
}

function renderTabBar() {
  tabsList.innerHTML = '';
  tabs.forEach(tab => {
    const tabItem = document.createElement('div');
    tabItem.className = `tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isAsleep ? 'asleep' : ''}`;
    tabItem.onclick = () => switchTab(tab.id);

    // Favicon image or fallback
    const fav = document.createElement('img');
    fav.className = 'tab-favicon';
    
    if (tab.url.startsWith('cheetah://newtab') || tab.url.startsWith('about:')) {
      fav.className += ' empty-fav';
      fav.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
    } else {
      let domain = '';
      try { domain = new URL(tab.url).hostname; } catch(err) {}
      fav.src = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
      fav.onerror = () => {
        fav.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
      };
    }

    const title = document.createElement('span');
    title.className = 'tab-title-text';
    title.innerText = tab.url.startsWith('cheetah://newtab') ? 'New Tab' : tab.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerText = '×';
    closeBtn.onclick = (e) => closeTab(tab.id, e);

    tabItem.appendChild(fav);
    tabItem.appendChild(title);
    tabItem.appendChild(closeBtn);
    tabsList.appendChild(tabItem);
  });
}

function renderTabGrid() {
  if (tabModal.classList.contains('hidden')) return;
  tabGrid.innerHTML = '';
  tabs.forEach(tab => {
    const card = document.createElement('div');
    card.className = `tab-card ${tab.id === activeTabId ? 'active' : ''}`;
    card.onclick = () => switchTab(tab.id);

    const title = document.createElement('div');
    title.className = 'tab-title';
    title.innerText = tab.url.startsWith('cheetah://newtab') ? 'New Tab' : tab.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.innerText = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeTab(tab.id, e);
    };

    card.appendChild(title);
    card.appendChild(closeBtn);
    tabGrid.appendChild(card);
  });
}

function updateUI() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab) return;

  if (!activeTab.url.startsWith('cheetah://newtab')) {
    urlInput.value = activeTab.url;
  } else {
    urlInput.value = '';
  }
  
  try {
    backBtn.disabled = !activeTab.webview.canGoBack();
    forwardBtn.disabled = !activeTab.webview.canGoForward();
  } catch (e) {
    // webview might not be fully loaded or is asleep
  }
}

// -------------------------------------------------------------
// Navigation Event Handlers
// -------------------------------------------------------------

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    let url = urlInput.value.trim();
    if (!url) return;
    navigateActiveTab(url);
    urlInput.blur();
  }
});

urlInput.addEventListener('focus', () => urlInput.select());

backBtn.addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && !activeTab.isAsleep && activeTab.webview.canGoBack()) activeTab.webview.goBack();
});

forwardBtn.addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && !activeTab.isAsleep && activeTab.webview.canGoForward()) activeTab.webview.goForward();
});

reloadBtn.addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    if (activeTab.isAsleep) wakeTab(activeTab);
    else activeTab.webview.reload();
  }
});

homeBtn.addEventListener('click', () => {
  navigateActiveTab('cheetah://newtab');
});

addTabBtn.addEventListener('click', () => {
  createTab();
});

tabsOverviewBtn.addEventListener('click', () => {
  tabModal.classList.remove('hidden');
  renderTabGrid();
});

newTabModalBtn.addEventListener('click', () => {
  createTab();
});

newWindowBtn.addEventListener('click', () => {
  window.electronAPI.createNewWindow();
  tabModal.classList.add('hidden');
});

closeModalBtn.addEventListener('click', () => {
  tabModal.classList.add('hidden');
});

function navigateActiveTab(url) {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab) return;

  if (url === 'cheetah://newtab') {
    activeTab.url = 'cheetah://newtab';
    activeTab.title = 'New Tab';
    if (activeTab.webview) activeTab.webview.src = 'about:blank';
    switchTab(activeTabId);
  } else {
    if (!/^https?:\/\//i.test(url)) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = currentSearchEngine + encodeURIComponent(url);
      }
    }
    activeTab.url = url;
    if (activeTab.isAsleep) {
      activeTab.sleepUrl = url;
      wakeTab(activeTab);
    } else {
      activeTab.webview.src = url;
    }
  }
}

// Fullscreen Logic
const headerArea = document.getElementById('header-area');
const fullscreenTrigger = document.getElementById('fullscreen-trigger');

window.electronAPI.onFullscreenChange((isFull) => {
  isFullscreen = isFull;
  if (isFullscreen) {
    headerArea.classList.add('fullscreen-hidden');
    fullscreenTrigger.style.display = 'block';
  } else {
    headerArea.classList.remove('fullscreen-hidden');
    headerArea.classList.remove('fullscreen-hover');
    fullscreenTrigger.style.display = 'none';
  }
});

fullscreenTrigger.addEventListener('mouseenter', () => {
  if (isFullscreen) {
    headerArea.classList.add('fullscreen-hover');
  }
});

headerArea.addEventListener('mouseleave', () => {
  if (isFullscreen) {
    headerArea.classList.remove('fullscreen-hover');
  }
});

// -------------------------------------------------------------
// AdBlocker Privacy Shield Logic
// -------------------------------------------------------------

const shieldCheckbox = document.getElementById('shield-toggle-checkbox');
const settingsShieldCheckbox = document.getElementById('settings-shield-toggle');
const blockedTrackersList = document.getElementById('blocked-trackers-list');
const tabBlockedCount = document.getElementById('tab-blocked-count');
const lifetimeBlockedCountLabel = document.getElementById('lifetime-blocked-count');

// Apply shield preference on load
window.electronAPI.setShieldEnabled(isShieldEnabled);
updateShieldColor();

function toggleShield(enabled) {
  isShieldEnabled = enabled;
  localStorage.setItem('cheetah-shield-enabled', isShieldEnabled.toString());
  window.electronAPI.setShieldEnabled(isShieldEnabled);
  
  shieldCheckbox.checked = isShieldEnabled;
  if (settingsShieldCheckbox) settingsShieldCheckbox.checked = isShieldEnabled;
  updateShieldColor();
  updateShieldUI();
}

function updateShieldColor() {
  const shieldIcon = document.getElementById('shield-status-btn');
  if (isShieldEnabled) {
    shieldIcon.style.color = ''; // default theme color
    shieldIcon.style.animation = 'pulse 2s infinite';
  } else {
    shieldIcon.style.color = '#ff3366';
    shieldIcon.style.animation = 'none';
  }
}

shieldCheckbox.addEventListener('change', () => toggleShield(shieldCheckbox.checked));
if (settingsShieldCheckbox) settingsShieldCheckbox.addEventListener('change', () => toggleShield(settingsShieldCheckbox.checked));

// Listen for block events relayed from Main Process
window.electronAPI.onAdBlocked((data) => {
  const { url, tabId } = data;
  const tab = tabs.find(t => t.webContentsId === tabId);
  if (tab) {
    tab.blockedCount++;
    
    // Extract tracker domain
    let domain = url;
    try { domain = new URL(url).hostname; } catch(err) {}
    
    if (!tab.blockedTrackers.includes(domain)) {
      tab.blockedTrackers.push(domain);
    }
    
    // Increment lifetime blocker stat
    let lifetime = parseInt(localStorage.getItem('cheetah-lifetime-blocked') || '0');
    lifetime++;
    localStorage.setItem('cheetah-lifetime-blocked', lifetime.toString());
    
    // Update live indicators if it's the active tab
    if (activeTabId === tab.id) {
      updateShieldUI();
    }
  }
});

function updateShieldUI() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab) return;
  
  shieldCountBadge.innerText = activeTab.blockedCount;
  tabBlockedCount.innerText = activeTab.blockedCount;
  
  const lifetime = localStorage.getItem('cheetah-lifetime-blocked') || '0';
  lifetimeBlockedCountLabel.innerText = lifetime;
  statAdsBlocked.innerText = lifetime;
  
  if (activeTab.blockedTrackers.length === 0) {
    blockedTrackersList.innerHTML = '<div class="empty-list-msg">No trackers detected yet.</div>';
  } else {
    blockedTrackersList.innerHTML = '';
    activeTab.blockedTrackers.forEach(tracker => {
      const row = document.createElement('div');
      row.className = 'tracker-item';
      row.innerText = tracker;
      blockedTrackersList.appendChild(row);
    });
  }
}

// -------------------------------------------------------------
// Bookmarks Logic (Sidebar Content Panel)
// -------------------------------------------------------------

function renderBookmarksPanel() {
  const list = document.getElementById('sb-bookmarks-list');
  if (bookmarks.length === 0) {
    list.innerHTML = '<div class="empty-list-msg">No bookmarks saved yet.</div>';
    return;
  }
  
  list.innerHTML = '';
  bookmarks.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'popover-item';
    item.onclick = () => {
      navigateActiveTab(bm.url);
    };
    
    const details = document.createElement('div');
    details.className = 'popover-item-details';
    
    const title = document.createElement('div');
    title.className = 'popover-item-title';
    title.innerText = bm.title;
    
    const subtitle = document.createElement('div');
    subtitle.className = 'popover-item-subtitle';
    subtitle.innerText = bm.url;
    
    details.appendChild(title);
    details.appendChild(subtitle);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'popover-item-action-btn';
    delBtn.innerHTML = '×';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      removeBookmark(bm.url);
    };
    
    item.appendChild(details);
    item.appendChild(delBtn);
    list.appendChild(item);
  });
}

function renderBookmarksBar() {
  bookmarksBarList.innerHTML = '';
  const isShow = localStorage.getItem('cheetah-bookmarks-bar-visible') !== 'false';
  if (!isShow) {
    bookmarksBar.classList.add('hidden');
    return;
  }
  bookmarksBar.classList.remove('hidden');

  if (bookmarks.length === 0) {
    bookmarksBarList.innerHTML = '<span style="font-size: 11px; opacity: 0.3;">Starred bookmarks will appear here.</span>';
    return;
  }
  
  bookmarks.slice(0, 15).forEach(bm => {
    const item = document.createElement('a');
    item.className = 'bookmark-bar-item';
    
    let domain = '';
    try { domain = new URL(bm.url).hostname; } catch(e) {}
    
    const img = document.createElement('img');
    img.style.width = '12px';
    img.style.height = '12px';
    img.src = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
    img.onerror = () => img.style.display = 'none';
    
    const text = document.createElement('span');
    text.innerText = bm.title;
    
    item.appendChild(img);
    item.appendChild(text);
    item.onclick = (e) => {
      e.preventDefault();
      navigateActiveTab(bm.url);
    };
    bookmarksBarList.appendChild(item);
  });
}

function saveBookmarks() {
  localStorage.setItem('cheetah-bookmarks', JSON.stringify(bookmarks));
  renderBookmarksPanel();
  renderBookmarksBar();
  updateBookmarkStarUI();
}

function addBookmark(title, url) {
  if (bookmarks.some(b => b.url === url)) return;
  bookmarks.push({ title, url, id: Date.now().toString() });
  saveBookmarks();
}

function removeBookmark(url) {
  bookmarks = bookmarks.filter(b => b.url !== url);
  saveBookmarks();
}

function updateBookmarkStarUI() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab || activeTab.url.startsWith('cheetah://newtab') || activeTab.url.startsWith('about:blank')) {
    bookmarkPageBtn.style.color = '';
    bookmarkPageBtn.style.fill = 'none';
    return;
  }
  const isBookmarked = bookmarks.some(b => b.url === activeTab.url);
  if (isBookmarked) {
    bookmarkPageBtn.style.color = 'var(--accent-color)';
    bookmarkPageBtn.style.fill = 'var(--accent-color)';
  } else {
    bookmarkPageBtn.style.color = '';
    bookmarkPageBtn.style.fill = 'none';
  }
}

bookmarkPageBtn.addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab || activeTab.url.startsWith('cheetah://newtab') || activeTab.url.startsWith('about:blank')) return;
  
  const isBookmarked = bookmarks.some(b => b.url === activeTab.url);
  if (isBookmarked) {
    removeBookmark(activeTab.url);
  } else {
    addBookmark(activeTab.title || 'Bookmarked Page', activeTab.url);
  }
});

document.getElementById('sb-add-bookmark-btn').addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && !activeTab.url.startsWith('cheetah://newtab')) {
    addBookmark(activeTab.title || 'Bookmarked Page', activeTab.url);
  }
});

// -------------------------------------------------------------
// History Logic (Sidebar Content Panel)
// -------------------------------------------------------------

function addHistoryEntry(title, url) {
  if (url.startsWith('cheetah://newtab') || url.startsWith('about:blank') || !title || title === 'Loading...') return;
  
  // Dedup history
  history = history.filter(h => h.url !== url);
  history.unshift({ title, url, timestamp: Date.now() });
  if (history.length > 300) history.pop(); // Cap history
  
  localStorage.setItem('cheetah-history', JSON.stringify(history));
  renderHistoryPanel();
}

function renderHistoryPanel() {
  const list = document.getElementById('sb-history-list');
  const searchVal = document.getElementById('sb-history-search').value.toLowerCase();
  
  const filtered = history.filter(h => 
    h.title.toLowerCase().includes(searchVal) || h.url.toLowerCase().includes(searchVal)
  );
  
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-list-msg">No history records found.</div>';
    return;
  }
  
  list.innerHTML = '';
  filtered.forEach(h => {
    const item = document.createElement('div');
    item.className = 'popover-item';
    item.onclick = () => {
      navigateActiveTab(h.url);
    };
    
    const details = document.createElement('div');
    details.className = 'popover-item-details';
    
    const title = document.createElement('div');
    title.className = 'popover-item-title';
    title.innerText = h.title;
    
    const subtitle = document.createElement('div');
    subtitle.className = 'popover-item-subtitle';
    subtitle.innerText = h.url;
    
    details.appendChild(title);
    details.appendChild(subtitle);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'popover-item-action-btn';
    delBtn.innerHTML = '×';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryEntry(h.timestamp);
    };
    
    item.appendChild(details);
    item.appendChild(delBtn);
    list.appendChild(item);
  });
}

function deleteHistoryEntry(timestamp) {
  history = history.filter(h => h.timestamp !== timestamp);
  localStorage.setItem('cheetah-history', JSON.stringify(history));
  renderHistoryPanel();
}

document.getElementById('sb-history-search').addEventListener('input', renderHistoryPanel);

document.getElementById('sb-clear-history-btn').addEventListener('click', () => {
  if (confirm('Clear all browsing history?')) {
    history = [];
    localStorage.setItem('cheetah-history', '[]');
    renderHistoryPanel();
  }
});

// -------------------------------------------------------------
// Downloads Management (Sidebar Content Panel)
// -------------------------------------------------------------

let downloads = [];

window.electronAPI.onDownloadStarted((data) => {
  downloads.unshift({
    id: data.id,
    filename: data.filename,
    totalBytes: data.totalBytes,
    receivedBytes: 0,
    state: 'progressing',
    savePath: ''
  });
  
  sbDownloadsBadge.classList.remove('hidden');
  const activeCount = downloads.filter(d => d.state === 'progressing').length;
  sbDownloadsBadge.innerText = activeCount;
  renderDownloadsPanel();
});

window.electronAPI.onDownloadUpdated((data) => {
  const dl = downloads.find(d => d.id === data.id);
  if (dl) {
    dl.state = data.state;
    dl.receivedBytes = data.receivedBytes;
    renderDownloadsPanel();
  }
});

window.electronAPI.onDownloadDone((data) => {
  const dl = downloads.find(d => d.id === data.id);
  if (dl) {
    dl.state = data.state;
    dl.savePath = data.savePath;
    dl.receivedBytes = data.receivedBytes;
    renderDownloadsPanel();
  }
  
  const activeCount = downloads.filter(d => d.state === 'progressing').length;
  if (activeCount === 0) {
    sbDownloadsBadge.classList.add('hidden');
  } else {
    sbDownloadsBadge.innerText = activeCount;
  }
});

function renderDownloadsPanel() {
  const list = document.getElementById('sb-downloads-list');
  if (downloads.length === 0) {
    list.innerHTML = '<div class="empty-list-msg">No downloads.</div>';
    return;
  }
  
  list.innerHTML = '';
  downloads.forEach(dl => {
    const item = document.createElement('div');
    item.className = 'popover-item';
    
    const details = document.createElement('div');
    details.className = 'popover-item-details';
    
    const title = document.createElement('div');
    title.className = 'popover-item-title';
    title.innerText = dl.filename;
    
    const subtitle = document.createElement('div');
    subtitle.className = 'popover-item-subtitle';
    const percent = dl.totalBytes > 0 ? Math.round((dl.receivedBytes / dl.totalBytes) * 100) : 0;
    
    if (dl.state === 'progressing') {
      subtitle.innerText = `Downloading: ${percent}% (${formatBytes(dl.receivedBytes)} / ${formatBytes(dl.totalBytes)})`;
    } else if (dl.state === 'paused') {
      subtitle.innerText = `Paused: ${percent}%`;
    } else if (dl.state === 'completed') {
      subtitle.innerText = `Completed (${formatBytes(dl.receivedBytes)})`;
      item.onclick = () => window.electronAPI.showItemInFolder(dl.savePath);
    } else if (dl.state === 'cancelled') {
      subtitle.innerText = 'Cancelled';
    } else {
      subtitle.innerText = `Failed: ${dl.state}`;
    }
    
    details.appendChild(title);
    details.appendChild(subtitle);
    
    if (dl.state === 'progressing' || dl.state === 'paused') {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'download-progress-container';
      const progress = document.createElement('div');
      progress.className = 'download-progress-bar';
      progress.style.width = `${percent}%`;
      progressContainer.appendChild(progress);
      details.appendChild(progressContainer);
      
      const cancel = document.createElement('button');
      cancel.className = 'popover-item-action-btn';
      cancel.innerHTML = '×';
      cancel.onclick = (e) => {
        e.stopPropagation();
        window.electronAPI.cancelDownload(dl.id);
      };
      item.appendChild(details);
      item.appendChild(cancel);
    } else {
      item.appendChild(details);
    }
    
    list.appendChild(item);
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

document.getElementById('sb-clear-downloads-btn').addEventListener('click', () => {
  downloads = downloads.filter(d => d.state === 'progressing');
  renderDownloadsPanel();
});

// -------------------------------------------------------------
// Popovers overlay
// -------------------------------------------------------------

const shieldPopover = document.getElementById('shield-popover');

shieldStatusBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isHidden = shieldPopover.classList.contains('hidden');
  if (isHidden) {
    shieldPopover.classList.remove('hidden');
    updateShieldUI();
  } else {
    shieldPopover.classList.add('hidden');
  }
});

document.body.addEventListener('click', (e) => {
  if (!shieldPopover.contains(e.target) && !shieldStatusBtn.contains(e.target)) {
    shieldPopover.classList.add('hidden');
  }
});

function hideAllPopovers() {
  shieldPopover.classList.add('hidden');
}

// -------------------------------------------------------------
// Home Dashboard Clock & Speed Dials
// -------------------------------------------------------------

function updateClock() {
  if (!ntClock || !ntGreeting) return;
  const now = new Date();
  
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  ntClock.innerText = `${hours}:${minutes} ${ampm}`;
  
  const hour = now.getHours();
  if (hour < 12) {
    ntGreeting.innerText = 'Good Morning';
  } else if (hour < 18) {
    ntGreeting.innerText = 'Good Afternoon';
  } else {
    ntGreeting.innerText = 'Good Evening';
  }
}

// Clock updates
setInterval(updateClock, 1000);
updateClock();

function renderSpeedDials() {
  speedDialGrid.innerHTML = '';
  
  speedDials.forEach((sd, index) => {
    const card = document.createElement('div');
    card.className = 'speed-dial-card';
    card.onclick = () => navigateActiveTab(sd.url);
    
    const icon = document.createElement('div');
    icon.className = 'speed-dial-icon';
    
    const img = document.createElement('img');
    let domain = '';
    try { domain = new URL(sd.url).hostname; } catch(err) {}
    img.src = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    img.onerror = () => {
      img.style.display = 'none';
      icon.innerText = sd.name.charAt(0).toUpperCase();
    };
    icon.appendChild(img);
    
    const title = document.createElement('div');
    title.className = 'speed-dial-title';
    title.innerText = sd.name;
    
    const delBtn = document.createElement('button');
    delBtn.className = 'speed-dial-delete';
    delBtn.innerHTML = '×';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSpeedDial(index);
    };
    
    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(delBtn);
    speedDialGrid.appendChild(card);
  });
  
  // "+" Add Button Card
  const addCard = document.createElement('div');
  addCard.className = 'speed-dial-card';
  addCard.style.borderStyle = 'dashed';
  addCard.onclick = () => showSpeedDialDialog();
  
  const addIcon = document.createElement('div');
  addIcon.className = 'speed-dial-icon';
  addIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  
  const addTitle = document.createElement('div');
  addTitle.className = 'speed-dial-title';
  addTitle.innerText = 'Add Link';
  
  addCard.appendChild(addIcon);
  addCard.appendChild(addTitle);
  speedDialGrid.appendChild(addCard);
}

function deleteSpeedDial(index) {
  speedDials.splice(index, 1);
  localStorage.setItem('cheetah-speed-dials', JSON.stringify(speedDials));
  renderSpeedDials();
}

function showSpeedDialDialog() {
  sdDialog.classList.remove('hidden');
  sdNameInput.value = '';
  sdUrlInput.value = '';
  sdNameInput.focus();
}

document.getElementById('dialog-sd-cancel').addEventListener('click', () => {
  sdDialog.classList.add('hidden');
});

document.getElementById('dialog-sd-save').addEventListener('click', () => {
  const name = sdNameInput.value.trim();
  let url = sdUrlInput.value.trim();
  
  if (!name || !url) return;
  
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  speedDials.push({ name, url });
  localStorage.setItem('cheetah-speed-dials', JSON.stringify(speedDials));
  renderSpeedDials();
  sdDialog.classList.add('hidden');
});

// New Tab Search triggers
function performNewtabSearch() {
  const query = ntSearchInput.value.trim();
  if (query) {
    navigateActiveTab(query);
  }
}

ntSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performNewtabSearch();
});
ntSearchBtn.addEventListener('click', performNewtabSearch);

function syncSearchEngineLabel() {
  if (currentSearchEngine.includes('duckduckgo')) {
    ntEngineName.innerText = 'DuckDuckGo';
  } else if (currentSearchEngine.includes('mojeek')) {
    ntEngineName.innerText = 'Mojeek';
  } else if (currentSearchEngine.includes('google')) {
    ntEngineName.innerText = 'Google';
  } else {
    ntEngineName.innerText = 'Custom';
  }
}

// -------------------------------------------------------------
// Settings Switcher & UI Sync (Inside Sidebar Settings)
// -------------------------------------------------------------

// Search Engine Configuration
const searchEngineSelect = document.getElementById('search-engine-select');
const customSearchContainer = document.getElementById('custom-search-container');
const customSearchInput = document.getElementById('custom-search-input');
const saveCustomSearch = document.getElementById('save-custom-search');

Array.from(searchEngineSelect.options).forEach(opt => {
  if (opt.value === currentSearchEngine) searchEngineSelect.value = currentSearchEngine;
});

if (searchEngineSelect.value !== currentSearchEngine) {
  searchEngineSelect.value = 'custom';
  customSearchContainer.classList.remove('hidden');
  customSearchInput.value = currentSearchEngine;
}

searchEngineSelect.addEventListener('change', () => {
  if (searchEngineSelect.value === 'custom') {
    customSearchContainer.classList.remove('hidden');
  } else {
    customSearchContainer.classList.add('hidden');
    currentSearchEngine = searchEngineSelect.value;
    localStorage.setItem('cheetah-search-engine', currentSearchEngine);
    syncSearchEngineLabel();
  }
});

saveCustomSearch.addEventListener('click', () => {
  currentSearchEngine = customSearchInput.value.trim();
  localStorage.setItem('cheetah-search-engine', currentSearchEngine);
  syncSearchEngineLabel();
  alert('Custom search engine saved!');
});

// Search Engine quick config inside URL bar
searchSettingsBtn.addEventListener('click', () => {
  openSidebar('settings');
});

// Themes UI grid populator
function applyTheme(themeObj) {
  for (const [key, value] of Object.entries(themeObj.colors)) {
    document.documentElement.style.setProperty(key, value);
  }
  localStorage.setItem('cheetah-theme', themeObj.name);
  renderThemeGrid();
}

function renderThemeGrid() {
  const grid = document.getElementById('sb-theme-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const currentThemeName = localStorage.getItem('cheetah-theme') || 'Default Dark';
  
  cheetahThemes.forEach(theme => {
    const card = document.createElement('div');
    card.className = `theme-card ${theme.name === currentThemeName ? 'active' : ''}`;
    card.onclick = () => applyTheme(theme);
    
    const title = document.createElement('div');
    title.innerText = theme.name;
    
    const preview = document.createElement('div');
    preview.className = 'theme-preview';
    ['--bg-color', '--toolbar-bg', '--accent-color'].forEach(colorVar => {
      const dot = document.createElement('div');
      dot.className = 'theme-color-dot';
      dot.style.backgroundColor = theme.colors[colorVar];
      preview.appendChild(dot);
    });
    
    card.appendChild(title);
    card.appendChild(preview);
    grid.appendChild(card);
  });
}

// Clear Data button
document.getElementById('settings-clear-data-btn').addEventListener('click', () => {
  if (confirm('Clear all local bookmarks, history, and search preferences? This will return the browser to default.')) {
    localStorage.clear();
    alert('Local browser preferences cleared! Reloading...');
    location.reload();
  }
});

// Apply Saved Theme on Boot
const savedTheme = localStorage.getItem('cheetah-theme');
if (savedTheme) {
  const themeObj = cheetahThemes.find(t => t.name === savedTheme);
  if (themeObj) applyTheme(themeObj);
}

// Initialize components
createTab();
renderSpeedDials();
renderBookmarksBar();
syncSearchEngineLabel();
updateMemorySaverUI();
