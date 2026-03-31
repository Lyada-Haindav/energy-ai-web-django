import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeStorageBackend } from "./services/dataStore.js";
import { describeModelStack, primeOwnArtifacts } from "./services/modelClient.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { chatRoute } from "./routes/chat.js";
import { chatsRouter } from "./routes/chats.js";
import { requireAuth } from "./middleware/auth.js";
import { createRateLimit, describeRateLimits } from "./middleware/rateLimit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST = path.resolve(__dirname, "..", "..", "client", "dist");
const app = express();
const port = Number(process.env.PORT || 8787);
const host = "0.0.0.0";
const PRIME_OWN_MODELS_ON_BOOT = (process.env.PRIME_OWN_MODELS_ON_BOOT || "false").toLowerCase() === "true";
const CHAT_RATE_LIMIT_WINDOW_MS = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60_000);
const CHAT_RATE_LIMIT_MAX = Number(process.env.CHAT_RATE_LIMIT_MAX || 24);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);

const authRateLimit = createRateLimit({
  id: "auth",
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  keyFn: (req) => req.ip || "anonymous",
  message: "Too many auth requests. Please wait a moment and try again."
});

const chatRateLimit = createRateLimit({
  id: "chat",
  windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
  max: CHAT_RATE_LIMIT_MAX,
  keyFn: (req) => req.user?.id || req.ip || "anonymous",
  message: "Too many chat requests in a short time. Please slow down for a moment."
});

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173"
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  const memory = process.memoryUsage();
  res.json({
    ok: true,
    service: "my-gpt-server",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
    },
    storage: describeStorageBackend(),
    models: describeModelStack(),
    rateLimits: describeRateLimits()
  });
});

app.use("/api/auth", authRateLimit, authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/chats", chatsRouter);
app.post("/api/chat", requireAuth, chatRateLimit, chatRoute);

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  const statusCode = Number(error?.statusCode || 500);
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  res.status(statusCode).json({ error: message });
});

app.listen(port, host, () => {
  console.log(`my-gpt-server listening on http://${host}:${port}`);
  if (!PRIME_OWN_MODELS_ON_BOOT) {
    console.log("own model priming disabled on boot");
    return;
  }

  void primeOwnArtifacts()
    .then(() => {
      console.log("own model artifacts primed");
    })
    .catch((error) => {
      console.warn(`own model priming skipped: ${error instanceof Error ? error.message : "unknown error"}`);
    });
});
