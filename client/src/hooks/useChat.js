import { useEffect, useMemo, useRef, useState } from "react";
import { cloneAttachments } from "../lib/attachments";
import { fetchChats, saveChats, streamChat, submitChatFeedback } from "../lib/api";

function bootstrapMessage() {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content:
      "I am Energy AI. Ask anything and I will balance low-energy speed with high-energy reasoning, plus show sources when reliable context is available.",
    meta: {
      model: "bootstrap",
      energyMode: "low"
    }
  };
}

function newSession() {
  const id = crypto.randomUUID();
  return {
    id,
    title: "Untitled Session",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [bootstrapMessage()]
  };
}

function deriveTitle(messages) {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) {
    return "Untitled Session";
  }
  const trimmed = firstUserMessage.content.trim();
  if (!trimmed) {
    const attachments = Array.isArray(firstUserMessage.meta?.attachments) ? firstUserMessage.meta.attachments : [];
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
              if (message.meta?.model !== "bootstrap") {
                return message;
              }

              return {
                ...bootstrapMessage(),
                id: message.id || `bootstrap-${messageIndex}`
              };
            })
          : [bootstrapMessage()]
      };
    })
    .sort((left, right) => left.createdAt - right.createdAt || left.updatedAt - right.updatedAt);
}

function lastSession(sessions) {
  return sessions[sessions.length - 1];
}

function chatErrorMessage(error) {
  if (error?.status === 401) {
    return "Your session expired. Sign in again and resend the message.";
  }

  if (error?.status === 403) {
    return "Verify your email before using chat.";
  }

  if (error?.message) {
    return error.message;
  }

  return "I could not reach the Energy AI backend. Start the server and confirm the provider settings in `.env`.";
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
      latencyMs: 0
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
      latencyMs: 0
    };
  }

  return {
    model: "energy-router",
    role: "router",
    energyMode: "auto",
    startLatencyMs: 0,
    firstTokenLatencyMs: 0,
    latencyMs: 0
  };
}

export function useChat({ enabled }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [activeMode, setActiveMode] = useState("auto");
  const [workspaceMode, setWorkspaceMode] = useState("general");
  const sessionsRef = useRef([]);
  const saveQueueRef = useRef(Promise.resolve());
  const abortControllerRef = useRef(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || lastSession(sessions),
    [sessions, activeSessionId]
  );

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    let ignore = false;

    async function loadChats() {
      if (!enabled) {
        setSessions([]);
        setActiveSessionId(null);
        setSyncError("");
        setIsHydrating(false);
        return;
      }

      setIsHydrating(true);
      setSyncError("");

      try {
        const result = await fetchChats();
        let nextSessions = normalizeSessions(result.sessions);

        if (nextSessions.length === 0) {
          nextSessions = [newSession()];
          void queuePersist(nextSessions);
        }

        if (!ignore) {
          sessionsRef.current = nextSessions;
          setSessions(nextSessions);
          setActiveSessionId((current) => nextSessions.find((session) => session.id === current)?.id || lastSession(nextSessions)?.id || null);
        }
      } catch (error) {
        const fallback = [newSession()];
        if (!ignore) {
          sessionsRef.current = fallback;
          setSessions(fallback);
          setActiveSessionId(fallback[0].id);
          setSyncError(error.message || "Could not load chats.");
        }
      } finally {
        if (!ignore) {
          setIsHydrating(false);
        }
      }
    }

    void loadChats();

    return () => {
      ignore = true;
    };
  }, [enabled]);

  function queuePersist(nextSessions) {
    if (!enabled) {
      return Promise.resolve();
    }

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveChats(nextSessions);
        setSyncError("");
      })
      .catch((error) => {
        setSyncError(error.message || "Could not sync chats.");
      });

    return saveQueueRef.current;
  }

  function replaceSessions(nextSessions) {
    sessionsRef.current = nextSessions;
    setSessions(nextSessions);
    return nextSessions;
  }

  function mutateSession(sessionId, mutate) {
    const next = sessionsRef.current.map((session) => {
      if (session.id !== sessionId) {
        return session;
      }

      const updated = mutate(session);
      return {
        ...updated,
        title: deriveTitle(updated.messages),
        updatedAt: Date.now()
      };
    });

    return replaceSessions(next);
  }

  function createChat() {
    const created = newSession();
    const next = replaceSessions([...sessionsRef.current, created]);
    setActiveSessionId(created.id);
    void queuePersist(next);
  }

  function removeChat(chatId) {
    const removedIndex = sessionsRef.current.findIndex((session) => session.id === chatId);
    const remaining = sessionsRef.current.filter((session) => session.id !== chatId);
    const next = remaining.length > 0 ? remaining : [newSession()];

    replaceSessions(next);
    void queuePersist(next);

    if (activeSessionId === chatId) {
      const fallbackSession =
        remaining[removedIndex] || remaining[removedIndex - 1] || lastSession(next);
      setActiveSessionId(fallbackSession?.id || null);
    }
  }

  async function runAssistantStream({ sessionId, assistantId, payloadMessages, mode, workspaceMode: activeWorkspaceMode }) {
    setIsLoading(true);
    const startedAt = performance.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamChat({
        messages: payloadMessages,
        mode,
        workspaceMode: activeWorkspaceMode,
        signal: controller.signal,
        onEvent: (event) => {
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
                    startLatencyMs: message.meta?.startLatencyMs || Math.round(performance.now() - startedAt),
                    model: event.model,
                    role: event.role,
                    energyMode: event.energyMode,
                    workspaceMode: event.workspaceMode || message.meta?.workspaceMode || activeWorkspaceMode,
                    routeReason: event.routeReason,
                    sources: Array.isArray(event.sources) ? event.sources : []
                  }
                };
              }

              if (event.type === "token") {
                return {
                  ...message,
                  content: message.content + event.token,
                  meta: {
                    ...message.meta,
                    firstTokenLatencyMs: message.meta?.firstTokenLatencyMs || Math.round(performance.now() - startedAt)
                  }
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
                    workspaceMode: event.workspaceMode || message.meta?.workspaceMode || activeWorkspaceMode,
                    routeReason: event.routeReason,
                    sources: Array.isArray(event.sources) ? event.sources : message.meta?.sources || []
                  }
                };
              }

              return message;
            });

            return {
              ...session,
              messages: nextMessages
            };
          });
        }
      });
      await queuePersist(sessionsRef.current);
    } catch (error) {
      const aborted = error?.name === "AbortError";
      mutateSession(sessionId, (session) => ({
        ...session,
        messages: session.messages.map((message) => {
          if (message.id !== assistantId) {
            return message;
          }

          const nextContent = message.content.trim() ? message.content : aborted ? "Generation stopped." : chatErrorMessage(error);
          return {
            ...message,
            content: nextContent,
            meta: {
              ...message.meta,
              stopped: aborted,
              latencyMs: Math.round(performance.now() - startedAt)
            }
          };
        })
      }));

      if (!aborted) {
        console.error(error);
      }

      await queuePersist(sessionsRef.current);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  async function sendMessage(content, attachments = []) {
    const trimmed = content.trim();
    const currentSession =
      sessionsRef.current.find((session) => session.id === activeSessionId) || lastSession(sessionsRef.current);
    const normalizedAttachments = cloneAttachments(attachments);
    if ((!trimmed && normalizedAttachments.length === 0) || !currentSession || isLoading) {
      return;
    }

    const sessionId = currentSession.id;
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
          meta: normalizedAttachments.length
        ? {
            attachments: normalizedAttachments
          }
        : undefined
    };
    const assistantId = crypto.randomUUID();
    const assistantPlaceholder = {
      id: assistantId,
      role: "assistant",
      content: "",
      meta: placeholderMetaForMode(activeMode)
    };
    assistantPlaceholder.meta.workspaceMode = workspaceMode;

    const payloadMessages = [...currentSession.messages, userMessage];

    mutateSession(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, userMessage, assistantPlaceholder]
    }));

    await runAssistantStream({
      sessionId,
      assistantId,
      payloadMessages,
      mode: activeMode,
      workspaceMode
    });
  }

  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

  async function regenerateLastReply() {
    const currentSession =
      sessionsRef.current.find((session) => session.id === activeSessionId) || lastSession(sessionsRef.current);
    if (!currentSession || isLoading) {
      return;
    }

    const sessionId = currentSession.id;
    const baseMessages = [...currentSession.messages];

    if (baseMessages[baseMessages.length - 1]?.role === "assistant") {
      baseMessages.pop();
    }

    const lastUserMessage = [...baseMessages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) {
      return;
    }

    const assistantId = crypto.randomUUID();
    const assistantPlaceholder = {
      id: assistantId,
      role: "assistant",
      content: "",
      meta: placeholderMetaForMode(activeMode)
    };
    assistantPlaceholder.meta.workspaceMode = workspaceMode;

    mutateSession(sessionId, (session) => ({
      ...session,
      messages: [...baseMessages, assistantPlaceholder]
    }));

    await runAssistantStream({
      sessionId,
      assistantId,
      payloadMessages: baseMessages,
      mode: activeMode,
      workspaceMode
    });
  }

  async function feedbackMessage(messageId, feedback) {
    const currentSession =
      sessionsRef.current.find((session) => session.id === activeSessionId) || lastSession(sessionsRef.current);
    if (!currentSession) {
      return;
    }

    const messageIndex = currentSession.messages.findIndex((message) => message.id === messageId);
    const targetMessage = messageIndex >= 0 ? currentSession.messages[messageIndex] : null;
    if (!targetMessage || targetMessage.role !== "assistant") {
      return;
    }
    if (targetMessage.meta?.feedback === feedback) {
      return;
    }

    const promptMessage = [...currentSession.messages.slice(0, messageIndex)].reverse().find((message) => message.role === "user");
    if (!promptMessage) {
      return;
    }

    const sessionId = currentSession.id;
    const next = mutateSession(sessionId, (session) => ({
      ...session,
      messages: session.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              meta: {
                ...message.meta,
                feedback
              }
            }
          : message
      )
    }));

    await queuePersist(next);

    try {
      await submitChatFeedback({
        prompt: promptMessage.content,
        completion: targetMessage.content,
        feedback,
        meta: {
          model: targetMessage.meta?.model,
          role: targetMessage.meta?.role,
          energyMode: targetMessage.meta?.energyMode,
          workspaceMode: targetMessage.meta?.workspaceMode,
          routeReason: targetMessage.meta?.routeReason
        }
      });
      setSyncError("");
    } catch (error) {
      setSyncError(error.message || "Could not save feedback.");
    }
  }

  return {
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
  };
}
