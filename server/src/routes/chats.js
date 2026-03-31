import express from "express";
import { cloneSessions, readDb, updateDb } from "../services/dataStore.js";
import { sanitizeAttachments } from "../services/attachmentContext.js";
import { recordFeedbackTrainingPair } from "../services/autoTrainService.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function sanitizeMessage(message) {
  const meta = message?.meta && typeof message.meta === "object" ? { ...message.meta } : undefined;
  const attachments = sanitizeAttachments(meta?.attachments);

  if (meta) {
    if (attachments.length > 0) {
      meta.attachments = attachments;
    } else {
      delete meta.attachments;
    }
  }

  return {
    id: String(message?.id || ""),
    role: String(message?.role || "assistant"),
    content: String(message?.content || ""),
    meta
  };
}

function sanitizeSession(session) {
  return {
    id: String(session?.id || ""),
    title: String(session?.title || "Untitled Session"),
    createdAt: Number(session?.createdAt || Date.now()),
    updatedAt: Number(session?.updatedAt || Date.now()),
    messages: Array.isArray(session?.messages) ? session.messages.map(sanitizeMessage) : []
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const sessions = cloneSessions(db.chats[req.user.id] || []);
    return res.json({ sessions });
  } catch (error) {
    return next(error);
  }
});

router.put("/", requireAuth, async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body?.sessions) ? req.body.sessions : null;
    if (!incoming) {
      return res.status(400).json({ error: "`sessions` must be an array." });
    }

    const sessions = incoming.map(sanitizeSession).filter((session) => session.id);

    await updateDb((db) => {
      db.chats[req.user.id] = sessions;
    });

    return res.json({
      ok: true,
      sessions
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/feedback", requireAuth, async (req, res, next) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const completion = String(req.body?.completion || "").trim();
    const replacement = String(req.body?.replacement || "").trim();
    const feedback = String(req.body?.feedback || "").trim().toLowerCase();
    const meta = req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : {};

    if (!prompt || !completion) {
      return res.status(400).json({ error: "`prompt` and `completion` are required." });
    }

    if (!["up", "down"].includes(feedback)) {
      return res.status(400).json({ error: "`feedback` must be either `up` or `down`." });
    }

    const result = await recordFeedbackTrainingPair({
      prompt,
      completion,
      feedback,
      replacement,
      meta
    });

    return res.json({
      ok: true,
      recorded: result.recorded,
      trained: result.trained
    });
  } catch (error) {
    return next(error);
  }
});

export { router as chatsRouter };
