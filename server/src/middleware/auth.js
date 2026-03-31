import { authenticateSession } from "../services/authService.js";

function extractBearerToken(header) {
  const match = String(header || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function createRequireAuth({ allowUnverified = false } = {}) {
  return async function requireAuth(req, res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization);
      const auth = await authenticateSession(token);

      if (!auth) {
        return res.status(401).json({ error: "Authentication required." });
      }

      if (!allowUnverified && !auth.user.emailVerified) {
        return res.status(403).json({ error: "Please verify your email before continuing." });
      }

      req.authToken = token;
      req.user = auth.user;
      req.sessionId = auth.sessionId;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const requireAuth = createRequireAuth();
export const requireAnyAuth = createRequireAuth({ allowUnverified: true });

export async function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required." });
    }

    return next();
  });
}
