import { Bot, Check, Copy, Ellipsis, FileCode2, PencilLine, RotateCcw, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { describeAttachmentSize } from "../lib/attachments";
import { energyKeyFromMeta, energyLabelFromMeta, energyOptionById, modelDisplayName } from "../lib/energy";
import { workspaceModeLabel } from "../lib/workspaceModes";

function ModelChip({ meta }) {
  if (!meta?.model || meta.model === "bootstrap") {
    return null;
  }

  const energyKey = energyKeyFromMeta(meta);
  const energyOption = energyOptionById(energyKey);
  const visibleLatencyMs = Number(meta.firstTokenLatencyMs || meta.startLatencyMs || meta.latencyMs || 0);

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[#8a968c]">
      <span className="energy-chip border-[#d6ddd0] bg-white/72 text-[#5b6f65]">{modelDisplayName(meta.model)}</span>
      <span className={`energy-chip ${energyOption.chipClass}`}>{energyLabelFromMeta(meta)}</span>
      {meta.workspaceMode && meta.workspaceMode !== "general" ? (
        <span className="energy-chip border-[#d6ddd0] bg-white/72 text-[#7c6840]">{workspaceModeLabel(meta.workspaceMode)}</span>
      ) : null}
      {visibleLatencyMs ? <span className="energy-chip border-[#d6ddd0] bg-white/72 text-[#7d8d7e]">{visibleLatencyMs} ms</span> : null}
      {meta.energyScore ? <span className="energy-chip border-[#d6ddd0] bg-white/72 text-[#7d8d7e]">energy {meta.energyScore}</span> : null}
    </div>
  );
}

function Sources({ sources }) {
  const [open, setOpen] = useState(false);

  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="energy-chip border-[#d6ddd0] bg-white/72 text-[#5b6f65] transition hover:bg-white/88"
      >
        {open ? "Hide sources" : `Show sources (${sources.length})`}
      </button>
      {open ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {sources.map((source, index) => (
            <a
              key={`${source.url || source.title}-${index}`}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="energy-chip border-[#d6ddd0] bg-white/72 text-[#5b6f65] transition hover:-translate-y-0.5 hover:bg-white/88"
            >
              {source.title || `Source ${index + 1}`}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function parseContentSegments(content) {
  const text = String(content || "");
  const segments = [];
  const regex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let cursor = 0;
  let match = regex.exec(text);

  while (match) {
    if (match.index > cursor) {
      segments.push({
        type: "text",
        value: text.slice(cursor, match.index)
      });
    }

    segments.push({
      type: "code",
      language: match[1] || "text",
      value: match[2] || ""
    });

    cursor = match.index + match[0].length;
    match = regex.exec(text);
  }

  if (cursor < text.length) {
    segments.push({
      type: "text",
      value: text.slice(cursor)
    });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-[24px] border border-[#d6ddd0] bg-[#fffdf8] text-[#173324] shadow-[0_24px_54px_-42px_rgba(31,47,37,0.16)]">
      <div className="flex items-center justify-between border-b border-[#e4e9df] px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-[#8a968c]">
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-full border border-[#d6ddd0] bg-white/82 px-3 py-1 text-[11px] font-semibold text-[#173324] transition hover:bg-white"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-xs leading-7">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MessageContent({ content }) {
  const segments = parseContentSegments(content);

  return (
    <div className="space-y-1.5">
      {segments.map((segment, index) => {
        if (segment.type === "code") {
          return <CodeBlock key={`code-${index}`} language={segment.language} code={segment.value} />;
        }

        if (!segment.value.trim()) {
          return null;
        }

        return (
          <div key={`text-${index}`} className="whitespace-pre-wrap leading-7">
            {segment.value}
          </div>
        );
      })}
    </div>
  );
}

function AttachmentList({ attachments }) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <span
          key={attachment.id || attachment.name}
          className="inline-flex max-w-full items-center gap-2 rounded-[14px] border border-[#d6ddd0] bg-white/72 px-3 py-1.5 text-[11px] text-[#173324]"
        >
          <FileCode2 size={13} className="shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{attachment.name}</span>
            <span className="block text-[11px] text-[#7d8d7e]">
              {attachment.language || "text"} · {describeAttachmentSize(attachment.size)}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

function ActionMenuItem({ children, active = false, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-[12px] font-semibold transition ${
        active
          ? "border-[#cddbcf] bg-[#f3f9f4] text-[#173324]"
          : "border-[#d6ddd0] bg-white/72 text-[#5b6f65] hover:bg-white/88"
      }`}
    >
      {children}
    </button>
  );
}

export default function MessageBubble({ message, isLatestAssistant, onReusePrompt, onRegenerate, onFeedback }) {
  const fromUser = message.role === "user";
  const energyKey = energyKeyFromMeta(message.meta);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const bubbleClass = fromUser
    ? "ml-auto max-w-[94%] border-[#c9ddcb] bg-[linear-gradient(135deg,rgba(236,248,238,0.98)_0%,rgba(223,241,227,0.96)_54%,rgba(214,235,219,0.92)_100%)] text-[#173324] shadow-[0_28px_70px_-54px_rgba(31,47,37,0.16)] sm:max-w-[82%]"
    : energyKey === "deep"
      ? "mr-auto max-w-[96%] border-[#edd8d1] bg-[linear-gradient(135deg,rgba(255,246,241,0.98)_0%,rgba(250,238,233,0.95)_52%,rgba(247,243,237,0.92)_100%)] text-[#173324] shadow-[0_28px_72px_-54px_rgba(31,47,37,0.16)] sm:max-w-[86%]"
      : "mr-auto max-w-[96%] border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.98)_0%,rgba(248,244,234,0.95)_54%,rgba(244,239,228,0.92)_100%)] text-[#173324] shadow-[0_28px_72px_-54px_rgba(31,47,37,0.14)] sm:max-w-[86%]";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  function handleMenuCopy() {
    handleCopy();
    setMenuOpen(false);
  }

  function handleMenuReusePrompt() {
    onReusePrompt?.({
      content: message.content,
      attachments: Array.isArray(message.meta?.attachments) ? message.meta.attachments : []
    });
    setMenuOpen(false);
  }

  function handleMenuRegenerate() {
    onRegenerate?.();
    setMenuOpen(false);
  }

  function handleMenuFeedback(value) {
    onFeedback?.(message.id, value);
    setMenuOpen(false);
  }

  return (
    <article className={`animate-rise relative overflow-hidden rounded-[22px] border px-3 py-3 transition duration-300 hover:-translate-y-0.5 sm:rounded-[26px] sm:px-3.5 sm:py-3.5 ${bubbleClass}`}>
      <div className="mb-2 flex items-start justify-between gap-3 sm:mb-2.5">
        <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${fromUser ? "text-[#5f7967]" : "text-[#8a968c]"}`}>
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-2xl ${
              fromUser
                ? "border border-[#c9ddcb] bg-white/82 text-[#173324]"
                : "border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(241,248,241,0.92)_0%,rgba(247,241,228,0.82)_100%)] text-[#173324]"
            }`}
          >
            {fromUser ? <User size={13} /> : <Bot size={13} />}
          </span>
          {fromUser ? "You" : "Energy AI"}
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Open message actions"
            aria-expanded={menuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/72 text-[#5b6f65] transition hover:bg-white/88"
          >
            <Ellipsis size={18} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.55rem)] z-20 w-[208px] rounded-[22px] border border-[#d6ddd0] bg-[rgba(255,251,245,0.96)] p-2 shadow-[0_28px_80px_-40px_rgba(31,47,37,0.16)] backdrop-blur-2xl">
              <div className="space-y-2">
                {fromUser ? (
                  <>
                    <ActionMenuItem onClick={handleMenuReusePrompt} ariaLabel="Edit and resend prompt">
                      <PencilLine size={14} />
                      Edit prompt
                    </ActionMenuItem>
                    <ActionMenuItem onClick={handleMenuCopy} ariaLabel="Copy prompt">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </ActionMenuItem>
                  </>
                ) : (
                  <>
                    <ActionMenuItem onClick={handleMenuCopy} ariaLabel="Copy answer">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </ActionMenuItem>
                    {isLatestAssistant ? (
                      <ActionMenuItem onClick={handleMenuRegenerate} ariaLabel="Regenerate answer">
                        <RotateCcw size={14} />
                        Regenerate
                      </ActionMenuItem>
                    ) : null}
                    <ActionMenuItem
                      active={message.meta?.feedback === "up"}
                      onClick={() => handleMenuFeedback("up")}
                      ariaLabel="Good answer"
                    >
                      <ThumbsUp size={14} />
                      Helpful
                    </ActionMenuItem>
                    <ActionMenuItem
                      active={message.meta?.feedback === "down"}
                      onClick={() => handleMenuFeedback("down")}
                      ariaLabel="Bad answer"
                    >
                      <ThumbsDown size={14} />
                      Needs work
                    </ActionMenuItem>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {fromUser ? <AttachmentList attachments={message.meta?.attachments} /> : null}
      <MessageContent content={message.content || "..."} />
      {!fromUser ? <ModelChip meta={message.meta} /> : null}
      {!fromUser && message.meta?.routeReason ? (
        <p className="mt-2.5 text-[11px] leading-5 text-[#7d8d7e]">{message.meta.routeReason}</p>
      ) : null}
      {!fromUser && message.meta?.stopped ? (
        <div className="mt-2.5">
          <span className="energy-chip border-[#d6ddd0] bg-white/72 text-[#7d8d7e]">Stopped early</span>
        </div>
      ) : null}
      {!fromUser ? <Sources sources={message.meta?.sources} /> : null}
    </article>
  );
}
