const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 160 * 1024;
const MAX_ATTACHMENT_CHARS = 12000;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonl",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "scss",
  "html",
  "xml",
  "svg",
  "py",
  "java",
  "kt",
  "go",
  "rs",
  "php",
  "rb",
  "swift",
  "c",
  "h",
  "hpp",
  "cpp",
  "cs",
  "sql",
  "sh",
  "bash",
  "yml",
  "yaml",
  "toml",
  "env",
  "log",
  "ini",
  "conf",
  "dockerfile"
]);

function extensionFromName(fileName) {
  const value = String(fileName || "").trim().toLowerCase();
  if (!value.includes(".")) {
    return value === "dockerfile" ? "dockerfile" : "";
  }

  return value.split(".").pop() || "";
}

function isTextLikeFile(file) {
  const mimeType = String(file?.type || "").toLowerCase();
  const extension = extensionFromName(file?.name);
  return mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("xml") || TEXT_EXTENSIONS.has(extension);
}

function detectLanguage(fileName) {
  const extension = extensionFromName(fileName);
  const byExtension = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    java: "java",
    kt: "kotlin",
    go: "go",
    rs: "rust",
    php: "php",
    rb: "ruby",
    swift: "swift",
    c: "c",
    h: "c",
    hpp: "cpp",
    cpp: "cpp",
    cs: "csharp",
    css: "css",
    scss: "scss",
    html: "html",
    xml: "xml",
    svg: "svg",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    jsonl: "json",
    md: "markdown",
    markdown: "markdown",
    toml: "toml",
    env: "bash",
    log: "text",
    txt: "text",
    dockerfile: "dockerfile"
  };

  return byExtension[extension] || "text";
}

function trimAttachmentContent(content) {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  if (normalized.length <= MAX_ATTACHMENT_CHARS) {
    return {
      content: normalized,
      truncated: false
    };
  }

  return {
    content: `${normalized.slice(0, MAX_ATTACHMENT_CHARS)}\n\n[truncated]`,
    truncated: true
  };
}

export function attachmentAcceptValue() {
  return [
    ".txt,.md,.markdown,.json,.jsonl,.js,.jsx,.ts,.tsx,.css,.scss,.html,.xml,.svg",
    ".py,.java,.kt,.go,.rs,.php,.rb,.swift,.c,.h,.hpp,.cpp,.cs,.sql,.sh,.bash",
    ".yml,.yaml,.toml,.env,.log,.ini,.conf,Dockerfile",
    "text/*,application/json,application/xml"
  ].join(",");
}

export function cloneAttachments(value) {
  return Array.isArray(value)
    ? value.map((attachment) => ({
        id: String(attachment?.id || crypto.randomUUID()),
        name: String(attachment?.name || "attachment.txt"),
        mimeType: String(attachment?.mimeType || "text/plain"),
        size: Number(attachment?.size || 0),
        language: String(attachment?.language || detectLanguage(attachment?.name)),
        truncated: Boolean(attachment?.truncated),
        content: String(attachment?.content || "")
      }))
    : [];
}

export async function readAttachmentsFromFiles(fileList, currentAttachments = []) {
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
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type || "text/plain",
        size: file.size,
        language: detectLanguage(file.name),
        truncated: trimmed.truncated,
        content: trimmed.content
      });
    } catch {
      errors.push(`Could not read ${file.name}. Try a different file.`);
    }
  }

  return {
    attachments: next,
    errors
  };
}

export function describeAttachmentSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${value} B`;
}

export { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_CHARS };
