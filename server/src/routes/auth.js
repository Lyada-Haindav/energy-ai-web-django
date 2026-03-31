import express from "express";
import {
  createPasswordResetToken,
  createVerificationToken,
  loginUser,
  registerUser,
  resetPassword,
  revokeSession,
  verifyEmailToken
} from "../services/authService.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/emailService.js";
import { requireAnyAuth, requireAuth } from "../middleware/auth.js";

const router = express.Router();

function readBodyField(body, key) {
  return String(body?.[key] || "").trim();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return String(password || "").length >= 8;
}

router.post("/register", async (req, res, next) => {
  try {
    const name = readBodyField(req.body, "name");
    const email = readBodyField(req.body, "email");
    const password = String(req.body?.password || "");

    if (name.length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters." });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const account = await registerUser({ name, email, password });
    const delivery = await sendVerificationEmail({
      user: account.user,
      token: account.verificationToken
    });

    return res.status(201).json({
      token: account.token,
      user: account.user,
      emailDelivery: delivery
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = readBodyField(req.body, "email");
    const password = String(req.body?.password || "");

    if (!validateEmail(email) || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const session = await loginUser({ email, password });
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.post("/logout", requireAnyAuth, async (req, res, next) => {
  try {
    await revokeSession(req.authToken);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/verify-email", async (req, res, next) => {
  try {
    const token = readBodyField(req.body, "token");
    const email = readBodyField(req.body, "email");
    if (!token) {
      return res.status(400).json({ error: "Verification token is required." });
    }

    const result = await verifyEmailToken(token, email);
    return res.json({
      ok: true,
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        emailVerified: result.emailVerified,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      },
      alreadyVerified: Boolean(result.alreadyVerified)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/resend-verification", async (req, res, next) => {
  try {
    const email = readBodyField(req.body, "email");
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const result = await createVerificationToken(email);
    if (!result) {
      return res.status(404).json({
        error: "No account found for that email. Create an account first."
      });
    }

    const delivery = await sendVerificationEmail({
      user: result.user,
      token: result.verificationToken
    });

    return res.json({
      ok: true,
      message: "Verification email sent.",
      emailDelivery: delivery
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const email = readBodyField(req.body, "email");
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const result = await createPasswordResetToken(email);
    if (!result) {
      return res.status(404).json({
        error: "No account found for that email. Create an account first."
      });
    }

    const delivery = await sendPasswordResetEmail({
      user: result.user,
      token: result.resetToken
    });

    return res.json({
      ok: true,
      message: "Password reset email sent.",
      emailDelivery: delivery
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const token = readBodyField(req.body, "token");
    const password = String(req.body?.password || "");

    if (!token) {
      return res.status(400).json({ error: "Reset token is required." });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    await resetPassword({ token, password });
    return res.json({
      ok: true,
      message: "Password updated. Sign in with your new password."
    });
  } catch (error) {
    return next(error);
  }
});

export { router as authRouter };
