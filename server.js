// Schedwall — offline local scheduling wallpaper server.
// Node 18+ / Express 4 / Socket.io 4 / plain JSON on disk.

const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const { Server: IOServer } = require("socket.io");

const PORT = process.env.PORT || 3939;
const DB_PATH = path.join(__dirname, "database.json");

// ---------- storage ----------
const DEFAULT_DB = {
  quote: "Si vis pacem, para bellum",
  template: [
    // sample recurring lecture (Mon 09-11)
    { id: "t1", day: 1, start: 9, end: 11, title: "Lecture — Systems" },
    { id: "t2", day: 3, start: 14, end: 16, title: "Lab — Networks" },
  ],
  overlay: [],
  checked: {},
};

function loadDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DB, ...parsed };
  } catch {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return { ...DEFAULT_DB };
  }
}
let db = loadDB();

// ---------- purge past overlay + checked entries ----------
function todayYMD() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function purgePast() {
  const today = todayYMD();
  const before = db.overlay.length;
  db.overlay = db.overlay.filter((t) => !t.date || t.date >= today);
  // strip checked entries whose date is before today
  let removed = 0;
  for (const key of Object.keys(db.checked)) {
    const m = key.match(/-(\d{4}-\d{2}-\d{2})$/);
    if (m && m[1] < today) { delete db.checked[key]; removed++; }
  }
  if (before !== db.overlay.length || removed) { saveDB(); broadcast(); }
}
setTimeout(purgePast, 500);
setInterval(purgePast, 60 * 60 * 1000);

let saveTimer = null;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), () => {});
  }, 50);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- express ----------
const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: "*" } });

app.use(express.json({ limit: "128kb" }));

// Strict no-cache for every response (KDE QtWebEngine loves to cache).
app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  next();
});

app.use(express.static(path.join(__dirname, "public")));

function broadcast() {
  io.emit("state", db);
}

function broadcastScrollCommand(direction) {
  io.to("wallpaper").emit("scroll-command", { direction });
}

// ---------- API ----------
app.get("/api/state", (_req, res) => res.json(db));

app.get("/api/scroll-up", (_req, res) => {
  broadcastScrollCommand("up");
  res.json({ success: true });
});

app.get("/api/scroll-down", (_req, res) => {
  broadcastScrollCommand("down");
  res.json({ success: true });
});

app.post("/api/quote", (req, res) => {
  const q = String(req.body?.quote ?? "").slice(0, 300);
  if (!q) return res.status(400).json({ error: "empty quote" });
  db.quote = q;
  saveDB();
  broadcast();
  res.json({ ok: true });
});

app.post("/api/task", (req, res) => {
  const { layer, day, date, start, end, title } = req.body || {};
  if (!["template", "overlay"].includes(layer))
    return res.status(400).json({ error: "bad layer" });
  const s = Number(start),
    e = Number(end);
  if (!Number.isInteger(s) || !Number.isInteger(e) || s < 7 || e > 24 || e <= s)
    return res.status(400).json({ error: "bad hours" });
  const t = String(title || "").slice(0, 120).trim();
  if (!t) return res.status(400).json({ error: "empty title" });
  const task = { id: uid(), start: s, end: e, title: t };
  if (layer === "template") {
    const d = Number(day);
    if (!Number.isInteger(d) || d < 1 || d > 7)
      return res.status(400).json({ error: "bad day" });
    task.day = d;
  } else {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ error: "bad date" });
    if (date < todayYMD())
      return res.status(400).json({ error: "date in past" });
    task.date = date;
  }
  db[layer].push(task);
  saveDB();
  broadcast();
  res.json(task);
});

// clear all tasks in a layer
app.delete("/api/tasks/:layer", (req, res) => {
  const { layer } = req.params;
  if (!["template", "overlay"].includes(layer))
    return res.status(400).json({ error: "bad layer" });
  const ids = new Set(db[layer].map((t) => t.id));
  db[layer] = [];
  for (const key of Object.keys(db.checked)) {
    const id = key.split("-")[0];
    if (ids.has(id)) delete db.checked[key];
  }
  saveDB();
  broadcast();
  res.json({ ok: true });
});

app.delete("/api/task/:layer/:id", (req, res) => {
  const { layer, id } = req.params;
  if (!["template", "overlay"].includes(layer))
    return res.status(400).json({ error: "bad layer" });
  db[layer] = db[layer].filter((t) => t.id !== id);
  // clean checked marks that reference it
  for (const key of Object.keys(db.checked)) {
    if (key.startsWith(id + "-")) delete db.checked[key];
  }
  saveDB();
  broadcast();
  res.json({ ok: true });
});

app.post("/api/check", (req, res) => {
  const { taskId, date, checked } = req.body || {};
  if (!taskId || !date) return res.status(400).json({ error: "missing" });
  const key = `${taskId}-${date}`;
  if (checked) db.checked[key] = true;
  else delete db.checked[key];
  saveDB();
  broadcast();
  res.json({ ok: true });
});

// ---------- pages ----------
app.get("/", (_req, res) => res.redirect("/admin"));
app.get("/wallpaper", (_req, res) =>
  res.sendFile(path.join(__dirname, "views", "wallpaper.html")),
);
app.get("/admin", (_req, res) =>
  res.sendFile(path.join(__dirname, "views", "admin.html")),
);

io.on("connection", (socket) => {
  const client = socket.handshake.query?.client;
  if (client === "wallpaper") socket.join("wallpaper");
  socket.emit("state", db);
});

server.listen(PORT, () => {
  console.log(`\n  Schedwall running`);
  console.log(`   wallpaper  http://localhost:${PORT}/wallpaper`);
  console.log(`   admin      http://localhost:${PORT}/admin`);
  console.log(`   database   ${DB_PATH}\n`);
});