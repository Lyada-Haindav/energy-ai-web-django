import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { describeRateLimits } from "../middleware/rateLimit.js";
import { describeModelStack } from "../services/modelClient.js";
import { describeStorageBackend, readDb } from "../services/dataStore.js";
import { getAutoTrainStatus, triggerManualAutoTrain } from "../services/autoTrainService.js";
import { requireAdmin } from "../middleware/auth.js";
import { describeWorkspaceModes } from "../services/workspaceMode.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const USER_DATA_PATH = path.resolve(
  process.env.USER_TRAIN_DATA_PATH || path.join(PROJECT_ROOT, "training/data/local/user_live_pairs.jsonl")
);
const USER_CANDIDATE_DATA_PATH = path.resolve(
  process.env.USER_TRAIN_CANDIDATE_DATA_PATH || path.join(PROJECT_ROOT, "training/data/local/user_live_candidates.jsonl")
);
const USER_REJECTED_DATA_PATH = path.resolve(
  process.env.USER_TRAIN_REJECTED_DATA_PATH || path.join(PROJECT_ROOT, "training/data/local/user_rejected_pairs.jsonl")
);

function summarizeChatStats(db) {
  const chatSessions = Object.values(db.chats || {}).flatMap((sessions) => (Array.isArray(sessions) ? sessions : []));
  const messageCount = chatSessions.reduce((sum, session) => sum + (Array.isArray(session.messages) ? session.messages.length : 0), 0);
  const now = Date.now();
  const activeChats24h = chatSessions.filter((session) => now - Number(session.updatedAt || 0) < 24 * 60 * 60 * 1000).length;

  return {
    users: db.users.length,
    verifiedUsers: db.users.filter((user) => user.emailVerified).length,
    authSessions: db.sessions.length,
    chatSessions: chatSessions.length,
    messages: messageCount,
    activeChats24h,
    avgMessagesPerChat: chatSessions.length > 0 ? Number((messageCount / chatSessions.length).toFixed(1)) : 0
  };
}

async function readJsonl(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function topEntries(map, limit = 5) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

async function summarizeQuality() {
  const [approvedRows, rejectedRows, candidateRows] = await Promise.all([
    readJsonl(USER_DATA_PATH),
    readJsonl(USER_REJECTED_DATA_PATH),
    readJsonl(USER_CANDIDATE_DATA_PATH)
  ]);

  const approvedFeedback = approvedRows.filter((row) => row.source === "user_feedback_upvote").length;
  const correctedFeedback = approvedRows.filter((row) => row.source === "user_feedback_correction").length;
  const rejectedFeedback = rejectedRows.length;
  const promptFailures = new Map();
  const routeSummary = new Map();
  const energySummary = new Map([
    ["low", { approved: 0, rejected: 0 }],
    ["high", { approved: 0, rejected: 0 }]
  ]);

  rejectedRows.forEach((row) => {
    const prompt = String(row.prompt || "").trim();
    const route = String(row.route_reason || "unknown route").trim();
    const energyMode = String(row.energy_mode || "").trim().toLowerCase();
    if (prompt) {
      promptFailures.set(prompt, (promptFailures.get(prompt) || 0) + 1);
    }
    routeSummary.set(route, (routeSummary.get(route) || 0) + 1);
    if (energySummary.has(energyMode)) {
      energySummary.get(energyMode).rejected += 1;
    }
  });

  approvedRows.forEach((row) => {
    const route = String(row.route_reason || "unknown route").trim();
    const energyMode = String(row.energy_mode || "").trim().toLowerCase();
    routeSummary.set(route, (routeSummary.get(route) || 0) + 0);
    if (energySummary.has(energyMode)) {
      energySummary.get(energyMode).approved += 1;
    }
  });

  const totalReviewed = approvedFeedback + correctedFeedback + rejectedFeedback;
  const approvalRate = totalReviewed > 0 ? Number((((approvedFeedback + correctedFeedback) / totalReviewed) * 100).toFixed(1)) : 0;

  return {
    approvedFeedback,
    correctedFeedback,
    rejectedFeedback,
    candidateRows: candidateRows.length,
    approvalRate,
    worstPrompts: topEntries(promptFailures),
    routeHotspots: topEntries(routeSummary),
    energyScorecard: Array.from(energySummary.entries()).map(([mode, counts]) => ({
      mode,
      approved: counts.approved,
      rejected: counts.rejected,
      accuracy:
        counts.approved + counts.rejected > 0
          ? Number(((counts.approved / (counts.approved + counts.rejected)) * 100).toFixed(1))
          : 0
    }))
  };
}

function summarizeHealth() {
  const memory = process.memoryUsage();
  return {
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
    },
    storage: describeStorageBackend(),
    models: describeModelStack(),
    rateLimits: describeRateLimits(),
    nodeVersion: process.version
  };
}

router.get("/overview", requireAdmin, async (_req, res, next) => {
  try {
    const [db, training, quality] = await Promise.all([readDb(), getAutoTrainStatus(), summarizeQuality()]);

    return res.json({
      ok: true,
      stats: summarizeChatStats(db),
      training,
      quality,
      health: summarizeHealth(),
      controls: {
        workspaceModes: describeWorkspaceModes()
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/retrain", requireAdmin, async (_req, res, next) => {
  try {
    const result = await triggerManualAutoTrain();
    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    return next(error);
  }
});

export { router as adminRouter };
