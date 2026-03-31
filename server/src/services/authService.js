import crypto from "node:crypto";
import { promisify } from "node:util";
import { readDb, updateDb } from "./dataStore.js";

const scryptAsync = promisify(crypto.scrypt);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const EMAIL_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;
const RESET_TOKEN_TTL_MS = 1000 * 60 * 30;
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean)
);

function now() {
  return Date.now();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
}

function parsePasswordHash(storedHash) {
  const [salt, expectedHex] = String(storedHash || "").split(":");
  if (!salt || !expectedHex || expectedHex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(expectedHex)) {
    return null;
  }

  return {
    salt,
    expectedHex: expectedHex.toLowerCase()
  };
}

async function verifyPasswordHash(password, storedHash) {
  const parsed = parsePasswordHash(storedHash);
  if (!parsed) {
    return false;
  }

  const derived = await scryptAsync(password, parsed.salt, 64);
  const actual = Buffer.from(derived).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(parsed.expectedHex, "hex"));
}

async function verifyPassword(password, user) {
  const storedHash = String(user?.passwordHash || "");
  if (await verifyPasswordHash(password, storedHash)) {
    return {
      matches: true,
      upgraded: false
    };
  }

  const legacyPassword =
    typeof user?.password === "string"
      ? user.password
      : storedHash && !parsePasswordHash(storedHash)
        ? storedHash
        : "";

  if (!legacyPassword || password !== legacyPassword) {
    return {
      matches: false,
      upgraded: false
    };
  }

  return {
    matches: true,
    upgraded: true,
    passwordHash: await hashPassword(password)
  };
}

function createOpaqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

function isAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  return ADMIN_EMAILS.has(normalizedEmail);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: isAdminEmail(user.email),
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function pruneExpiredSessions(db) {
  const current = now();
  db.sessions = db.sessions.filter((session) => Number(session.expiresAt || 0) > current);
}

function findUserByEmail(db, email) {
  return db.users.find((user) => user.email === normalizeEmail(email));
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const trimmedName = String(name || "").trim();
  const passwordHash = await hashPassword(password);
  const verificationToken = createOpaqueToken();
  const sessionToken = createOpaqueToken();
  const createdAt = new Date().toISOString();
  const result = await updateDb((db) => {
    if (findUserByEmail(db, normalizedEmail)) {
      const error = new Error("An account with that email already exists.");
      error.statusCode = 409;
      throw error;
    }

    pruneExpiredSessions(db);

    const user = {
      id: crypto.randomUUID(),
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      createdAt,
      updatedAt: createdAt,
      verificationTokenHash: hashToken(verificationToken),
      verificationExpiresAt: now() + EMAIL_TOKEN_TTL_MS,
      resetTokenHash: null,
      resetExpiresAt: null
    };

    db.users.push(user);
    db.sessions.push({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      createdAt,
      lastUsedAt: createdAt,
      expiresAt: now() + SESSION_TTL_MS
    });

    return {
      token: sessionToken,
      user: sanitizeUser(user),
      verificationToken
    };
  });

  return result;
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const sessionToken = createOpaqueToken();
  const createdAt = new Date().toISOString();
  const result = await updateDb(async (db) => {
    pruneExpiredSessions(db);

    const user = findUserByEmail(db, normalizedEmail);
    if (!user) {
      const error = new Error("No account found for that email. Create an account first.");
      error.statusCode = 404;
      throw error;
    }

    const verification = await verifyPassword(password, user);
    if (!verification.matches) {
      const error = new Error("Incorrect password.");
      error.statusCode = 401;
      throw error;
    }
    if (verification.upgraded && verification.passwordHash) {
      user.passwordHash = verification.passwordHash;
      delete user.password;
      user.updatedAt = new Date().toISOString();
    }
    if (!user.emailVerified) {
      const error = new Error("Please verify your email before signing in.");
      error.statusCode = 403;
      throw error;
    }

    db.sessions.push({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      createdAt,
      lastUsedAt: createdAt,
      expiresAt: now() + SESSION_TTL_MS
    });

    return {
      token: sessionToken,
      user: sanitizeUser(user)
    };
  });

  return result;
}

export async function authenticateSession(token) {
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  return updateDb((db) => {
    pruneExpiredSessions(db);

    const session = db.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    if (!session) {
      return null;
    }

    const user = db.users.find((candidate) => candidate.id === session.userId);
    if (!user) {
      db.sessions = db.sessions.filter((candidate) => candidate.id !== session.id);
      return null;
    }

    session.lastUsedAt = new Date().toISOString();
    session.expiresAt = now() + SESSION_TTL_MS;

    return {
      user: sanitizeUser(user),
      sessionId: session.id
    };
  });
}

export async function revokeSession(token) {
  if (!token) {
    return;
  }

  const tokenHash = hashToken(token);
  await updateDb((db) => {
    db.sessions = db.sessions.filter((session) => session.tokenHash !== tokenHash);
  });
}

export async function createVerificationToken(email) {
  const normalizedEmail = normalizeEmail(email);
  const verificationToken = createOpaqueToken();

  return updateDb((db) => {
    const user = findUserByEmail(db, normalizedEmail);
    if (!user) {
      return null;
    }

    user.verificationTokenHash = hashToken(verificationToken);
    user.verificationExpiresAt = now() + EMAIL_TOKEN_TTL_MS;
    user.updatedAt = new Date().toISOString();

    return {
      user: sanitizeUser(user),
      verificationToken
    };
  });
}

export async function getAccountStatus(email) {
  const normalizedEmail = normalizeEmail(email);
  const db = await readDb();
  const user = findUserByEmail(db, normalizedEmail);

  if (!user) {
    return {
      exists: false,
      email: normalizedEmail
    };
  }

  return {
    exists: true,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function verifyEmailToken(token, email = "") {
  const tokenHash = hashToken(token);
  const normalizedEmail = normalizeEmail(email);

  return updateDb((db) => {
    const user = db.users.find(
      (candidate) =>
        candidate.verificationTokenHash === tokenHash && Number(candidate.verificationExpiresAt || 0) > now()
    );

    if (user) {
      user.emailVerified = true;
      user.verificationTokenHash = null;
      user.verificationExpiresAt = null;
      user.updatedAt = new Date().toISOString();

      return {
        ...sanitizeUser(user),
        alreadyVerified: false
      };
    }

    if (normalizedEmail) {
      const existingUser = findUserByEmail(db, normalizedEmail);
      if (existingUser?.emailVerified) {
        return {
          ...sanitizeUser(existingUser),
          alreadyVerified: true
        };
      }
    }

    const error = new Error("That verification link is invalid or has expired.");
    error.statusCode = 400;
    throw error;
  });
}

export async function createPasswordResetToken(email) {
  const normalizedEmail = normalizeEmail(email);
  const resetToken = createOpaqueToken();

  return updateDb((db) => {
    const user = findUserByEmail(db, normalizedEmail);
    if (!user) {
      return null;
    }

    user.resetTokenHash = hashToken(resetToken);
    user.resetExpiresAt = now() + RESET_TOKEN_TTL_MS;
    user.updatedAt = new Date().toISOString();

    return {
      user: sanitizeUser(user),
      resetToken
    };
  });
}

export async function resetPassword({ token, password }) {
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(password);

  return updateDb((db) => {
    const user = db.users.find(
      (candidate) => candidate.resetTokenHash === tokenHash && Number(candidate.resetExpiresAt || 0) > now()
    );

    if (!user) {
      const error = new Error("That reset link is invalid or has expired.");
      error.statusCode = 400;
      throw error;
    }

    user.passwordHash = passwordHash;
    delete user.password;
    user.resetTokenHash = null;
    user.resetExpiresAt = null;
    user.updatedAt = new Date().toISOString();

    db.sessions = db.sessions.filter((session) => session.userId !== user.id);

    return sanitizeUser(user);
  });
}

export async function getUserById(userId) {
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === userId);
  return user ? sanitizeUser(user) : null;
}
