import { useEffect, useState } from "react";
import {
  forgotPassword as forgotPasswordRequest,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  resendVerification as resendVerificationRequest,
  resetPassword as resetPasswordRequest,
  setAuthToken,
  setUnauthorizedHandler,
  verifyEmail as verifyEmailRequest,
  whoAmI
} from "../lib/api";

const TOKEN_STORAGE_KEY = "energy-ai-auth-token";
const PENDING_TOKEN_STORAGE_KEY = "energy-ai-pending-auth-token";

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function readStoredPendingToken() {
  try {
    return localStorage.getItem(PENDING_TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeStoredToken(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore browsers that block storage access and keep auth in memory.
  }
}

export function useAuth() {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      persistPendingToken("");
      persistSession("", null);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      if (!token) {
        setUser(null);
        setIsBootstrapping(false);
        return;
      }

      setIsBootstrapping(true);

      try {
        const result = await whoAmI();
        if (!ignore) {
          setUser(result.user);
        }
      } catch {
        if (!ignore) {
          writeStoredToken(TOKEN_STORAGE_KEY, "");
          setAuthToken("");
          setToken("");
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrap();

    return () => {
      ignore = true;
    };
  }, [token]);

  function persistSession(nextToken, nextUser) {
    writeStoredToken(TOKEN_STORAGE_KEY, nextToken);

    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser || null);
  }

  function persistPendingToken(nextToken) {
    writeStoredToken(PENDING_TOKEN_STORAGE_KEY, nextToken);
  }

  async function register(payload) {
    const result = await registerRequest(payload);
    if (result.user?.emailVerified) {
      persistPendingToken("");
      persistSession(result.token, result.user);
    } else {
      persistPendingToken(result.token);
      persistSession("", null);
    }
    return result;
  }

  async function login(payload) {
    const result = await loginRequest(payload);
    persistPendingToken("");
    persistSession(result.token, result.user);
    return result;
  }

  async function logout() {
    try {
      await logoutRequest();
    } catch {
      // Clear local auth state even if the backend session already expired.
    } finally {
      persistPendingToken("");
      persistSession("", null);
    }
  }

  async function refreshUser() {
    if (!token) {
      setUser(null);
      return null;
    }

    const result = await whoAmI();
    setUser(result.user);
    return result.user;
  }

  async function verifyEmail(tokenValue, emailValue = "") {
    const result = await verifyEmailRequest({
      token: tokenValue,
      email: emailValue
    });
    const pendingToken = readStoredPendingToken();

    if (pendingToken) {
      setAuthToken(pendingToken);

      try {
        const me = await whoAmI();
        persistPendingToken("");
        persistSession(pendingToken, me.user);
        return {
          ...result,
          autoSignedIn: true
        };
      } catch {
        setAuthToken("");
        persistPendingToken("");
      }
    }

    if (user && result.user?.id === user.id) {
      setUser(result.user);
    }

    return result;
  }

  async function resetPassword(payload) {
    const result = await resetPasswordRequest(payload);
    persistPendingToken("");
    persistSession("", null);
    return result;
  }

  return {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    isBootstrapping,
    register,
    login,
    logout,
    refreshUser,
    verifyEmail,
    resendVerification: resendVerificationRequest,
    forgotPassword: forgotPasswordRequest,
    resetPassword
  };
}
