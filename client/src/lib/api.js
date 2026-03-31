function defaultApiBase() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8787";
  }

  return window.location.port === "5173" ? "" : window.location.origin;
}

const API_BASE = import.meta.env.VITE_API_BASE || defaultApiBase();

let authToken = "";
let unauthorizedHandler = null;

function authHeaders() {
  return authToken
    ? {
        Authorization: `Bearer ${authToken}`
      }
    : {};
}

function notifyUnauthorized(error) {
  if (!authToken || typeof unauthorizedHandler !== "function") {
    return;
  }

  unauthorizedHandler(error);
}

function unexpectedApiResponseMessage() {
  return "The app reached the frontend dev server instead of the backend API. Keep the backend running and use the Vite proxy, or set VITE_API_BASE.";
}

async function readError(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    if (data?.error) {
      return data.error;
    }
  }

  if (contentType.includes("text/html")) {
    return unexpectedApiResponseMessage();
  }

  const text = await response.text().catch(() => "");
  return text || "Request failed.";
}

async function request(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders()
    },
    body: body ? JSON.stringify(body) : undefined,
    signal
  });

  if (!response.ok) {
    const error = new Error(await readError(response));
    error.status = response.status;
    if (response.status === 401) {
      notifyUnauthorized(error);
    }
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const error = new Error(contentType.includes("text/html") ? unexpectedApiResponseMessage() : "Unexpected response from the API.");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export function setAuthToken(token) {
  authToken = String(token || "");
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

export function register(payload) {
  return request("/api/auth/register", {
    method: "POST",
    body: payload
  });
}

export function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: payload
  });
}

export function logout() {
  return request("/api/auth/logout", {
    method: "POST"
  });
}

export function whoAmI() {
  return request("/api/auth/me");
}

export function verifyEmail(payload) {
  return request("/api/auth/verify-email", {
    method: "POST",
    body: payload
  });
}

export function resendVerification(payload) {
  return request("/api/auth/resend-verification", {
    method: "POST",
    body: payload
  });
}

export function forgotPassword(payload) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: payload
  });
}

export function resetPassword(payload) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: payload
  });
}

export function fetchChats() {
  return request("/api/chats");
}

export function saveChats(sessions) {
  return request("/api/chats", {
    method: "PUT",
    body: {
      sessions
    }
  });
}

export function submitChatFeedback(payload) {
  return request("/api/chats/feedback", {
    method: "POST",
    body: payload
  });
}

export function fetchAdminOverview() {
  return request("/api/admin/overview");
}

export function triggerAdminRetrain() {
  return request("/api/admin/retrain", {
    method: "POST"
  });
}

export async function streamChat({ messages, mode, workspaceMode, signal, onEvent }) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({ messages, mode, workspaceMode }),
    signal
  });

  if (!response.ok) {
    const error = new Error(await readError(response));
    error.status = response.status;
    if (response.status === 401) {
      notifyUnauthorized(error);
    }
    throw error;
  }

  if (!response.body) {
    const error = new Error("The chat response ended before any tokens arrived.");
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const error = new Error(unexpectedApiResponseMessage());
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    lines.forEach((line) => {
      if (!line.trim()) {
        return;
      }

      try {
        onEvent(JSON.parse(line));
      } catch {
        // Ignore malformed chunks from partial output.
      }
    });
  }

  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer));
    } catch {
      // Ignore final malformed chunk.
    }
  }
}
