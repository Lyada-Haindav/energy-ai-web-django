import { MessageCirclePlus, Trash2 } from "lucide-react";

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}

export default function Sidebar({
  sessions,
  activeSessionId,
  setActiveSessionId,
  createChat,
  removeChat,
  owner,
  drawerMode = false,
  onAfterAction,
  className = ""
}) {
  function handleCreateChat() {
    createChat();
    onAfterAction?.();
  }

  function handleSelectSession(sessionId) {
    setActiveSessionId(sessionId);
    onAfterAction?.();
  }

  return (
    <aside
      className={`energy-sidebar-shell energy-panel energy-sheen animate-page-in flex min-h-0 w-full flex-col p-2.5 sm:p-4 lg:h-full ${drawerMode ? "rounded-[26px] border-[#d6ddd0] bg-[linear-gradient(180deg,rgba(255,251,245,0.94)_0%,rgba(249,244,235,0.92)_52%,rgba(245,239,229,0.9)_100%)] shadow-[0_28px_70px_-50px_rgba(31,47,37,0.22)]" : ""} ${className}`}
    >
      <div className={`absolute right-5 top-5 h-24 w-24 rounded-full bg-[#c9dbc7]/20 blur-2xl animate-float ${drawerMode ? "block" : "hidden sm:block"}`} />
      <div className={`absolute left-6 top-24 h-20 w-20 rounded-full bg-[#efd29f]/16 blur-2xl animate-float-wide ${drawerMode ? "block" : "hidden sm:block"}`} />

      <button type="button" onClick={handleCreateChat} className="energy-sidebar-new-button energy-home-primary-button energy-sheen relative mb-3 w-full rounded-[20px] py-2.5 text-sm sm:mb-4 sm:rounded-[22px] sm:py-3">
        <MessageCirclePlus size={16} />
        New Session
      </button>

      <div className={`mb-3 items-center justify-between rounded-[20px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.9)_100%)] px-3 py-2.5 ${drawerMode ? "hidden" : "flex sm:hidden"}`}>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#8a968c]">Energy Memory</p>
          {owner ? <p className="mt-1 max-w-[13rem] truncate text-xs text-[#68786d]">{owner}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#8a968c]">Threads</p>
          <p className="mt-1 text-sm font-semibold text-[#173324]">{sessions.length}</p>
        </div>
      </div>

      <div
        className={`energy-sidebar-meta relative mb-3 rounded-[24px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.96)_0%,rgba(248,244,234,0.92)_52%,rgba(243,238,228,0.88)_100%)] p-3.5 shadow-[0_28px_70px_-50px_rgba(31,47,37,0.22)] ${drawerMode ? "block" : "hidden sm:block"}`}
      >
        <p className="energy-eyebrow">Energy Memory</p>
        {owner ? <p className="mt-1.5 text-xs text-[#68786d]">{owner}</p> : null}

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-[#dce4d8] bg-white/72 p-2.5">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8a968c]">Threads</p>
            <p className="mt-1.5 font-display text-xl font-bold tracking-[-0.04em] text-[#173324]">{sessions.length}</p>
          </div>
          <div className="rounded-2xl border border-[#dce4d8] bg-white/72 p-2.5">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8a968c]">Flow</p>
            <p className="mt-1.5 text-sm font-semibold text-[#48725b]">Static stack</p>
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between px-1 sm:mb-2.5">
        <span className="energy-eyebrow">Conversation stack</span>
        <span className="text-xs text-[#8a968c]">{sessions.length} total</span>
      </div>

      <div
        className={`scrollbar-hide flex min-h-0 gap-2.5 overflow-auto pr-1 ${drawerMode ? "flex-1 flex-col pb-0" : "pb-1 sm:flex-1 sm:flex-col sm:pb-0"}`}
      >
        {sessions.map((session, index) => {
          const selected = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={`energy-session-card group animate-rise shrink-0 rounded-[18px] border p-2.5 transition duration-300 sm:rounded-[22px] ${drawerMode ? "min-w-0" : "min-w-[210px] sm:min-w-0"} ${
                selected
                  ? "border-[#b7d1bc] bg-[linear-gradient(135deg,rgba(241,250,242,0.96)_0%,rgba(226,244,233,0.92)_54%,rgba(248,245,236,0.94)_100%)] shadow-[0_28px_70px_-54px_rgba(31,47,37,0.2)]"
                  : "border-[#dce4d8] bg-[linear-gradient(135deg,rgba(255,252,246,0.92)_0%,rgba(248,244,234,0.88)_100%)] hover:-translate-y-0.5 hover:border-[#a6c4ac]"
              }`}
              style={{ animationDelay: `${Math.min(index * 50, 240)}ms` }}
            >
              <button type="button" onClick={() => handleSelectSession(session.id)} className="w-full text-left">
                <div className="text-xs uppercase tracking-[0.22em] text-[#8a968c]">{selected ? "Active" : "Session"}</div>
                <div className="mt-1.5 max-h-10 overflow-hidden text-ellipsis text-sm font-semibold leading-5 text-[#173324] sm:max-h-12">{session.title}</div>
              </button>

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8a968c]">
                <span>{formatDate(session.updatedAt)}</span>
                <button
                  type="button"
                  onClick={() => {
                    removeChat(session.id);
                  }}
                  className="rounded-xl p-1.5 text-[#8a968c] opacity-100 transition hover:bg-[#fff2ee] hover:text-[#cb6d60] sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
