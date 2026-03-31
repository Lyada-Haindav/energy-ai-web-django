const CODE_LIKE_PATTERN =
  /[`{};$]|=>|<[A-Za-z][^>]*>|^\s*(const|let|var|function|class|import|export|return|if|for|while)\b/m;

const TOKEN_REPLACEMENTS = [
  [/\bwat\b/gi, "what"],
  [/\bwht\b/gi, "what"],
  [/\bwut\b/gi, "what"],
  [/\bhw\b/gi, "how"],
  [/\bu\b/gi, "you"],
  [/\bur\b/gi, "your"],
  [/\br\b/gi, "are"],
  [/\bpls\b/gi, "please"],
  [/\bplz\b/gi, "please"],
  [/\babt\b/gi, "about"],
  [/\bbtw\b/gi, "by the way"],
  [/\bbcoz\b/gi, "because"],
  [/\bbcz\b/gi, "because"],
  [/\bcuz\b/gi, "because"],
  [/\bcoz\b/gi, "because"],
  [/\bbecoz\b/gi, "because"],
  [/\bshld\b/gi, "should"],
  [/\bcld\b/gi, "could"],
  [/\bcud\b/gi, "could"],
  [/\bwud\b/gi, "would"],
  [/\bdis\b/gi, "this"],
  [/\bdat\b/gi, "that"],
  [/\btho\b/gi, "though"],
  [/\bthru\b/gi, "through"],
  [/\bmsg\b/gi, "message"],
  [/\bavailabe\b/gi, "available"],
  [/\bavailble\b/gi, "available"],
  [/\bauthntication\b/gi, "authentication"],
  [/\bauthenication\b/gi, "authentication"],
  [/\bauthetication\b/gi, "authentication"],
  [/\blogn\b/gi, "login"],
  [/\bpasswrd\b/gi, "password"],
  [/\bresposne\b/gi, "response"],
  [/\bresposnse\b/gi, "response"],
  [/\bresponce\b/gi, "response"],
  [/\bwrkng\b/gi, "working"],
  [/\bclomsy\b/gi, "clumsy"],
  [/\bviberant\b/gi, "vibrant"],
  [/\bteh\b/gi, "the"]
];

const PHRASE_REPLACEMENTS = [
  [/\bwdym\b/gi, "what do you mean"],
  [/\bidk\b/gi, "i do not know"],
  [/\btbh\b/gi, "to be honest"],
  [/\bimo\b/gi, "in my opinion"],
  [/\bimho\b/gi, "in my humble opinion"],
  [/\bgonna\b/gi, "going to"],
  [/\bwanna\b/gi, "want to"],
  [/\bkinda\b/gi, "kind of"],
  [/\bsorta\b/gi, "sort of"],
  [/\bgimme\b/gi, "give me"],
  [/\blemme\b/gi, "let me"],
  [/\bw\/o\b/gi, "without"]
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
    .replace(
      /\by\s+(?=(?:is|are|was|were|do|does|did|not|this|that|there|it|my|your|the|a|an|cant|can't|wont|won't|isnt|isn't|doesnt|doesn't|header|button|login|auth|api|page|screen|mobile|desktop|chat|code|review|available|availabe|working|showing|loading|fixed|visible)\b)/gi,
      "why "
    )
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

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    updated = updated.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of TOKEN_REPLACEMENTS) {
    updated = updated.replace(pattern, replacement);
  }

  return normalizeWhitespace(updated);
}
