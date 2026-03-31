export const WORKSPACE_MODE_OPTIONS = [
  { id: "general", label: "Auto", hint: "Reads your prompt" },
  { id: "coding", label: "Coding", hint: "Implementation" },
  { id: "bug-fix", label: "Bug Fix", hint: "Root cause" },
  { id: "code-review", label: "Code Review", hint: "Find risks" },
  { id: "refactor", label: "Refactor", hint: "Cleaner structure" },
  { id: "tests", label: "Tests", hint: "Coverage ideas" },
  { id: "explain-code", label: "Explain Code", hint: "Step by step" },
  { id: "error-log", label: "Error Log", hint: "Trace analysis" },
  { id: "api-contract", label: "API Contract", hint: "Requests and responses" },
  { id: "a11y", label: "A11y", hint: "Accessibility" },
  { id: "performance", label: "Performance", hint: "Speed and weight" },
  { id: "security", label: "Security", hint: "Auth and safety" },
  { id: "stack-detect", label: "Stack Detect", hint: "Infer tech stack" },
  { id: "lint", label: "Lint Hints", hint: "Style and consistency" }
];

const WORKSPACE_MODE_BY_ID = Object.fromEntries(WORKSPACE_MODE_OPTIONS.map((option) => [option.id, option]));

export function workspaceModeById(id) {
  return WORKSPACE_MODE_BY_ID[id] || WORKSPACE_MODE_BY_ID.general;
}

export function workspaceModeLabel(id) {
  return workspaceModeById(id).label;
}
