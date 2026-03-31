import {
  BarChart3,
  Flame,
  Leaf,
  Loader2,
  LogOut,
  MailCheck,
  Menu,
  MessageCircle,
  MessageCirclePlus,
  Search,
  UserCircle2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminPage from "./components/AdminPage";
import AnalyticsPage from "./components/AnalyticsPage";
import AuthPage from "./components/AuthPage";
import ChatWindow from "./components/ChatWindow";
import CommandPalette from "./components/CommandPalette";
import Composer from "./components/Composer";
import EnergyBrand from "./components/EnergyBrand";
import HomePage from "./components/HomePage";
import Sidebar from "./components/Sidebar";
import TokenActionPage from "./components/TokenActionPage";
import { useAuth } from "./hooks/useAuth";
import { useChat } from "./hooks/useChat";

const PUBLIC_ROUTES = new Set(["home", "login", "signup", "forgot-password", "reset-password", "verify-email"]);
const APP_ROUTES = new Set(["chat", "analytics"]);
const ADMIN_ROUTES = new Set(["admin"]);

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
    email: params.get("email") || ""
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
    "verify-email": "/verify-email"
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

function StatusBanner({ tone = "neutral", children, action }) {
  const toneClass =
    tone === "error"
      ? "border-[#edc6bf] bg-[#fff1ed] text-[#9a4a3b]"
      : tone === "success"
        ? "border-[#cfe4d4] bg-[#eff8f0] text-[#2f6a47]"
        : "border-[#dddcc8] bg-[#fffaf0] text-[#7c6840]";

  return (
    <div
      className={`energy-panel energy-sheen animate-page-in mb-4 flex flex-col gap-3 rounded-[28px] border px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between ${toneClass}`}
    >
      <div>{children}</div>
      {action}
    </div>
  );
}

function previewMessage(baseText, error) {
  return error ? `${baseText} ${error}` : baseText;
}

function PreviewLink({ href, label }) {
  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      className="energy-space-secondary mt-3 inline-flex px-4 py-2 text-sm"
    >
      {label}
    </a>
  );
}

function AppShell({
  page,
  user,
  sessions,
  activeSession,
  activeSessionId,
  setActiveSessionId,
  createChat,
  removeChat,
  sendMessage,
  stopGeneration,
  regenerateLastReply,
  feedbackMessage,
  isLoading,
  isHydrating,
  syncError,
  activeMode,
  setActiveMode,
  workspaceMode,
  setWorkspaceMode,
  onNavigate,
  onLogout,
  onResendVerification
}) {
  const [banner, setBanner] = useState(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [composerSeed, setComposerSeed] = useState({ value: "", attachments: [], nonce: 0 });

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [page, activeSessionId]);

  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase?.() || "";
      const isTypingTarget = tagName === "input" || tagName === "textarea" || target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen((current) => !current);
        return;
      }

      if (!isTypingTarget && event.key.toLowerCase() === "n" && page === "chat") {
        event.preventDefault();
        createChat();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createChat, page]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const syncMenuState = (event) => {
      if (event.matches) {
        setIsMobileMenuOpen(false);
      }
    };

    syncMenuState(media);
    media.addEventListener?.("change", syncMenuState);
    return () => media.removeEventListener?.("change", syncMenuState);
  }, []);

  async function resendVerification() {
    setIsResendingVerification(true);

    try {
      const result = await onResendVerification({ email: user.email });
      setBanner({
        tone: result.emailDelivery?.previewOnly ? "neutral" : "success",
        text: result.emailDelivery?.previewOnly
          ? previewMessage(
              "Verification email prepared. Delivery is not configured yet, so use the preview link.",
              result.emailDelivery?.error
            )
          : `${result.message || "Verification email sent."} If you do not see it soon, check spam or promotions for \`Verify your Energy AI email\`.`,
        previewUrl: result.emailDelivery?.previewOnly ? result.emailDelivery?.previewUrl : "",
        previewLabel: "Open verification preview"
      });
    } catch (error) {
      setBanner({
        tone: "error",
        text: error.message || "Could not resend verification email."
      });
    } finally {
      setIsResendingVerification(false);
    }
  }

  return (
    <main className="energy-home-page-clean energy-clean-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-6rem] h-72 w-72 rounded-full bg-[#efcb81]/22 blur-3xl animate-drift" />
        <div className="absolute right-[-6rem] top-[2rem] h-80 w-80 rounded-full bg-[#b5d0b8]/18 blur-3xl animate-float" />
        <div className="absolute bottom-[-8rem] right-[6%] h-80 w-80 rounded-full bg-[#f0b98f]/18 blur-3xl animate-drift" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(170,196,170,0.16),transparent_52%)]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-40 px-0 pt-0 sm:sticky sm:px-4 sm:pt-3 lg:px-6">
        <div className="energy-app-topbar energy-home-clean-nav energy-page-enter mx-auto flex min-h-[4rem] w-full max-w-[1440px] flex-col gap-2 rounded-none border-x-0 border-t-0 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:rounded-[22px] sm:border sm:px-4 sm:py-2 lg:px-5">
          <div className="flex w-full items-center justify-between gap-3 text-[#173324] sm:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/72 text-[#173324] transition hover:bg-white/88"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            <EnergyBrand size={38} className="min-w-0 flex-1 justify-center" titleClassName="text-base text-[#173324]" showSubtitle={false} />

            <button
              type="button"
              onClick={() => {
                if (page === "chat") {
                  createChat();
                  return;
                }

                onNavigate("chat");
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/72 text-[#173324] transition hover:bg-white/88"
              aria-label={page === "chat" ? "Start new chat" : "Open chat"}
            >
              {page === "chat" ? <MessageCirclePlus size={18} /> : <MessageCircle size={18} />}
            </button>
          </div>

          <EnergyBrand
            size={40}
            className="hidden sm:flex sm:w-auto"
            titleClassName="text-lg sm:text-[1.08rem] text-[#173324]"
            subtitleClassName="text-[10px] text-[#7d8d7e]"
          />

          <div className="hidden w-full flex-wrap items-center gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <span className="energy-chip border-[#d7dfd2] bg-white/72 text-[#48725b]">
                <Leaf size={12} />
                Low Energy
              </span>
              <span className="energy-chip border-[#ead7bd] bg-[#fff4df] text-[#9a7532]">
                <Flame size={12} />
                High Energy
              </span>
            </div>

            <div className="w-full rounded-full border border-[#d6ddd0] bg-white/70 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => onNavigate("chat")}
                className={`inline-flex min-w-[98px] flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition sm:flex-none ${
                  page === "chat"
                    ? "bg-[linear-gradient(180deg,#173324_0%,#10261d_100%)] text-white shadow-[0_18px_40px_-28px_rgba(16,38,29,0.42)]"
                    : "text-[#173324] hover:bg-white/88"
                }`}
              >
                <MessageCircle size={14} />
                Chat
              </button>
              <button
                type="button"
                onClick={() => onNavigate("analytics")}
                className={`inline-flex min-w-[98px] flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition sm:flex-none ${
                  page === "analytics"
                    ? "bg-[linear-gradient(180deg,#173324_0%,#10261d_100%)] text-white shadow-[0_18px_40px_-28px_rgba(16,38,29,0.42)]"
                    : "text-[#173324] hover:bg-white/88"
                }`}
              >
                <BarChart3 size={14} />
                Analytics
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-[16px] border border-[#d6ddd0] bg-white/72 px-3 py-2 text-sm font-semibold text-[#173324] transition hover:bg-white/88 lg:inline-flex"
            >
              <Search size={14} />
              Command
              <span className="rounded-full border border-[#d6ddd0] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#7d8d7e]">Ctrl K</span>
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[16px] border border-[#d6ddd0] bg-white/72 px-3 py-2 text-[#173324] backdrop-blur sm:max-w-[220px] sm:flex-none">
              <UserCircle2 size={18} />
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold leading-none">{user.name}</p>
                <p className="mt-1 hidden text-xs text-[#7d8d7e] xl:block">{user.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-[#d6ddd0] bg-white/72 px-3 py-2 text-sm font-semibold text-[#173324] transition hover:bg-white/88"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-50 lg:hidden ${isMobileMenuOpen ? "" : "pointer-events-none"}`}>
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setIsMobileMenuOpen(false)}
          className={`absolute inset-0 bg-black/72 transition duration-300 ${isMobileMenuOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[84vw] max-w-[340px] flex-col border-r border-[#d6ddd0] bg-[linear-gradient(180deg,rgba(250,246,238,0.98)_0%,rgba(247,241,230,0.98)_48%,rgba(244,238,226,0.98)_100%)] px-3 py-3 shadow-[0_40px_120px_-60px_rgba(43,53,40,0.28)] transition duration-300 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between gap-3 rounded-[24px] border border-[#d6ddd0] bg-white/72 px-3 py-3 text-[#173324]">
            <EnergyBrand size={40} className="min-w-0 flex-1" titleClassName="text-lg text-[#173324]" subtitleClassName="text-[10px] text-[#7d8d7e]" />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/72 text-[#173324] transition hover:bg-white/88"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onNavigate("chat");
                setIsMobileMenuOpen(false);
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-[20px] px-3 py-3 text-sm font-semibold transition ${
                page === "chat"
                  ? "bg-[linear-gradient(180deg,#173324_0%,#10261d_100%)] text-white shadow-[0_18px_40px_-28px_rgba(16,38,29,0.42)]"
                  : "border border-[#d6ddd0] bg-white/72 text-[#173324]"
              }`}
            >
              <MessageCircle size={15} />
              Chat
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigate("analytics");
                setIsMobileMenuOpen(false);
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-[20px] px-3 py-3 text-sm font-semibold transition ${
                page === "analytics"
                  ? "bg-[linear-gradient(180deg,#173324_0%,#10261d_100%)] text-white shadow-[0_18px_40px_-28px_rgba(16,38,29,0.42)]"
                  : "border border-[#d6ddd0] bg-white/72 text-[#173324]"
              }`}
            >
              <BarChart3 size={15} />
              Analytics
            </button>
          </div>

          <div className="mt-3 flex min-h-0 flex-1">
            <Sidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              setActiveSessionId={setActiveSessionId}
              createChat={createChat}
              removeChat={removeChat}
              owner={user.email}
              drawerMode
              onAfterAction={() => setIsMobileMenuOpen(false)}
              className="h-full flex-1"
            />
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3 text-sm font-semibold text-[#173324] transition hover:bg-white/88"
          >
            <LogOut size={15} />
            Logout
          </button>
        </aside>
      </div>

      <section
        className={`energy-app-content relative mx-auto w-full max-w-[1440px] px-0 pb-0 pt-[4.55rem] sm:p-3 sm:pt-3 lg:px-6 lg:pb-5 lg:pt-4 ${
          page === "chat" ? "min-h-[calc(100svh-4.55rem)] lg:min-h-[calc(100vh-5.2rem)]" : ""
        }`}
      >
        <CommandPalette
          open={isCommandPaletteOpen}
          isAdmin={Boolean(user?.isAdmin)}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={onNavigate}
          onNewChat={() => {
            onNavigate("chat");
            createChat();
          }}
          onLogout={onLogout}
        />

        {!user.emailVerified ? (
          <StatusBanner
            tone="neutral"
            action={
              <button
                type="button"
                onClick={resendVerification}
                disabled={isResendingVerification}
                className="energy-space-secondary inline-flex px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResendingVerification ? <Loader2 size={14} className="animate-spin" /> : <MailCheck size={14} />}
                Resend verification
              </button>
            }
          >
            Verify <strong>{user.email}</strong> to complete your account setup.
          </StatusBanner>
        ) : null}

        {banner ? (
          <StatusBanner tone={banner.tone}>
            <div>
              <div>{banner.text}</div>
              <PreviewLink href={banner.previewUrl} label={banner.previewLabel} />
            </div>
          </StatusBanner>
        ) : null}

        {syncError ? <StatusBanner tone="error">{syncError}</StatusBanner> : null}

        <div key={page} className="energy-page-enter h-full">
          {isHydrating ? (
            <div className="energy-panel energy-sheen flex min-h-[55vh] items-center justify-center p-6">
              <div className="energy-panel energy-sheen inline-flex items-center gap-3 rounded-[24px] px-5 py-3 text-sm text-[#365041]">
                <Loader2 size={16} className="animate-spin" />
                Loading your private chats
              </div>
            </div>
          ) : page === "chat" ? (
            <div className="energy-workspace-grid grid min-h-[calc(100svh-4.55rem)] gap-0 sm:gap-2 md:gap-3 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)]">
              <div className="hidden lg:block lg:h-full">
                <Sidebar
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  setActiveSessionId={setActiveSessionId}
                  createChat={createChat}
                  removeChat={removeChat}
                  owner={user.email}
                />
              </div>
              <section className="energy-workspace-main grid min-h-0 grid-rows-[auto_auto] gap-0 sm:gap-2 lg:content-start">
                <ChatWindow
                  messages={activeSession?.messages || []}
                  isLoading={isLoading}
                  userName={user.name}
                  workspaceMode={workspaceMode}
                  onReusePrompt={(payload) =>
                    setComposerSeed({
                      value: typeof payload === "string" ? payload : payload?.content || "",
                      attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
                      nonce: Date.now()
                    })
                  }
                  onRegenerate={regenerateLastReply}
                  onFeedback={feedbackMessage}
                />
                <Composer
                  isLoading={isLoading}
                  onSend={sendMessage}
                  onStop={stopGeneration}
                  mode={activeMode}
                  setMode={setActiveMode}
                  workspaceMode={workspaceMode}
                  setWorkspaceMode={setWorkspaceMode}
                  prefillText={composerSeed.value}
                  prefillAttachments={composerSeed.attachments}
                  prefillNonce={composerSeed.nonce}
                />
              </section>
            </div>
          ) : (
            <AnalyticsPage sessions={sessions} />
          )}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const {
    user,
    isAuthenticated,
    isBootstrapping,
    register,
    login,
    logout,
    refreshUser,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword
  } = useAuth();
  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createChat,
    removeChat,
    sendMessage,
    stopGeneration,
    regenerateLastReply,
    feedbackMessage,
    isLoading,
    isHydrating,
    syncError,
    activeMode,
    setActiveMode,
    workspaceMode,
    setWorkspaceMode
  } = useChat({ enabled: Boolean(isAuthenticated && user?.emailVerified) });

  const [route, setRoute] = useState(parseRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    const onPopState = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  function navigate(page, params = {}) {
    if (page === "admin") {
      window.history.pushState({}, "", "/admin");
      setRoute(parseRoute());
      return;
    }

    const targetHash = hashForPage(page, params);
    if (window.location.pathname === "/admin") {
      window.history.pushState({}, "", `/${targetHash}`);
      setRoute(parseRoute());
      return;
    }

    window.location.hash = targetHash;
  }

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    if (!isAuthenticated && (APP_ROUTES.has(route.page) || ADMIN_ROUTES.has(route.page))) {
      navigate("login");
      return;
    }

    if (isAuthenticated && user && !user.emailVerified && (APP_ROUTES.has(route.page) || ADMIN_ROUTES.has(route.page))) {
      navigate("verify-email", { email: user.email });
      return;
    }

    if (isAuthenticated && user?.emailVerified && ADMIN_ROUTES.has(route.page) && !user?.isAdmin) {
      navigate("home");
      return;
    }

    if (isAuthenticated && user?.emailVerified && (route.page === "login" || route.page === "signup")) {
      navigate("chat");
    }
  }, [isAuthenticated, isBootstrapping, route.page, user]);

  const page = useMemo(() => route.page, [route.page]);

  if (isBootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#020307_0%,#07101b_100%)] px-4 text-white">
        <div className="inline-flex items-center gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(11,15,24,0.92)_0%,rgba(10,22,32,0.86)_100%)] px-5 py-4 text-sm text-white/78 shadow-[0_28px_72px_-42px_rgba(0,0,0,1)]">
          <Loader2 size={16} className="animate-spin" />
          Loading Energy AI
        </div>
      </main>
    );
  }

  if (page === "home") {
    return <HomePage isAuthenticated={isAuthenticated} user={user} onNavigate={navigate} />;
  }

  if (page === "admin" && isAuthenticated && user?.emailVerified && user?.isAdmin) {
    return <AdminPage user={user} onNavigate={navigate} />;
  }

  if (!isAuthenticated && PUBLIC_ROUTES.has(page)) {
    if (page === "reset-password" || page === "verify-email") {
      return (
        <TokenActionPage
          mode={page}
          token={route.token}
          email={route.email}
          onVerifyEmail={async (tokenValue, emailValue) => {
            const result = await verifyEmail(tokenValue, emailValue);
            await refreshUser().catch(() => null);
            return result;
          }}
          onResetPassword={resetPassword}
          onResendVerification={resendVerification}
          navigate={navigate}
        />
      );
    }

    return (
      <AuthPage
        mode={page}
        onLogin={login}
        onRegister={register}
        onForgotPassword={forgotPassword}
        navigate={navigate}
        defaultEmail={route.email}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthPage
        mode="login"
        onLogin={login}
        onRegister={register}
        onForgotPassword={forgotPassword}
        navigate={navigate}
        defaultEmail={route.email}
      />
    );
  }

  if (page === "reset-password" || page === "verify-email") {
    return (
      <TokenActionPage
        mode={page}
        token={route.token}
        email={user.email}
        onVerifyEmail={async (tokenValue, emailValue) => {
          const result = await verifyEmail(tokenValue, emailValue);
          await refreshUser();
          return result;
        }}
        onResetPassword={resetPassword}
        onResendVerification={resendVerification}
        navigate={navigate}
      />
    );
  }

  return (
    <AppShell
      page={page}
      user={user}
      sessions={sessions}
      activeSession={activeSession}
      activeSessionId={activeSessionId}
        setActiveSessionId={setActiveSessionId}
        createChat={createChat}
        removeChat={removeChat}
        sendMessage={sendMessage}
        stopGeneration={stopGeneration}
        regenerateLastReply={regenerateLastReply}
        feedbackMessage={feedbackMessage}
        isLoading={isLoading}
        isHydrating={isHydrating}
        syncError={syncError}
      activeMode={activeMode}
      setActiveMode={setActiveMode}
      workspaceMode={workspaceMode}
      setWorkspaceMode={setWorkspaceMode}
      onNavigate={navigate}
      onLogout={async () => {
        await logout();
        navigate("home");
      }}
      onResendVerification={resendVerification}
    />
  );
}
