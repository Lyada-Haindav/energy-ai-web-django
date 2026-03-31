const CODE_LIKE_PATTERN =
  /[`{};$]|=>|<[A-Za-z][^>]*>|^\s*(const|let|var|function|class|import|export|return|if|for|while)\b/m;

const TOKEN_REPLACEMENTS = [
  [/\bwat\b/gi, "what"],
  [/\bwht\b/gi, "what"],
  [/\bhw\b/gi, "how"],
  [/\bu\b/gi, "you"],
  [/\bur\b/gi, "your"],
  [/\br\b/gi, "are"],
  [/\bpls\b/gi, "please"],
  [/\bplz\b/gi, "please"],
  [/\bbcoz\b/gi, "because"],
  [/\bbcz\b/gi, "because"],
  [/\bcuz\b/gi, "because"],
  [/\bmsg\b/gi, "message"],
  [/\bavailabe\b/gi, "available"],
  [/\bteh\b/gi, "the"]
];

function normalizeWhitespace(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\s+/g, " ").trim();
}

function looksCodeLike(text) {
  const value = String(text || "");
  if (!value.trim()) {
    return false;
  }

  return CODE_LIKE_PATTERN.test(value);
}

function replaceStandaloneWhy(text) {
  return text
    .replace(/\by\s+(?=(?:is|are|was|were|do|does|did|not|this|that|there|it|my|your|the|a|an|cant|can't|isnt|isn't|doesnt|doesn't)\b)/gi, "why ")
    .replace(/\by\b(?=\s*\?)/gi, "why");
}

export function normalizeNaturalLanguageText(text) {
  const raw = String(text || "");
  if (!raw.trim()) {
    return "";
  }

  if (looksCodeLike(raw) || raw.includes("[ATTACHED_FILES]")) {
    return normalizeWhitespace(raw);
  }

  let updated = normalizeWhitespace(raw);
  updated = replaceStandaloneWhy(updated);

  for (const [pattern, replacement] of TOKEN_REPLACEMENTS) {
    updated = updated.replace(pattern, replacement);
  }

  return normalizeWhitespace(updated);
}
