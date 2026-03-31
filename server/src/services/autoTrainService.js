import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearOwnArtifactCache } from "./modelClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");

const AUTO_TRAIN_ENABLED = (process.env.AUTO_TRAIN_ENABLED || "true").toLowerCase() !== "false";
const AUTO_TRAIN_MIN_NEW_EXAMPLES = Number(process.env.AUTO_TRAIN_MIN_NEW_EXAMPLES || 10);
const AUTO_TRAIN_COOLDOWN_MS = Number(process.env.AUTO_TRAIN_COOLDOWN_MINUTES || 20) * 60 * 1000;

const USER_DATA_PATH = path.resolve(
  process.env.USER_TRAIN_DATA_PATH || path.join(PROJECT_ROOT, "training/data/local/user_live_pairs.jsonl")
);
const USER_CANDIDATE_DATA_PATH = path.resolve(
  process.env.USER_TRAIN_CANDIDATE_DATA_PATH || path.join(PROJECT_ROOT, "training/data/local/user_live_candidates.jsonl")
);
const USER_REJECTED_DATA_PATH = path.resolve(
  process.env.USER_TRAIN_REJECTED_DATA_PATH || path.join(PROJECT_ROOT, "training/data/local/user_rejected_pairs.jsonl")
);
const PUBLIC_DATA_PATH = path.resolve(
  process.env.PUBLIC_TRAIN_DATA_PATH || path.join(PROJECT_ROOT, "training/data/public/merged_public_chat.jsonl")
);
const TRAIN_SCRIPT_PATH = path.resolve(
  process.env.AUTO_TRAIN_SCRIPT || path.join(PROJECT_ROOT, "training/scripts/train_own_models.py")
);
const OUT_DIR = path.resolve(process.env.OWN_MODELS_DIR || path.join(PROJECT_ROOT, "training/checkpoints/own"));
const AUTO_TRAIN_STATE_PATH = path.resolve(
  process.env.AUTO_TRAIN_STATE_PATH || path.join(PROJECT_ROOT, "training/data/local/auto_train_state.json")
);

const TRAIN_DEEP_THRESHOLD = process.env.AUTO_TRAIN_DEEP_THRESHOLD || "2";
const TRAIN_MAX_PAIRS = process.env.AUTO_TRAIN_MAX_PAIRS || "180000";
const TRAIN_MAX_DUPLICATE_PROMPTS = process.env.AUTO_TRAIN_MAX_DUPLICATE_PROMPTS || "10";
const TRAIN_FAST_TO_DEEP_RATIO = process.env.AUTO_TRAIN_MAX_FAST_TO_DEEP_RATIO || "6";
const TRAIN_SEED = process.env.AUTO_TRAIN_SEED || "42";

const SKIP_PROMPT_PATTERN =
  /^(hi|hello|hey|yo|ok|okay|good|great|nice|thanks|thank you|cool|how are you|bye|goodbye|see you|see ya|later|[0-9]+)$/i;
const ABUSIVE_PATTERN = /\b(fuck|idiot|stupid|moron|dumb|shut\s*up)\b/i;

let trainingInProgress = false;
let lastTrainCompletedAt = 0;
let lastTrainStartedAt = 0;
let lastTrainResult = {
  status: "idle",
  startedAt: 0,
  completedAt: 0,
  detail: ""
};

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function shouldSkipPair(prompt, completion) {
  if (!prompt || !completion) {
    return true;
  }
  if (prompt.length < 3 || completion.length < 8) {
    return true;
  }
  if (SKIP_PROMPT_PATTERN.test(prompt)) {
    return true;
  }
  if (ABUSIVE_PATTERN.test(prompt)) {
    return true;
  }
  return false;
}

async function appendUserPair(prompt, completion) {
  const payload = {
    prompt,
    completion,
    source: "live_user_chat",
    quality_signal: "candidate",
    created_at: new Date().toISOString()
  };

  await fs.mkdir(path.dirname(USER_CANDIDATE_DATA_PATH), { recursive: true });
  await fs.appendFile(USER_CANDIDATE_DATA_PATH, `${JSON.stringify(payload)}\n`, "utf-8");
}

async function appendApprovedPair(prompt, completion, metadata = {}) {
  const payload = {
    prompt,
    completion,
    source: metadata.source || "user_feedback_approved",
    feedback: metadata.feedback || "upvote",
    quality_signal: metadata.qualitySignal || "approved",
    model: metadata.model || "",
    role: metadata.role || "",
    energy_mode: metadata.energyMode || "",
    route_reason: metadata.routeReason || "",
    created_at: new Date().toISOString()
  };

  await fs.mkdir(path.dirname(USER_DATA_PATH), { recursive: true });
  await fs.appendFile(USER_DATA_PATH, `${JSON.stringify(payload)}\n`, "utf-8");
}

async function appendRejectedPair(prompt, completion, metadata = {}) {
  const payload = {
    prompt,
    completion,
    source: metadata.source || "user_feedback_rejected",
    feedback: metadata.feedback || "downvote",
    quality_signal: "rejected",
    model: metadata.model || "",
    role: metadata.role || "",
    energy_mode: metadata.energyMode || "",
    route_reason: metadata.routeReason || "",
    created_at: new Date().toISOString()
  };

  await fs.mkdir(path.dirname(USER_REJECTED_DATA_PATH), { recursive: true });
  await fs.appendFile(USER_REJECTED_DATA_PATH, `${JSON.stringify(payload)}\n`, "utf-8");
}

async function countJsonlRows(filePath) {
  if (!(await fileExists(filePath))) {
    return 0;
  }

  const raw = await fs.readFile(filePath, "utf-8");
  if (!raw.trim()) {
    return 0;
  }

  return raw.trim().split("\n").length;
}

async function readAutoTrainState() {
  if (!(await fileExists(AUTO_TRAIN_STATE_PATH))) {
    return { last_trained_lines: 0 };
  }

  try {
    const raw = await fs.readFile(AUTO_TRAIN_STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      last_trained_lines: Number(parsed.last_trained_lines || 0)
    };
  } catch {
    return { last_trained_lines: 0 };
  }
}

async function readJsonFile(filePath) {
  if (!(await fileExists(filePath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeAutoTrainState(lastTrainedLines) {
  await fs.mkdir(path.dirname(AUTO_TRAIN_STATE_PATH), { recursive: true });
  await fs.writeFile(
    AUTO_TRAIN_STATE_PATH,
    JSON.stringify(
      {
        last_trained_lines: lastTrainedLines,
        updated_at: new Date().toISOString()
      },
      null,
      2
    ),
    "utf-8"
  );
}

function buildTrainingArgs(inputs) {
  const args = [TRAIN_SCRIPT_PATH];

  for (const input of inputs) {
    args.push("--input", input);
  }

  args.push(
    "--out-dir",
    OUT_DIR,
    "--deep-threshold",
    TRAIN_DEEP_THRESHOLD,
    "--max-pairs",
    TRAIN_MAX_PAIRS,
    "--max-duplicate-prompts",
    TRAIN_MAX_DUPLICATE_PROMPTS,
    "--max-fast-to-deep-ratio",
    TRAIN_FAST_TO_DEEP_RATIO,
    "--seed",
    TRAIN_SEED
  );

  return args;
}

async function runTrainingJob() {
  const hasUserData = await fileExists(USER_DATA_PATH);
  if (!hasUserData) {
    return false;
  }

  const inputs = [];
  if (await fileExists(PUBLIC_DATA_PATH)) {
    inputs.push(PUBLIC_DATA_PATH);
  }
  inputs.push(USER_DATA_PATH);

  const args = buildTrainingArgs(inputs);
  const startedAt = Date.now();

  const success = await new Promise((resolve) => {
    const child = spawn("python3", args, {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        clearOwnArtifactCache();
        console.log(
          `[auto-train] completed in ${Math.round((Date.now() - startedAt) / 1000)}s; model cache refreshed`
        );
        resolve(true);
      } else {
        const details = code === null ? `signal ${signal || "unknown"}` : `code ${code}`;
        console.error(`[auto-train] failed with ${details}`);
        if (stderr.trim()) {
          console.error(stderr.trim());
        }
        if (stdout.trim()) {
          console.error(stdout.trim());
        }
        resolve(false);
      }
    });
  });

  return success;
}

function markTrainingStarted(detail = "running") {
  lastTrainStartedAt = Date.now();
  lastTrainResult = {
    status: "running",
    startedAt: lastTrainStartedAt,
    completedAt: 0,
    detail
  };
}

function markTrainingFinished(ok, detail = "") {
  const completedAt = Date.now();
  if (ok) {
    lastTrainCompletedAt = completedAt;
  }

  lastTrainResult = {
    status: ok ? "success" : "failed",
    startedAt: lastTrainStartedAt,
    completedAt,
    detail
  };
}

export async function maybeAutoTrain() {
  if (!AUTO_TRAIN_ENABLED) {
    return;
  }
  if (trainingInProgress) {
    return;
  }
  if (Date.now() - lastTrainCompletedAt < AUTO_TRAIN_COOLDOWN_MS) {
    return;
  }

  const totalLines = await countJsonlRows(USER_DATA_PATH);
  const state = await readAutoTrainState();
  const newExamples = Math.max(totalLines - state.last_trained_lines, 0);

  if (newExamples < AUTO_TRAIN_MIN_NEW_EXAMPLES) {
    return;
  }

  trainingInProgress = true;
  markTrainingStarted(`auto with ${newExamples} new examples`);
  try {
    console.log(`[auto-train] starting with ${newExamples} new examples`);
    const ok = await runTrainingJob();
    if (ok) {
      await writeAutoTrainState(totalLines);
    }
    markTrainingFinished(ok, ok ? "auto training completed" : "auto training failed");
  } finally {
    trainingInProgress = false;
  }
}

export async function recordUserTrainingPair({ prompt, completion }) {
  const cleanPrompt = normalize(prompt);
  const cleanCompletion = normalize(completion);

  if (shouldSkipPair(cleanPrompt, cleanCompletion)) {
    return;
  }

  await appendUserPair(cleanPrompt, cleanCompletion);
}

export async function recordFeedbackTrainingPair({
  prompt,
  completion,
  feedback,
  replacement,
  meta = {}
}) {
  const cleanPrompt = normalize(prompt);
  const cleanCompletion = normalize(completion);
  const cleanReplacement = normalize(replacement);
  const signal = String(feedback || "").trim().toLowerCase();

  if (!cleanPrompt || !cleanCompletion || !["up", "down"].includes(signal)) {
    return {
      recorded: false,
      trained: false
    };
  }

  if (signal === "up") {
    if (shouldSkipPair(cleanPrompt, cleanCompletion)) {
      return {
        recorded: false,
        trained: false
      };
    }

    await appendApprovedPair(cleanPrompt, cleanCompletion, {
      ...meta,
      source: "user_feedback_upvote",
      feedback: "upvote",
      qualitySignal: "approved"
    });
    void maybeAutoTrain();
    return {
      recorded: true,
      trained: true
    };
  }

  await appendRejectedPair(cleanPrompt, cleanCompletion, {
    ...meta,
    source: "user_feedback_downvote",
    feedback: "downvote"
  });

  if (!cleanReplacement || shouldSkipPair(cleanPrompt, cleanReplacement)) {
    return {
      recorded: true,
      trained: false
    };
  }

  await appendApprovedPair(cleanPrompt, cleanReplacement, {
    ...meta,
    source: "user_feedback_correction",
    feedback: "correction",
    qualitySignal: "corrected"
  });
  void maybeAutoTrain();
  return {
    recorded: true,
    trained: true
  };
}

export async function triggerManualAutoTrain() {
  if (trainingInProgress) {
    return {
      started: false,
      status: "already-running"
    };
  }

  trainingInProgress = true;
  markTrainingStarted("manual retrain requested");

  void (async () => {
    try {
      const ok = await runTrainingJob();
      if (ok) {
        const totalLines = await countJsonlRows(USER_DATA_PATH);
        await writeAutoTrainState(totalLines);
      }
      markTrainingFinished(ok, ok ? "manual retrain completed" : "manual retrain failed");
    } catch (error) {
      markTrainingFinished(false, error instanceof Error ? error.message : "manual retrain failed");
    } finally {
      trainingInProgress = false;
    }
  })();

  return {
    started: true,
    status: "running"
  };
}

export async function getAutoTrainStatus() {
  const [approvedLines, candidateLines, rejectedLines, metadata] = await Promise.all([
    countJsonlRows(USER_DATA_PATH),
    countJsonlRows(USER_CANDIDATE_DATA_PATH),
    countJsonlRows(USER_REJECTED_DATA_PATH),
    readJsonFile(path.join(OUT_DIR, "metadata.json"))
  ]);

  return {
    enabled: AUTO_TRAIN_ENABLED,
    inProgress: trainingInProgress,
    minNewExamples: AUTO_TRAIN_MIN_NEW_EXAMPLES,
    cooldownMs: AUTO_TRAIN_COOLDOWN_MS,
    lastTrainStartedAt,
    lastTrainCompletedAt,
    lastTrainResult,
    files: {
      approved: approvedLines,
      candidates: candidateLines,
      rejected: rejectedLines
    },
    modelDir: OUT_DIR,
    metadata
  };
}
