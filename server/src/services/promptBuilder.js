const SHARED_DIRECTIVES = [
  "Be accurate, useful, and honest about uncertainty.",
  "Do not pretend to know facts that are missing or unverified.",
  "Think carefully before answering, but do not expose raw chain-of-thought.",
  "Answer directly first, then add structure, tradeoffs, or examples when helpful.",
  "When returning code, always use fenced markdown code blocks with language tags.",
  "If the request is ambiguous and details are required, ask one concise clarifying question."
].join(" ");

const PROMPT_MAX_MESSAGES = Number(process.env.PROMPT_MAX_MESSAGES || 6);
const PROMPT_MAX_MESSAGE_CHARS = Number(process.env.PROMPT_MAX_MESSAGE_CHARS || 650);
const PROMPT_MAX_ATTACHMENT_MESSAGE_CHARS = Number(process.env.PROMPT_MAX_ATTACHMENT_MESSAGE_CHARS || 14500);
const ATTACHMENT_CONTEXT_MARKER = "[ATTACHED_FILES]";

const SYSTEM_BY_ROLE = {
  fast: [
    "You are Energy AI's low-energy model.",
    "Optimize for fast, efficient, accurate answers with minimal wasted tokens.",
    "Keep responses concise by default, but do not sacrifice correctness.",
    "Escalate complexity only when the user explicitly asks for more depth.",
    SHARED_DIRECTIVES
  ].join(" "),
  deep: [
    "You are Energy AI's high-energy model.",
    "Spend more reasoning budget on complex coding, planning, architecture, and analysis tasks.",
    "Provide structured explanations, explicit tradeoffs, and practical implementation detail.",
    "Prefer crisp conclusions over vague brainstorming.",
    SHARED_DIRECTIVES
  ].join(" "),
  router: [
    "You are Energy AI's routing assistant and safety filter.",
    "Decide whether a request should use the low-energy or high-energy model based on complexity, code, planning depth, and reasoning cost.",
    "Prefer low-energy for short direct questions and high-energy for multi-step analysis."
  ].join(" ")
};

function compactMessageContent(content) {
  const raw = String(content || "").trim().replace(/\r\n/g, "\n");
  const preserveFormatting = raw.includes(ATTACHMENT_CONTEXT_MARKER) || raw.includes("```");
  const text = preserveFormatting ? raw : raw.replace(/\s+/g, " ");
  const maxChars = text.includes(ATTACHMENT_CONTEXT_MARKER) ? PROMPT_MAX_ATTACHMENT_MESSAGE_CHARS : PROMPT_MAX_MESSAGE_CHARS;
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}...`;
}

function selectPromptMessages(messages, intent = null) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  if (safeMessages.length <= 1) {
    return safeMessages;
  }

  if (intent?.ignoreConversationContext) {
    return safeMessages.slice(-1);
  }

  if (!intent?.previousIsMeaningful) {
    return safeMessages.slice(-3);
  }

  return safeMessages.slice(-PROMPT_MAX_MESSAGES);
}

export function buildPrompt(messages, role, options = {}) {
  const { knowledgeContext = "", intent = null, workspaceMode = "general" } = options;
  const system = SYSTEM_BY_ROLE[role] || SYSTEM_BY_ROLE.fast;
  const normalizedWorkspaceMode = normalizeWorkspaceMode(workspaceMode || intent?.workspaceMode);
  const transcript = selectPromptMessages(messages, intent)
    .map((message) => `${message.role.toUpperCase()}: ${compactMessageContent(message.content)}`)
    .join("\n");

  const sections = [system];

  if (knowledgeContext.trim()) {
    sections.push(
      [
        "Use verified external context below when relevant.",
        "Prefer facts supported by the supplied context.",
        "If you rely on the context, cite the matching source number like [1].",
        "If context is insufficient, say what is uncertain instead of guessing.",
        "[KNOWLEDGE_CONTEXT]",
        knowledgeContext.trim(),
        "[/KNOWLEDGE_CONTEXT]"
      ].join("\n")
    );
  }

  if (intent?.normalizedText) {
    sections.push(
      [
        "[INTENT_PROFILE]",
        `type=${intent.type}`,
        `response_style=${intent.responseStyle}`,
        `search_profile=${intent.searchProfile || "reference"}`,
        `needs_depth=${intent.needsDepth ? "yes" : "no"}`,
        `use_previous_context=${intent.previousIsMeaningful && !intent.ignoreConversationContext ? "yes" : "no"}`,
        intent.type === "contest"
          ? "contest_answer_format=idea_then_complexity_then_edge_cases_then_submission_code"
          : "",
        "[/INTENT_PROFILE]"
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (normalizedWorkspaceMode !== "general") {
    sections.push(
      [
        "[WORKSPACE_MODE]",
        `mode=${normalizedWorkspaceMode}`,
        `label=${workspaceModeLabel(normalizedWorkspaceMode)}`,
        `instructions=${workspaceModeInstructions(normalizedWorkspaceMode)}`,
        "[/WORKSPACE_MODE]"
      ].join("\n")
    );
  }

  if (transcript.includes(ATTACHMENT_CONTEXT_MARKER)) {
    sections.push(
      [
        "[ATTACHMENT_POLICY]",
        "When attached files are present, ground the answer in that file context before giving generic advice.",
        "Quote short snippets only when needed, and call out the exact file names that matter.",
        "If the attached files are incomplete, say what is missing and what to inspect next.",
        "[/ATTACHMENT_POLICY]"
      ].join("\n")
    );
  }

  sections.push(`${transcript}\nASSISTANT:`);
  return sections.join("\n\n");
}
import { normalizeWorkspaceMode, workspaceModeInstructions, workspaceModeLabel } from "./workspaceMode.js";
