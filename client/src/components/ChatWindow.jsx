import { Bot, ChevronDown, Flame, Leaf, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import { workspaceModeLabel } from "../lib/workspaceModes";

export default function ChatWindow({ messages, isLoading, userName, workspaceMode, onReusePrompt, onRegenerate, onFeedback }) {
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastAssistantIndex = [...messages].map((message) => message.role).lastIndexOf("assistant");

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return undefined;
    }

    const updateStickyState = () => {
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 140;
      setShowScrollButton(distanceFromBottom >= 180);
    };

    updateStickyState();
    node.addEventListener("scroll", updateStickyState);
    return () => node.removeEventListener("scroll", updateStickyState);
  }, []);

  useLayoutEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return;
    }

    const shouldScroll = lastMessage.role === "user" || shouldStickToBottomRef.current;
    if (!shouldScroll) {
      return;
    }

    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({
        block: "end",
        behavior: lastMessage.role === "user" ? "smooth" : "auto"
      });
    });
  }, [messages, isLoading]);

  return (
    <section className="energy-chat-shell energy-panel energy-sheen animate-page-in relative flex min-h-0 flex-col rounded-none border-x-0 border-t-0 bg-[linear-gradient(180deg,rgba(251,248,241,0.98)_0%,rgba(246,241,232,0.96)_100%)] px-2 pb-1 pt-2 shadow-none sm:min-h-[280px] sm:rounded-[24px] sm:border sm:bg-[linear-gradient(160deg,rgba(255,252,246,0.9)_0%,rgba(248,244,234,0.86)_56%,rgba(243,238,228,0.84)_100%)] sm:p-2.5 sm:shadow-[0_28px_72px_-52px_rgba(31,47,37,0.24)] lg:max-h-[calc(100vh-15.6rem)]">
      <div className="absolute right-10 top-12 hidden h-28 w-28 rounded-full bg-[#c8dcc9]/18 blur-3xl sm:block" />
      <div className="absolute bottom-10 left-8 hidden h-24 w-24 rounded-full bg-[#efd6ae]/16 blur-3xl sm:block" />
      <div className="absolute right-[24%] top-[22%] hidden h-24 w-24 rounded-full bg-[#f1bda6]/12 blur-3xl animate-float-wide sm:block" />

      <header className="energy-chat-toolbar mb-2 hidden flex-col gap-1.5 rounded-[20px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.92)_48%,rgba(244,239,228,0.9)_100%)] px-3 py-2 shadow-[0_22px_58px_-44px_rgba(31,47,37,0.2)] sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="energy-chat-toolbar-icon inline-flex h-8 w-8 items-center justify-center rounded-[18px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(216,231,216,0.88)_0%,rgba(247,239,223,0.72)_100%)] text-[#173324] shadow-[0_14px_34px_-22px_rgba(31,47,37,0.2)]">
            <Bot size={15} />
          </span>
          <div>
            <div className="energy-chip w-fit border-[#d6ddd0] bg-white/72 px-2.5 py-1 text-[10px] text-[#7d8d7e]">
              <Sparkles size={12} />
              Live workspace
            </div>
            <h2 className="energy-chat-title mt-1 font-display text-base font-bold tracking-[-0.05em] text-[#173324] sm:text-[1.18rem]">
              {userName ? `${userName}'s chat` : "Reasoning chat"}
            </h2>
            <p className="energy-chat-subtitle mt-0.5 text-[10px] leading-4 text-[#68786d] sm:text-[11px]">
              Messages stay visible while routing works in the background.
            </p>
          </div>
        </div>

        <div className="energy-chat-toolbar-chips flex flex-wrap items-center gap-1.5">
          {workspaceMode && workspaceMode !== "general" ? (
            <span className="energy-chip border-[#d9ddd4] bg-white/76 px-2.5 py-1 text-[10px] text-[#6f6c55]">{workspaceModeLabel(workspaceMode)}</span>
          ) : null}
          <span className="energy-chip border-[#cde0d0] bg-[#f4faf5] px-2.5 py-1 text-[10px] text-[#48725b]">
            <Leaf size={13} />
            energy-low-own-v1
          </span>
          <span className="energy-chip border-[#eed4ca] bg-[#fff4ee] px-2.5 py-1 text-[10px] text-[#bb5f58]">
            <Flame size={13} />
            energy-high-own-v1
          </span>
          <span className="energy-chip border-[#d6ddd0] bg-white/72 px-2.5 py-1 text-[10px] text-[#7d8d7e]">{messages.length} msgs</span>
        </div>
      </header>

      <div ref={scrollRef} className="scrollbar-hide min-h-0 flex-1 overflow-auto px-0 pb-2 sm:px-0 sm:pb-1">
        <div className="space-y-2 sm:space-y-3">
          {messages.length === 0 ? (
            <div className="flex min-h-[160px] items-center justify-center px-0 py-2 sm:min-h-[220px] sm:px-2 sm:py-4">
              <div className="w-full max-w-2xl rounded-[22px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.9)_56%,rgba(244,239,228,0.9)_100%)] p-4 text-center shadow-[0_30px_80px_-58px_rgba(31,47,37,0.22)] sm:rounded-[26px] sm:p-5">
                <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#d6ddd0] bg-white/72 text-[#173324] sm:h-12 sm:w-12 sm:rounded-[20px]">
                  <Sparkles size={22} />
                </div>
                <h3 className="mt-3 font-display text-base font-bold tracking-[-0.04em] text-[#173324] sm:text-xl">Start the next thread</h3>
                <p className="mt-2 text-sm leading-6 text-[#68786d] sm:leading-6">
                  Ask a coding question, attach files, or hand the assistant a hard debugging task with real context.
                </p>
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLatestAssistant={index === lastAssistantIndex}
              onReusePrompt={onReusePrompt}
              onRegenerate={onRegenerate}
              onFeedback={onFeedback}
            />
          ))}

          {isLoading ? (
            <div className="py-3 text-center text-xs uppercase tracking-[0.24em] text-[#8a968c]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.88)_100%)] px-4 py-2 font-semibold text-[#5b6f65] shadow-[0_20px_48px_-40px_rgba(31,47,37,0.18)]">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#4e8b67] animate-blink" />
                Generating
              </span>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      </div>

      {showScrollButton ? (
        <button
          type="button"
          onClick={() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })}
          className="absolute bottom-4 right-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6ddd0] bg-[rgba(255,252,246,0.94)] text-[#173324] shadow-[0_18px_44px_-26px_rgba(31,47,37,0.18)] transition hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.98)]"
          aria-label="Scroll to latest message"
        >
          <ChevronDown size={18} />
        </button>
      ) : null}
    </section>
  );
}
