(function () {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  const TOKEN_STORAGE_KEY = "energy-ai-auth-token";
  const PENDING_TOKEN_STORAGE_KEY = "energy-ai-pending-auth-token";
  const PUBLIC_ROUTES = new Set(["home", "login", "signup", "forgot-password", "reset-password", "verify-email"]);
  const APP_ROUTES = new Set(["chat", "analytics"]);
  const ADMIN_ROUTES = new Set(["admin"]);
  const MAX_ATTACHMENTS = 4;
  const MAX_ATTACHMENT_BYTES = 160 * 1024;
  const MAX_ATTACHMENT_CHARS = 12000;
  const CHATGPT_TYPICAL_QUERY_WH = 0.3;
  const EXTERNAL_BENCHMARKS = [
    {
      id: "chatgpt-typical",
      label: "ChatGPT Typical",
      kind: "published",
      whPerResponse: CHATGPT_TYPICAL_QUERY_WH,
      detail: "Published benchmark estimate used as a same-response comparison reference.",
    },
    {
      id: "gemini-frontier-proxy",
      label: "Gemini Frontier Proxy",
      kind: "proxy",
      whPerResponse: CHATGPT_TYPICAL_QUERY_WH,
      detail: "Proxy estimate only, since Google does not publish direct per-query Gemini energy.",
    },
  ];

  const TEXT_EXTENSIONS = new Set([
    "txt", "md", "markdown", "json", "jsonl", "js", "jsx", "ts", "tsx", "css", "scss", "html", "xml", "svg",
    "py", "java", "kt", "go", "rs", "php", "rb", "swift", "c", "h", "hpp", "cpp", "cs", "sql", "sh", "bash",
    "yml", "yaml", "toml", "env", "log", "ini", "conf", "dockerfile"
  ]);

  const ENERGY_MODE_OPTIONS = [
    {
      id: "auto",
      label: "Auto Balance",
      hint: "Route by difficulty",
      activeClass: "border-[#e7cf97] bg-[linear-gradient(180deg,#fbf0d3_0%,#efddab_100%)] text-[#6f5821] shadow-[0_22px_44px_-34px_rgba(111,88,33,0.28)]",
      idleClass: "border-[#d6ddd0] bg-white/76 text-[#7f6630] hover:bg-[#fff9ef]",
      chipClass: "border-[#e7d4a2] bg-[#fbf1d8] text-[#7b6228]",
    },
    {
      id: "fast",
      label: "Low Energy",
      hint: "Fast and efficient",
      activeClass: "border-[#c7dfcd] bg-[linear-gradient(180deg,#eff9f1_0%,#ddefe1_100%)] text-[#2e6d4d] shadow-[0_22px_44px_-34px_rgba(46,109,77,0.24)]",
      idleClass: "border-[#d6ddd0] bg-white/76 text-[#3f7258] hover:bg-[#f5fbf6]",
      chipClass: "border-[#cfe5d4] bg-[#eef8f0] text-[#2f6d4d]",
    },
    {
      id: "deep",
      label: "High Energy",
      hint: "Deep reasoning",
      activeClass: "border-[#edd0c7] bg-[linear-gradient(180deg,#fff2ed_0%,#f6ddd5_100%)] text-[#96503f] shadow-[0_22px_44px_-34px_rgba(150,80,63,0.24)]",
      idleClass: "border-[#d6ddd0] bg-white/76 text-[#9a5d4c] hover:bg-[#fff3ef]",
      chipClass: "border-[#edd7d0] bg-[#fff2ee] text-[#995949]",
    },
  ];

  const WORKSPACE_MODE_OPTIONS = [
    { id: "general", label: "Auto", hint: "Reads your prompt" },
    { id: "coding", label: "Coding", hint: "Implementation" },
    { id: "bug-fix", label: "Bug Fix", hint: "Root cause" },
    { id: "code-review", label: "Code Review", hint: "Find risks" },
    { id: "refactor", label: "Refactor", hint: "Cleaner structure" },
    { id: "tests", label: "Tests", hint: "Coverage ideas" },
    { id: "explain-code", label: "Explain Code", hint: "Step by step" },
    { id: "error-log", label: "Error Log", hint: "Trace analysis" },
    { id: "api-contract", label: "API Contract", hint: "Requests and responses" },
    { id: "a11y", label: "A11y", hint: "Accessibility" },
    { id: "performance", label: "Performance", hint: "Speed and weight" },
    { id: "security", label: "Security", hint: "Auth and safety" },
    { id: "stack-detect", label: "Stack Detect", hint: "Infer tech stack" },
    { id: "lint", label: "Lint Hints", hint: "Style and consistency" },
  ];

  const MODE_BY_ID = Object.fromEntries(ENERGY_MODE_OPTIONS.map((option) => [option.id, option]));
  const WORKSPACE_BY_ID = Object.fromEntries(WORKSPACE_MODE_OPTIONS.map((option) => [option.id, option]));

  const state = {
    route: parseRoute(),
    token: readStoredValue(TOKEN_STORAGE_KEY),
    pendingToken: readStoredValue(PENDING_TOKEN_STORAGE_KEY),
    user: null,
    isBootstrapping: true,
    sessions: [],
    activeSessionId: null,
    isHydrating: false,
    chatsLoaded: false,
    isLoading: false,
    syncError: "",
    activeMode: "auto",
    workspaceMode: "general",
    banner: null,
    draft: "",
    attachments: [],
    attachmentError: "",
    abortController: null,
    saveQueue: Promise.resolve(),
    authForm: {
      name: "",
      email: parseRoute().email || "",
      password: "",
    },
    authStatus: null,
    tokenForm: {
      password: "",
      confirmPassword: "",
    },
    tokenStatus: null,
    tokenBusy: false,
    isResendingVerification: false,
    adminOverview: null,
    adminError: "",
    isAdminLoading: false,
    isRetraining: false,
    analyticsOverview: null,
    analyticsError: "",
    isAnalyticsLoading: false,
    isEvaluationRunning: false,
    copiedMessageId: "",
    autoVerifyKey: "",
    renderQueued: false,
    scrollWanted: "",
    isMobileMenuOpen: false,
    isCommandPaletteOpen: false,
    commandPaletteQuery: "",
    chatShouldStickToBottom: true,
    chatScrollDistanceFromBottom: 0,
    streamingMessageId: "",
  };

  let chatScrollRegion = null;
  let chatScrollHandler = null;
  let streamRenderTimer = 0;
  let streamPatchSessionId = "";
  let streamPatchMessageId = "";

  const initialPathNode = document.getElementById("energy-initial-path");
  state.initialPath = initialPathNode ? JSON.parse(initialPathNode.textContent) : "/";

  window.addEventListener("hashchange", onLocationChange);
  window.addEventListener("popstate", onLocationChange);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", handleResize);

  app.addEventListener("click", handleClick);
  app.addEventListener("input", handleInput);
  app.addEventListener("change", handleChange);
  app.addEventListener("submit", handleSubmit);

  bootstrap();

  function readStoredValue(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function writeStoredValue(key, value) {
    try {
      if (value) {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage failures.
    }
  }

  function parseRoute() {
    const pathname = String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
    if (pathname === "/admin") {
      return { page: "admin", token: "", email: "" };
    }

    const raw = window.location.hash || "#/home";
    const normalized = raw.startsWith("#") ? raw.slice(1) : raw;
    const [pathPart, queryString = ""] = normalized.split("?");
    const params = new URLSearchParams(queryString);
    const routeState = {
      token: params.get("token") || "",
      email: params.get("email") || "",
    };

    switch (pathPart) {
      case "/home":
        return { page: "home", ...routeState };
      case "/chat":
        return { page: "chat", ...routeState };
      case "/analytics":
        return { page: "analytics", ...routeState };
      case "/signup":
        return { page: "signup", ...routeState };
      case "/forgot-password":
        return { page: "forgot-password", ...routeState };
      case "/reset-password":
        return { page: "reset-password", ...routeState };
      case "/verify-email":
        return { page: "verify-email", ...routeState };
      case "/login":
        return { page: "login", ...routeState };
      default:
        return { page: "home", ...routeState };
    }
  }

  function hashForPage(page, params = {}) {
    const pathByPage = {
      home: "/home",
      chat: "/chat",
      analytics: "/analytics",
      admin: "/admin",
      login: "/login",
      signup: "/signup",
      "forgot-password": "/forgot-password",
      "reset-password": "/reset-password",
      "verify-email": "/verify-email",
    };

    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        search.set(key, value);
      }
    });

    const query = search.toString();
    return `#${pathByPage[page] || "/home"}${query ? `?${query}` : ""}`;
  }

  function onLocationChange() {
    state.route = parseRoute();
    if (state.route.email && !state.authForm.email) {
      state.authForm.email = state.route.email;
    }
    state.authStatus = null;
    state.tokenStatus = null;
    state.banner = null;
    state.adminError = "";
    state.analyticsError = "";
    state.attachmentError = "";
    state.isMobileMenuOpen = false;
    state.isCommandPaletteOpen = false;
    state.commandPaletteQuery = "";
    scheduleRender();
    syncRouteState();
  }

  function navigate(page, params = {}) {
    if (page === "admin") {
      window.history.pushState({}, "", "/admin");
      onLocationChange();
      return;
    }

    const targetHash = hashForPage(page, params);
    if (window.location.pathname === "/admin") {
      window.history.pushState({}, "", `/${targetHash}`);
      onLocationChange();
      return;
    }

    window.location.hash = targetHash;
  }

  function requestScroll(mode) {
    state.scrollWanted = mode || "force";
    if (state.scrollWanted === "force") {
      state.chatShouldStickToBottom = true;
      state.chatScrollDistanceFromBottom = 0;
    }
  }

  function isTypingTarget(target) {
    const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
    return tagName === "input" || tagName === "textarea" || Boolean(target && target.isContentEditable);
  }

  function handleResize() {
    if (window.innerWidth >= 1024 && state.isMobileMenuOpen) {
      state.isMobileMenuOpen = false;
      if (!patchMobileDrawerVisibility()) {
        scheduleRender();
      }
    }
  }

  function updateBodyOverflow() {
    document.body.style.overflow = state.isMobileMenuOpen || state.isCommandPaletteOpen ? "hidden" : "";
  }

  function focusCommandPaletteInput() {
    const paletteInput = app.querySelector("input[name='command-palette-query']");
    if (paletteInput && document.activeElement !== paletteInput) {
      paletteInput.focus();
      if (!state.commandPaletteQuery) {
        paletteInput.select();
      }
    }
  }

  function patchMobileDrawerVisibility() {
    const drawer = app.querySelector("[data-mobile-drawer]");
    if (!drawer) {
      return false;
    }

    const backdrop = drawer.querySelector("[data-mobile-backdrop]");
    const panel = drawer.querySelector("[data-mobile-panel]");

    drawer.classList.toggle("pointer-events-none", !state.isMobileMenuOpen);
    if (backdrop) {
      backdrop.classList.toggle("opacity-100", state.isMobileMenuOpen);
      backdrop.classList.toggle("opacity-0", !state.isMobileMenuOpen);
    }
    if (panel) {
      panel.classList.toggle("translate-x-0", state.isMobileMenuOpen);
      panel.classList.toggle("-translate-x-full", !state.isMobileMenuOpen);
    }

    updateBodyOverflow();
    return true;
  }

  function patchCommandPaletteVisibility() {
    const overlay = app.querySelector("[data-command-palette-overlay]");
    if (!overlay) {
      return false;
    }

    overlay.classList.toggle("hidden", !state.isCommandPaletteOpen);
    overlay.classList.toggle("pointer-events-none", !state.isCommandPaletteOpen);

    const paletteInput = overlay.querySelector("input[name='command-palette-query']");
    if (paletteInput && paletteInput.value !== state.commandPaletteQuery) {
      paletteInput.value = state.commandPaletteQuery;
    }
    applyCommandPaletteFilter(state.commandPaletteQuery);
    if (state.isCommandPaletteOpen) {
      focusCommandPaletteInput();
    }

    updateBodyOverflow();
    return true;
  }

  function patchChatComposer(options = {}) {
    if (state.route.page !== "chat") {
      return false;
    }

    const composer = app.querySelector(".energy-js-composer-form");
    if (!composer) {
      return false;
    }

    composer.outerHTML = renderComposer();

    if (options.focusComposer) {
      const textarea = app.querySelector("textarea[name='composer-draft']");
      if (textarea) {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      }
    }

    patchMobileDrawerVisibility();
    patchCommandPaletteVisibility();
    afterRender();
    return true;
  }

  function patchChatLayout(options = {}) {
    if (state.route.page !== "chat") {
      return false;
    }

    const mainColumn = app.querySelector(".energy-js-main-column");
    if (!mainColumn) {
      return false;
    }

    const desktopSidebar = app.querySelector(".energy-js-sidebar-desktop");
    const mobileSidebarHost = app.querySelector("[data-mobile-sidebar-host]");

    if (desktopSidebar) {
      desktopSidebar.innerHTML = renderSidebar(false);
    }
    if (mobileSidebarHost) {
      mobileSidebarHost.innerHTML = renderSidebar(true);
    }

    mainColumn.innerHTML = `${renderChatWindow()}${renderComposer()}`;

    if (options.focusComposer) {
      const textarea = app.querySelector("textarea[name='composer-draft']");
      if (textarea) {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      }
    }

    patchMobileDrawerVisibility();
    patchCommandPaletteVisibility();
    afterRender();
    return true;
  }

  function patchMessageState(sessionId, messageId) {
    const patched = patchActiveChatMessages(sessionId, messageId);
    if (!patched) {
      return false;
    }
    updateChatScrollState(syncChatScrollRegion({ preserveState: true }));
    return true;
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    const target = event.target;

    if (
      target instanceof HTMLTextAreaElement &&
      target.name === "composer-draft" &&
      key === "enter" &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      if (!state.isLoading) {
        void sendMessage();
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && key === "k" && state.token && state.user && APP_ROUTES.has(state.route.page)) {
      event.preventDefault();
      state.isCommandPaletteOpen = !state.isCommandPaletteOpen;
      if (!state.isCommandPaletteOpen) {
        state.commandPaletteQuery = "";
      }
      if (!patchCommandPaletteVisibility()) {
        scheduleRender();
      }
      return;
    }

    if (event.key === "Escape") {
      if (state.isCommandPaletteOpen) {
        state.isCommandPaletteOpen = false;
        state.commandPaletteQuery = "";
        if (!patchCommandPaletteVisibility()) {
          scheduleRender();
        }
        return;
      }
      if (state.isMobileMenuOpen) {
        state.isMobileMenuOpen = false;
        if (!patchMobileDrawerVisibility()) {
          scheduleRender();
        }
      }
      return;
    }

    if (!isTypingTarget(event.target) && key === "n" && state.token && state.user && state.route.page === "chat") {
      event.preventDefault();
      createChat();
    }
  }

  function scheduleRender() {
    if (state.renderQueued) {
      return;
    }

    state.renderQueued = true;
    window.requestAnimationFrame(() => {
      state.renderQueued = false;
      renderApp();
      afterRender();
    });
  }

  function patchActiveChatMessages(sessionId, messageId) {
    if (state.route.page !== "chat") {
      return false;
    }

    const session = currentSession();
    if (!session || (sessionId && session.id !== sessionId)) {
      return false;
    }

    const stack = app.querySelector(".energy-js-message-stack");
    if (!stack) {
      return false;
    }

    const targetMessageId = messageId || state.streamingMessageId || streamPatchMessageId;
    if (targetMessageId) {
      const messageIndex = session.messages.findIndex((message) => message.id === targetMessageId);
      const targetNode = app.querySelector(`[data-message-id="${targetMessageId}"]`);
      if (messageIndex !== -1 && targetNode) {
        const lastAssistantIndex = [...session.messages].map((message) => message.role).lastIndexOf("assistant");
        targetNode.outerHTML = renderMessage(session.messages[messageIndex], messageIndex === lastAssistantIndex, { disableAnimation: true });
        return true;
      }
    }

    stack.innerHTML = renderChatMessages(session, state.isLoading, { disableAnimation: true });
    return true;
  }

  function scheduleStreamRender(sessionId, messageId) {
    streamPatchSessionId = sessionId || streamPatchSessionId;
    streamPatchMessageId = messageId || streamPatchMessageId;
    if (streamRenderTimer) {
      return;
    }

    streamRenderTimer = window.setTimeout(() => {
      const targetSessionId = streamPatchSessionId;
      const targetMessageId = streamPatchMessageId;
      streamPatchSessionId = "";
      streamPatchMessageId = "";
      streamRenderTimer = 0;
      if (!patchActiveChatMessages(targetSessionId, targetMessageId)) {
        scheduleRender();
      } else {
        const region = syncChatScrollRegion();
        if (region && state.chatShouldStickToBottom) {
          scrollToLatest();
        }
      }
    }, 80);
  }

  function flushStreamRender(sessionId, messageId) {
    if (streamRenderTimer) {
      window.clearTimeout(streamRenderTimer);
      streamRenderTimer = 0;
    }
    streamPatchSessionId = "";
    streamPatchMessageId = "";
    if (!patchActiveChatMessages(sessionId, messageId)) {
      scheduleRender();
    } else {
      const region = syncChatScrollRegion();
      if (region && state.chatShouldStickToBottom) {
        scrollToLatest();
      }
    }
  }

  async function bootstrap() {
    scheduleRender();

    if (!state.token) {
      state.user = null;
      state.isBootstrapping = false;
      syncRouteState();
      scheduleRender();
      return;
    }

    try {
      const result = await whoAmI();
      state.user = result.user;
    } catch (_error) {
      persistSession("", null);
    } finally {
      state.isBootstrapping = false;
      syncRouteState();
      scheduleRender();
    }
  }

  function persistSession(nextToken, nextUser) {
    writeStoredValue(TOKEN_STORAGE_KEY, nextToken);
    state.token = String(nextToken || "");
    state.user = nextUser || null;
    state.sessions = [];
    state.activeSessionId = null;
    state.chatsLoaded = false;
    state.adminOverview = null;
    state.analyticsOverview = null;
  }

  function persistPendingToken(nextToken) {
    writeStoredValue(PENDING_TOKEN_STORAGE_KEY, nextToken);
    state.pendingToken = String(nextToken || "");
  }

  function unauthorizedReset() {
    persistPendingToken("");
    persistSession("", null);
    state.syncError = "";
    state.banner = null;
    navigate("login");
  }

  async function request(path, { method = "GET", body, signal, useAuth = true } = {}) {
    const response = await fetch(path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(useAuth && state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok) {
      const errorMessage = await readError(response);
      const error = new Error(errorMessage);
      error.status = response.status;
      if (response.status === 401 && useAuth && state.token) {
        unauthorizedReset();
      }
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }

    return response.json();
  }

  async function readError(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json().catch(() => null);
      if (data && data.error) {
        return data.error;
      }
    }
    const text = await response.text().catch(() => "");
    return text || "Request failed.";
  }

  function whoAmI() {
    return request("/api/auth/me");
  }

  function registerRequest(payload) {
    return request("/api/auth/register", { method: "POST", body: payload, useAuth: false });
  }

  function loginRequest(payload) {
    return request("/api/auth/login", { method: "POST", body: payload, useAuth: false });
  }

  function logoutRequest() {
    return request("/api/auth/logout", { method: "POST" });
  }

  function verifyEmailRequest(payload) {
    return request("/api/auth/verify-email", { method: "POST", body: payload, useAuth: false });
  }

  function resendVerificationRequest(payload) {
    return request("/api/auth/resend-verification", { method: "POST", body: payload, useAuth: false });
  }

  function forgotPasswordRequest(payload) {
    return request("/api/auth/forgot-password", { method: "POST", body: payload, useAuth: false });
  }

  function resetPasswordRequest(payload) {
    return request("/api/auth/reset-password", { method: "POST", body: payload, useAuth: false });
  }

  function fetchChats() {
    return request("/api/chats");
  }

  function saveChats(sessions) {
    return request("/api/chats", { method: "PUT", body: { sessions } });
  }

  function submitChatFeedback(payload) {
    return request("/api/chats/feedback", { method: "POST", body: payload });
  }

  function fetchAdminOverview() {
    return request("/api/admin/overview");
  }

  function fetchAnalyticsOverview() {
    return request("/api/analytics/overview");
  }

  function triggerAdminRetrain() {
    return request("/api/admin/retrain", { method: "POST" });
  }

  function triggerAdminEvaluations() {
    return request("/api/admin/evaluations/run", { method: "POST" });
  }

  async function streamChat({ messages, mode, workspaceMode, signal, onEvent }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: JSON.stringify({ messages, mode, workspaceMode }),
      signal,
    });

    if (!response.ok) {
      const error = new Error(await readError(response));
      error.status = response.status;
      if (response.status === 401 && state.token) {
        unauthorizedReset();
      }
      throw error;
    }

    if (!response.body) {
      const error = new Error("The chat response ended before any tokens arrived.");
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
        } catch (_error) {
          // Ignore malformed chunk.
        }
      });
    }

    if (buffer.trim()) {
      try {
        onEvent(JSON.parse(buffer));
      } catch (_error) {
        // Ignore trailing malformed chunk.
      }
    }
  }

  function bootstrapMessage() {
    return {
      id: randomId(),
      role: "assistant",
      content: "I am Energy AI. Ask anything and I will balance low-energy speed with high-energy reasoning, plus show sources when reliable context is available.",
      meta: {
        model: "bootstrap",
        energyMode: "low",
      },
    };
  }

  function newSession() {
    const id = randomId();
    return {
      id,
      title: "Untitled Session",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [bootstrapMessage()],
    };
  }

  function deriveTitle(messages) {
    const firstUserMessage = messages.find((message) => message.role === "user");
    if (!firstUserMessage) {
      return "Untitled Session";
    }
    const trimmed = String(firstUserMessage.content || "").trim();
    if (!trimmed) {
      const attachments = Array.isArray(firstUserMessage.meta && firstUserMessage.meta.attachments)
        ? firstUserMessage.meta.attachments
        : [];
      if (attachments.length === 1) {
        return attachments[0].name || "Attached file";
      }
      if (attachments.length > 1) {
        return `${attachments.length} attached files`;
      }
    }
    return trimmed.length > 42 ? `${trimmed.slice(0, 42)}...` : trimmed;
  }

  function normalizeSessions(value) {
    if (!Array.isArray(value) || value.length === 0) {
      return [];
    }

    return value
      .map((session, index) => {
        const createdAt = Number.isFinite(session.createdAt)
          ? session.createdAt
          : Number.isFinite(session.updatedAt)
            ? session.updatedAt
            : index;
        const updatedAt = Number.isFinite(session.updatedAt) ? session.updatedAt : createdAt;
        return {
          ...session,
          createdAt,
          updatedAt,
          messages: Array.isArray(session.messages)
            ? session.messages.map((message, messageIndex) => {
              if (message.meta && message.meta.model === "bootstrap") {
                return {
                  ...bootstrapMessage(),
                  id: message.id || `bootstrap-${messageIndex}`,
                };
              }
              return message;
            })
            : [bootstrapMessage()],
        };
      })
      .sort((left, right) => left.createdAt - right.createdAt || left.updatedAt - right.updatedAt);
  }

  function currentSession() {
    return state.sessions.find((session) => session.id === state.activeSessionId) || state.sessions[state.sessions.length - 1] || null;
  }

  function replaceSessions(nextSessions) {
    state.sessions = nextSessions;
    if (!state.sessions.find((session) => session.id === state.activeSessionId)) {
      state.activeSessionId = currentSession() ? currentSession().id : null;
    }
  }

  function mutateSession(sessionId, mutate) {
    const nextSessions = state.sessions.map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      const updated = mutate(session);
      return {
        ...updated,
        title: deriveTitle(updated.messages),
        updatedAt: Date.now(),
      };
    });
    replaceSessions(nextSessions);
    return nextSessions;
  }

  async function loadChats() {
    if (!(state.token && state.user && state.user.emailVerified) || state.isHydrating || state.chatsLoaded) {
      return;
    }

    state.isHydrating = true;
    state.syncError = "";
    scheduleRender();

    try {
      const result = await fetchChats();
      let nextSessions = normalizeSessions(result.sessions);
      if (nextSessions.length === 0) {
        nextSessions = [newSession()];
        void queuePersist(nextSessions);
      }
      replaceSessions(nextSessions);
      state.activeSessionId = state.activeSessionId && nextSessions.find((session) => session.id === state.activeSessionId)
        ? state.activeSessionId
        : nextSessions[nextSessions.length - 1].id;
      state.chatsLoaded = true;
    } catch (error) {
      const fallback = [newSession()];
      replaceSessions(fallback);
      state.activeSessionId = fallback[0].id;
      state.syncError = syncErrorMessage(error, "Could not load chats.");
      state.chatsLoaded = true;
    } finally {
      state.isHydrating = false;
      if (!patchChatLayout()) {
        scheduleRender();
      }
    }
  }

  function queuePersist(nextSessions) {
    if (!(state.token && state.user && state.user.emailVerified)) {
      return Promise.resolve();
    }

    state.saveQueue = state.saveQueue
      .catch(() => undefined)
      .then(async () => {
        await saveChats(nextSessions);
        state.syncError = "";
      })
      .catch((error) => {
        state.syncError = syncErrorMessage(error, "Could not sync chats.");
        scheduleRender();
      });

    return state.saveQueue;
  }

  function createChat() {
    const created = newSession();
    replaceSessions([...state.sessions, created]);
    state.activeSessionId = created.id;
    queuePersist(state.sessions);
    requestScroll("force");
    if (!patchChatLayout({ focusComposer: true })) {
      scheduleRender();
    }
  }

  function removeChat(chatId) {
    const removedIndex = state.sessions.findIndex((session) => session.id === chatId);
    const remaining = state.sessions.filter((session) => session.id !== chatId);
    const next = remaining.length > 0 ? remaining : [newSession()];
    replaceSessions(next);
    queuePersist(next);
    if (state.activeSessionId === chatId) {
      const fallbackSession = remaining[removedIndex] || remaining[removedIndex - 1] || next[next.length - 1];
      state.activeSessionId = fallbackSession ? fallbackSession.id : null;
    }
    if (!patchChatLayout({ focusComposer: true })) {
      scheduleRender();
    }
  }

  function placeholderMetaForMode(mode) {
    if (mode === "deep") {
      return {
        model: "energy-router",
        role: "deep",
        energyMode: "high",
        energyScore: "D",
        startLatencyMs: 0,
        firstTokenLatencyMs: 0,
        latencyMs: 0,
      };
    }
    if (mode === "fast") {
      return {
        model: "energy-router",
        role: "fast",
        energyMode: "low",
        energyScore: "A",
        startLatencyMs: 0,
        firstTokenLatencyMs: 0,
        latencyMs: 0,
      };
    }
    return {
      model: "energy-router",
      role: "router",
      energyMode: "auto",
      startLatencyMs: 0,
      firstTokenLatencyMs: 0,
      latencyMs: 0,
    };
  }

  function cloneAttachments(value) {
    return Array.isArray(value)
      ? value.map((attachment) => ({
          id: String(attachment.id || randomId()),
          name: String(attachment.name || "attachment.txt"),
          mimeType: String(attachment.mimeType || "text/plain"),
          size: Number(attachment.size || 0),
          language: String(attachment.language || detectLanguage(attachment.name)),
          truncated: Boolean(attachment.truncated),
          content: String(attachment.content || ""),
        }))
      : [];
  }

  async function runAssistantStream({ sessionId, assistantId, payloadMessages, mode, workspaceMode }) {
    state.isLoading = true;
    state.streamingMessageId = assistantId;
    const startedAt = performance.now();
    const controller = new AbortController();
    state.abortController = controller;
    if (!patchChatLayout()) {
      scheduleRender();
    }

    try {
      await streamChat({
        messages: payloadMessages,
        mode,
        workspaceMode,
        signal: controller.signal,
        onEvent(event) {
          mutateSession(sessionId, (session) => {
            const nextMessages = session.messages.map((message) => {
              if (message.id !== assistantId) {
                return message;
              }

              if (event.type === "start") {
                return {
                  ...message,
                  meta: {
                    ...message.meta,
                    stopped: false,
                    startLatencyMs: message.meta && message.meta.startLatencyMs ? message.meta.startLatencyMs : Math.round(performance.now() - startedAt),
                    model: event.model,
                    role: event.role,
                    energyMode: event.energyMode,
                    workspaceMode: event.workspaceMode || (message.meta && message.meta.workspaceMode) || workspaceMode,
                    routeReason: event.routeReason,
                    sources: Array.isArray(event.sources) ? event.sources : [],
                  },
                };
              }

              if (event.type === "token") {
                return {
                  ...message,
                  content: `${message.content || ""}${event.token || ""}`,
                  meta: {
                    ...message.meta,
                    firstTokenLatencyMs: message.meta && message.meta.firstTokenLatencyMs ? message.meta.firstTokenLatencyMs : Math.round(performance.now() - startedAt),
                  },
                };
              }

              if (event.type === "final") {
                return {
                  ...message,
                  meta: {
                    ...message.meta,
                    latencyMs: Math.round(performance.now() - startedAt),
                    energyScore: event.energyScore,
                    model: event.model,
                    role: event.role,
                    energyMode: event.energyMode,
                    workspaceMode: event.workspaceMode || (message.meta && message.meta.workspaceMode) || workspaceMode,
                    routeReason: event.routeReason,
                    sources: Array.isArray(event.sources) ? event.sources : (message.meta && message.meta.sources) || [],
                  },
                };
              }

              return message;
            });

            return {
              ...session,
              messages: nextMessages,
            };
          });
          requestScroll("force");
          if (event.type === "token") {
            scheduleStreamRender(sessionId, assistantId);
          } else {
            flushStreamRender(sessionId, assistantId);
          }
        },
      });
      await queuePersist(state.sessions);
    } catch (error) {
      const aborted = error && error.name === "AbortError";
      mutateSession(sessionId, (session) => ({
        ...session,
        messages: session.messages.map((message) => {
          if (message.id !== assistantId) {
            return message;
          }
          const nextContent = String(message.content || "").trim()
            ? message.content
            : aborted
              ? "Generation stopped."
              : chatErrorMessage(error);
          return {
            ...message,
            content: nextContent,
            meta: {
              ...message.meta,
              stopped: aborted,
              latencyMs: Math.round(performance.now() - startedAt),
            },
          };
        }),
      }));
      if (!aborted) {
        console.error(error);
      }
      await queuePersist(state.sessions);
    } finally {
      if (state.abortController === controller) {
        state.abortController = null;
      }
      state.isLoading = false;
      state.streamingMessageId = "";
      requestScroll("force");
      flushStreamRender(sessionId, assistantId);
      if (!patchChatLayout({ focusComposer: true })) {
        scheduleRender();
      }
    }
  }

  async function sendMessage() {
    const trimmed = String(state.draft || "").trim();
    let activeSession = currentSession();
    if (!activeSession && !state.isLoading) {
      createChat();
      activeSession = currentSession();
    }
    const normalizedAttachments = cloneAttachments(state.attachments);
    if ((!trimmed && normalizedAttachments.length === 0) || !activeSession || state.isLoading) {
      return;
    }

    const sessionId = activeSession.id;
    const userMessage = {
      id: randomId(),
      role: "user",
      content: trimmed,
      meta: normalizedAttachments.length ? { attachments: normalizedAttachments } : undefined,
    };
    const assistantId = randomId();
    const assistantPlaceholder = {
      id: assistantId,
      role: "assistant",
      content: "",
      meta: {
        ...placeholderMetaForMode(state.activeMode),
        workspaceMode: state.workspaceMode,
      },
    };
    const payloadMessages = [...activeSession.messages, userMessage];

    mutateSession(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, userMessage, assistantPlaceholder],
    }));

    state.draft = "";
    state.attachments = [];
    state.attachmentError = "";
    requestScroll("force");
    if (!patchChatLayout({ focusComposer: true })) {
      scheduleRender();
    }

    await runAssistantStream({
      sessionId,
      assistantId,
      payloadMessages,
      mode: state.activeMode,
      workspaceMode: state.workspaceMode,
    });
  }

  function stopGeneration() {
    if (state.abortController) {
      state.abortController.abort();
    }
  }

  async function regenerateLastReply() {
    const activeSession = currentSession();
    if (!activeSession || state.isLoading) {
      return;
    }

    const baseMessages = [...activeSession.messages];
    if (baseMessages[baseMessages.length - 1] && baseMessages[baseMessages.length - 1].role === "assistant") {
      baseMessages.pop();
    }

    const lastUserMessage = [...baseMessages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) {
      return;
    }

    const assistantId = randomId();
    const assistantPlaceholder = {
      id: assistantId,
      role: "assistant",
      content: "",
      meta: {
        ...placeholderMetaForMode(state.activeMode),
        workspaceMode: state.workspaceMode,
      },
    };

    mutateSession(activeSession.id, () => ({
      ...activeSession,
      messages: [...baseMessages, assistantPlaceholder],
    }));

    requestScroll("force");
    if (!patchChatLayout()) {
      scheduleRender();
    }

    await runAssistantStream({
      sessionId: activeSession.id,
      assistantId,
      payloadMessages: baseMessages,
      mode: state.activeMode,
      workspaceMode: state.workspaceMode,
    });
  }

  async function feedbackMessage(messageId, feedback) {
    const activeSession = currentSession();
    if (!activeSession) {
      return;
    }

    const messageIndex = activeSession.messages.findIndex((message) => message.id === messageId);
    const targetMessage = messageIndex >= 0 ? activeSession.messages[messageIndex] : null;
    if (!targetMessage || targetMessage.role !== "assistant") {
      return;
    }
    if (targetMessage.meta && targetMessage.meta.feedback === feedback) {
      return;
    }

    const promptMessage = [...activeSession.messages.slice(0, messageIndex)].reverse().find((message) => message.role === "user");
    if (!promptMessage) {
      return;
    }

    mutateSession(activeSession.id, (session) => ({
      ...session,
      messages: session.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              meta: {
                ...message.meta,
                feedback,
              },
            }
          : message
      ),
    }));
    queuePersist(state.sessions);
    if (!patchMessageState(activeSession.id, messageId)) {
      scheduleRender();
    }

    try {
      const result = await submitChatFeedback({
        prompt: promptMessage.content,
        completion: targetMessage.content,
        feedback,
        meta: {
          model: targetMessage.meta && targetMessage.meta.model,
          role: targetMessage.meta && targetMessage.meta.role,
          energyMode: targetMessage.meta && targetMessage.meta.energyMode,
          workspaceMode: targetMessage.meta && targetMessage.meta.workspaceMode,
          routeReason: targetMessage.meta && targetMessage.meta.routeReason,
        },
      });
      state.syncError = "";
      const autoTrain = result && result.autoTrain || null;
      if (autoTrain) {
        const bannerText = autoTrain.queued
          ? (autoTrain.message || "Feedback saved. Auto-training has started.")
          : autoTrain.inProgress
            ? (autoTrain.message || "Feedback saved. Training is already running.")
            : (autoTrain.message || (feedback === "up" ? "Feedback saved and added to training." : "Feedback saved for training review."));
        state.banner = {
          tone: autoTrain.queued ? "success" : "neutral",
          text: bannerText,
        };
        scheduleRender();
      }
    } catch (error) {
      state.syncError = syncErrorMessage(error, "Could not save feedback.");
      scheduleRender();
    }
  }

  async function handleAuthSubmit(mode) {
    state.authStatus = null;
    scheduleRender();

    try {
      if (mode === "signup") {
        const result = await registerRequest({
          name: state.authForm.name,
          email: state.authForm.email,
          password: state.authForm.password,
        });
        if (result.user && result.user.emailVerified) {
          persistPendingToken("");
          persistSession(result.token, result.user);
          navigate("chat");
          return;
        }
        persistPendingToken(result.token);
        persistSession("", null);
        state.authStatus = {
          tone: result.emailDelivery && result.emailDelivery.previewOnly ? "neutral" : "success",
          text: result.emailDelivery && result.emailDelivery.previewOnly
            ? previewMessage("Account created. Use the preview link below.", result.emailDelivery.error)
            : "Account created. Verify your email to continue.",
          previewUrl: result.emailDelivery && result.emailDelivery.previewOnly ? result.emailDelivery.previewUrl : "",
          previewLabel: "Open verification preview",
        };
        scheduleRender();
        return;
      }

      if (mode === "forgot-password") {
        const result = await forgotPasswordRequest({ email: state.authForm.email });
        state.authStatus = {
          tone: result.emailDelivery && result.emailDelivery.previewOnly ? "neutral" : "success",
          text: result.emailDelivery && result.emailDelivery.previewOnly
            ? previewMessage("Reset link ready. Use the preview below.", result.emailDelivery.error)
            : (result.message || "If that account exists, a reset email is on the way."),
          previewUrl: result.emailDelivery && result.emailDelivery.previewOnly ? result.emailDelivery.previewUrl : "",
          previewLabel: "Open reset preview",
        };
        scheduleRender();
        return;
      }

      const result = await loginRequest({
        email: state.authForm.email,
        password: state.authForm.password,
      });
      persistPendingToken("");
      persistSession(result.token, result.user);
      navigate("chat");
    } catch (error) {
      if (mode === "login" && error.status === 403) {
        navigate("verify-email", { email: state.authForm.email });
        return;
      }

      state.authStatus = {
        tone: "error",
        text: (mode === "login" && error.status === 404)
          ? `${error.message || "No account found."} Create it again.`
          : (mode === "signup" && error.status === 409)
            ? `${error.message || "Account already exists."} Try login instead.`
            : (error.message || "Request failed."),
      };
      scheduleRender();
    }
  }

  async function handleVerifyEmail(tokenValue, emailValue) {
    const result = await verifyEmailRequest({
      token: tokenValue,
      email: emailValue,
    });
    const pendingToken = readStoredValue(PENDING_TOKEN_STORAGE_KEY);
    if (pendingToken) {
      state.token = pendingToken;
      try {
        const me = await whoAmI();
        persistPendingToken("");
        persistSession(pendingToken, me.user);
        return { ...result, autoSignedIn: true };
      } catch (_error) {
        state.token = "";
        persistPendingToken("");
      }
    }

    if (state.user && result.user && result.user.id === state.user.id) {
      state.user = result.user;
    }

    return result;
  }

  async function autoVerifyTokenIfNeeded() {
    const emailValue = state.route.email || (state.user && state.user.email) || "";
    const key = `${state.route.token}:${emailValue}`;
    if (state.route.page !== "verify-email" || !state.route.token || state.tokenBusy || state.autoVerifyKey === key) {
      return;
    }

    state.autoVerifyKey = key;
    state.tokenBusy = true;
    scheduleRender();

    try {
      const result = await handleVerifyEmail(state.route.token, emailValue);
      if (result && result.autoSignedIn) {
        navigate("chat");
        return;
      }
      state.tokenStatus = {
        tone: "success",
        text: result && result.alreadyVerified ? "Already verified. Login to continue." : "Email verified. Login to continue.",
      };
    } catch (error) {
      state.tokenStatus = {
        tone: "error",
        text: error.message || "Verification failed.",
      };
    } finally {
      state.tokenBusy = false;
      scheduleRender();
    }
  }

  async function handleResetPassword() {
    const tokenValue = state.route.token;
    if (!tokenValue) {
      state.tokenStatus = { tone: "error", text: "This reset link is missing its token." };
      scheduleRender();
      return;
    }
    if (state.tokenForm.password.length < 8) {
      state.tokenStatus = { tone: "error", text: "Password must be at least 8 characters." };
      scheduleRender();
      return;
    }
    if (state.tokenForm.password !== state.tokenForm.confirmPassword) {
      state.tokenStatus = { tone: "error", text: "Passwords do not match." };
      scheduleRender();
      return;
    }

    state.tokenStatus = null;
    state.tokenBusy = true;
    scheduleRender();

    try {
      const result = await resetPasswordRequest({
        token: tokenValue,
        password: state.tokenForm.password,
      });
      persistPendingToken("");
      persistSession("", null);
      state.tokenStatus = {
        tone: "success",
        text: result.message || "Password updated.",
      };
    } catch (error) {
      state.tokenStatus = {
        tone: "error",
        text: error.message || "Reset failed.",
      };
    } finally {
      state.tokenBusy = false;
      scheduleRender();
    }
  }

  async function resendVerification(email) {
    state.isResendingVerification = true;
    state.banner = null;
    scheduleRender();

    try {
      const result = await resendVerificationRequest({ email });
      state.banner = {
        tone: result.emailDelivery && result.emailDelivery.previewOnly ? "neutral" : "success",
        text: result.emailDelivery && result.emailDelivery.previewOnly
          ? previewMessage("Verification email prepared. Delivery is not configured yet, so use the preview link.", result.emailDelivery.error)
          : `${result.message || "Verification email sent."} If you do not see it soon, check spam or promotions for Verify your Energy AI email.`,
        previewUrl: result.emailDelivery && result.emailDelivery.previewOnly ? result.emailDelivery.previewUrl : "",
        previewLabel: "Open verification preview",
      };
    } catch (error) {
      state.banner = {
        tone: "error",
        text: error.message || "Could not resend verification email.",
      };
    } finally {
      state.isResendingVerification = false;
      scheduleRender();
    }
  }

  async function resendVerificationForTokenPage() {
    const emailValue = state.route.email || (state.user && state.user.email) || "";
    if (!emailValue) {
      return;
    }

    state.isResendingVerification = true;
    state.tokenStatus = null;
    scheduleRender();

    try {
      const result = await resendVerificationRequest({ email: emailValue });
      state.tokenStatus = {
        tone: result.emailDelivery && result.emailDelivery.previewOnly ? "neutral" : "success",
        text: result.emailDelivery && result.emailDelivery.previewOnly
          ? previewMessage("Verification link ready. Use the preview below.", result.emailDelivery.error)
          : (result.message || "Verification email sent."),
        previewUrl: result.emailDelivery && result.emailDelivery.previewOnly ? result.emailDelivery.previewUrl : "",
        previewLabel: "Open verification preview",
      };
    } catch (error) {
      state.tokenStatus = {
        tone: "error",
        text: error.message || "Could not resend verification email.",
      };
    } finally {
      state.isResendingVerification = false;
      scheduleRender();
    }
  }

  async function doLogout() {
    try {
      await logoutRequest();
    } catch (_error) {
      // Ignore logout failures.
    } finally {
      persistPendingToken("");
      persistSession("", null);
      navigate("home");
    }
  }

  async function loadAdminOverview({ silent = false } = {}) {
    if (!state.user || !state.user.isAdmin || state.isAdminLoading) {
      return;
    }

    if (!silent) {
      state.isAdminLoading = true;
      scheduleRender();
    }

    try {
      state.adminOverview = await fetchAdminOverview();
      state.adminError = "";
    } catch (error) {
      state.adminError = error.message || "Could not load admin overview.";
    } finally {
      if (!silent) {
        state.isAdminLoading = false;
      }
      scheduleRender();
    }
  }

  async function loadAnalyticsOverview({ silent = false } = {}) {
    if (!state.user || state.isAnalyticsLoading) {
      return;
    }

    if (!silent) {
      state.isAnalyticsLoading = true;
      scheduleRender();
    }

    try {
      state.analyticsOverview = await fetchAnalyticsOverview();
      state.analyticsError = "";
    } catch (error) {
      state.analyticsError = error.message || "Could not load analytics overview.";
    } finally {
      if (!silent) {
        state.isAnalyticsLoading = false;
      }
      scheduleRender();
    }
  }

  async function retrainAdmin() {
    state.isRetraining = true;
    scheduleRender();
    try {
      await triggerAdminRetrain();
      await loadAdminOverview({ silent: true });
      state.adminError = "";
    } catch (error) {
      state.adminError = error.message || "Could not start retraining.";
    } finally {
      state.isRetraining = false;
      scheduleRender();
    }
  }

  async function runAdminEvaluations() {
    state.isEvaluationRunning = true;
    scheduleRender();
    try {
      const result = await triggerAdminEvaluations();
      if (state.adminOverview) {
        state.adminOverview.evaluations = {
          latest: result.evaluation,
          recentRuns: [result.evaluation].concat(((state.adminOverview.evaluations && state.adminOverview.evaluations.recentRuns) || []).slice(0, 4)),
        };
      }
      await loadAdminOverview({ silent: true });
      await loadAnalyticsOverview({ silent: true });
      state.adminError = "";
    } catch (error) {
      state.adminError = error.message || "Could not run evaluations.";
    } finally {
      state.isEvaluationRunning = false;
      scheduleRender();
    }
  }

  function syncRouteState() {
    if (state.isBootstrapping) {
      return;
    }

    const page = state.route.page;
    if ((!state.token || !state.user) && (APP_ROUTES.has(page) || ADMIN_ROUTES.has(page))) {
      navigate("login");
      return;
    }

    if (state.user && !state.user.emailVerified && (APP_ROUTES.has(page) || ADMIN_ROUTES.has(page))) {
      navigate("verify-email", { email: state.user.email });
      return;
    }

    if (state.user && state.user.emailVerified && ADMIN_ROUTES.has(page) && !state.user.isAdmin) {
      navigate("home");
      return;
    }

    if (state.user && state.user.emailVerified && (page === "login" || page === "signup")) {
      navigate("chat");
      return;
    }

    if (state.token && state.user && state.user.emailVerified) {
      void loadChats();
    }

    if (page === "admin" && state.user && state.user.emailVerified && state.user.isAdmin && !state.adminOverview) {
      void loadAdminOverview();
    }

    if (page === "analytics" && state.user && state.user.emailVerified && !state.analyticsOverview) {
      void loadAnalyticsOverview();
    }

    if (page === "verify-email" && state.route.token) {
      void autoVerifyTokenIfNeeded();
    }
  }

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function previewMessage(baseText, error) {
    return error ? `${baseText} ${error}` : baseText;
  }

  function renderIcon(name, size, className) {
    const iconSize = Number(size) || 16;
    const iconClassName = className ? ` class="${escapeHtml(className)}"` : "";
    const pathByName = {
      menu: '<path d="M3 6h18M3 12h18M3 18h18"></path>',
      x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
      search: '<circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path>',
      "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>',
      "message-circle-plus": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path><path d="M12 8v6"></path><path d="M9 11h6"></path>',
      "bar-chart": '<path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20v-3"></path>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path>',
      user: '<path d="M18 20a6 6 0 0 0-12 0"></path><circle cx="12" cy="10" r="4"></circle><circle cx="12" cy="12" r="9"></circle>',
      home: '<path d="m3 10 9-7 9 7"></path><path d="M9 21V12h6v9"></path><path d="M21 21H3"></path>',
      shield: '<path d="M12 3 5 6v6c0 5 3.4 8.8 7 10 3.6-1.2 7-5 7-10V6Z"></path><path d="m9 12 2 2 4-4"></path>',
      sparkles: '<path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"></path><path d="M5 3v4"></path><path d="M3 5h4"></path><path d="M19 17v4"></path><path d="M17 19h4"></path>',
      leaf: '<path d="M6 20c9 0 12-6 12-14C10 6 6 10 6 20Z"></path><path d="M6 14c2 0 4 1 6 3"></path>',
      flame: '<path d="M12 3c1 3-2 4-2 7 0 2 1 3 2 4 1-1 2-2 2-4 0-2-1-3-1-5 3 1 5 4 5 8a7 7 0 1 1-14 0c0-3 2-6 5-8 0 2 1 3 1 5 0 2 1 3 2 4"></path>',
      clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
      "arrow-right": '<path d="M5 12h14"></path><path d="m13 5 7 7-7 7"></path>',
      "chevron-down": '<path d="m6 9 6 6 6-6"></path>',
      trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>',
    };
    const body = pathByName[name] || "";
    return `<svg${iconClassName} width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function listCommandActions() {
    const actions = [
      { id: "home", label: "Open Home", hint: "Go back to the landing page", shortcut: "H", icon: "home" },
      { id: "chat", label: "Open Chat", hint: "Jump into the workspace", shortcut: "C", icon: "message-circle" },
      { id: "analytics", label: "Open Analytics", hint: "Inspect usage and latency", shortcut: "A", icon: "bar-chart" },
    ];

    if (state.user && state.user.isAdmin) {
      actions.push({ id: "admin", label: "Open Admin", hint: "Training, health, and quality controls", shortcut: "D", icon: "shield" });
    }

    actions.push(
      { id: "new-chat", label: "New Session", hint: "Start a fresh conversation", shortcut: "N", icon: "message-circle-plus" },
      { id: "logout", label: "Logout", hint: "Sign out of Energy AI", shortcut: "L", icon: "logout" },
    );

    return actions;
  }

  async function runCommandAction(commandId) {
    state.isCommandPaletteOpen = false;
    state.commandPaletteQuery = "";
    patchCommandPaletteVisibility();

    switch (commandId) {
      case "home":
      case "chat":
      case "analytics":
      case "admin":
        navigate(commandId);
        return;
      case "new-chat":
        if (state.route.page !== "chat") {
          navigate("chat");
        }
        createChat();
        return;
      case "logout":
        await doLogout();
        return;
      default:
        return;
    }
  }

  function formatDate(timestamp) {
    try {
      return new Date(timestamp).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  function formatDateTime(timestamp) {
    if (!timestamp) {
      return "Not yet";
    }
    try {
      return new Date(timestamp).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "Unknown";
    }
  }

  function describeAttachmentSize(bytes) {
    const value = Number(bytes || 0);
    if (value >= 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (value >= 1024) {
      return `${Math.max(1, Math.round(value / 1024))} KB`;
    }
    return `${value} B`;
  }

  function extensionFromName(fileName) {
    const value = String(fileName || "").trim().toLowerCase();
    if (!value.includes(".")) {
      return value === "dockerfile" ? "dockerfile" : "";
    }
    return value.split(".").pop() || "";
  }

  function isTextLikeFile(file) {
    const mimeType = String(file && file.type || "").toLowerCase();
    const extension = extensionFromName(file && file.name);
    return mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("xml") || TEXT_EXTENSIONS.has(extension);
  }

  function detectLanguage(fileName) {
    const extension = extensionFromName(fileName);
    const byExtension = {
      js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx", py: "python", java: "java", kt: "kotlin", go: "go",
      rs: "rust", php: "php", rb: "ruby", swift: "swift", c: "c", h: "c", hpp: "cpp", cpp: "cpp", cs: "csharp",
      css: "css", scss: "scss", html: "html", xml: "xml", svg: "svg", sql: "sql", sh: "bash", bash: "bash",
      yml: "yaml", yaml: "yaml", json: "json", jsonl: "json", md: "markdown", markdown: "markdown", toml: "toml",
      env: "bash", log: "text", txt: "text", dockerfile: "dockerfile",
    };
    return byExtension[extension] || "text";
  }

  function trimAttachmentContent(content) {
    const normalized = String(content || "").replace(/\r\n/g, "\n");
    if (normalized.length <= MAX_ATTACHMENT_CHARS) {
      return { content: normalized, truncated: false };
    }
    return {
      content: `${normalized.slice(0, MAX_ATTACHMENT_CHARS)}\n\n[truncated]`,
      truncated: true,
    };
  }

  async function readAttachmentsFromFiles(fileList, currentAttachments) {
    const files = Array.from(fileList || []);
    const next = cloneAttachments(currentAttachments);
    const errors = [];

    for (const file of files) {
      if (next.length >= MAX_ATTACHMENTS) {
        errors.push(`Only ${MAX_ATTACHMENTS} attachments can be added at once.`);
        break;
      }

      if (!isTextLikeFile(file)) {
        errors.push(`${file.name} is not a supported code or text file.`);
        continue;
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        errors.push(`${file.name} is too large. Keep each file under ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB.`);
        continue;
      }

      try {
        const raw = await file.text();
        const trimmed = trimAttachmentContent(raw);
        next.push({
          id: randomId(),
          name: file.name,
          mimeType: file.type || "text/plain",
          size: file.size,
          language: detectLanguage(file.name),
          truncated: trimmed.truncated,
          content: trimmed.content,
        });
      } catch (_error) {
        errors.push(`Could not read ${file.name}. Try a different file.`);
      }
    }

    return { attachments: next, errors };
  }

  function energyKeyFromMeta(meta) {
    if (meta && (meta.energyMode === "auto" || meta.role === "router")) {
      return "auto";
    }
    if (meta && (meta.energyMode === "high" || meta.role === "deep")) {
      return "deep";
    }
    if (meta && (meta.energyMode === "low" || meta.role === "fast")) {
      return "fast";
    }
    const model = String(meta && meta.model || "").toLowerCase();
    if (model.includes("high") || model.includes("deep")) {
      return "deep";
    }
    if (model.includes("low") || model.includes("fast")) {
      return "fast";
    }
    return "auto";
  }

  function energyLabelFromMeta(meta) {
    return (MODE_BY_ID[energyKeyFromMeta(meta)] || MODE_BY_ID.auto).label;
  }

  function modelDisplayName(model) {
    const cleaned = String(model || "").replace(/-(mock|own)$/i, "").trim();
    if (!cleaned) {
      return "Unknown Model";
    }
    if (/router/i.test(cleaned)) {
      return "Energy Router";
    }
    if (/(high|deep)/i.test(cleaned)) {
      return "Energy AI High-Energy";
    }
    if (/(low|fast)/i.test(cleaned)) {
      return "Energy AI Low-Energy";
    }
    return cleaned.replace(/[-_]+/g, " ");
  }

  function workspaceModeLabel(id) {
    return (WORKSPACE_BY_ID[id] || WORKSPACE_BY_ID.general).label;
  }

  function chatErrorMessage(error) {
    if (error && error.status === 401) {
      return "Your session expired. Sign in again and resend the message.";
    }
    if (error && error.status === 403) {
      return "Verify your email before using chat.";
    }
    if (error && error.status === 507) {
      return "Storage is almost full, so this reply worked but the app could not save everything.";
    }
    if (error && error.message) {
      return error.message;
    }
    return "I could not reach the Energy AI backend. Start the server and confirm the provider settings.";
  }

  function syncErrorMessage(error, fallback) {
    if (error && error.status === 507) {
      return "Storage is almost full, so chat history is not being saved right now.";
    }
    if (error && error.message) {
      return error.message;
    }
    return fallback;
  }

  function parseContentSegments(content) {
    const text = String(content || "");
    const segments = [];
    const regex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
    let cursor = 0;
    let match = regex.exec(text);

    while (match) {
      if (match.index > cursor) {
        segments.push({ type: "text", value: text.slice(cursor, match.index) });
      }
      segments.push({ type: "code", language: match[1] || "text", value: match[2] || "" });
      cursor = match.index + match[0].length;
      match = regex.exec(text);
    }

    if (cursor < text.length) {
      segments.push({ type: "text", value: text.slice(cursor) });
    }

    return segments.length > 0 ? segments : [{ type: "text", value: text }];
  }

  function renderPreviewLink(status) {
    if (!status || !status.previewUrl) {
      return "";
    }
    return `<a href="${escapeHtml(status.previewUrl)}" class="energy-space-secondary mt-3 inline-flex px-4 py-2.5 text-sm">${escapeHtml(status.previewLabel || "Open preview")}</a>`;
  }

  function renderNotice(status) {
    if (!status) {
      return "";
    }
    const toneClass = status.tone === "error"
      ? "border-[#edc6bf] bg-[#fff1ed] text-[#9a4a3b]"
      : status.tone === "success"
        ? "border-[#cfe4d4] bg-[#eff8f0] text-[#2f6a47]"
        : "border-[#dddcc8] bg-[#fffaf0] text-[#7c6840]";

    return `<div class="rounded-[22px] border px-4 py-4 text-sm leading-7 ${toneClass}"><div>${escapeHtml(status.text || "")}</div>${renderPreviewLink(status)}</div>`;
  }

  function renderBanner(status) {
    if (!status) {
      return "";
    }
    const toneClass = status.tone === "error"
      ? "border-[#edc6bf] bg-[#fff1ed] text-[#9a4a3b]"
      : status.tone === "success"
        ? "border-[#cfe4d4] bg-[#eff8f0] text-[#2f6a47]"
        : "border-[#dddcc8] bg-[#fffaf0] text-[#7c6840]";

    return `<div class="energy-panel energy-sheen animate-page-in energy-js-banner flex flex-col gap-3 rounded-[28px] border px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between ${toneClass}"><div>${escapeHtml(status.text || "")}${renderPreviewLink(status)}</div></div>`;
  }

  function renderBrand(showSubtitle) {
    return `
      <div class="energy-brand-lockup">
        <img src="/static/api/energy-logo.svg" alt="Energy AI" />
        <div class="energy-brand-copy">
          <p class="energy-brand-copy-title font-display text-[#173324]">Energy AI</p>
          ${showSubtitle ? '<p class="energy-brand-copy-subtitle">Low-energy speed. High-energy depth.</p>' : ""}
        </div>
      </div>
    `;
  }

  function renderHomePage() {
    const isAuthenticated = Boolean(state.token && state.user);
    const actionPrimaryPage = isAuthenticated ? "chat" : "signup";
    const actionSecondaryPage = isAuthenticated ? "analytics" : "login";
    return `
      <main class="energy-home-page-clean energy-static-page relative min-h-screen overflow-hidden">
        <div class="energy-space-stars energy-space-layer energy-space-layer-stars opacity-95"></div>
        <div class="energy-space-nebula energy-space-layer energy-space-layer-nebula"></div>
        <div class="energy-home-haze energy-space-layer"></div>
        <div class="energy-home-depth-field energy-space-layer"></div>

        <section class="energy-home-shell energy-page-scroll relative mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-0 pb-6 pt-0 sm:px-6 sm:pb-8 sm:pt-4">
          <header class="energy-home-clean-nav animate-page-in flex flex-wrap items-center justify-between gap-4 rounded-none border-x-0 border-t-0 px-4 py-3 sm:rounded-[26px] sm:border sm:px-5">
            ${renderBrand(true)}
            <div class="energy-js-home-actions">
              ${isAuthenticated ? `<span class="energy-home-clean-badge justify-center">${escapeHtml(state.user && state.user.name || "Signed in")}</span>` : ""}
              ${isAuthenticated && state.user && state.user.isAdmin ? `<button type="button" data-nav="admin" class="energy-home-secondary-button">Admin</button>` : ""}
              <button type="button" data-nav="${escapeHtml(actionSecondaryPage)}" class="${isAuthenticated ? "energy-home-secondary-button" : "energy-home-secondary-button"}">${isAuthenticated ? "Analytics" : "Login"}</button>
              <button type="button" data-nav="${escapeHtml(actionPrimaryPage)}" class="energy-home-primary-button">${isAuthenticated ? "Open Workspace" : "Start Free"}</button>
            </div>
          </header>

          <section class="energy-home-hero-grid relative grid flex-1 items-center gap-10 overflow-hidden px-4 pb-10 pt-8 lg:grid-cols-[0.96fr_1.04fr] lg:gap-14">
            <div class="energy-home-copy max-w-2xl text-left">
              <div class="energy-home-clean-badge animate-rise">${renderIcon("sparkles", 14)}<span>One AI system. Three energy levels.</span></div>
              <h1 class="energy-home-hero-title mt-8 animate-rise energy-stagger-1 font-display text-[3.35rem] font-bold tracking-[-0.08em] text-[#10261d] sm:text-7xl lg:text-[6.15rem]">
                <span class="block">The right answer at the</span>
                <span class="block text-[#132b21]">right speed.</span>
              </h1>
              <p class="energy-home-hero-lead mt-6 max-w-xl animate-rise energy-stagger-2 text-base leading-8 text-[#5f7064] sm:text-[1.36rem]">
                Energy AI answers simple prompts in Low-Energy mode, switches to High-Energy mode for harder reasoning, and uses Auto Balance to decide when speed matters more than depth.
              </p>
              <div class="mt-10 energy-js-home-actions">
                <button type="button" data-nav="${escapeHtml(actionPrimaryPage)}" class="energy-home-primary-button">${isAuthenticated ? "Open Workspace" : "Start now"}${renderIcon("arrow-right", 16)}</button>
                <button type="button" data-nav="${escapeHtml(actionSecondaryPage)}" class="energy-home-secondary-button">${isAuthenticated ? "See Analytics" : "Sign in"}</button>
              </div>
              <div class="mt-8 flex animate-rise energy-stagger-4 flex-wrap gap-3">
                <span class="energy-home-mode-pill energy-home-mode-pill-fast">${renderIcon("leaf", 14)}<span>Low Energy</span></span>
                <span class="energy-home-mode-pill energy-home-mode-pill-auto">${renderIcon("clock", 14)}<span>Auto Balance</span></span>
                <span class="energy-home-mode-pill energy-home-mode-pill-deep">${renderIcon("flame", 14)}<span>High Energy</span></span>
              </div>
            </div>

            <div class="energy-home-clean-scene animate-page-in energy-stagger-2">
              <div class="energy-home-stage-wrap">
                <div class="energy-home-preview-stack energy-home-stage">
                  <div class="energy-home-preview-backdrop"></div>
                  <div class="energy-home-preview-backdrop energy-home-preview-backdrop-secondary"></div>
                  <div class="energy-home-preview-card">
                    <p class="energy-home-preview-kicker">Model preview</p>
                    <h2 class="energy-home-preview-title">Choose speed. Keep depth.</h2>
                    <div class="mt-5 space-y-3">
                      <article class="energy-home-preview-mode energy-home-preview-mode-fast">
                        <span class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dde6d9] bg-white/85 text-[#365b4a]">${renderIcon("leaf", 17)}</span>
                        <div>
                          <h3 class="text-[1.08rem] font-semibold tracking-[-0.03em] text-[#183124]">Low-Energy</h3>
                          <p class="mt-1 text-sm leading-7 text-[#627568]">Built for direct questions, short tasks, and faster response time.</p>
                        </div>
                      </article>
                      <article class="energy-home-preview-mode energy-home-preview-mode-auto">
                        <span class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dde6d9] bg-white/85 text-[#365b4a]">${renderIcon("clock", 17)}</span>
                        <div>
                          <h3 class="text-[1.08rem] font-semibold tracking-[-0.03em] text-[#183124]">Auto Balance</h3>
                          <p class="mt-1 text-sm leading-7 text-[#627568]">Routes the prompt automatically so easy work stays fast and hard work gets more thinking time.</p>
                        </div>
                      </article>
                      <article class="energy-home-preview-mode energy-home-preview-mode-deep">
                        <span class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dde6d9] bg-white/85 text-[#365b4a]">${renderIcon("flame", 17)}</span>
                        <div>
                          <h3 class="text-[1.08rem] font-semibold tracking-[-0.03em] text-[#183124]">High-Energy</h3>
                          <p class="mt-1 text-sm leading-7 text-[#627568]">Uses more reasoning time for coding, debugging, planning, architecture, and deeper analysis.</p>
                        </div>
                      </article>
                    </div>
                    <div class="energy-home-preview-footer">
                      <span>Energy AI</span>
                      <strong>Fast for the easy parts. Deep for the important parts.</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="energy-home-feature-grid grid gap-4 px-4 pb-8 md:grid-cols-3 md:px-0">
            <article class="group energy-home-clean-feature energy-home-clean-feature-fast"><div class="relative z-10"><span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d7dfd2] bg-white/80 text-[#294437] shadow-[0_18px_40px_-32px_rgba(18,38,29,0.42)] transition duration-300 group-hover:scale-105">${renderIcon("leaf", 18)}</span><h3 class="mt-4 font-display text-2xl font-bold tracking-[-0.04em] text-[#13291f]">Low Energy</h3><p class="mt-2 text-sm leading-7 text-[#516457]">Direct questions stay clean, fast, and immediate.</p></div></article>
            <article class="group energy-home-clean-feature energy-home-clean-feature-auto"><div class="relative z-10"><span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d7dfd2] bg-white/80 text-[#294437] shadow-[0_18px_40px_-32px_rgba(18,38,29,0.42)] transition duration-300 group-hover:scale-105">${renderIcon("clock", 18)}</span><h3 class="mt-4 font-display text-2xl font-bold tracking-[-0.04em] text-[#13291f]">Auto Balance</h3><p class="mt-2 text-sm leading-7 text-[#516457]">The router decides when to stay light and when to think longer.</p></div></article>
            <article class="group energy-home-clean-feature energy-home-clean-feature-deep"><div class="relative z-10"><span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d7dfd2] bg-white/80 text-[#294437] shadow-[0_18px_40px_-32px_rgba(18,38,29,0.42)] transition duration-300 group-hover:scale-105">${renderIcon("flame", 18)}</span><h3 class="mt-4 font-display text-2xl font-bold tracking-[-0.04em] text-[#13291f]">High Energy</h3><p class="mt-2 text-sm leading-7 text-[#516457]">Debugging and complex coding get the deeper pass.</p></div></article>
          </section>
        </section>
      </main>
    `;
  }

  function renderAuthPage(mode) {
    const copyMap = {
      login: { badge: "Access", title: "Enter Energy AI", description: "Fast routing, deep reasoning, and a cleaner workspace." },
      signup: { badge: "Sign up", title: "Create your workspace", description: "Start with a cleaner interface and adaptive reasoning." },
      "forgot-password": { badge: "Recovery", title: "Recover access", description: "Get back into your private Energy AI workspace." },
    };
    const copy = copyMap[mode] || copyMap.login;
    const isSignup = mode === "signup";
    const isForgot = mode === "forgot-password";
    const title = isSignup ? "Create account" : isForgot ? "Recover access" : "Sign in";
    const footer = isSignup
      ? `Already have an account? <button type="button" data-nav="login" class="energy-js-link-button font-semibold text-[#173324]">Login</button>`
      : isForgot
        ? `Remembered it? <button type="button" data-nav="login" class="energy-js-link-button font-semibold text-[#173324]">Back to login</button>`
        : `Need an account? <button type="button" data-nav="signup" class="energy-js-link-button font-semibold text-[#173324]">Create one</button>`;

    return `
      <main class="energy-home-page-clean energy-clean-shell energy-static-page relative min-h-screen overflow-hidden">
        <div class="energy-space-stars opacity-90"></div>
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute left-[10%] top-[14%] h-52 w-52 rounded-full bg-[#efcb81]/20 blur-3xl"></div>
          <div class="absolute right-[14%] top-[18%] h-64 w-64 rounded-full bg-[#bfd6bf]/16 blur-3xl"></div>
          <div class="absolute bottom-[12%] left-[24%] h-56 w-56 rounded-full bg-[#f0b98f]/14 blur-3xl"></div>
        </div>
        <section class="energy-page-scroll relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-5 sm:px-6">
          <div class="energy-auth-layout grid w-full gap-6 lg:grid-cols-[1.05fr_460px]">
            <div class="animate-page-in">
              <div class="energy-home-clean-nav inline-flex rounded-full px-4 py-2">${renderBrand(false)}</div>
              <div class="mt-8 max-w-3xl">
                <div class="energy-home-clean-badge">${escapeHtml(copy.badge)}</div>
                <h1 class="energy-auth-display-title mt-6 font-display text-4xl font-bold tracking-[-0.06em] text-[#13291f] sm:text-6xl">${escapeHtml(copy.title)}</h1>
                <p class="mt-4 text-base leading-8 text-[#5d7064] sm:text-lg">${escapeHtml(copy.description)}</p>
              </div>
              <div class="mt-10 flex flex-wrap gap-3">
                <span class="energy-home-mode-pill energy-home-mode-pill-fast">Low Energy</span>
                <span class="energy-home-mode-pill energy-home-mode-pill-auto">Auto Balance</span>
                <span class="energy-home-mode-pill energy-home-mode-pill-deep">High Energy</span>
              </div>
            </div>
            <div class="flex items-center justify-center">
              <div class="energy-auth-card animate-page-in w-full p-5 sm:p-6">
                <div class="relative z-10">
                  <p class="text-xs uppercase tracking-[0.28em] text-[#8a968c]">${isSignup ? "Sign up" : isForgot ? "Recovery" : "Login"}</p>
                  <h2 class="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-[#173324]">${escapeHtml(title)}</h2>
                  <p class="mt-3 text-sm leading-7 text-[#5d7064]">${isSignup ? "Create your private workspace." : isForgot ? "We will send a reset link." : "Continue to your workspace."}</p>
                  <form data-form="auth" data-mode="${escapeHtml(mode)}" class="mt-7 space-y-4">
                    ${isSignup ? `
                      <label class="block">
                        <span class="mb-2 block text-sm font-semibold text-[#355445]">Full name</span>
                        <input name="auth-name" type="text" value="${escapeHtml(state.authForm.name)}" placeholder="Your name" class="energy-auth-input" />
                      </label>
                    ` : ""}
                    <label class="block">
                      <span class="mb-2 block text-sm font-semibold text-[#355445]">Email</span>
                      <input name="auth-email" type="email" value="${escapeHtml(state.authForm.email)}" placeholder="you@example.com" class="energy-auth-input" />
                    </label>
                    ${!isForgot ? `
                      <label class="block">
                        <span class="mb-2 block text-sm font-semibold text-[#355445]">Password</span>
                        <input name="auth-password" type="password" value="${escapeHtml(state.authForm.password)}" placeholder="${isSignup ? "At least 8 characters" : "Your password"}" class="energy-auth-input" />
                      </label>
                    ` : ""}
                    ${renderNotice(state.authStatus)}
                    <button type="submit" class="energy-home-primary-button w-full justify-center">${isSignup ? "Create account" : isForgot ? "Send reset link" : "Sign in"}</button>
                    ${!isForgot && !isSignup ? `<button type="button" data-nav="forgot-password" class="w-full text-sm font-semibold text-[#5d7064] transition hover:text-[#173324]">Forgot password?</button>` : ""}
                  </form>
                  <div class="mt-6 border-t border-[#dde5da] pt-4 text-sm text-[#617469]">${footer}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    `;
  }

  function renderTokenPage(mode) {
    const emailValue = state.route.email || (state.user && state.user.email) || "";
    if (mode === "verify-email") {
      return `
        <main class="energy-home-page-clean energy-clean-shell energy-static-page relative min-h-screen overflow-hidden">
          <div class="energy-space-stars opacity-90"></div>
          <section class="energy-page-scroll relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-5 sm:px-6">
            <div class="energy-auth-layout grid w-full gap-6 lg:grid-cols-[1.05fr_460px]">
              <div class="animate-page-in">
                <div class="energy-home-clean-nav inline-flex rounded-full px-4 py-2">${renderBrand(false)}</div>
              </div>
              <div class="flex items-center justify-center">
                <div class="energy-auth-card animate-page-in w-full p-5 sm:p-6">
                  <div class="relative z-10">
                    <p class="text-xs uppercase tracking-[0.28em] text-[#8a968c]">Verification</p>
                    <h2 class="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-[#173324]">${state.route.token ? "Confirming email" : "Check your inbox"}</h2>
                    <p class="mt-3 text-sm leading-7 text-[#5d7064]">${state.route.token ? "Validating your verification link." : emailValue ? `Use the link sent to ${escapeHtml(emailValue)}.` : "Open the newest link from your inbox."}</p>
                    <div class="mt-7 space-y-4">
                      ${state.tokenBusy ? `<div class="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3 text-sm text-[#5d7064]">Verifying email</div>` : ""}
                      ${renderNotice(state.tokenStatus)}
                      <div class="flex flex-col gap-3 sm:flex-row">
                        ${state.tokenStatus && state.tokenStatus.tone === "success" ? `<button type="button" data-nav="login" data-email="${escapeHtml(emailValue)}" class="energy-home-primary-button">Sign in</button>` : ""}
                        ${emailValue ? `<button type="button" data-action="token-resend" class="energy-home-secondary-button">${state.isResendingVerification ? "Resending..." : "Resend"}</button>` : ""}
                      </div>
                      <div class="mt-6 border-t border-[#dde5da] pt-4 text-sm text-[#617469]">
                        Need to sign in first? <button type="button" data-nav="login" class="energy-js-link-button font-semibold text-[#173324]">Go to login</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      `;
    }

    return `
      <main class="energy-home-page-clean energy-clean-shell energy-static-page relative min-h-screen overflow-hidden">
        <div class="energy-space-stars opacity-90"></div>
        <section class="energy-page-scroll relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-5 sm:px-6">
          <div class="energy-auth-layout grid w-full gap-6 lg:grid-cols-[1.05fr_460px]">
            <div class="animate-page-in">
              <div class="energy-home-clean-nav inline-flex rounded-full px-4 py-2">${renderBrand(false)}</div>
            </div>
            <div class="flex items-center justify-center">
              <div class="energy-auth-card animate-page-in w-full p-5 sm:p-6">
                <div class="relative z-10">
                  <p class="text-xs uppercase tracking-[0.28em] text-[#8a968c]">Reset password</p>
                  <h2 class="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-[#173324]">Choose a new password</h2>
                  <p class="mt-3 text-sm leading-7 text-[#5d7064]">Set a new password and continue to the workspace.</p>
                  <form data-form="reset-password" class="mt-7 space-y-4">
                    <label class="block">
                      <span class="mb-2 block text-sm font-semibold text-[#355445]">New password</span>
                      <input name="token-password" type="password" value="${escapeHtml(state.tokenForm.password)}" placeholder="At least 8 characters" class="energy-auth-input" />
                    </label>
                    <label class="block">
                      <span class="mb-2 block text-sm font-semibold text-[#355445]">Confirm password</span>
                      <input name="token-confirm-password" type="password" value="${escapeHtml(state.tokenForm.confirmPassword)}" placeholder="Repeat the password" class="energy-auth-input" />
                    </label>
                    ${renderNotice(state.tokenStatus)}
                    ${state.tokenStatus && state.tokenStatus.tone === "success" ? `<button type="button" data-nav="login" data-email="${escapeHtml(emailValue)}" class="energy-home-secondary-button w-full justify-center">Sign in</button>` : ""}
                    <button type="submit" class="energy-home-primary-button w-full justify-center">${state.tokenBusy ? "Saving..." : "Save password"}</button>
                  </form>
                  <div class="mt-6 border-t border-[#dde5da] pt-4 text-sm text-[#617469]">
                    Back to account access? <button type="button" data-nav="login" class="energy-js-link-button font-semibold text-[#173324]">Login</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    `;
  }

  function renderSidebar(drawerMode) {
    const useDrawerMode = Boolean(drawerMode);
    return `
      <aside class="energy-sidebar-shell energy-panel energy-sheen animate-page-in flex min-h-0 w-full flex-col p-2.5 sm:p-4 lg:h-full ${useDrawerMode ? "rounded-[26px] border-[#d6ddd0] bg-[linear-gradient(180deg,rgba(255,251,245,0.94)_0%,rgba(249,244,235,0.92)_52%,rgba(245,239,229,0.9)_100%)] shadow-[0_28px_70px_-50px_rgba(31,47,37,0.22)]" : ""}">
        <div class="absolute right-5 top-5 h-24 w-24 rounded-full bg-[#c9dbc7]/20 blur-2xl animate-float ${useDrawerMode ? "block" : "hidden sm:block"}"></div>
        <div class="absolute left-6 top-24 h-20 w-20 rounded-full bg-[#efd29f]/16 blur-2xl animate-float-wide ${useDrawerMode ? "block" : "hidden sm:block"}"></div>
        <button type="button" data-action="new-chat" class="energy-sidebar-new-button energy-home-primary-button energy-sheen relative mb-3 w-full rounded-[20px] py-2.5 text-sm sm:mb-4 sm:rounded-[22px] sm:py-3">
          ${renderIcon("message-circle-plus", 16)}
          <span>New Session</span>
        </button>
        <div class="mb-3 items-center justify-between rounded-[20px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.9)_100%)] px-3 py-2.5 ${useDrawerMode ? "hidden" : "flex sm:hidden"}">
          <div>
            <p class="text-[10px] uppercase tracking-[0.22em] text-[#8a968c]">Energy Memory</p>
            ${state.user ? `<p class="mt-1 max-w-[13rem] truncate text-xs text-[#68786d]">${escapeHtml(state.user.email)}</p>` : ""}
          </div>
          <div class="text-right">
            <p class="text-[10px] uppercase tracking-[0.22em] text-[#8a968c]">Threads</p>
            <p class="mt-1 text-sm font-semibold text-[#173324]">${state.sessions.length}</p>
          </div>
        </div>
        <div class="energy-sidebar-meta relative mb-3 rounded-[24px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.96)_0%,rgba(248,244,234,0.92)_52%,rgba(243,238,228,0.88)_100%)] p-3.5 shadow-[0_28px_70px_-50px_rgba(31,47,37,0.22)] ${useDrawerMode ? "block" : "hidden sm:block"}">
          <p class="energy-eyebrow">Energy Memory</p>
          ${state.user ? `<p class="mt-1.5 text-xs text-[#68786d]">${escapeHtml(state.user.email)}</p>` : ""}
          <div class="mt-3 grid grid-cols-2 gap-2.5">
            <div class="rounded-2xl border border-[#dce4d8] bg-white/72 p-2.5">
              <p class="text-xs uppercase tracking-[0.22em] text-[#8a968c]">Threads</p>
              <p class="mt-1.5 font-display text-xl font-bold tracking-[-0.04em] text-[#173324]">${state.sessions.length}</p>
            </div>
            <div class="rounded-2xl border border-[#dce4d8] bg-white/72 p-2.5">
              <p class="text-xs uppercase tracking-[0.22em] text-[#8a968c]">Flow</p>
              <p class="mt-1.5 text-sm font-semibold text-[#48725b]">Adaptive routing</p>
            </div>
          </div>
        </div>
        <div class="mb-2 flex items-center justify-between px-1 sm:mb-2.5">
          <span class="energy-eyebrow">Conversation stack</span>
          <span class="text-xs text-[#8a968c]">${state.sessions.length} total</span>
        </div>
        <div class="scrollbar-hide flex min-h-0 gap-2.5 overflow-auto pr-1 ${useDrawerMode ? "flex-1 flex-col pb-0" : "flex-1 flex-col pb-1 sm:pb-0"}">
          ${state.sessions.map((session, index) => {
            const selected = session.id === state.activeSessionId;
            return `
              <div class="energy-session-card group animate-rise shrink-0 rounded-[18px] border p-2.5 transition duration-300 sm:rounded-[22px] ${useDrawerMode ? "min-w-0" : "min-w-[210px] sm:min-w-0"} ${selected ? "border-[#b7d1bc] bg-[linear-gradient(135deg,rgba(241,250,242,0.96)_0%,rgba(226,244,233,0.92)_54%,rgba(248,245,236,0.94)_100%)] shadow-[0_28px_70px_-54px_rgba(31,47,37,0.2)]" : "border-[#dce4d8] bg-[linear-gradient(135deg,rgba(255,252,246,0.92)_0%,rgba(248,244,234,0.88)_100%)] hover:-translate-y-0.5 hover:border-[#a6c4ac]"}" style="animation-delay:${Math.min(index * 50, 240)}ms">
                <button type="button" data-session-id="${escapeHtml(session.id)}" class="w-full text-left">
                  <div class="text-xs uppercase tracking-[0.22em] text-[#8a968c]">${selected ? "Active" : "Session"}</div>
                  <div class="mt-1.5 max-h-10 overflow-hidden text-ellipsis text-sm font-semibold leading-5 text-[#173324] sm:max-h-12">${escapeHtml(session.title)}</div>
                </button>
                <div class="mt-2.5 flex items-center justify-between text-[11px] text-[#8a968c]">
                  <span>${escapeHtml(formatDate(session.updatedAt))}</span>
                  <button type="button" data-action="remove-chat" data-chat-id="${escapeHtml(session.id)}" class="rounded-xl p-1.5 text-[#8a968c] transition hover:bg-[#fff2ee] hover:text-[#cb6d60] ${useDrawerMode ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}">${renderIcon("trash", 13)}</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </aside>
    `;
  }

  function renderAttachmentsList(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return "";
    }
    return `
      <div class="mt-2.5 flex flex-wrap gap-2">
        ${attachments.map((attachment) => `
          <span class="inline-flex max-w-full items-center gap-2 rounded-[14px] border border-[#d6ddd0] bg-white/72 px-3 py-1.5 text-[11px] text-[#173324]">
            <span class="min-w-0">
              <span class="block truncate font-semibold">${escapeHtml(attachment.name)}</span>
              <span class="block text-[11px] text-[#7d8d7e]">${escapeHtml(attachment.language || "text")} · ${escapeHtml(describeAttachmentSize(attachment.size))}</span>
            </span>
          </span>
        `).join("")}
      </div>
    `;
  }

  function renderSources(sources) {
    if (!Array.isArray(sources) || sources.length === 0) {
      return "";
    }
    return `
      <div class="mt-3 flex flex-wrap gap-2">
        ${sources.map((source, index) => `
          <a href="${escapeHtml(source.url || "#")}" target="_blank" rel="noreferrer" class="energy-chip border-[#d6ddd0] bg-white/72 text-[#5b6f65] transition hover:-translate-y-0.5 hover:bg-white/88">${escapeHtml(source.title || `Source ${index + 1}`)}</a>
        `).join("")}
      </div>
    `;
  }

  function renderMessageContent(content) {
    return parseContentSegments(content).map((segment) => {
      if (segment.type === "code") {
        return `
          <div class="energy-js-code-block">
            <div class="energy-js-code-head"><span>${escapeHtml(segment.language)}</span></div>
            <pre class="energy-js-code-body"><code>${escapeHtml(segment.value)}</code></pre>
          </div>
        `;
      }
      if (!String(segment.value || "").trim()) {
        return "";
      }
      return `<div class="whitespace-pre-wrap leading-7">${escapeHtml(segment.value)}</div>`;
    }).join("");
  }

  function renderModelChip(meta) {
    if (!meta || !meta.model || meta.model === "bootstrap") {
      return "";
    }
    const energyKey = energyKeyFromMeta(meta);
    const energyOption = MODE_BY_ID[energyKey] || MODE_BY_ID.auto;
    const visibleLatencyMs = Number(meta.firstTokenLatencyMs || meta.startLatencyMs || meta.latencyMs || 0);
    return `
      <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[#8a968c]">
        <span class="energy-chip border-[#d6ddd0] bg-white/72 text-[#5b6f65]">${escapeHtml(modelDisplayName(meta.model))}</span>
        <span class="energy-chip ${energyOption.chipClass}">${escapeHtml(energyLabelFromMeta(meta))}</span>
        ${meta.workspaceMode && meta.workspaceMode !== "general" ? `<span class="energy-chip border-[#d6ddd0] bg-white/72 text-[#7c6840]">${escapeHtml(workspaceModeLabel(meta.workspaceMode))}</span>` : ""}
        ${visibleLatencyMs ? `<span class="energy-chip border-[#d6ddd0] bg-white/72 text-[#7d8d7e]">${visibleLatencyMs} ms</span>` : ""}
        ${meta.energyScore ? `<span class="energy-chip border-[#d6ddd0] bg-white/72 text-[#7d8d7e]">energy ${escapeHtml(meta.energyScore)}</span>` : ""}
      </div>
    `;
  }

  function renderMessage(message, isLatestAssistant, options = {}) {
    const fromUser = message.role === "user";
    const energyKey = energyKeyFromMeta(message.meta || {});
    const animationClass = options.disableAnimation ? "" : "animate-rise ";
    const bubbleClass = fromUser
      ? "ml-auto max-w-[94%] border-[#c9ddcb] bg-[linear-gradient(135deg,rgba(236,248,238,0.98)_0%,rgba(223,241,227,0.96)_54%,rgba(214,235,219,0.92)_100%)] text-[#173324] shadow-[0_28px_70px_-54px_rgba(31,47,37,0.16)] sm:max-w-[82%]"
      : energyKey === "deep"
        ? "mr-auto max-w-[96%] border-[#edd8d1] bg-[linear-gradient(135deg,rgba(255,246,241,0.98)_0%,rgba(250,238,233,0.95)_52%,rgba(247,243,237,0.92)_100%)] text-[#173324] shadow-[0_28px_72px_-54px_rgba(31,47,37,0.16)] sm:max-w-[86%]"
        : "mr-auto max-w-[96%] border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.98)_0%,rgba(248,244,234,0.95)_54%,rgba(244,239,228,0.92)_100%)] text-[#173324] shadow-[0_28px_72px_-54px_rgba(31,47,37,0.14)] sm:max-w-[86%]";

    return `
      <article data-message-id="${escapeHtml(message.id)}" class="energy-js-message-card ${animationClass}relative overflow-hidden rounded-[22px] border px-3 py-3 transition duration-300 hover:-translate-y-0.5 sm:rounded-[26px] sm:px-3.5 sm:py-3.5 ${bubbleClass}">
        <div class="mb-2 flex items-start justify-between gap-3 sm:mb-2.5">
          <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${fromUser ? "text-[#5f7967]" : "text-[#8a968c]"}">${fromUser ? "You" : "Energy AI"}</div>
        </div>
        ${fromUser ? renderAttachmentsList(message.meta && message.meta.attachments) : ""}
        <div class="space-y-1.5">${renderMessageContent(message.content || "...")}</div>
        ${!fromUser ? renderModelChip(message.meta || {}) : ""}
        ${!fromUser && message.meta && message.meta.routeReason ? `<p class="mt-2.5 text-[11px] leading-5 text-[#7d8d7e]">${escapeHtml(message.meta.routeReason)}</p>` : ""}
        ${!fromUser && message.meta && message.meta.stopped ? `<div class="mt-2.5"><span class="energy-chip border-[#d6ddd0] bg-white/72 text-[#7d8d7e]">Stopped early</span></div>` : ""}
        ${!fromUser ? renderSources(message.meta && message.meta.sources) : ""}
        <div class="energy-js-message-actions">
          ${fromUser ? `
            <button type="button" data-action="copy-message" data-message-id="${escapeHtml(message.id)}" class="energy-js-action-button">${state.copiedMessageId === message.id ? "Copied" : "Copy"}</button>
          ` : `
            <button type="button" data-action="copy-message" data-message-id="${escapeHtml(message.id)}" class="energy-js-action-button">${state.copiedMessageId === message.id ? "Copied" : "Copy"}</button>
            ${isLatestAssistant ? `<button type="button" data-action="regenerate" class="energy-js-action-button">Regenerate</button>` : ""}
            <button type="button" data-action="feedback-up" data-message-id="${escapeHtml(message.id)}" class="energy-js-action-button ${message.meta && message.meta.feedback === "up" ? "is-active" : ""}">Helpful</button>
            <button type="button" data-action="feedback-down" data-message-id="${escapeHtml(message.id)}" class="energy-js-action-button ${message.meta && message.meta.feedback === "down" ? "is-active" : ""}">Needs work</button>
          `}
        </div>
      </article>
    `;
  }

  function renderChatMessages(session, isLoading, options = {}) {
    const messages = session ? session.messages : [];
    const lastAssistantIndex = [...messages].map((message) => message.role).lastIndexOf("assistant");

    return `
      <div class="space-y-2 sm:space-y-3">
        ${messages.length === 0 ? `
          <div class="flex min-h-[160px] items-center justify-center px-0 py-2 sm:min-h-[220px] sm:px-2 sm:py-4">
            <div class="energy-js-empty-state w-full max-w-2xl rounded-[22px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.9)_56%,rgba(244,239,228,0.9)_100%)] p-4 text-center shadow-[0_30px_80px_-58px_rgba(31,47,37,0.22)] sm:rounded-[26px] sm:p-5">
              <div class="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#d6ddd0] bg-white/72 text-[#173324] sm:h-12 sm:w-12 sm:rounded-[20px]">
                ${renderIcon("sparkles", 22)}
              </div>
              <h3 class="mt-3 font-display text-base font-bold tracking-[-0.04em] text-[#173324] sm:text-xl">Start the next thread</h3>
              <p class="mt-2 text-sm leading-6 text-[#68786d] sm:leading-6">Ask a coding question, attach files, or hand the assistant a hard debugging task with real context.</p>
            </div>
          </div>
        ` : ""}
        ${messages.map((message, index) => renderMessage(message, index === lastAssistantIndex, options)).join("")}
        ${isLoading ? `
          <div class="py-3 text-center text-xs uppercase tracking-[0.24em] text-[#8a968c]">
            <span class="inline-flex items-center gap-2 rounded-full border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.88)_100%)] px-4 py-2 font-semibold text-[#5b6f65] shadow-[0_20px_48px_-40px_rgba(31,47,37,0.18)]">
              <span class="inline-flex h-2 w-2 rounded-full bg-[#4e8b67] animate-blink"></span>
              Generating
            </span>
          </div>
        ` : ""}
        <div id="chat-scroll-end"></div>
      </div>
    `;
  }

  function renderChatWindow() {
    const session = currentSession();
    const messages = session ? session.messages : [];

    return `
      <section class="energy-js-chat-window energy-chat-shell energy-panel energy-sheen animate-page-in relative flex min-h-0 flex-col rounded-none border-x-0 border-t-0 bg-[linear-gradient(180deg,rgba(251,248,241,0.98)_0%,rgba(246,241,232,0.96)_100%)] px-2 pb-1 pt-2 shadow-none sm:min-h-[280px] sm:rounded-[24px] sm:border sm:bg-[linear-gradient(160deg,rgba(255,252,246,0.9)_0%,rgba(248,244,234,0.86)_56%,rgba(243,238,228,0.84)_100%)] sm:p-2.5 sm:shadow-[0_28px_72px_-52px_rgba(31,47,37,0.24)] lg:max-h-[calc(100vh-15.6rem)]">
        <div class="absolute right-10 top-12 hidden h-28 w-28 rounded-full bg-[#c8dcc9]/18 blur-3xl sm:block"></div>
        <div class="absolute bottom-10 left-8 hidden h-24 w-24 rounded-full bg-[#efd6ae]/16 blur-3xl sm:block"></div>
        <div class="absolute right-[24%] top-[22%] hidden h-24 w-24 rounded-full bg-[#f1bda6]/12 blur-3xl animate-float-wide sm:block"></div>
        <header class="energy-chat-toolbar mb-2 hidden flex-col gap-1.5 rounded-[20px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.92)_48%,rgba(244,239,228,0.9)_100%)] px-3 py-2 shadow-[0_22px_58px_-44px_rgba(31,47,37,0.2)] sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2.5">
            <span class="energy-chat-toolbar-icon inline-flex h-8 w-8 items-center justify-center rounded-[18px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(216,231,216,0.88)_0%,rgba(247,239,223,0.72)_100%)] text-[#173324] shadow-[0_14px_34px_-22px_rgba(31,47,37,0.2)]">
              ${renderIcon("sparkles", 15)}
            </span>
            <div>
              <div class="energy-chip w-fit border-[#d6ddd0] bg-white/72 px-2.5 py-1 text-[10px] text-[#7d8d7e]">
                ${renderIcon("sparkles", 12)}
                <span>Live workspace</span>
              </div>
              <h2 class="energy-chat-title mt-1 font-display text-base font-bold tracking-[-0.05em] text-[#173324] sm:text-[1.18rem]">${state.user ? `${escapeHtml(state.user.name)}'s chat` : "Reasoning chat"}</h2>
              <p class="energy-chat-subtitle mt-0.5 text-[10px] leading-4 text-[#68786d] sm:text-[11px]">Messages stay visible while routing works in the background.</p>
            </div>
          </div>
          <div class="energy-chat-toolbar-chips flex flex-wrap items-center gap-1.5">
            ${state.workspaceMode && state.workspaceMode !== "general" ? `<span class="energy-chip border-[#d9ddd4] bg-white/76 px-2.5 py-1 text-[10px] text-[#6f6c55]">${escapeHtml(workspaceModeLabel(state.workspaceMode))}</span>` : ""}
            <span class="energy-chip border-[#cde0d0] bg-[#f4faf5] px-2.5 py-1 text-[10px] text-[#48725b]">${renderIcon("leaf", 13)}<span>energy-low-own-v1</span></span>
            <span class="energy-chip border-[#eed4ca] bg-[#fff4ee] px-2.5 py-1 text-[10px] text-[#bb5f58]">${renderIcon("flame", 13)}<span>energy-high-own-v1</span></span>
            <span class="energy-chip border-[#d6ddd0] bg-white/72 px-2.5 py-1 text-[10px] text-[#7d8d7e]">${messages.length} msgs</span>
          </div>
        </header>
        <div class="energy-js-scroll-region scrollbar-hide min-h-0 flex-1 overflow-auto px-0 pb-2 sm:px-0 sm:pb-1">
          <div class="energy-js-message-stack">${renderChatMessages(session, state.isLoading)}</div>
        </div>
        <button type="button" data-action="scroll-to-latest" class="energy-js-scroll-latest absolute bottom-4 right-4 hidden h-11 w-11 items-center justify-center rounded-full border border-[#d6ddd0] bg-[rgba(255,252,246,0.94)] text-[#173324] shadow-[0_18px_44px_-26px_rgba(31,47,37,0.18)] transition hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.98)]" aria-label="Scroll to latest message">
          ${renderIcon("chevron-down", 18)}
        </button>
      </section>
    `;
  }

  function renderComposer() {
    return `
      <form data-form="composer" class="energy-js-composer-form energy-chat-composer energy-panel energy-sheen animate-page-in rounded-none border-x-0 border-b-0 border-t border-[#d6ddd0] bg-[linear-gradient(180deg,rgba(251,248,241,0.98)_0%,rgba(246,241,232,0.96)_100%)] p-2 shadow-[0_-18px_52px_-40px_rgba(31,47,37,0.18)] sm:rounded-[24px] sm:border sm:bg-[linear-gradient(160deg,rgba(255,252,246,0.9)_0%,rgba(248,244,234,0.86)_56%,rgba(243,238,228,0.84)_100%)] sm:p-2.5">
        <div class="mb-2 rounded-[18px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.92)_0%,rgba(248,244,234,0.88)_100%)] p-2">
          <div class="energy-js-composer-toolbar">
            <div class="flex items-center gap-2">
              <span class="energy-chip border-[#d6ddd0] bg-white/72 px-2.5 py-1 text-[10px] text-[#7d8d7e]">Route</span>
              <span class="hidden text-[10px] text-[#7d8d7e] sm:inline">Auto-detects review, bug-fix, tests, security, and more from your prompt.</span>
            </div>
            <div class="energy-js-toolbar-buttons">
              <input type="file" name="composer-files" class="energy-hidden-file-input" multiple />
              <button type="button" data-action="open-file-picker" class="inline-flex items-center gap-2 rounded-[14px] border border-[#d6ddd0] bg-white/72 px-3 py-1.5 text-[10px] font-semibold text-[#173324] transition hover:bg-white/88">Attach</button>
            </div>
          </div>
          <div class="energy-js-mode-stack mt-2">
            ${ENERGY_MODE_OPTIONS.map((option) => `
              <button type="button" data-action="set-mode" data-mode="${escapeHtml(option.id)}" class="min-w-[104px] shrink-0 rounded-[15px] border px-3 py-1.5 text-left transition duration-300 hover:border-[#cad8cd] ${state.activeMode === option.id ? option.activeClass : option.idleClass}">
                <span class="block text-[11px] font-semibold">${escapeHtml(option.label)}</span>
                <span class="mt-0.5 block text-[8px] uppercase tracking-[0.16em] opacity-80">${escapeHtml(option.hint)}</span>
              </button>
            `).join("")}
          </div>
          <div class="energy-js-mode-stack mt-2">
            ${WORKSPACE_MODE_OPTIONS.map((option) => `
              <button type="button" data-action="set-workspace" data-workspace="${escapeHtml(option.id)}" class="shrink-0 rounded-full border px-3 py-1 text-left transition ${state.workspaceMode === option.id ? "border-[#b9d1bd] bg-[linear-gradient(135deg,rgba(238,248,239,0.94)_0%,rgba(247,241,228,0.88)_100%)] text-[#173324] shadow-[0_16px_36px_-24px_rgba(31,47,37,0.16)]" : "border-[#d6ddd0] bg-white/72 text-[#5b6f65] hover:bg-white/88"}">
                <span class="block text-[10px] font-semibold">${escapeHtml(option.label)}</span>
                <span class="mt-0.5 block text-[8px] uppercase tracking-[0.14em] text-[#8a968c]">${escapeHtml(option.hint)}</span>
              </button>
            `).join("")}
          </div>
        </div>
        ${(state.attachments.length > 0 || state.attachmentError) ? `
          <div class="mb-2 rounded-[16px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.9)_100%)] p-2">
            ${state.attachments.length ? `
              <div class="flex flex-wrap gap-2">
                ${state.attachments.map((attachment) => `
                  <span class="inline-flex max-w-full items-center gap-2 rounded-[14px] border border-[#d6ddd0] bg-white/72 px-3 py-1.5 text-left text-[10px] text-[#173324]">
                    <span class="min-w-0">
                      <span class="block truncate font-semibold">${escapeHtml(attachment.name)}</span>
                      <span class="block text-[9px] text-[#7d8d7e]">${escapeHtml(attachment.language)} · ${escapeHtml(describeAttachmentSize(attachment.size))}</span>
                    </span>
                    <button type="button" data-action="remove-attachment" data-attachment-id="${escapeHtml(attachment.id)}" class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#d6ddd0] bg-white/82 text-[#5b6f65] transition hover:bg-white">x</button>
                  </span>
                `).join("")}
              </div>
            ` : ""}
            ${state.attachmentError ? `<p class="mt-2 text-[10px] text-[#fca5a5]">${escapeHtml(state.attachmentError)}</p>` : ""}
          </div>
        ` : ""}
        <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <textarea name="composer-draft" rows="3" placeholder="Ask anything. Energy AI will stay fast when it can and go deeper when the work demands it." class="energy-chat-textarea energy-input h-[74px] resize-none rounded-[20px] border-[#d6ddd0] bg-white/82 px-4 py-3 text-sm leading-6 text-[#173324] placeholder:text-[#8a968c] sm:h-[92px] sm:rounded-[24px] sm:px-4 sm:py-3">${escapeHtml(state.draft)}</textarea>
          <button type="${state.isLoading ? "button" : "submit"}" data-action="${state.isLoading ? "stop-generation" : ""}" class="energy-home-primary-button energy-sheen min-h-[46px] w-full rounded-[18px] px-5 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[52px] sm:w-auto sm:rounded-[20px] sm:px-5">
            <span>${state.isLoading ? "Stop" : "Send"}</span>
          </button>
        </div>
      </form>
    `;
  }

  function summarizeMessages(sessions) {
    const assistantMessages = sessions
      .flatMap((session) => session.messages || [])
      .filter((message) => message.role === "assistant" && message.meta && message.meta.model && message.meta.model !== "bootstrap");

    const modelCounts = new Map();
    let lowEnergyResponses = 0;
    let highEnergyResponses = 0;
    let totalEstimatedWh = 0;

    assistantMessages.forEach((message) => {
      const energyKey = energyKeyFromMeta(message.meta || {});
      const label = modelDisplayName(message.meta.model);
      const estimatedWh = estimateResponseWh(message.meta || {});
      const current = modelCounts.get(label) || { label, count: 0, energyKey, estimatedWh: 0 };
      current.count += 1;
      current.estimatedWh += estimatedWh;
      current.energyKey = current.energyKey === "auto" ? energyKey : current.energyKey;
      modelCounts.set(label, current);
      if (energyKey === "fast") {
        lowEnergyResponses += 1;
      }
      if (energyKey === "deep") {
        highEnergyResponses += 1;
      }
      totalEstimatedWh += estimatedWh;
    });

    const usageBars = [...modelCounts.values()].sort((left, right) => right.count - left.count);
    const avgEnergyPerResponseWh = assistantMessages.length ? totalEstimatedWh / assistantMessages.length : 0;
    const benchmarkComparisons = EXTERNAL_BENCHMARKS.map((benchmark) => {
      const totalWh = assistantMessages.length * benchmark.whPerResponse;
      const deltaPct = totalWh > 0 ? clamp(Math.round((1 - totalEstimatedWh / totalWh) * 100), -999, 99) : 0;
      return {
        ...benchmark,
        totalWh,
        deltaPct,
      };
    });

    return {
      totalAssistantResponses: assistantMessages.length,
      lowEnergyResponses,
      highEnergyResponses,
      usageBars,
      totalEstimatedWh,
      avgEnergyPerResponseWh,
      benchmarkComparisons,
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function estimateResponseWh(meta) {
    const energyKey = energyKeyFromMeta(meta);
    const profiles = {
      fast: { baseWh: 0.05, referenceLatencyMs: 450 },
      deep: { baseWh: 0.18, referenceLatencyMs: 1500 },
      auto: { baseWh: 0.09, referenceLatencyMs: 850 },
    };
    const profile = profiles[energyKey] || profiles.auto;
    const latencyMs = Number(meta.latencyMs || 0) || profile.referenceLatencyMs;
    const latencyFactor = clamp(latencyMs / profile.referenceLatencyMs, 0.65, 1.75);
    const energyScoreFactor = meta.energyScore === "D" ? 1.2 : meta.energyScore === "C" ? 1.08 : meta.energyScore === "B" ? 1 : 0.92;
    return Number((profile.baseWh * latencyFactor * energyScoreFactor).toFixed(4));
  }

  function formatEnergy(wh) {
    if (!Number.isFinite(wh) || wh <= 0) {
      return "0 mWh";
    }
    if (wh < 1) {
      return `${Math.round(wh * 1000)} mWh`;
    }
    return `${wh.toFixed(2)} Wh`;
  }

  function renderBenchmarkComparison(summary) {
    if (!summary.totalAssistantResponses) {
      return `
        <section class="energy-panel energy-sheen p-5">
          <p class="energy-eyebrow">Benchmark layer</p>
          <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">How your current usage compares</h3>
          <p class="mt-3 text-sm leading-7 text-[#5d7468]">Send a few prompts and this section will compare Energy AI with other model profiles like ChatGPT and a Gemini proxy.</p>
        </section>
      `;
    }

    const rows = [
      {
        id: "energy-ai-local",
        label: "Energy AI Local Estimate",
        kind: "local",
        totalWh: summary.totalEstimatedWh,
        detail: "Scaled from your own low-energy and high-energy usage mix.",
        deltaPct: 0,
      },
      ...summary.benchmarkComparisons,
    ];
    const maxWh = Math.max(...rows.map((row) => row.totalWh), 0.001);

    return `
      <section class="energy-panel energy-sheen p-5">
        <p class="energy-eyebrow">Benchmark layer</p>
        <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">How your current usage compares</h3>
        <p class="mt-2 text-sm leading-7 text-[#5d7468]">Same-response comparison for ${summary.totalAssistantResponses} assistant replies across Energy AI, ChatGPT typical usage, and a Gemini frontier proxy.</p>
        <div class="energy-js-benchmark-grid mt-5">
          ${rows.map((row) => {
            const toneClass = row.kind === "local"
              ? "bg-[linear-gradient(135deg,#f4fbf7_0%,#e8f7ef_100%)] border-[#cde7d8]"
              : row.kind === "published"
                ? "bg-[linear-gradient(135deg,#fff8e8_0%,#fff0cf_100%)] border-[#ecd9ab]"
                : "bg-[linear-gradient(135deg,#eef4ff_0%,#e0ebff_100%)] border-[#c8d7f2]";
            const barClass = row.kind === "local"
              ? "bg-[linear-gradient(90deg,#9fe0bc_0%,#2f8f63_100%)]"
              : row.kind === "published"
                ? "bg-[linear-gradient(90deg,#f7dc97_0%,#b97d1c_100%)]"
                : "bg-[linear-gradient(90deg,#a2c5ff_0%,#4a78de_100%)]";
            const width = Math.max((row.totalWh / maxWh) * 100, 12);
            const comparisonText = row.kind === "local"
              ? "Your current estimated total"
              : row.deltaPct >= 0
                ? `${row.deltaPct}% more than Energy AI`
                : `${Math.abs(row.deltaPct)}% less than Energy AI`;

            return `
              <article class="rounded-[28px] border p-5 ${toneClass}">
                <p class="text-sm font-semibold text-[#173127]">${escapeHtml(row.label)}</p>
                <p class="mt-2 text-sm leading-7 text-[#5b6f65]">${escapeHtml(row.detail)}</p>
                <p class="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-[#13241b]">${escapeHtml(formatEnergy(row.totalWh))}</p>
                <div class="mt-4 h-3 overflow-hidden rounded-full bg-white/70">
                  <div class="h-full rounded-full ${barClass}" style="width:${width}%"></div>
                </div>
                <p class="mt-3 text-xs uppercase tracking-[0.18em] text-[#6b8075]">${escapeHtml(comparisonText)}</p>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderAnalyticsMethodology() {
    return `
      <section class="energy-panel energy-sheen p-5">
        <p class="energy-eyebrow">Methodology</p>
        <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">What these comparisons mean</h3>
        <div class="mt-4 space-y-3 text-sm leading-7 text-[#5d7468]">
          <p>Energy AI values are estimates, not direct hardware power measurements. They scale from the route used and observed response latency.</p>
          <p>ChatGPT uses a typical public benchmark estimate. Gemini is shown as a proxy comparison because Google does not publish direct per-query energy numbers.</p>
          <p>The goal here is relative comparison for your own usage, not an official vendor billing or power report.</p>
        </div>
      </section>
    `;
  }

  function renderEvaluationDashboard(overview) {
    const evaluation = overview && overview.evaluations || {};
    const summary = evaluation.summary || {};
    const categories = Array.isArray(summary.categories) ? summary.categories : [];
    const weakestCases = Array.isArray(summary.weakestCases) ? summary.weakestCases : [];
    const quality = overview && overview.quality || {};

    if (!evaluation.completedAt) {
      return `
        <section class="energy-panel energy-sheen p-5">
          <p class="energy-eyebrow">Evaluation suite</p>
          <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">No evaluation run yet</h3>
          <p class="mt-3 text-sm leading-7 text-[#5d7468]">Run the evaluation suite from the admin page to score web grounding, backend guidance, and coding quality.</p>
        </section>
      `;
    }

    return `
      <section class="energy-panel energy-sheen p-5">
        <p class="energy-eyebrow">Evaluation suite</p>
        <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">How the current stack is performing</h3>
        <div class="mt-5 energy-js-stat-grid energy-js-stat-grid--four">
          ${renderTrainingRow("Pass rate", `${escapeHtml(String(summary.passRate || 0))}%`, `${summary.passed || 0} / ${summary.total || 0} prompts`)}
          ${renderTrainingRow("Average score", `${escapeHtml(String(summary.averageScore || 0))}%`, `Suite ${escapeHtml(summary.suiteVersion || "")}`)}
          ${renderTrainingRow("Average latency", `${escapeHtml(String(summary.averageLatencyMs || 0))} ms`, "Across current evaluation prompts")}
          ${renderTrainingRow("Approval rate", `${escapeHtml(String(quality.approvalRate || 0))}%`, `${quality.approvedFeedback || 0} upvotes, ${quality.correctedFeedback || 0} corrections`)}
        </div>
        <div class="mt-5 energy-js-admin-grid">
          <div class="rounded-[26px] border border-[#dce7df] bg-white/72 p-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a968c]">Category breakdown</p>
            <div class="mt-3 grid gap-3">
              ${categories.length ? categories.map((entry) => renderTrainingRow(entry.category, `${entry.passRate}%`, `${entry.passed}/${entry.total} passed · ${entry.averageLatencyMs} ms`)).join("") : `<div class="rounded-[20px] border border-[#d6ddd0] bg-white/76 px-4 py-4 text-sm text-[#6c7c71]">No category data yet.</div>`}
            </div>
          </div>
          <div class="rounded-[26px] border border-[#dce7df] bg-white/72 p-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a968c]">Weakest prompts</p>
            <div class="mt-3 grid gap-3">
              ${weakestCases.length ? weakestCases.map((entry) => `
                <article class="rounded-[22px] border border-[#d6ddd0] bg-white/82 px-4 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <p class="text-sm font-semibold text-[#173324]">${escapeHtml(entry.title)}</p>
                    <span class="energy-chip border-[#d6ddd0] bg-white/72 text-[#5b6f65]">${escapeHtml(String(entry.score || 0))}%</span>
                  </div>
                  <p class="mt-2 text-sm leading-6 text-[#5d7064]">${escapeHtml(entry.preview || "")}</p>
                </article>
              `).join("") : `<div class="rounded-[20px] border border-[#d6ddd0] bg-white/76 px-4 py-4 text-sm text-[#6c7c71]">No failures recorded in the latest run.</div>`}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderAnalyticsPage() {
    const summary = summarizeMessages(state.sessions);
    const analytics = state.analyticsOverview || {};
    const analyticsStats = analytics.stats || {};
    const evaluationSummary = analytics.evaluations && analytics.evaluations.summary || {};
    const quality = analytics.quality || {};
    const maxCount = Math.max(...summary.usageBars.map((item) => item.count), 1);
    return `
      <main class="energy-home-page-clean energy-clean-shell energy-static-page relative min-h-screen overflow-hidden">
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute left-[-10rem] top-[-6rem] h-72 w-72 rounded-full bg-[#efcb81]/22 blur-3xl animate-drift"></div>
          <div class="absolute right-[-6rem] top-[2rem] h-80 w-80 rounded-full bg-[#b5d0b8]/18 blur-3xl animate-float"></div>
          <div class="absolute bottom-[-8rem] right-[6%] h-80 w-80 rounded-full bg-[#f0b98f]/18 blur-3xl animate-drift"></div>
        </div>
        ${renderAppHeader("analytics")}
        <section class="energy-page-scroll energy-app-shell-gap relative mx-auto w-full max-w-[1440px] px-4 pb-8 pt-24 sm:px-6 lg:px-8">
          ${state.banner ? renderBanner(state.banner) : ""}
          ${state.syncError ? renderBanner({ tone: "error", text: state.syncError }) : ""}
          ${state.analyticsError ? renderBanner({ tone: "error", text: state.analyticsError }) : ""}
          ${state.isAnalyticsLoading && !state.analyticsOverview ? `<div class="mb-4 inline-flex items-center gap-3 rounded-[20px] border border-[#d6ddd0] bg-white/72 px-4 py-3 text-sm text-[#5d7064]">Loading analytics overview</div>` : ""}
          <div class="energy-js-stat-grid energy-js-stat-grid--four">
            ${renderMetricCard("Responses", String(summary.totalAssistantResponses), `${summary.lowEnergyResponses} low / ${summary.highEnergyResponses} high`)}
            ${renderMetricCard("Estimated total", formatEnergy(summary.totalEstimatedWh), "Approximate response energy")}
            ${renderMetricCard("Source-backed", String(analyticsStats.sourceBackedResponses || 0), "Replies with web sources attached")}
            ${renderMetricCard("Eval pass rate", `${evaluationSummary.passRate || 0}%`, `${evaluationSummary.passed || 0}/${evaluationSummary.total || 0} current checks`)}
          </div>
          <div class="energy-js-analytics-grid mt-6">
            <section class="energy-panel energy-sheen p-5">
              <p class="energy-eyebrow">Model mix</p>
              <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">Which engines carried the work</h3>
              <div class="mt-5 space-y-4">
                ${summary.usageBars.length ? summary.usageBars.map((item) => `
                  <div class="rounded-[24px] border border-[#dce7df] bg-white/72 p-4">
                    <div class="mb-2 flex items-center justify-between gap-3 text-sm text-[#486154]">
                      <span class="font-semibold text-[#173127]">${escapeHtml(item.label)}</span>
                      <span class="font-mono">${item.count}</span>
                    </div>
                    <div class="energy-js-bar-track"><div class="energy-js-bar-fill ${item.energyKey === "deep" ? "deep" : ""}" style="width:${Math.max((item.count / maxCount) * 100, 10)}%"></div></div>
                    <p class="mt-2 text-xs uppercase tracking-[0.18em] text-[#6b8075]">Estimated energy ${escapeHtml(formatEnergy(item.estimatedWh))}</p>
                  </div>
                `).join("") : `<div class="rounded-[18px] border border-[#dce4d8] bg-white/82 px-4 py-4 text-sm text-[#7d8d7e]">Start chatting to generate analytics for this dashboard.</div>`}
              </div>
            </section>
            <section class="energy-panel energy-sheen p-5">
              <p class="energy-eyebrow">Energy story</p>
              <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">How the routing balance behaved</h3>
              <div class="mt-5 grid gap-3">
                <div class="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a968c]">Low Energy Replies</p>
                  <p class="mt-2 text-xl font-semibold text-[#173324]">${summary.lowEnergyResponses}</p>
                </div>
                <div class="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a968c]">High Energy Replies</p>
                  <p class="mt-2 text-xl font-semibold text-[#173324]">${summary.highEnergyResponses}</p>
                </div>
                <div class="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a968c]">Working mode</p>
                  <p class="mt-2 text-sm text-[#5d7064]">Energy AI keeps everyday prompts light and shifts into deeper reasoning when the task needs more thought.</p>
                </div>
              </div>
            </section>
          </div>
          <div class="mt-6">
            ${renderBenchmarkComparison(summary)}
          </div>
          <div class="mt-6">
            ${renderEvaluationDashboard(analytics)}
          </div>
          <div class="mt-6">
            ${renderAnalyticsMethodology()}
          </div>
        </section>
      </main>
    `;
  }

  function renderMetricCard(title, value, note) {
    return `
      <article class="energy-panel energy-sheen p-4 sm:p-5">
        <div class="mb-4">
          <p class="energy-eyebrow">${escapeHtml(title)}</p>
          ${note ? `<p class="mt-1 text-sm text-[#5f776b]">${escapeHtml(note)}</p>` : ""}
        </div>
        <p class="font-display text-3xl font-bold tracking-[-0.05em] text-[#13241b] sm:text-4xl">${escapeHtml(value)}</p>
      </article>
    `;
  }

  function renderCommandPalette() {
    const actions = listCommandActions();
    return `
      <div data-command-palette-overlay class="fixed inset-0 z-[90] ${state.isCommandPaletteOpen ? "" : "pointer-events-none hidden"}">
        <button type="button" data-action="close-command-palette" aria-label="Close command palette overlay" class="absolute inset-0 bg-[#13261c]/24 backdrop-blur-md"></button>
        <section class="energy-js-command-palette absolute left-1/2 top-[12vh] w-[min(92vw,720px)] -translate-x-1/2 rounded-[30px] border border-[#d6ddd0] bg-[linear-gradient(180deg,rgba(255,252,246,0.98)_0%,rgba(248,244,234,0.96)_100%)] p-4 shadow-[0_50px_120px_-50px_rgba(31,47,37,0.36)]">
          <div class="flex items-center gap-3 rounded-[24px] border border-[#d6ddd0] bg-white/80 px-4 py-3">
            <input name="command-palette-query" value="${escapeHtml(state.commandPaletteQuery)}" placeholder="Jump anywhere, start a session, or open admin..." class="min-w-0 flex-1 bg-transparent text-sm text-[#173324] outline-none placeholder:text-[#728378]" />
            <button type="button" data-action="close-command-palette" class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/82 text-[#5b6f65] transition hover:bg-white" aria-label="Close command palette">
              ${renderIcon("x", 15)}
            </button>
          </div>
          <div class="mt-4 space-y-2">
            ${actions.map((action) => `
              <button type="button" data-action="run-command" data-command-id="${escapeHtml(action.id)}" data-command-search="${escapeHtml(`${action.label} ${action.hint}`.toLowerCase())}" class="energy-js-command-item flex w-full items-center justify-between gap-3 rounded-[22px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.9)_0%,rgba(248,244,234,0.86)_100%)] px-4 py-3 text-left transition hover:bg-[#fffaf3]">
                <span class="flex items-center gap-3">
                  <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/82 text-[#173324]">
                    ${renderIcon(action.icon, 16)}
                  </span>
                  <span>
                    <span class="block text-sm font-semibold text-[#173324]">${escapeHtml(action.label)}</span>
                    <span class="block text-xs text-[#627267]">${escapeHtml(action.hint)}</span>
                  </span>
                </span>
                <span class="text-[11px] uppercase tracking-[0.18em] text-[#6e7f74]">${escapeHtml(action.shortcut)}</span>
              </button>
            `).join("")}
            <div class="energy-js-command-empty hidden rounded-[22px] border border-[#d6ddd0] bg-white/76 px-4 py-5 text-sm text-[#627267]">No matching action yet.</div>
          </div>
        </section>
      </div>
    `;
  }

  function renderMobileDrawer(activePage) {
    return `
      <div data-mobile-drawer class="fixed inset-0 z-50 lg:hidden ${state.isMobileMenuOpen ? "" : "pointer-events-none"}">
        <button type="button" data-mobile-backdrop data-action="close-mobile-menu" aria-label="Close menu overlay" class="absolute inset-0 bg-black/72 transition duration-300 ${state.isMobileMenuOpen ? "opacity-100" : "opacity-0"}"></button>
        <aside data-mobile-panel class="absolute inset-y-0 left-0 flex w-[84vw] max-w-[340px] flex-col border-r border-[#d6ddd0] bg-[linear-gradient(180deg,rgba(250,246,238,0.98)_0%,rgba(247,241,230,0.98)_48%,rgba(244,238,226,0.98)_100%)] px-3 py-3 shadow-[0_40px_120px_-60px_rgba(43,53,40,0.28)] transition duration-300 ${state.isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}">
          <div class="flex items-center justify-between gap-3 rounded-[24px] border border-[#d6ddd0] bg-white/72 px-3 py-3 text-[#173324]">
            <div class="min-w-0 flex-1">${renderBrand(true)}</div>
            <button type="button" data-action="close-mobile-menu" class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/72 text-[#173324] transition hover:bg-white/88" aria-label="Close menu">
              ${renderIcon("x", 16)}
            </button>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button type="button" data-nav="chat" class="inline-flex items-center justify-center gap-2 rounded-[20px] px-3 py-3 text-sm font-semibold transition ${activePage === "chat" ? "bg-[linear-gradient(180deg,#173324_0%,#10261d_100%)] text-white shadow-[0_18px_40px_-28px_rgba(16,38,29,0.42)]" : "border border-[#d6ddd0] bg-white/72 text-[#173324]"}">
              ${renderIcon("message-circle", 15)}
              <span>Chat</span>
            </button>
            <button type="button" data-nav="analytics" class="inline-flex items-center justify-center gap-2 rounded-[20px] px-3 py-3 text-sm font-semibold transition ${activePage === "analytics" ? "bg-[linear-gradient(180deg,#173324_0%,#10261d_100%)] text-white shadow-[0_18px_40px_-28px_rgba(16,38,29,0.42)]" : "border border-[#d6ddd0] bg-white/72 text-[#173324]"}">
              ${renderIcon("bar-chart", 15)}
              <span>Analytics</span>
            </button>
          </div>
          ${state.user && state.user.isAdmin ? `
            <button type="button" data-nav="admin" class="mt-3 inline-flex items-center justify-center gap-2 rounded-[20px] border border-[#d6ddd0] bg-white/72 px-3 py-3 text-sm font-semibold text-[#173324] transition hover:bg-white/88">
              ${renderIcon("shield", 15)}
              <span>Admin</span>
            </button>
          ` : ""}
          <div class="mt-3 flex min-h-0 flex-1">
            <div data-mobile-sidebar-host class="h-full flex-1">${renderSidebar(true)}</div>
          </div>
          <button type="button" data-action="logout" class="mt-3 inline-flex items-center justify-center gap-2 rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3 text-sm font-semibold text-[#173324] transition hover:bg-white/88">
            ${renderIcon("logout", 15)}
            <span>Logout</span>
          </button>
        </aside>
      </div>
    `;
  }

  function renderAppHeader(activePage) {
    return `
      <header class="fixed inset-x-0 top-0 z-40 px-0 pt-0 sm:sticky sm:px-4 sm:pt-3 lg:px-6">
        <div class="energy-app-topbar energy-home-clean-nav energy-page-enter mx-auto flex min-h-[4rem] w-full max-w-[1440px] flex-col gap-2 rounded-none border-x-0 border-t-0 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:rounded-[22px] sm:border sm:px-4 sm:py-2 lg:px-5">
          <div class="flex w-full items-center justify-between gap-3 text-[#173324] sm:hidden">
            <button type="button" data-action="open-mobile-menu" class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/72 text-[#173324] transition hover:bg-white/88" aria-label="Open menu">
              ${renderIcon("menu", 18)}
            </button>
            <div class="min-w-0 flex flex-1 justify-center">${renderBrand(false)}</div>
            <button type="button" data-action="${activePage === "chat" ? "new-chat" : "mobile-open-chat"}" class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/72 text-[#173324] transition hover:bg-white/88" aria-label="${activePage === "chat" ? "Start new chat" : "Open chat"}">
              ${renderIcon(activePage === "chat" ? "message-circle-plus" : "message-circle", 18)}
            </button>
          </div>
          <div class="hidden sm:flex sm:w-auto">${renderBrand(true)}</div>
          <div class="hidden w-full flex-wrap items-center gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <div class="hidden items-center gap-2 md:flex">
              <span class="energy-chip border-[#d7dfd2] bg-white/72 text-[#48725b]">${renderIcon("leaf", 12)}<span>Low Energy</span></span>
              <span class="energy-chip border-[#ead7bd] bg-[#fff4df] text-[#9a7532]">${renderIcon("flame", 12)}<span>High Energy</span></span>
            </div>
            <div class="w-full rounded-full border border-[#d6ddd0] bg-white/70 p-1 sm:w-auto">
              <button type="button" data-nav="chat" class="inline-flex min-w-[98px] flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition sm:flex-none ${activePage === "chat" ? "bg-[linear-gradient(180deg,#173324_0%,#10261d_100%)] text-white shadow-[0_18px_40px_-28px_rgba(16,38,29,0.42)]" : "text-[#173324] hover:bg-white/88"}">
                ${renderIcon("message-circle", 14)}
                <span>Chat</span>
              </button>
              <button type="button" data-nav="analytics" class="inline-flex min-w-[98px] flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition sm:flex-none ${activePage === "analytics" ? "bg-[linear-gradient(180deg,#173324_0%,#10261d_100%)] text-white shadow-[0_18px_40px_-28px_rgba(16,38,29,0.42)]" : "text-[#173324] hover:bg-white/88"}">
                ${renderIcon("bar-chart", 14)}
                <span>Analytics</span>
              </button>
            </div>
            <button type="button" data-action="open-command-palette" class="hidden items-center gap-2 rounded-[16px] border border-[#d6ddd0] bg-white/72 px-3 py-2 text-sm font-semibold text-[#173324] transition hover:bg-white/88 lg:inline-flex">
              ${renderIcon("search", 14)}
              <span>Command</span>
              <span class="rounded-full border border-[#d6ddd0] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#7d8d7e]">Ctrl K</span>
            </button>
            ${state.user && state.user.isAdmin ? `<button type="button" data-nav="admin" class="energy-home-secondary-button">Admin</button>` : ""}
            <div class="flex min-w-0 flex-1 items-center gap-2 rounded-[16px] border border-[#d6ddd0] bg-white/72 px-3 py-2 text-[#173324] backdrop-blur sm:max-w-[220px] sm:flex-none">
              ${renderIcon("user", 18)}
              <div class="min-w-0 text-left">
                <p class="truncate text-sm font-semibold leading-none">${escapeHtml(state.user && state.user.name || "User")}</p>
                <p class="mt-1 hidden text-xs text-[#7d8d7e] xl:block">${escapeHtml(state.user && state.user.email || "")}</p>
              </div>
            </div>
            <button type="button" data-action="logout" class="inline-flex items-center justify-center gap-2 rounded-[16px] border border-[#d6ddd0] bg-white/72 px-3 py-2 text-sm font-semibold text-[#173324] transition hover:bg-white/88">
              ${renderIcon("logout", 14)}
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>
      ${renderMobileDrawer(activePage)}
      ${renderCommandPalette()}
    `;
  }

  function renderChatPage() {
    return `
      <main class="energy-home-page-clean energy-clean-shell energy-static-page relative min-h-screen overflow-hidden">
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute left-[-10rem] top-[-6rem] h-72 w-72 rounded-full bg-[#efcb81]/22 blur-3xl animate-drift"></div>
          <div class="absolute right-[-6rem] top-[2rem] h-80 w-80 rounded-full bg-[#b5d0b8]/18 blur-3xl animate-float"></div>
          <div class="absolute bottom-[-8rem] right-[6%] h-80 w-80 rounded-full bg-[#f0b98f]/18 blur-3xl animate-drift"></div>
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(170,196,170,0.16),transparent_52%)]"></div>
        </div>
        ${renderAppHeader("chat")}
        <section class="energy-app-content energy-app-content-static energy-app-shell-gap relative mx-auto w-full max-w-[1440px] px-0 pb-0 pt-[4.55rem] sm:p-3 sm:pt-3 lg:px-6 lg:pb-5 lg:pt-4 min-h-[calc(100svh-4.55rem)] lg:min-h-[calc(100vh-5.2rem)]">
          ${state.banner ? renderBanner(state.banner) : ""}
          ${state.syncError ? renderBanner({ tone: "error", text: state.syncError }) : ""}
          ${state.isHydrating ? `
            <div class="energy-panel energy-sheen flex min-h-[55vh] items-center justify-center p-6">
              <div class="energy-panel energy-sheen inline-flex items-center gap-3 rounded-[24px] px-5 py-3 text-sm text-[#365041]">Loading your private chats</div>
            </div>
          ` : `
            <div class="energy-js-chat-layout">
              <div class="energy-js-sidebar-desktop">${renderSidebar(false)}</div>
              <section class="energy-js-main-column">
                ${renderChatWindow()}
                ${renderComposer()}
              </section>
            </div>
          `}
        </section>
      </main>
    `;
  }

  function renderAdminPage() {
    const overview = state.adminOverview || {};
    const training = overview.training || {};
    const stats = overview.stats || {};
    const quality = overview.quality || {};
    const health = overview.health || {};
    const evaluations = overview.evaluations || {};
    const latestEvaluation = evaluations.latest || {};
    const evaluationSummary = latestEvaluation.summary || {};
    const energyScorecard = Array.isArray(quality.energyScorecard) ? quality.energyScorecard : [];

    return `
      <main class="energy-home-page-clean energy-clean-shell energy-static-page relative min-h-screen overflow-hidden">
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[#efcb81]/18 blur-3xl animate-drift"></div>
          <div class="absolute right-[-5rem] top-[8%] h-80 w-80 rounded-full bg-[#bfd6bf]/14 blur-3xl animate-float"></div>
          <div class="absolute bottom-[-10rem] left-[10%] h-80 w-80 rounded-full bg-[#f0b98f]/16 blur-3xl animate-drift"></div>
        </div>
        <section class="energy-page-scroll relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
          <header class="energy-home-clean-nav flex flex-wrap items-center justify-between gap-3 rounded-[28px] px-4 py-3">
            ${renderBrand(true)}
            <div class="energy-js-toolbar-buttons">
              <span class="energy-chip border-[#d6ddd0] bg-white/72 text-[#48725b]">Admin</span>
              <span class="energy-chip border-[#d6ddd0] bg-white/72 text-[#5d7064]">${escapeHtml(state.user && state.user.email || "")}</span>
              <button type="button" data-nav="home" class="energy-home-secondary-button">Home</button>
              <button type="button" data-nav="chat" class="energy-home-primary-button">Open Chat</button>
            </div>
          </header>

          <section class="energy-admin-hero-grid mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="energy-panel rounded-[34px] p-6">
              <p class="energy-eyebrow">Admin Console</p>
              <h1 class="mt-4 font-display text-4xl font-bold tracking-[-0.06em] text-[#173324] sm:text-5xl">Control training, health, and quality from one place.</h1>
              <p class="mt-4 max-w-2xl text-base leading-8 text-[#5d7064] sm:text-lg">Review training health, quality signals, and model activity from one private control surface.</p>
              <div class="mt-6 energy-js-admin-actions">
                <button type="button" data-action="retrain-admin" class="energy-home-primary-button" ${state.isRetraining || training.inProgress ? "disabled" : ""}>${state.isRetraining || training.inProgress ? "Retraining..." : "Retrain Models"}</button>
                <button type="button" data-action="run-evaluations" class="energy-home-secondary-button" ${state.isEvaluationRunning ? "disabled" : ""}>${state.isEvaluationRunning ? "Running evaluations..." : "Run Evaluations"}</button>
                <button type="button" data-action="refresh-admin" class="energy-home-secondary-button">Refresh Overview</button>
              </div>
              ${state.adminError ? `<div class="mt-5 rounded-[24px] border border-[#edc6bf] bg-[#fff1ed] px-4 py-3 text-sm text-[#9a4a3b]">${escapeHtml(state.adminError)}</div>` : ""}
            </div>
            <div class="energy-panel rounded-[34px] p-6">
              <p class="energy-eyebrow">Training Status</p>
              ${state.isAdminLoading && !state.adminOverview ? `<div class="mt-6 inline-flex items-center gap-3 rounded-[20px] border border-[#d6ddd0] bg-white/72 px-4 py-3 text-sm text-[#5d7064]">Loading admin overview</div>` : `
                <div class="mt-5 space-y-3">
                  ${renderTrainingRow("State", training.lastTrainResult && training.lastTrainResult.status || "idle", training.lastTrainResult && training.lastTrainResult.detail || "Waiting for training activity")}
                  ${renderTrainingRow("Last Started", formatDateTime(training.lastTrainStartedAt))}
                  ${renderTrainingRow("Last Completed", formatDateTime(training.lastTrainCompletedAt))}
                </div>
              `}
            </div>
          </section>

          <section class="mt-6 energy-js-stat-grid energy-js-stat-grid--four">
            ${renderStatCard("Users", String(stats.users || 0), `${stats.verifiedUsers || 0} verified`)}
            ${renderStatCard("Chat Sessions", String(stats.chatSessions || 0), `${stats.activeChats24h || 0} active in 24h`)}
            ${renderStatCard("Auth Sessions", String(stats.authSessions || 0), "Active login sessions")}
            ${renderStatCard("Approved Pairs", String(training.files && training.files.approved || 0), `${training.files && training.files.candidates || 0} candidates, ${training.files && training.files.rejected || 0} rejected`)}
          </section>

          <section class="mt-6 energy-js-admin-grid">
            <div class="energy-panel rounded-[34px] p-6">
              <p class="energy-eyebrow">Model Artifacts</p>
              <div class="mt-5 grid gap-3 sm:grid-cols-3">
                ${renderTrainingRow("Router Rows", String(training.metadata && training.metadata.router_examples || 0))}
                ${renderTrainingRow("Fast Rows", String(training.metadata && training.metadata.fast_examples || 0))}
                ${renderTrainingRow("Deep Rows", String(training.metadata && training.metadata.deep_examples || 0))}
              </div>
            </div>
            <div class="energy-panel rounded-[34px] p-6">
              <p class="energy-eyebrow">Queue</p>
              <div class="mt-5 grid gap-3 sm:grid-cols-3">
                ${renderTrainingRow("Auto Train", training.enabled ? "Enabled" : "Manual only")}
                ${renderTrainingRow("Min New Pairs", String(training.minNewExamples || 0))}
                ${renderTrainingRow("Cooldown", `${Math.round((training.cooldownMs || 0) / 60000)} min`, `${training.pendingApprovedExamples || 0} approved pairs waiting`)}
              </div>
            </div>
          </section>

          <section class="mt-6 energy-js-admin-grid">
            <div class="energy-panel rounded-[34px] p-6">
              <p class="energy-eyebrow">Evaluation Dashboard</p>
              <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                ${renderTrainingRow("Pass rate", `${evaluationSummary.passRate || 0}%`, `${evaluationSummary.passed || 0} / ${evaluationSummary.total || 0}`)}
                ${renderTrainingRow("Average score", `${evaluationSummary.averageScore || 0}%`, evaluationSummary.suiteVersion || "No suite yet")}
                ${renderTrainingRow("Average latency", `${evaluationSummary.averageLatencyMs || 0} ms`)}
                ${renderTrainingRow("Last run", formatDateTime(latestEvaluation.completedAt))}
              </div>
              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                ${Array.isArray(evaluationSummary.categories) && evaluationSummary.categories.length ? evaluationSummary.categories.map((entry) => renderTrainingRow(entry.category, `${entry.passRate}%`, `${entry.passed}/${entry.total} passed · ${entry.averageLatencyMs} ms`)).join("") : `<div class="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-4 text-sm text-[#6f7d73]">Run evaluations to populate this dashboard.</div>`}
              </div>
            </div>
            <div class="energy-panel rounded-[34px] p-6">
              <p class="energy-eyebrow">Recent Feedback</p>
              <div class="mt-5 grid gap-3">
                ${((training.recent && training.recent.approved) || []).slice(0, 3).map((row) => `
                  <article class="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3">
                    <p class="text-sm font-semibold text-[#173324]">${escapeHtml(row.prompt || "")}</p>
                    <p class="mt-2 text-sm leading-6 text-[#5d7064]">${escapeHtml(row.completion || "")}</p>
                    <p class="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#7d8d7e]">${escapeHtml(row.source || "approved")}</p>
                  </article>
                `).join("") || `<div class="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-4 text-sm text-[#6f7d73]">No approved feedback rows yet.</div>`}
              </div>
            </div>
          </section>

          <section class="mt-6 energy-js-admin-grid">
            <div class="energy-panel rounded-[34px] p-6">
              <p class="energy-eyebrow">Quality Signals</p>
              <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                ${renderTrainingRow("Upvotes", String(quality.approvedFeedback || 0))}
                ${renderTrainingRow("Corrections", String(quality.correctedFeedback || 0))}
                ${renderTrainingRow("Rejected", String(quality.rejectedFeedback || 0))}
                ${renderTrainingRow("Candidates", String(quality.candidateRows || 0), `${stats.avgMessagesPerChat || 0} avg msgs/chat`)}
              </div>
              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                ${energyScorecard.map((entry) => renderTrainingRow(`${entry.mode} mode`, `${entry.accuracy}%`, `${entry.approved} approved / ${entry.rejected} rejected`)).join("")}
              </div>
            </div>
            <div class="energy-panel rounded-[34px] p-6">
              <p class="energy-eyebrow">Service Health</p>
              <div class="mt-5 space-y-3">
                ${renderTrainingRow("Uptime", `${health.uptimeSeconds || 0}s`)}
                ${renderTrainingRow("Memory", `${health.memoryMb && health.memoryMb.rss || 0} MB`)}
                ${renderTrainingRow("Runtime", health.nodeVersion || `Python ${escapeHtml(String(window.navigator.userAgent || ""))}`)}
              </div>
            </div>
          </section>
        </section>
      </main>
    `;
  }

  function renderTrainingRow(label, value, hint) {
    return `
      <div class="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3">
        <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a968c]">${escapeHtml(label)}</p>
        <p class="mt-2 text-xl font-semibold text-[#173324]">${escapeHtml(value)}</p>
        ${hint ? `<p class="mt-1 text-sm text-[#7d8d7e]">${escapeHtml(hint)}</p>` : ""}
      </div>
    `;
  }

  function renderStatCard(label, value, hint) {
    return `
      <article class="energy-panel relative overflow-hidden rounded-[28px] p-5">
        <div>
          <p class="energy-eyebrow">${escapeHtml(label)}</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-[#173324]">${escapeHtml(value)}</p>
          ${hint ? `<p class="mt-2 text-sm text-[#5d7064]">${escapeHtml(hint)}</p>` : ""}
        </div>
      </article>
    `;
  }

  function renderCurrentPage() {
    if (state.isBootstrapping) {
      return `
        <main class="energy-home-page-clean energy-clean-shell flex min-h-screen items-center justify-center px-4">
          <div class="inline-flex items-center gap-3 rounded-[24px] border border-[#d6ddd0] bg-[linear-gradient(160deg,rgba(255,252,246,0.96)_0%,rgba(248,244,234,0.92)_100%)] px-5 py-4 text-sm text-[#4b6156] shadow-[0_28px_72px_-48px_rgba(31,47,37,0.24)]">Loading Energy AI</div>
        </main>
      `;
    }

    const page = state.route.page;
    if (page === "home") {
      return renderHomePage();
    }

    const isAuthenticated = Boolean(state.token && state.user);
    if (page === "admin" && isAuthenticated && state.user.emailVerified && state.user.isAdmin) {
      return renderAdminPage();
    }

    if (!isAuthenticated && PUBLIC_ROUTES.has(page)) {
      if (page === "reset-password" || page === "verify-email") {
        return renderTokenPage(page);
      }
      return renderAuthPage(page);
    }

    if (!isAuthenticated) {
      return renderAuthPage("login");
    }

    if (page === "reset-password" || page === "verify-email") {
      return renderTokenPage(page);
    }

    if (page === "analytics") {
      return renderAnalyticsPage();
    }

    return renderChatPage();
  }

  function renderApp() {
    app.innerHTML = renderCurrentPage();
  }

  function applyCommandPaletteFilter(query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const items = app.querySelectorAll(".energy-js-command-item");
    let visibleCount = 0;

    items.forEach((item) => {
      const searchText = String(item.getAttribute("data-command-search") || "");
      const isVisible = !normalizedQuery || searchText.includes(normalizedQuery);
      item.classList.toggle("hidden", !isVisible);
      if (isVisible) {
        visibleCount += 1;
      }
    });

    const emptyState = app.querySelector(".energy-js-command-empty");
    if (emptyState) {
      emptyState.classList.toggle("hidden", visibleCount !== 0);
    }
  }

  function updateChatScrollState(region) {
    if (!region) {
      return;
    }

    const distanceFromBottom = Math.max(region.scrollHeight - region.scrollTop - region.clientHeight, 0);
    state.chatScrollDistanceFromBottom = distanceFromBottom;
    state.chatShouldStickToBottom = distanceFromBottom < 140;

    const button = app.querySelector(".energy-js-scroll-latest");
    if (button) {
      button.classList.toggle("hidden", distanceFromBottom < 180);
      button.classList.toggle("inline-flex", distanceFromBottom >= 180);
    }
  }

  function syncChatScrollRegion(options = {}) {
    const preserveState = Boolean(options.preserveState);
    const region = app.querySelector(".energy-js-scroll-region");
    if (chatScrollRegion && chatScrollHandler && chatScrollRegion !== region) {
      chatScrollRegion.removeEventListener("scroll", chatScrollHandler);
    }

    if (!region) {
      chatScrollRegion = null;
      chatScrollHandler = null;
      return null;
    }

    if (chatScrollRegion !== region) {
      chatScrollHandler = () => updateChatScrollState(region);
      region.addEventListener("scroll", chatScrollHandler, { passive: true });
      chatScrollRegion = region;
    }

    if (!preserveState) {
      updateChatScrollState(region);
    }
    return region;
  }

  function restoreChatScrollState(region, shouldStickToBottom, distanceFromBottom) {
    if (!region) {
      return;
    }

    if (shouldStickToBottom) {
      state.chatShouldStickToBottom = true;
      state.chatScrollDistanceFromBottom = 0;
      region.scrollTop = region.scrollHeight;
    } else {
      state.chatShouldStickToBottom = false;
      state.chatScrollDistanceFromBottom = Math.max(distanceFromBottom, 0);
      region.scrollTop = Math.max(region.scrollHeight - region.clientHeight - state.chatScrollDistanceFromBottom, 0);
    }

    updateChatScrollState(region);
  }

  function scrollToLatest() {
    const region = app.querySelector(".energy-js-scroll-region");
    state.chatShouldStickToBottom = true;
    state.chatScrollDistanceFromBottom = 0;
    if (region) {
      region.scrollTop = region.scrollHeight;
    }
    updateChatScrollState(region);
  }

  function afterRender() {
    const shouldStickToBottom = state.chatShouldStickToBottom;
    const distanceFromBottom = state.chatScrollDistanceFromBottom;
    const region = syncChatScrollRegion({ preserveState: true });

    if (state.scrollWanted) {
      const scrollMode = state.scrollWanted;
      state.scrollWanted = "";
      if (scrollMode === "force" || (scrollMode === "sticky" && shouldStickToBottom)) {
        scrollToLatest();
      } else {
        restoreChatScrollState(region, shouldStickToBottom, distanceFromBottom);
      }
    } else {
      restoreChatScrollState(region, shouldStickToBottom, distanceFromBottom);
    }

    if (state.isCommandPaletteOpen) {
      applyCommandPaletteFilter(state.commandPaletteQuery);
      focusCommandPaletteInput();
    }

    updateBodyOverflow();
    syncRouteState();
  }

  async function handleClick(event) {
    const navButton = event.target.closest("[data-nav]");
    if (navButton) {
      const page = navButton.getAttribute("data-nav");
      const email = navButton.getAttribute("data-email") || "";
      state.isMobileMenuOpen = false;
      state.isCommandPaletteOpen = false;
      state.commandPaletteQuery = "";
      navigate(page, email ? { email } : {});
      return;
    }

    const sessionButton = event.target.closest("[data-session-id]");
    if (sessionButton && !event.target.closest("[data-action='remove-chat']")) {
      state.activeSessionId = sessionButton.getAttribute("data-session-id");
      state.isMobileMenuOpen = false;
      requestScroll("force");
      if (!patchChatLayout()) {
        scheduleRender();
      }
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.getAttribute("data-action");
    switch (action) {
      case "logout":
        await doLogout();
        break;
      case "open-mobile-menu":
        state.isMobileMenuOpen = true;
        if (!patchMobileDrawerVisibility()) {
          scheduleRender();
        }
        break;
      case "close-mobile-menu":
        state.isMobileMenuOpen = false;
        if (!patchMobileDrawerVisibility()) {
          scheduleRender();
        }
        break;
      case "mobile-open-chat":
        state.isMobileMenuOpen = false;
        navigate("chat");
        break;
      case "open-command-palette":
        state.isCommandPaletteOpen = true;
        if (!patchCommandPaletteVisibility()) {
          scheduleRender();
        }
        break;
      case "close-command-palette":
        state.isCommandPaletteOpen = false;
        state.commandPaletteQuery = "";
        if (!patchCommandPaletteVisibility()) {
          scheduleRender();
        }
        break;
      case "run-command":
        await runCommandAction(actionButton.getAttribute("data-command-id"));
        break;
      case "new-chat":
        state.isMobileMenuOpen = false;
        state.isCommandPaletteOpen = false;
        state.commandPaletteQuery = "";
        createChat();
        break;
      case "remove-chat":
        removeChat(actionButton.getAttribute("data-chat-id"));
        break;
      case "set-mode":
        state.activeMode = actionButton.getAttribute("data-mode") || "auto";
        if (!patchChatComposer()) {
          scheduleRender();
        }
        break;
      case "set-workspace":
        state.workspaceMode = actionButton.getAttribute("data-workspace") || "general";
        if (!patchChatComposer()) {
          scheduleRender();
        }
        break;
      case "stop-generation":
        stopGeneration();
        break;
      case "scroll-to-latest":
        scrollToLatest();
        break;
      case "copy-message":
        await copyMessage(actionButton.getAttribute("data-message-id"));
        break;
      case "reuse-message":
        reuseMessage(actionButton.getAttribute("data-message-id"));
        break;
      case "regenerate":
        await regenerateLastReply();
        break;
      case "feedback-up":
        await feedbackMessage(actionButton.getAttribute("data-message-id"), "up");
        break;
      case "feedback-down":
        await feedbackMessage(actionButton.getAttribute("data-message-id"), "down");
        break;
      case "open-file-picker": {
        const input = app.querySelector("input[name='composer-files']");
        if (input) {
          input.click();
        }
        break;
      }
      case "remove-attachment":
        state.attachments = state.attachments.filter((attachment) => attachment.id !== actionButton.getAttribute("data-attachment-id"));
        state.attachmentError = "";
        if (!patchChatComposer()) {
          scheduleRender();
        }
        break;
      case "token-resend":
        await resendVerificationForTokenPage();
        break;
      case "refresh-admin":
        await loadAdminOverview();
        break;
      case "retrain-admin":
        await retrainAdmin();
        break;
      case "run-evaluations":
        await runAdminEvaluations();
        break;
      default:
        break;
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const name = target.getAttribute("name");
    if (name === "auth-name") {
      state.authForm.name = target.value;
    } else if (name === "auth-email") {
      state.authForm.email = target.value;
    } else if (name === "auth-password") {
      state.authForm.password = target.value;
    } else if (name === "token-password") {
      state.tokenForm.password = target.value;
    } else if (name === "token-confirm-password") {
      state.tokenForm.confirmPassword = target.value;
    } else if (name === "composer-draft") {
      state.draft = target.value;
    } else if (name === "command-palette-query") {
      state.commandPaletteQuery = target.value;
      applyCommandPaletteFilter(state.commandPaletteQuery);
    } else {
      return;
    }
  }

  async function handleChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.name === "composer-files") {
      const result = await readAttachmentsFromFiles(target.files, state.attachments);
      state.attachments = result.attachments;
      state.attachmentError = result.errors[0] || "";
      target.value = "";
      if (!patchChatComposer()) {
        scheduleRender();
      }
    }
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();

    const formType = form.getAttribute("data-form");
    if (formType === "auth") {
      const mode = form.getAttribute("data-mode") || "login";
      await handleAuthSubmit(mode);
      return;
    }
    if (formType === "reset-password") {
      await handleResetPassword();
      return;
    }
    if (formType === "composer") {
      await sendMessage();
    }
  }

  async function copyMessage(messageId) {
    const session = currentSession();
    if (!session) {
      return;
    }
    const message = session.messages.find((item) => item.id === messageId);
    if (!message) {
      return;
    }
    try {
      await navigator.clipboard.writeText(message.content || "");
      state.copiedMessageId = messageId;
      if (!patchMessageState(session.id, messageId)) {
        scheduleRender();
      }
      window.setTimeout(() => {
        if (state.copiedMessageId === messageId) {
          state.copiedMessageId = "";
          if (!patchMessageState(session.id, messageId)) {
            scheduleRender();
          }
        }
      }, 1400);
    } catch (_error) {
      state.copiedMessageId = "";
    }
  }

  function reuseMessage(messageId) {
    const session = currentSession();
    if (!session) {
      return;
    }
    const message = session.messages.find((item) => item.id === messageId);
    if (!message) {
      return;
    }
    state.draft = message.content || "";
    state.attachments = cloneAttachments(message.meta && message.meta.attachments);
    state.attachmentError = "";
    if (!patchChatComposer({ focusComposer: true })) {
      scheduleRender();
    }
  }
})();
