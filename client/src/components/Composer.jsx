import { Paperclip, SendHorizonal, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { attachmentAcceptValue, describeAttachmentSize, readAttachmentsFromFiles } from "../lib/attachments";
import { ENERGY_MODE_OPTIONS } from "../lib/energy";
import { WORKSPACE_MODE_OPTIONS } from "../lib/workspaceModes";

export default function Composer({
  isLoading,
  onSend,
  onStop,
  mode,
  setMode,
  workspaceMode,
  setWorkspaceMode,
  prefillText = "",
  prefillAttachments = [],
  prefillNonce = 0
}) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!prefillNonce) {
      return;
    }

    setDraft(prefillText);
    setAttachments(Array.isArray(prefillAttachments) ? prefillAttachments : []);
    setAttachmentError("");
  }, [prefillAttachments, prefillNonce, prefillText]);

  function submit(event) {
    event?.preventDefault();
    if (isLoading) {
      return;
    }

    if (!draft.trim() && attachments.length === 0) {
      return;
    }

    onSend(draft, attachments);
    setDraft("");
    setAttachments([]);
    setAttachmentError("");
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    submit(event);
  }

  async function handleFilesSelected(event) {
    const { attachments: nextAttachments, errors } = await readAttachmentsFromFiles(event.target.files, attachments);
    setAttachments(nextAttachments);
    setAttachmentError(errors[0] || "");
    event.target.value = "";
  }

  function removeAttachment(attachmentId) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
    setAttachmentError("");
  }

  return (
    <form
      onSubmit={submit}
      className="energy-chat-composer energy-panel energy-sheen animate-page-in rounded-none border-x-0 border-b-0 border-t border-[#d6ddd0] bg-[linear-gradient(180deg,rgba(251,248,241,0.98)_0%,rgba(246,241,232,0.96)_100%)] p-2 shadow-[0_-18px_52px_-40px_rgba(31,47,37,0.18)] sm:rounded-[24px] sm:border sm:bg-[linear-gradient(160deg,rgba(255,252,246,0.9)_0%,rgba(248,244,234,0.86)_56%,rgba(243,238,228,0.84)_100%)] sm:p-2.5"
    >
      <div className="mb-2 rounded-[18px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.92)_0%,rgba(248,244,234,0.88)_100%)] p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="energy-chip border-[#d6ddd0] bg-white/72 px-2.5 py-1 text-[10px] text-[#7d8d7e]">Route</span>
            <span className="hidden text-[10px] text-[#7d8d7e] sm:inline">Auto-detects review, bug-fix, tests, security, and more from your prompt.</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={attachmentAcceptValue()}
              onChange={handleFilesSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[#d6ddd0] bg-white/72 px-3 py-1.5 text-[10px] font-semibold text-[#173324] transition hover:bg-white/88"
            >
              <Paperclip size={13} />
              Attach
            </button>
            <span className="hidden energy-chip border-[#d6ddd0] bg-white/76 text-[#627267] sm:inline-flex">
              <Sparkles size={12} />
              Ctrl/Cmd + K
            </span>
          </div>
        </div>

        <div className="energy-route-grid scrollbar-hide mt-2 flex gap-2 overflow-x-auto pb-1">
        {ENERGY_MODE_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.id}
            onClick={() => setMode(option.id)}
            className={`min-w-[104px] shrink-0 rounded-[15px] border px-3 py-1.5 text-left transition duration-300 hover:border-[#cad8cd] ${
              mode === option.id ? option.activeClass : option.idleClass
            }`}
          >
            <span className="block text-[11px] font-semibold">{option.label}</span>
            <span className="mt-0.5 block text-[8px] uppercase tracking-[0.16em] opacity-80">{option.hint}</span>
          </button>
        ))}
        </div>

        <div className="scrollbar-hide mt-2 flex gap-2 overflow-x-auto pb-1">
          {WORKSPACE_MODE_OPTIONS.map((option) => {
            const active = workspaceMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setWorkspaceMode(option.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-left transition ${
                  active
                    ? "border-[#b9d1bd] bg-[linear-gradient(135deg,rgba(238,248,239,0.94)_0%,rgba(247,241,228,0.88)_100%)] text-[#173324] shadow-[0_16px_36px_-24px_rgba(31,47,37,0.16)]"
                    : "border-[#d6ddd0] bg-white/72 text-[#5b6f65] hover:bg-white/88"
                }`}
              >
                <span className="block text-[10px] font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[8px] uppercase tracking-[0.14em] text-[#8a968c]">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(attachments.length > 0 || attachmentError) ? (
        <div className="mb-2 rounded-[16px] border border-[#d6ddd0] bg-[linear-gradient(135deg,rgba(255,252,246,0.94)_0%,rgba(248,244,234,0.9)_100%)] p-2">
        {attachments.length ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex max-w-full items-center gap-2 rounded-[14px] border border-[#d6ddd0] bg-white/72 px-3 py-1.5 text-left text-[10px] text-[#173324]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{attachment.name}</span>
                  <span className="block text-[9px] text-[#7d8d7e]">{attachment.language} · {describeAttachmentSize(attachment.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#d6ddd0] bg-white/82 text-[#5b6f65] transition hover:bg-white"
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

          {attachmentError ? <p className="mt-2 text-[10px] text-[#fca5a5]">{attachmentError}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Ask anything. Energy AI will stay fast when it can and go deeper when the work demands it."
          className="energy-chat-textarea energy-input h-[74px] resize-none rounded-[20px] border-[#d6ddd0] bg-white/82 px-4 py-3 text-sm leading-6 text-[#173324] placeholder:text-[#8a968c] sm:h-[92px] sm:rounded-[24px] sm:px-4 sm:py-3"
        />
        <button
          type={isLoading ? "button" : "submit"}
          onClick={isLoading ? onStop : undefined}
          disabled={!isLoading && !draft.trim() && attachments.length === 0}
          className="energy-home-primary-button energy-sheen min-h-[46px] w-full rounded-[18px] px-5 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[52px] sm:w-auto sm:rounded-[20px] sm:px-5"
        >
          {isLoading ? <Square size={16} /> : <SendHorizonal size={16} />}
          <span>{isLoading ? "Stop" : "Send"}</span>
        </button>
      </div>
    </form>
  );
}
