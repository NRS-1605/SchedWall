# SchedWall 🛠️📐

> **Your calendar, etched into the desktop canvas.** SchedWall transforms your KDE Plasma wallpaper into a live, high-density dark blueprint grid. Built to bypass Wayland's input restrictions, it separates your viewing canvas from a lightweight local admin console using WebSockets. No cloud tracking, no heavy electron apps—just absolute data privacy, automation, and system ricing.

---

## 💡 The Core Idea

Most calendar desktop widgets are clunky, resource-heavy, or stop working entirely under Wayland because the desktop layer aggressively intercepts mouse clicks.

SchedWall sidesteps this by turning your wallpaper into a **read-only live HUD** and handling all scheduling modifications via a hidden local web console or global terminal hooks. The moment you update your schedule or tick off a task in your browser, the changes instantly paint themselves onto your desktop background.

---

## ✨ Features

* **Drafting Grid Aesthetic:** A deep matte-black grid texture paired with high-contrast, elegant Serif typography.
* **The Asymmetric Layout:** A striking full-height left column for vertical motivational quotes, leaving the right 75% of your screen open for a full 7-day grid (Monday to Sunday, 07:00 to 00:00).
* **Smart Session Blocks:** Supports single 1-hour items or large multi-hour chunks (like university lectures) rather than cluttering the screen with repeating single slots.
* **Active Day Tinting:** The wallpaper automatically detects the system date and applies a faint, clean gray overlay highlight to the current day.
* **Wayland Remote Scrolling:** Built-in API endpoints allow you to scroll through your massive 17-hour timeline using global keyboard shortcuts.
* **Zero-Cache Engine:** Custom Express server headers explicitly tell KDE's `QtWebEngine` never to cache the site, ensuring your changes refresh instantly.

---

## 🛠️ Tech Stack

* **Frontend:** React, Tailwind CSS, WebSockets client
* **Backend:** Node.js, Express server (Offline storage via a local `database.json`)
* **Real-time Engine:** WebSockets for instantaneous multi-view synchronization

---

## 🚀 Quick Setup (Run Locally)

### 1. Clone & Install

```bash
git clone https://github.com/NRS-1605/SchedWall.git
cd SchedWall
npm install

```

### 2. Boot the Local Server

```bash
npm run dev

```

The app will spin up locally.

* Open `http://localhost:5173/admin` in your web browser to manage your tasks.
* The live canvas sits waiting at `http://localhost:5173/wallpaper`.

---

## 🎨 KDE Plasma Integration

### 1. Set the Wallpaper

1. Right-click an empty area on your desktop and select **Configure Desktop and Wallpaper**.
2. Click **Get New Plugins...** and search for **HTML Wallpaper** (or Web Wallpaper) and install it.
3. Select it as your active wallpaper type.
4. Set the target URL to: `http://localhost:5173/wallpaper?v=1`

> 💡 **Pro-Tip:** If you ever make heavy custom CSS modifications to your dashboard layout and KDE refuses to clear its browser cache, simply change the trailing number in the URL settings (e.g., `?v=2`) to force a hard visual refresh.

---

## ⌨️ Setting up Global Desktop Scrolling

Because Wayland locks down mouse events on the wallpaper layer, standard scrolling won't work out of the box. SchedWall solves this via local API triggers.

1. Open **KDE System Settings** -> **Shortcuts**.
2. Click **Add New** -> **Command** at the bottom of the window.
3. Configure the down-scroll hook:
* **Name:** Wallpaper Scroll Down
* **Trigger:** `Meta + Shift + Down` (or your personal favorite shortcut)
* **Command:** `curl http://localhost:5173/api/scroll-down`


4. Repeat the exact same steps for the up-scroll hook:
* **Name:** Wallpaper Scroll Up
* **Trigger:** `Meta + Shift + Up`
* **Command:** `curl http://localhost:5173/api/scroll-up`


5. Hit **Apply**.

Now you can glide through your day's schedule directly from your hardware keys regardless of what active window you are working inside.
