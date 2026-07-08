import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Local JSON File DB
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "rooms.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory cache for super-fast lookups
let roomsCache: Record<string, any> = {};

// Load existing rooms from disk
try {
  if (fs.existsSync(DATA_FILE)) {
    const fileContent = fs.readFileSync(DATA_FILE, "utf-8");
    roomsCache = JSON.parse(fileContent);
    console.log("Loaded existing rooms from database file.");
  }
} catch (error) {
  console.error("Failed to read rooms database from disk, starting fresh:", error);
}

// Save rooms to disk
function saveRoomsToDisk() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(roomsCache, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write rooms database to disk:", error);
  }
}

// Default layout for automatic fallback
const DEFAULT_SPOTS = [
  { id: 'spot-ppd', name: 'ППД', description: 'Пункт постоянной дислокации', x: 50, y: 50 },
  { id: 'spot-1', name: '1', description: 'Геоточка 1', x: 20, y: 15 },
  { id: 'spot-2', name: '2', description: 'Геоточка 2', x: 50, y: 15 },
  { id: 'spot-3', name: '3', description: 'Геоточка 3', x: 80, y: 15 },
  { id: 'spot-4', name: '4', description: 'Геоточка 4', x: 20, y: 35 },
  { id: 'spot-5', name: '5', description: 'Геоточка 5', x: 80, y: 35 },
  { id: 'spot-6', name: '6', description: 'Геоточка 6', x: 20, y: 65 },
  { id: 'spot-7', name: '7', description: 'Геоточка 7', x: 80, y: 65 },
  { id: 'spot-8', name: '8', description: 'Геоточка 8', x: 20, y: 85 },
  { id: 'spot-9', name: '9', description: 'Геоточка 9', x: 50, y: 85 },
  { id: 'spot-10', name: '10', description: 'Геоточка 10', x: 80, y: 85 },
  { id: 'spot-11', name: '11', description: 'Геоточка 11', x: 35, y: 50 },
  { id: 'spot-12', name: '12', description: 'Геоточка 12', x: 65, y: 50 }
];

function createDefaultState(roomName: string = "Общая группа") {
  return {
    roomName,
    spots: [...DEFAULT_SPOTS],
    users: [],
    presence: [],
    history: []
  };
}

// --- API Endpoints ---

// Create a new room (replaces npoint document creation)
app.post("/api/rooms", (req, res) => {
  const { contents } = req.body;
  let parsedContent: any = null;

  if (contents) {
    if (typeof contents === "string") {
      try {
        parsedContent = JSON.parse(contents);
      } catch (e) {
        parsedContent = createDefaultState();
      }
    } else {
      parsedContent = contents;
    }
  } else {
    parsedContent = createDefaultState();
  }

  // Generate a random token/ID (similar to npoint tokens)
  const binId = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
  
  roomsCache[binId] = parsedContent;
  saveRoomsToDisk();

  res.json({ token: binId });
});

// Get room state (replaces getting from npoint)
app.get("/api/rooms/:binId", (req, res) => {
  const { binId } = req.params;
  
  if (roomsCache[binId]) {
    return res.json(roomsCache[binId]);
  }

  // Dynamic self-healing: if binId isn't found, initialize it with a default state
  // to avoid crashing the user's interface
  console.log(`Bin ID ${binId} not found, initializing dynamic fallback...`);
  const fallbackState = createDefaultState();
  roomsCache[binId] = fallbackState;
  saveRoomsToDisk();

  res.json(fallbackState);
});

// Update room state (replaces updating on npoint)
const handleUpdate = (req: any, res: any) => {
  const { binId } = req.params;
  const newState = req.body;

  if (!newState || typeof newState !== "object") {
    return res.status(400).json({ error: "Invalid state object" });
  }

  roomsCache[binId] = newState;
  saveRoomsToDisk();

  res.json({ status: "ok" });
};

app.post("/api/rooms/:binId", handleUpdate);
app.put("/api/rooms/:binId", handleUpdate);

// --- Vite & Client Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
