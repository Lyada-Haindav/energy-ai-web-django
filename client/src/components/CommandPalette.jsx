import { BarChart3, Home, LogOut, MessageCircle, MessageCirclePlus, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

function ActionButton({ action, onRun }) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={() => onRun(action)}
      className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08]"
    >
      <span className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/82">
          <Icon size={16} />
        </span>
        <span>
          <span className="block text-sm font-semibold text-white">{action.label}</span>
          <span className="block text-xs text-white/46">{action.hint}</span>
        </span>
      </span>
      <span className="text-[11px] uppercase tracking-[0.18em] text-white/36">{action.shortcut}</span>
    </button>
  );
}

export default function CommandPalette({ open, isAdmin, onClose, onNavigate, onNewChat, onLogout }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const actions = [
    { id: "home", label: "Open Home", hint: "Go back to the landing page", shortcut: "H", icon: Home, run: () => onNavigate("home") },
    { id: "chat", label: "Open Chat", hint: "Jump into the workspace", shortcut: "C", icon: MessageCircle, run: () => onNavigate("chat") },
    { id: "analytics", label: "Open Analytics", hint: "Inspect usage and latency", shortcut: "A", icon: BarChart3, run: () => onNavigate("analytics") },
    ...(isAdmin
      ? [
          {
            id: "admin",
            label: "Open Admin",
            hint: "Training, health, and quality controls",
            shortcut: "D",
            icon: ShieldCheck,
            run: () => onNavigate("admin")
          }
        ]
      : []),
    { id: "new-chat", label: "New Session", hint: "Start a fresh conversation", shortcut: "N", icon: MessageCirclePlus, run: onNewChat },
    { id: "logout", label: "Logout", hint: "Sign out of Energy AI", shortcut: "L", icon: LogOut, run: onLogout }
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const visibleActions = normalizedQuery
    ? actions.filter((action) => `${action.label} ${action.hint}`.toLowerCase().includes(normalizedQuery))
    : actions;

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button type="button" aria-label="Close command palette overlay" onClick={onClose} className="absolute inset-0 bg-black/78 backdrop-blur-sm" />
      <section className="absolute left-1/2 top-[12vh] w-[min(92vw,720px)] -translate-x-1/2 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,11,18,0.98)_0%,rgba(10,16,27,0.96)_100%)] p-4 shadow-[0_50px_120px_-40px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump anywhere, start a session, or open admin..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/38"
          />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72 transition hover:bg-white/[0.1]"
            aria-label="Close command palette"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {visibleActions.map((action) => (
            <ActionButton
              key={action.id}
              action={action}
              onRun={(selected) => {
                selected.run();
                onClose();
              }}
            />
          ))}

          {visibleActions.length === 0 ? (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-white/52">No matching action yet.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
