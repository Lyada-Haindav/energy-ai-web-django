import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim());
    values[key] = value;
  }

  return values;
}

function loadLocalEnv() {
  const merged = {};
  const candidates = [
    path.join(__dirname, "..", "server", ".env"),
    path.join(__dirname, ".env"),
    path.join(__dirname, ".env.local")
  ];

  for (const candidate of candidates) {
    Object.assign(merged, parseEnvFile(candidate));
  }

  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const PORT = Number(process.env.PORT || 3010);
const DAILY_FREE_LIMIT = 500;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const EMAIL_PROVIDER = process.env.EMAILS_FREE_PROVIDER || "brevo";

function senderConfig() {
  const email = String(process.env.EMAIL_FROM || "").trim();
  const name = String(process.env.EMAIL_FROM_NAME || "emails free").trim() || "emails free";
  return email ? { email, name } : null;
}

const LIVE_DELIVERY_AVAILABLE = EMAIL_PROVIDER === "brevo" && Boolean(process.env.BREVO_API_KEY && senderConfig());
const REQUESTED_DELIVERY_MODE = process.env.EMAILS_FREE_DELIVERY_MODE || "";
const DELIVERY_MODE = REQUESTED_DELIVERY_MODE
  ? REQUESTED_DELIVERY_MODE === "live" && !LIVE_DELIVERY_AVAILABLE
    ? "mock"
    : REQUESTED_DELIVERY_MODE
  : LIVE_DELIVERY_AVAILABLE
    ? "live"
    : "mock";

function pad(value) {
  return String(value).padStart(2, "0");
}

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function createPastIso({ days = 0, hours = 0, minutes = 0 }) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hours);
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toBoolean(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

const SEND_WINDOWS = {
  morning: "Morning focus",
  afternoon: "Afternoon ship",
  evening: "Evening catch-up",
  "late-night": "Late night"
};

const SPAM_TERMS = ["free money", "guaranteed", "urgent", "winner", "buy now", "act now", "instant cash"];

const ADVANCED_CAPABILITIES = [
  {
    id: "smart-warmup",
    title: "Smart warmup pacing",
    body: "Protects deliverability by recommending gentler send waves for larger batches."
  },
  {
    id: "segment-intel",
    title: "Audience heat segments",
    body: "Highlights high-intent and at-risk subscribers so campaigns hit the right inboxes first."
  },
  {
    id: "send-copilot",
    title: "Send copilot scoring",
    body: "Scores each campaign before launch using subject quality, segment health, timing, and personalization."
  },
  {
    id: "automation-studio",
    title: "Journey automations",
    body: "Runs lifecycle workflows with goal tracking, timing steps, and manual launches."
  },
  {
    id: "transactional-rails",
    title: "Transactional rails",
    body: "Exposes API-style sending, SMTP credentials, sender domains, and webhook visibility."
  }
];

const SAMPLE_CONTACTS = [
  {
    id: "ct-001",
    name: "Maya Chen",
    email: "maya@northstarlabs.io",
    company: "Northstar Labs",
    tags: ["founder", "beta", "product"],
    engagementScore: 94,
    status: "active",
    lastOpenedAt: createPastIso({ hours: 8 })
  },
  {
    id: "ct-002",
    name: "Arjun Patel",
    email: "arjun@launchgrid.co",
    company: "Launchgrid",
    tags: ["growth", "creator"],
    engagementScore: 82,
    status: "active",
    lastOpenedAt: createPastIso({ days: 1, hours: 2 })
  },
  {
    id: "ct-003",
    name: "Sofia Ramirez",
    email: "sofia@orbitcommerce.com",
    company: "Orbit Commerce",
    tags: ["ecommerce", "product"],
    engagementScore: 76,
    status: "active",
    lastOpenedAt: createPastIso({ days: 2 })
  },
  {
    id: "ct-004",
    name: "Jonah Price",
    email: "jonah@signalforge.dev",
    company: "Signal Forge",
    tags: ["founder", "engineering"],
    engagementScore: 68,
    status: "active",
    lastOpenedAt: createPastIso({ days: 3, hours: 6 })
  },
  {
    id: "ct-005",
    name: "Nila Kannan",
    email: "nila@makerwave.app",
    company: "Makerwave",
    tags: ["creator", "community"],
    engagementScore: 59,
    status: "active",
    lastOpenedAt: createPastIso({ days: 5 })
  },
  {
    id: "ct-006",
    name: "Owen Brooks",
    email: "owen@quietstack.ai",
    company: "Quietstack",
    tags: ["growth", "sales"],
    engagementScore: 38,
    status: "active",
    lastOpenedAt: createPastIso({ days: 10 })
  },
  {
    id: "ct-007",
    name: "Fatima Noor",
    email: "fatima@loopletters.com",
    company: "Loop Letters",
    tags: ["ops"],
    engagementScore: 41,
    status: "active",
    lastOpenedAt: createPastIso({ days: 14 })
  },
  {
    id: "ct-008",
    name: "Elliot Nash",
    email: "elliot@oldsignal.fm",
    company: "Old Signal",
    tags: ["legacy"],
    engagementScore: 18,
    status: "unsubscribed",
    lastOpenedAt: createPastIso({ days: 40 })
  },
  {
    id: "ct-009",
    name: "Riya Dsouza",
    email: "riya@northcoastlabs.io",
    company: "North Coast Labs",
    tags: ["beta", "growth"],
    engagementScore: 33,
    status: "bounced",
    lastOpenedAt: createPastIso({ days: 27 })
  }
];

const SAMPLE_TEMPLATES = [
  {
    id: "tpl-launch",
    name: "Launch memo",
    category: "Product",
    subject: "Your launch update from emails free",
    preview: "Fast shipping note with a strong CTA and a founder-friendly tone.",
    content:
      "Hi {{name}},\n\nWe just shipped a sharper emails free experience built for focused teams.\n\nWhat changed:\n- smarter send scoring\n- clearer quota tracking\n- faster launch flow\n\nReply if you want early access to the next premium features.\n\nCheers,\nThe emails free team"
  },
  {
    id: "tpl-weekly",
    name: "Weekly pulse",
    category: "Newsletter",
    subject: "This week's build notes and email wins",
    preview: "A crisp weekly digest with highlights, metrics, and next steps.",
    content:
      "Hi {{name}},\n\nHere is your weekly pulse:\n- strongest campaign this week\n- audience segments heating up\n- what to send next\n\nIf you want the premium roadmap, reply with your biggest email bottleneck.\n\nTeam emails free"
  },
  {
    id: "tpl-reactivate",
    name: "Reactivation nudge",
    category: "Lifecycle",
    subject: "Still want updates from emails free?",
    preview: "Gentle re-engagement template for quiet subscribers.",
    content:
      "Hi {{name}},\n\nWe noticed it has been a while since you opened an email from us.\n\nIf you still want product notes, stay subscribed and we will keep the updates useful and light.\n\nIf not, you can ignore this message and we will slow down.\n\nThanks,\nemails free"
  },
  {
    id: "tpl-welcome",
    name: "Welcome flow",
    category: "Automation",
    subject: "Welcome to emails free",
    preview: "A first-touch onboarding email for new signups.",
    content:
      "Hi {{name}},\n\nWelcome to emails free.\n\nYou now have access to the control room, audience intelligence, and a free runway of 500 emails per day.\n\nStart with your highest-intent segment and ship something useful.\n\nTeam emails free"
  },
  {
    id: "tpl-reset",
    name: "Password reset",
    category: "Transactional",
    subject: "Reset your emails free password",
    preview: "A transactional template for account recovery and trust-sensitive flows.",
    content:
      "Hi {{name}},\n\nWe received a request to reset your password.\n\nUse the secure link in the app to continue. If this was not you, you can ignore this email.\n\nThe emails free security team"
  }
];

const SEGMENT_DEFINITIONS = [
  {
    id: "all-active",
    name: "All active",
    description: "Everyone currently eligible to receive campaigns.",
    matcher: (contact) => contact.status === "active"
  },
  {
    id: "founders",
    name: "Founders and operators",
    description: "Founders and close-to-product operators with strategic interest.",
    matcher: (contact) => contact.status === "active" && (contact.tags.includes("founder") || contact.tags.includes("ops"))
  },
  {
    id: "product-led",
    name: "Product-led builders",
    description: "Subscribers who care about launches, product updates, and weekly builds.",
    matcher: (contact) =>
      contact.status === "active" &&
      (contact.tags.includes("product") || contact.tags.includes("creator") || contact.tags.includes("growth"))
  },
  {
    id: "high-intent",
    name: "High intent",
    description: "Highly engaged readers most likely to open and click.",
    matcher: (contact) => contact.status === "active" && contact.engagementScore >= 80
  },
  {
    id: "re-engage",
    name: "Re-engage",
    description: "Low-engagement contacts who need a softer comeback sequence.",
    matcher: (contact) => contact.status === "active" && contact.engagementScore < 45
  }
];

const SAMPLE_DOMAINS = [
  {
    id: "dom-001",
    domain: "mg.emailsfree.app",
    status: "warming",
    dkim: "verified",
    spf: "verified",
    dmarc: "configured",
    reputation: 96,
    lastCheckedAt: createPastIso({ hours: 2 })
  },
  {
    id: "dom-002",
    domain: "notify.emailsfree.app",
    status: "ready",
    dkim: "verified",
    spf: "verified",
    dmarc: "configured",
    reputation: 98,
    lastCheckedAt: createPastIso({ hours: 5 })
  }
];

const SAMPLE_API_KEYS = [
  {
    id: "key-001",
    name: "Production API",
    mode: "live",
    maskedKey: "ef_live_x1m4...4ac9",
    scopes: ["smtp", "transactional", "events"],
    createdAt: createPastIso({ days: 19 }),
    lastUsedAt: createPastIso({ hours: 1 })
  },
  {
    id: "key-002",
    name: "Automation worker",
    mode: "internal",
    maskedKey: "ef_worker_9q2...7bb1",
    scopes: ["automations", "contacts", "templates"],
    createdAt: createPastIso({ days: 12 }),
    lastUsedAt: createPastIso({ hours: 7 })
  }
];

const SAMPLE_FORMS = [
  {
    id: "form-001",
    name: "Launch waitlist",
    source: "Landing page",
    submissionsToday: 42,
    totalSubmissions: 1284,
    conversionRate: 12.6,
    syncSegmentId: "product-led"
  },
  {
    id: "form-002",
    name: "Docs beta access",
    source: "Documentation footer",
    submissionsToday: 19,
    totalSubmissions: 342,
    conversionRate: 8.4,
    syncSegmentId: "founders"
  }
];

const SAMPLE_WEBHOOKS = [
  {
    id: "hook-001",
    name: "Delivery events",
    target: "/webhooks/delivery",
    status: "healthy",
    lastSeenAt: createPastIso({ minutes: 42 }),
    eventTypes: ["delivered", "opened", "clicked"]
  },
  {
    id: "hook-002",
    name: "Bounce monitor",
    target: "/webhooks/bounce",
    status: "healthy",
    lastSeenAt: createPastIso({ hours: 2 }),
    eventTypes: ["bounced", "blocked", "complaint"]
  }
];

const SAMPLE_AUTOMATIONS = [
  {
    id: "aut-001",
    name: "Welcome sequence",
    trigger: "Contact joins waitlist",
    objective: "Turn new signups into active readers within 3 days.",
    status: "active",
    segmentId: "product-led",
    templateId: "tpl-welcome",
    recipientsPerRun: 14,
    sendWindow: "morning",
    smartWarmup: true,
    steps: [
      { delay: "Instant", action: "Send welcome flow" },
      { delay: "+1 day", action: "Send launch memo" },
      { delay: "+3 days", action: "Tag engaged contacts as high intent" }
    ],
    runs: 32,
    lastRunAt: createPastIso({ hours: 6 }),
    goalRate: 47
  },
  {
    id: "aut-002",
    name: "Weekly product digest",
    trigger: "Every Friday at 9:00",
    objective: "Keep the product-led segment warm with a repeatable weekly habit.",
    status: "active",
    segmentId: "product-led",
    templateId: "tpl-weekly",
    recipientsPerRun: 88,
    sendWindow: "afternoon",
    smartWarmup: true,
    steps: [
      { delay: "Friday", action: "Send weekly pulse" },
      { delay: "+2 hours", action: "Resend to non-openers with variant subject" }
    ],
    runs: 11,
    lastRunAt: createPastIso({ days: 1, hours: 4 }),
    goalRate: 39
  },
  {
    id: "aut-003",
    name: "Quiet audience revive",
    trigger: "No open for 14 days",
    objective: "Recover colder subscribers before they fully disengage.",
    status: "draft",
    segmentId: "re-engage",
    templateId: "tpl-reactivate",
    recipientsPerRun: 24,
    sendWindow: "evening",
    smartWarmup: false,
    steps: [
      { delay: "Instant", action: "Send reactivation nudge" },
      { delay: "+5 days", action: "Pause if still inactive" }
    ],
    runs: 4,
    lastRunAt: createPastIso({ days: 5 }),
    goalRate: 21
  }
];

const SAMPLE_TRANSACTIONAL_EVENTS = [
  {
    id: "txn-001",
    lane: "API",
    recipient: "maya@northstarlabs.io",
    templateName: "Password reset",
    subject: "Reset your emails free password",
    status: "Delivered",
    sentAt: createPastIso({ hours: 4 })
  },
  {
    id: "txn-002",
    lane: "SMTP",
    recipient: "arjun@launchgrid.co",
    templateName: "Welcome flow",
    subject: "Welcome to emails free",
    status: "Delivered",
    sentAt: createPastIso({ hours: 9 })
  }
];

const SAMPLE_ACTIVITY = [
  {
    id: "act-001",
    kind: "automation",
    title: "Welcome sequence completed 14-contact run",
    status: "healthy",
    createdAt: createPastIso({ hours: 6 })
  },
  {
    id: "act-002",
    kind: "transactional",
    title: "Password reset delivered to Maya Chen",
    status: "healthy",
    createdAt: createPastIso({ hours: 4 })
  },
  {
    id: "act-003",
    kind: "infrastructure",
    title: "mg.emailsfree.app passed DKIM verification",
    status: "healthy",
    createdAt: createPastIso({ days: 1, hours: 1 })
  }
];

function buildSegments(contacts) {
  return SEGMENT_DEFINITIONS.map((definition) => {
    const members = contacts.filter(definition.matcher);
    const activeMembers = members.filter((contact) => contact.status === "active");

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      count: members.length,
      averageEngagement: Math.round(average(activeMembers.map((contact) => contact.engagementScore))),
      sample: members.slice(0, 3).map((contact) => contact.name)
    };
  });
}

function getSegmentById(segmentId, contacts = SAMPLE_CONTACTS) {
  const segments = buildSegments(contacts);
  return segments.find((segment) => segment.id === segmentId) || segments[0];
}

function getTemplateById(templateId, templates = SAMPLE_TEMPLATES) {
  return templates.find((template) => template.id === templateId) || templates[0];
}

function normalizeCampaignPayload(payload, options = {}) {
  const contacts = options.contacts || SAMPLE_CONTACTS;
  const templates = options.templates || SAMPLE_TEMPLATES;
  const segment = getSegmentById(String(payload.segmentId || "all-active"), contacts);
  const template = getTemplateById(String(payload.templateId || "tpl-launch"), templates);
  const parsedRecipients = Number(payload.recipients || segment.count || 0);

  return {
    name: String(payload.name || "").trim(),
    subject: String(payload.subject || template.subject || "").trim(),
    abVariantSubject: String(payload.abVariantSubject || "").trim(),
    content: String(payload.content || template.content || "").trim(),
    recipients: Number.isFinite(parsedRecipients) ? Math.round(parsedRecipients) : 0,
    segmentId: segment.id,
    segmentName: segment.name,
    templateId: template.id,
    templateName: template.name,
    sendWindow: Object.hasOwn(SEND_WINDOWS, payload.sendWindow) ? payload.sendWindow : "morning",
    smartWarmup: toBoolean(payload.smartWarmup),
    segment,
    template
  };
}

function validateCampaign(campaign) {
  if (!campaign.name) {
    return "Campaign name is required.";
  }
  if (!campaign.subject) {
    return "Subject is required.";
  }
  if (!campaign.content) {
    return "Email copy is required.";
  }
  if (!Number.isFinite(campaign.recipients) || campaign.recipients < 1 || campaign.recipients > DAILY_FREE_LIMIT) {
    return "Recipients must be between 1 and 500 on the free plan.";
  }

  return null;
}

function calculateIntelligence(campaign) {
  let score = 86;
  const boosts = [];
  const warnings = [];
  const notes = [];
  const subjectLower = campaign.subject.toLowerCase();
  const contentLower = campaign.content.toLowerCase();
  const spamMatches = SPAM_TERMS.filter((term) => subjectLower.includes(term) || contentLower.includes(term));
  const subjectLength = campaign.subject.length;

  if (subjectLength >= 28 && subjectLength <= 58) {
    score += 6;
    boosts.push("Subject length is in a healthy inbox range.");
  } else if (subjectLength < 20) {
    score -= 7;
    warnings.push("Subject is very short. Add more context so opens are not left to guesswork.");
  } else {
    score -= 5;
    warnings.push("Subject is long. Tighter subjects usually land better on mobile inboxes.");
  }

  if (campaign.content.includes("{{name}}")) {
    score += 5;
    boosts.push("Personalization token detected in the body.");
  } else {
    score -= 6;
    warnings.push("No personalization token found. Adding {{name}} can improve opens and replies.");
  }

  if (spamMatches.length) {
    score -= 9 + spamMatches.length * 4;
    warnings.push(`Spam-sensitive wording detected: ${spamMatches.join(", ")}.`);
  } else {
    boosts.push("No obvious spam-heavy phrases detected.");
  }

  if (campaign.segment.averageEngagement >= 75) {
    score += 8;
    boosts.push(`Selected segment is healthy at ${campaign.segment.averageEngagement}% engagement.`);
  } else if (campaign.segment.averageEngagement < 45) {
    score -= 8;
    warnings.push("Selected segment is cold. Use a softer sequence or a stronger hook.");
  } else {
    notes.push("Segment engagement is workable, but not elite.");
  }

  if (campaign.smartWarmup && campaign.recipients >= 80) {
    score += 7;
    boosts.push("Smart warmup is active for a larger batch.");
  } else if (!campaign.smartWarmup && campaign.recipients >= 120) {
    score -= 9;
    warnings.push("Large send without warmup enabled. Consider pacing the launch.");
  }

  if (campaign.sendWindow === "morning") {
    score += 4;
    boosts.push("Morning send window aligns with stronger open behavior.");
  } else if (campaign.sendWindow === "late-night") {
    score -= 7;
    warnings.push("Late-night sends usually drag down opens unless the audience is global.");
  } else {
    notes.push(`Using ${SEND_WINDOWS[campaign.sendWindow]} as the send window.`);
  }

  if (campaign.abVariantSubject) {
    score += 3;
    boosts.push("A/B subject variant is ready for a stronger test loop.");
  } else {
    notes.push("No A/B subject set. A second subject can improve learning speed.");
  }

  const finalScore = clamp(Math.round(score), 28, 99);
  const projectedOpenRate = clamp(Math.round(18 + (finalScore - 50) * 0.45), 12, 58);
  const projectedClickRate = clamp(
    Math.round(3 + (finalScore - 50) * 0.12 + (campaign.abVariantSubject ? 1 : 0)),
    1,
    18
  );
  const projectedBounceRate = clamp(Number((6.2 - finalScore * 0.05 - (campaign.smartWarmup ? 0.5 : 0)).toFixed(2)), 0.4, 8.5);
  const projectedUnsubscribeRate = clamp(
    Number((0.14 + spamMatches.length * 0.08 + (campaign.segment.averageEngagement < 45 ? 0.08 : 0)).toFixed(2)),
    0.05,
    1.8
  );

  let band = "Needs work";
  if (finalScore >= 90) {
    band = "Prime";
  } else if (finalScore >= 80) {
    band = "Strong";
  } else if (finalScore >= 70) {
    band = "Usable";
  }

  const topInsight =
    boosts[0] ||
    warnings[0] ||
    "Campaign is ready for iteration. The strongest gains now come from better targeting and cleaner copy.";

  return {
    score: finalScore,
    band,
    projectedOpenRate,
    projectedClickRate,
    projectedBounceRate,
    projectedUnsubscribeRate,
    recommendedHourlyBatch: campaign.smartWarmup ? Math.max(40, Math.ceil(campaign.recipients / 4)) : campaign.recipients,
    boosts,
    warnings,
    notes,
    topInsight
  };
}

function estimateAnalytics(recipients, intelligence) {
  const bounced = Math.round(recipients * (intelligence.projectedBounceRate / 100));
  const delivered = Math.max(0, recipients - bounced);
  const opened = Math.min(delivered, Math.round(delivered * (intelligence.projectedOpenRate / 100)));
  const clicked = Math.min(opened, Math.round(delivered * (intelligence.projectedClickRate / 100)));
  const unsubscribed = Math.min(
    Math.max(0, delivered - clicked),
    Math.round(delivered * (intelligence.projectedUnsubscribeRate / 100))
  );

  return {
    delivered,
    opened,
    clicked,
    bounced,
    unsubscribed
  };
}

function buildCampaignRecord(payload, options = {}) {
  const normalized = normalizeCampaignPayload(payload, options);
  const intelligence = options.intelligence || calculateIntelligence(normalized);
  const analytics = options.analytics || estimateAnalytics(normalized.recipients, intelligence);

  return {
    id: options.id || `cmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: normalized.name,
    subject: normalized.subject,
    abVariantSubject: normalized.abVariantSubject,
    previewText: normalized.content.slice(0, 140),
    recipients: normalized.recipients,
    segmentId: normalized.segmentId,
    segmentName: normalized.segmentName,
    templateId: normalized.templateId,
    templateName: normalized.templateName,
    sendWindow: normalized.sendWindow,
    smartWarmup: normalized.smartWarmup,
    status: options.status || (DELIVERY_MODE === "mock" ? "Delivered in mock mode" : "Queued"),
    sentAt: options.sentAt || new Date().toISOString(),
    intelligence,
    analytics
  };
}

function createSeedCampaigns() {
  return [
    buildCampaignRecord(
      {
        name: "Founder briefing",
        subject: "Your early-access roadmap is ready",
        abVariantSubject: "Early-access roadmap: founder briefing inside",
        content: SAMPLE_TEMPLATES[0].content,
        recipients: 28,
        segmentId: "founders",
        templateId: "tpl-launch",
        sendWindow: "morning",
        smartWarmup: true
      },
      {
        id: "cmp-seed-001",
        sentAt: createPastIso({ days: 2, hours: 3 }),
        status: "Delivered"
      }
    ),
    buildCampaignRecord(
      {
        name: "Weekly maker pulse",
        subject: "This week's build notes and email wins",
        abVariantSubject: "This week in emails free: launch notes and wins",
        content: SAMPLE_TEMPLATES[1].content,
        recipients: 94,
        segmentId: "product-led",
        templateId: "tpl-weekly",
        sendWindow: "afternoon",
        smartWarmup: true
      },
      {
        id: "cmp-seed-002",
        sentAt: createPastIso({ days: 4, hours: 5 }),
        status: "Delivered"
      }
    ),
    buildCampaignRecord(
      {
        name: "Reactivation wave",
        subject: "Still want updates from emails free?",
        content: SAMPLE_TEMPLATES[2].content,
        recipients: 36,
        segmentId: "re-engage",
        templateId: "tpl-reactivate",
        sendWindow: "evening",
        smartWarmup: false
      },
      {
        id: "cmp-seed-003",
        sentAt: createPastIso({ days: 6, hours: 2 }),
        status: "Delivered"
      }
    )
  ];
}

function ensureFreshDay(state) {
  const today = getDateKey();

  if (state.dateKey !== today) {
    state.dateKey = today;
    state.sentToday = 0;
  }
}

function buildAutomationSummary(automation, state) {
  const normalized = normalizeCampaignPayload(
    {
      name: automation.name,
      segmentId: automation.segmentId,
      templateId: automation.templateId,
      recipients: automation.recipientsPerRun,
      sendWindow: automation.sendWindow,
      smartWarmup: automation.smartWarmup
    },
    {
      contacts: state.contacts,
      templates: state.templates
    }
  );
  const intelligence = calculateIntelligence(normalized);

  return {
    ...automation,
    segmentName: normalized.segmentName,
    templateName: normalized.templateName,
    score: intelligence.score,
    projectedOpenRate: intelligence.projectedOpenRate,
    hourlyBatch: intelligence.recommendedHourlyBatch
  };
}

function buildActivityEntry(kind, title, status = "healthy") {
  return {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    kind,
    title,
    status,
    createdAt: new Date().toISOString()
  };
}

function buildTransactionalEvent({ lane, recipient, templateName, subject, status }) {
  return {
    id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    lane,
    recipient,
    templateName,
    subject,
    status,
    sentAt: new Date().toISOString()
  };
}

const state = {
  contacts: structuredClone(SAMPLE_CONTACTS),
  templates: structuredClone(SAMPLE_TEMPLATES),
  domains: structuredClone(SAMPLE_DOMAINS),
  apiKeys: structuredClone(SAMPLE_API_KEYS),
  forms: structuredClone(SAMPLE_FORMS),
  webhooks: structuredClone(SAMPLE_WEBHOOKS),
  automations: structuredClone(SAMPLE_AUTOMATIONS),
  transactionalEvents: structuredClone(SAMPLE_TRANSACTIONAL_EVENTS),
  activity: structuredClone(SAMPLE_ACTIVITY),
  campaigns: createSeedCampaigns(),
  dateKey: getDateKey(),
  sentToday: 0
};

function buildAnalyticsSummary(campaigns) {
  if (!campaigns.length) {
    return {
      totalSent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      averageDeliverability: 0,
      bestCampaign: null
    };
  }

  const totals = campaigns.reduce(
    (accumulator, campaign) => {
      accumulator.totalSent += campaign.recipients;
      accumulator.delivered += campaign.analytics.delivered;
      accumulator.opened += campaign.analytics.opened;
      accumulator.clicked += campaign.analytics.clicked;
      accumulator.bounced += campaign.analytics.bounced;
      accumulator.unsubscribed += campaign.analytics.unsubscribed;
      accumulator.scores.push(campaign.intelligence.score);
      return accumulator;
    },
    {
      totalSent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      scores: []
    }
  );

  const bestCampaign = campaigns
    .slice()
    .sort((left, right) => right.intelligence.score - left.intelligence.score)[0];

  return {
    totalSent: totals.totalSent,
    delivered: totals.delivered,
    opened: totals.opened,
    clicked: totals.clicked,
    bounced: totals.bounced,
    unsubscribed: totals.unsubscribed,
    openRate: totals.delivered ? Number(((totals.opened / totals.delivered) * 100).toFixed(1)) : 0,
    clickRate: totals.delivered ? Number(((totals.clicked / totals.delivered) * 100).toFixed(1)) : 0,
    bounceRate: totals.totalSent ? Number(((totals.bounced / totals.totalSent) * 100).toFixed(1)) : 0,
    averageDeliverability: Math.round(average(totals.scores)),
    bestCampaign: bestCampaign
      ? {
          id: bestCampaign.id,
          name: bestCampaign.name,
          score: bestCampaign.intelligence.score,
          segmentName: bestCampaign.segmentName
        }
      : null
  };
}

function buildRecommendations(segments, analytics, remaining, automationCenter) {
  const recommendations = [];
  const reengageSegment = segments.find((segment) => segment.id === "re-engage");

  if (analytics.averageDeliverability < 82) {
    recommendations.push("Tighten subject lines and keep personalization in the first screen of the email.");
  }

  if (reengageSegment && reengageSegment.count > 0) {
    recommendations.push(`Run a softer reactivation note for ${reengageSegment.count} colder contacts before the next product blast.`);
  }

  if (automationCenter.activeCount < 2) {
    recommendations.push("Promote one more automation from draft to active so your lifecycle flows are doing more of the work.");
  }

  if (remaining <= 150) {
    recommendations.push(`Only ${remaining} emails remain on the free cap today, so reserve the next send for your highest-intent segment.`);
  } else {
    recommendations.push("Use the free cap on a smaller high-intent segment first, then widen once the copy proves itself.");
  }

  return recommendations.slice(0, 4);
}

function buildDashboardPayload(state) {
  ensureFreshDay(state);

  const segments = buildSegments(state.contacts);
  const analytics = buildAnalyticsSummary(state.campaigns);
  const remaining = Math.max(0, DAILY_FREE_LIMIT - state.sentToday);
  const activeContacts = state.contacts.filter((contact) => contact.status === "active");
  const suppressedContacts = state.contacts.filter((contact) => contact.status !== "active");
  const automationSummaries = state.automations.map((automation) => buildAutomationSummary(automation, state));
  const automationCenter = {
    activeCount: automationSummaries.filter((automation) => automation.status === "active").length,
    totalRuns: automationSummaries.reduce((sum, automation) => sum + automation.runs, 0),
    automations: automationSummaries,
    activity: state.activity.slice(0, 8)
  };
  const growth = {
    totalForms: state.forms.length,
    submissionsToday: state.forms.reduce((sum, form) => sum + form.submissionsToday, 0),
    forms: state.forms
  };
  const infrastructure = {
    smtp: {
      host: "smtp.emailsfree.app",
      port: 587,
      username: "emailsfree-live",
      tls: "TLS enforced",
      status: shouldUseLiveDelivery() ? "Live via Brevo" : "Sandboxed",
      provider: shouldUseLiveDelivery() ? "Brevo" : "Mock"
    },
    domains: state.domains,
    apiKeys: state.apiKeys,
    webhooks: state.webhooks
  };
  const transactional = {
    events: state.transactionalEvents.slice(0, 8),
    quotaBucket: remaining
  };

  return {
    brand: "emails free",
    plan: "Free",
    dailyLimit: DAILY_FREE_LIMIT,
    sentToday: state.sentToday,
    remaining,
    premiumStatus: "coming-soon",
    deliveryMode: DELIVERY_MODE,
    deliveryProvider: shouldUseLiveDelivery() ? "Brevo" : "Mock",
    capabilities: ADVANCED_CAPABILITIES,
    contacts: {
      total: state.contacts.length,
      active: activeContacts.length,
      suppressed: suppressedContacts.length,
      averageEngagement: Math.round(average(activeContacts.map((contact) => contact.engagementScore))),
      segments,
      rows: state.contacts.slice(0, 8)
    },
    templates: state.templates,
    analytics,
    campaigns: state.campaigns.slice(0, 10),
    automationCenter,
    infrastructure,
    growth,
    transactional,
    recommendations: buildRecommendations(segments, analytics, remaining, automationCenter)
  };
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validateRecipientEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shouldUseLiveDelivery() {
  return DELIVERY_MODE === "live" && LIVE_DELIVERY_AVAILABLE;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function personalizeCopy(content, recipient) {
  const fallbackName = recipient.name || recipient.email.split("@")[0] || "there";
  return String(content || "").replace(/\{\{\s*name\s*\}\}/gi, fallbackName);
}

function contentToHtml(content) {
  return String(content || "")
    .split(/\n\s*\n/)
    .map((block) => `<p style="margin:0 0 16px">${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function buildEmailHtml({ subject, content, recipient }) {
  const body = personalizeCopy(content, recipient);

  return `
    <div style="font-family:Arial,sans-serif;color:#14261a;line-height:1.6;max-width:640px;margin:0 auto;padding:24px">
      <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#0e8f87">emails free</p>
      <h2 style="margin:0 0 18px;color:#112338">${escapeHtml(subject)}</h2>
      ${contentToHtml(body)}
      <p style="margin:24px 0 0;font-size:13px;color:#5c6d7f">Sent from emails free via ${shouldUseLiveDelivery() ? "Brevo" : "mock delivery"}.</p>
    </div>
  `;
}

function getSegmentDefinition(segmentId) {
  return SEGMENT_DEFINITIONS.find((definition) => definition.id === segmentId) || SEGMENT_DEFINITIONS[0];
}

function resolveSegmentRecipients(segmentId, contacts, limit) {
  const definition = getSegmentDefinition(segmentId);

  return contacts
    .filter((contact) => definition.matcher(contact) && validateRecipientEmail(contact.email))
    .slice(0, limit);
}

function buildLiveAnalytics(delivered, failed) {
  return {
    delivered,
    opened: 0,
    clicked: 0,
    bounced: failed,
    unsubscribed: 0
  };
}

async function sendBrevoEmail({ to, subject, textContent, htmlContent, tags = [] }) {
  if (!shouldUseLiveDelivery()) {
    return {
      delivered: false,
      previewOnly: true,
      error: "Live email delivery is not enabled."
    };
  }

  const sender = senderConfig();
  const apiKey = process.env.BREVO_API_KEY;

  if (!sender || !apiKey) {
    const error = new Error("Live email delivery is unavailable because the sender or Brevo API key is missing.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender,
      to: [
        {
          email: to.email,
          name: to.name || to.email
        }
      ],
      subject,
      htmlContent,
      textContent,
      tags: tags.filter(Boolean)
    })
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Brevo send failed: ${details || response.statusText}`);
    error.statusCode = 502;
    throw error;
  }

  return {
    delivered: true,
    previewOnly: false
  };
}

async function sendBroadcastEmails({ campaign, recipients, tag }) {
  let sentCount = 0;
  let failedCount = 0;
  const failures = [];

  for (const recipient of recipients) {
    const textContent = personalizeCopy(campaign.content, recipient);
    const htmlContent = buildEmailHtml({
      subject: campaign.subject,
      content: campaign.content,
      recipient
    });

    try {
      await sendBrevoEmail({
        to: recipient,
        subject: campaign.subject,
        textContent,
        htmlContent,
        tags: ["emails-free", tag, campaign.segmentId]
      });
      sentCount += 1;
    } catch (error) {
      failedCount += 1;
      failures.push({
        email: recipient.email,
        error: error instanceof Error ? error.message : "Unknown delivery failure."
      });
    }
  }

  return {
    sentCount,
    failedCount,
    failures
  };
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function getContentType(filePath) {
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  return "text/html; charset=utf-8";
}

async function serveFile(res, filePath) {
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(content);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

function rejectIfOverFreeLimit(state, requestedRecipients) {
  const remaining = DAILY_FREE_LIMIT - state.sentToday;

  if (requestedRecipients > remaining) {
    const error = new Error(
      `Free plan limit reached. You can send ${remaining} more email${remaining === 1 ? "" : "s"} today.`
    );
    error.statusCode = 429;
    throw error;
  }
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      service: "emails free",
      date: getDateKey()
    });
  }

  if (req.method === "GET" && (pathname === "/api/dashboard" || pathname === "/api/usage")) {
    return json(res, 200, buildDashboardPayload(state));
  }

  if (req.method === "POST" && pathname === "/api/intelligence") {
    const payload = await readJsonBody(req);
    const normalized = normalizeCampaignPayload(payload, {
      contacts: state.contacts,
      templates: state.templates
    });
    const intelligence = calculateIntelligence(normalized);

    return json(res, 200, {
      ok: true,
      intelligence,
      normalized: {
        recipients: normalized.recipients,
        segmentName: normalized.segmentName,
        templateName: normalized.templateName,
        sendWindowLabel: SEND_WINDOWS[normalized.sendWindow]
      }
    });
  }

  if (req.method === "POST" && pathname === "/api/send") {
    ensureFreshDay(state);

    const payload = await readJsonBody(req);
    const normalized = normalizeCampaignPayload(payload, {
      contacts: state.contacts,
      templates: state.templates
    });
    const validationError = validateCampaign(normalized);

    if (validationError) {
      return json(res, 400, {
        error: validationError,
        dashboard: buildDashboardPayload(state)
      });
    }

    const liveRecipients = resolveSegmentRecipients(normalized.segmentId, state.contacts, normalized.recipients);
    const effectiveCampaign =
      shouldUseLiveDelivery() && liveRecipients.length < normalized.recipients
        ? {
            ...normalized,
            recipients: liveRecipients.length
          }
        : normalized;

    if (shouldUseLiveDelivery() && effectiveCampaign.recipients < 1) {
      return json(res, 400, {
        error: "No deliverable contacts were found in the selected segment.",
        dashboard: buildDashboardPayload(state)
      });
    }

    try {
      rejectIfOverFreeLimit(state, effectiveCampaign.recipients);
    } catch (error) {
      return json(res, error.statusCode || 429, {
        error: error.message,
        dashboard: buildDashboardPayload(state)
      });
    }

    let status = "Delivered in mock mode";
    let message = "Campaign launched in mock mode with predictive analytics.";
    let analytics;
    let activityStatus = "healthy";

    if (shouldUseLiveDelivery()) {
      const result = await sendBroadcastEmails({
        campaign: effectiveCampaign,
        recipients: liveRecipients,
        tag: "campaign"
      });

      if (result.sentCount < 1) {
        return json(res, 502, {
          error: result.failures[0]?.error || "Live delivery failed for every recipient.",
          dashboard: buildDashboardPayload(state)
        });
      }

      state.sentToday += result.sentCount;
      status = result.failedCount ? "Partially sent live via Brevo" : "Sent live via Brevo";
      message =
        result.failedCount > 0
          ? `Campaign sent live to ${result.sentCount} contacts. ${result.failedCount} deliveries failed.`
          : `Campaign sent live to ${result.sentCount} contacts via Brevo.`;
      analytics = buildLiveAnalytics(result.sentCount, result.failedCount);
      activityStatus = result.failedCount > 0 ? "warming" : "healthy";
    } else {
      state.sentToday += effectiveCampaign.recipients;
    }

    const campaign = buildCampaignRecord(effectiveCampaign, {
      status,
      analytics,
      contacts: state.contacts,
      templates: state.templates
    });

    state.campaigns.unshift(campaign);
    state.campaigns = state.campaigns.slice(0, 24);
    state.activity.unshift(
      buildActivityEntry("campaign", `${campaign.name} launched to ${campaign.recipients} recipients`, activityStatus)
    );
    state.activity = state.activity.slice(0, 20);

    return json(res, 200, {
      ok: true,
      message,
      campaign,
      dashboard: buildDashboardPayload(state)
    });
  }

  if (req.method === "POST" && pathname === "/api/automations/run") {
    ensureFreshDay(state);

    const payload = await readJsonBody(req);
    const automationId = String(payload.automationId || "").trim();
    const automation = state.automations.find((item) => item.id === automationId);

    if (!automation) {
      return json(res, 404, {
        error: "Automation not found.",
        dashboard: buildDashboardPayload(state)
      });
    }

    const automationCampaign = normalizeCampaignPayload(
      {
        name: `${automation.name} manual run`,
        segmentId: automation.segmentId,
        templateId: automation.templateId,
        recipients: automation.recipientsPerRun,
        sendWindow: automation.sendWindow,
        smartWarmup: automation.smartWarmup
      },
      {
        contacts: state.contacts,
        templates: state.templates
      }
    );

    const liveRecipients = resolveSegmentRecipients(
      automationCampaign.segmentId,
      state.contacts,
      automationCampaign.recipients
    );
    const effectiveCampaign =
      shouldUseLiveDelivery() && liveRecipients.length < automationCampaign.recipients
        ? {
            ...automationCampaign,
            recipients: liveRecipients.length
          }
        : automationCampaign;

    if (shouldUseLiveDelivery() && effectiveCampaign.recipients < 1) {
      return json(res, 400, {
        error: "No deliverable contacts were found for this automation.",
        dashboard: buildDashboardPayload(state)
      });
    }

    try {
      rejectIfOverFreeLimit(state, effectiveCampaign.recipients);
    } catch (error) {
      return json(res, error.statusCode || 429, {
        error: error.message,
        dashboard: buildDashboardPayload(state)
      });
    }

    let status = "Automation run in mock mode";
    let message = `${automation.name} launched successfully.`;
    let analytics;
    let activityStatus = "healthy";

    if (shouldUseLiveDelivery()) {
      const result = await sendBroadcastEmails({
        campaign: effectiveCampaign,
        recipients: liveRecipients,
        tag: "automation"
      });

      if (result.sentCount < 1) {
        return json(res, 502, {
          error: result.failures[0]?.error || "Live delivery failed for every automation recipient.",
          dashboard: buildDashboardPayload(state)
        });
      }

      state.sentToday += result.sentCount;
      status = result.failedCount ? "Automation partially sent live" : "Automation sent live via Brevo";
      message =
        result.failedCount > 0
          ? `${automation.name} sent live to ${result.sentCount} contacts, with ${result.failedCount} failures.`
          : `${automation.name} sent live via Brevo to ${result.sentCount} contacts.`;
      analytics = buildLiveAnalytics(result.sentCount, result.failedCount);
      activityStatus = result.failedCount > 0 ? "warming" : "healthy";
    } else {
      state.sentToday += effectiveCampaign.recipients;
    }

    automation.runs += 1;
    automation.lastRunAt = new Date().toISOString();

    const campaign = buildCampaignRecord(effectiveCampaign, {
      status,
      analytics,
      contacts: state.contacts,
      templates: state.templates
    });

    state.campaigns.unshift(campaign);
    state.campaigns = state.campaigns.slice(0, 24);
    state.activity.unshift(
      buildActivityEntry("automation", `${automation.name} ran for ${campaign.recipients} recipients`, activityStatus)
    );
    state.activity = state.activity.slice(0, 20);

    return json(res, 200, {
      ok: true,
      message,
      automation,
      campaign,
      dashboard: buildDashboardPayload(state)
    });
  }

  if (req.method === "POST" && pathname === "/api/transactional/send") {
    ensureFreshDay(state);

    const payload = await readJsonBody(req);
    const recipient = normalizeEmail(payload.recipientEmail);
    const template = getTemplateById(String(payload.templateId || "tpl-reset"), state.templates);
    const subject = String(payload.subject || template.subject || "").trim();

    if (!validateRecipientEmail(recipient)) {
      return json(res, 400, {
        error: "A valid recipient email is required.",
        dashboard: buildDashboardPayload(state)
      });
    }

    if (!subject) {
      return json(res, 400, {
        error: "Subject is required for transactional sends.",
        dashboard: buildDashboardPayload(state)
      });
    }

    try {
      rejectIfOverFreeLimit(state, 1);
    } catch (error) {
      return json(res, error.statusCode || 429, {
        error: error.message,
        dashboard: buildDashboardPayload(state)
      });
    }

    if (shouldUseLiveDelivery()) {
      try {
        await sendBrevoEmail({
          to: {
            email: recipient,
            name: recipient.split("@")[0]
          },
          subject,
          textContent: personalizeCopy(template.content, { email: recipient, name: recipient.split("@")[0] }),
          htmlContent: buildEmailHtml({
            subject,
            content: template.content,
            recipient: {
              email: recipient,
              name: recipient.split("@")[0]
            }
          }),
          tags: ["emails-free", "transactional", template.id]
        });
      } catch (error) {
        return json(res, error.statusCode || 502, {
          error: error instanceof Error ? error.message : "Transactional delivery failed.",
          dashboard: buildDashboardPayload(state)
        });
      }
    }

    state.sentToday += 1;
    const event = buildTransactionalEvent({
      lane: String(payload.lane || "API"),
      recipient,
      templateName: template.name,
      subject,
      status: shouldUseLiveDelivery() ? "Sent live via Brevo" : "Delivered in mock mode"
    });

    state.transactionalEvents.unshift(event);
    state.transactionalEvents = state.transactionalEvents.slice(0, 16);
    state.activity.unshift(buildActivityEntry("transactional", `${subject} sent to ${recipient}`, "healthy"));
    state.activity = state.activity.slice(0, 20);

    return json(res, 200, {
      ok: true,
      message: shouldUseLiveDelivery()
        ? `Transactional email sent live to ${recipient} via Brevo.`
        : `Transactional test sent to ${recipient}.`,
      event,
      dashboard: buildDashboardPayload(state)
    });
  }

  return json(res, 404, { error: "API route not found." });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = url.pathname;

  try {
    if (pathname.startsWith("/api/")) {
      return await handleApi(req, res, pathname);
    }

    if (pathname === "/" || pathname === "/index.html") {
      return await serveFile(res, path.join(publicDir, "index.html"));
    }

    if (pathname === "/styles.css") {
      return await serveFile(res, path.join(publicDir, "styles.css"));
    }

    if (pathname === "/app.js") {
      return await serveFile(res, path.join(publicDir, "app.js"));
    }

    return await serveFile(res, path.join(publicDir, "index.html"));
  } catch (error) {
    const statusCode = error && typeof error.statusCode === "number" ? error.statusCode : 500;
    return json(res, statusCode, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
});

server.listen(PORT, () => {
  console.log(`emails free running at http://localhost:${PORT}`);
});
