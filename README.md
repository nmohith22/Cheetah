# Cheetah Browser 🐆

Cheetah is a high-performance, privacy-focused, and stunningly designed web browser built on Electron. It is engineered to be lightning-fast, visually premium, and completely secure by default.

---

## Key Features

- **⚡ Lightning-Fast Search & Navigation:** Instant loading with aggressive GPU-rasterization and memory optimizations.
- **🛡️ Shielded Privacy & Security:**
  - Built-in **Ghostery AdBlocker** to block ads, trackers, and malicious scripts.
  - **Do Not Track (DNT)** header enforced on all requests.
  - **100% Incognito Session:** All browsing tabs run in an isolated in-memory partition. No history, cookies, or cache are stored on disk—everything is securely wiped upon exit.
  - **HTTPS & Privacy Shield Indicator:** Visual confirmation of security status and adblocker activity in the URL bar.
- **🎨 Premium Visual Experience:**
  - **52 Preloaded Themes:** Instantly switch between cyberpunk, Nord, Dracula, retro, cozy coffee, and neon palettes.
  - **Smooth Animations:** Dynamic transitions, hover effects, scale triggers, and polished CSS-based UI elements.
  - **Glassmorphism UI:** Frosted glass navigation bars, glowing borders, and backdrop blurs.
- **🏠 Customizable New Tab Dashboard (`cheetah://newtab`):**
  - Futuristic digital clock and greetings.
  - Center-focused private search input.
  - **Editable Speed Dial (Favorites Grid):** Add, edit, or remove quick links.
  - **Privacy Dashboard:** Real-time metrics on blocked trackers and active guards.
- **📁 Advanced Browser Management:**
  - **Horizontal Tab Bar:** Smooth, draggable tab switching at the top, just like major production browsers.
  - **Bookmarks Manager:** Toggable bookmarks bar, quick bookmarking, and local storage bookmarks list.
  - **History Tracker:** Fully private local history search and single-click history purge.
  - **Downloads Manager:** In-app download drawer with real-time progress and file access.

---

## Installation & Running Locally

Ensure you have [Node.js](https://nodejs.org/) installed.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nmohith22/Cheetah.git
   cd Cheetah
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm start
   ```

---

## Packaging & Building Binaries

Cheetah uses `electron-builder` to package production-ready executables for Windows, macOS, and Linux.

### Building for Windows (`.exe`):
```bash
npm run build:win
```

### Building for macOS (`.dmg` / `.app`):
```bash
npm run build:mac
```

### Building for Linux (`.AppImage` / `.deb`):
```bash
npm run build:linux
```

### Build All Platforms:
```bash
npm run build:all
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
