const state = {
  dashboard: null,
  preview: null,
  formInitialized: false,
  transactionalInitialized: false
};

const sentTodayEl = document.getElementById("sent-today");
const remainingCountEl = document.getElementById("remaining-count");
const quotaFillEl = document.getElementById("quota-fill");
const deliveryModeLabelEl = document.getElementById("delivery-mode-label");
const avgScoreEl = document.getElementById("avg-score");
const activeContactsCountEl = document.getElementById("active-contacts-count");
const automationRunCountEl = document.getElementById("automation-run-count");
const bestSegmentEl = document.getElementById("best-segment");
const bestCampaignEl = document.getElementById("best-campaign");
const openRateMetricEl = document.getElementById("open-rate-metric");
const clickRateMetricEl = document.getElementById("click-rate-metric");
const bounceRateMetricEl = document.getElementById("bounce-rate-metric");
const templateCountEl = document.getElementById("template-count");
const capabilityCountEl = document.getElementById("capability-count");

const formEl = document.getElementById("campaign-form");
const campaignNameEl = document.getElementById("campaign-name");
const campaignSegmentEl = document.getElementById("campaign-segment");
const campaignTemplateEl = document.getElementById("campaign-template");
const campaignRecipientsEl = document.getElementById("campaign-recipients");
const campaignSendWindowEl = document.getElementById("campaign-send-window");
const campaignWarmupEl = document.getElementById("campaign-warmup");
const campaignSubjectEl = document.getElementById("campaign-subject");
const campaignAbSubjectEl = document.getElementById("campaign-ab-subject");
const campaignContentEl = document.getElementById("campaign-content");
const sendButtonEl = document.getElementById("send-button");
const formMessageEl = document.getElementById("form-message");

const intelligenceScoreEl = document.getElementById("intelligence-score");
const intelligenceBandEl = document.getElementById("intelligence-band");
const intelligenceSummaryEl = document.getElementById("intelligence-summary");
const projectedOpenRateEl = document.getElementById("projected-open-rate");
const projectedClickRateEl = document.getElementById("projected-click-rate");
const projectedBounceRateEl = document.getElementById("projected-bounce-rate");
const recommendedBatchEl = document.getElementById("recommended-batch");
const intelligenceBoostsEl = document.getElementById("intelligence-boosts");
const intelligenceWarningsEl = document.getElementById("intelligence-warnings");

const capabilitiesListEl = document.getElementById("capabilities-list");
const segmentCountEl = document.getElementById("segment-count");
const segmentListEl = document.getElementById("segment-list");
const contactsSummaryEl = document.getElementById("contacts-summary");
const contactListEl = document.getElementById("contact-list");
const templateSummaryEl = document.getElementById("template-summary");
const templateListEl = document.getElementById("template-list");

const automationSummaryEl = document.getElementById("automation-summary");
const automationListEl = document.getElementById("automation-list");
const automationMessageEl = document.getElementById("automation-message");
const activitySummaryEl = document.getElementById("activity-summary");
const activityListEl = document.getElementById("activity-list");

const domainSummaryEl = document.getElementById("domain-summary");
const domainListEl = document.getElementById("domain-list");
const smtpStatusEl = document.getElementById("smtp-status");
const smtpCardEl = document.getElementById("smtp-card");
const keySummaryEl = document.getElementById("key-summary");
const keyListEl = document.getElementById("key-list");
const webhookListEl = document.getElementById("webhook-list");
const formSummaryEl = document.getElementById("form-summary");
const formListEl = document.getElementById("form-list");
const transactionalListEl = document.getElementById("transactional-list");

const transactionalFormEl = document.getElementById("transactional-form");
const transactionalRecipientEl = document.getElementById("transactional-recipient");
const transactionalTemplateEl = document.getElementById("transactional-template");
const transactionalSubjectEl = document.getElementById("transactional-subject");
const transactionalSendButtonEl = document.getElementById("transactional-send-button");
const transactionalMessageEl = document.getElementById("transactional-message");

const analyticsMetricsEl = document.getElementById("analytics-metrics");
const recommendationListEl = document.getElementById("recommendation-list");
const recentCountEl = document.getElementById("recent-count");
const recentCampaignsEl = document.getElementById("recent-campaigns");

let previewTimer = null;

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatRate(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    maximumFractionDigits: 1
  })}%`;
}

function formatTime(value) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatDeliveryLabel(dashboard) {
  if (dashboard.deliveryMode === "live") {
    return `Live via ${dashboard.deliveryProvider || "provider"}`;
  }

  if (dashboard.deliveryMode === "mock") {
    return "Mock mode";
  }

  return dashboard.deliveryMode;
}

function clearElement(element) {
  element.innerHTML = "";
}

function setTextMessage(element, text, tone = "neutral") {
  element.textContent = text;
  element.dataset.tone = tone;
  element.style.color = tone === "success" ? "#0e8f87" : tone === "error" ? "#c24d2c" : "#59697d";
}

function getSelectedSegment() {
  return state.dashboard?.contacts?.segments?.find((segment) => segment.id === campaignSegmentEl.value) || null;
}

function getSelectedTemplate() {
  return state.dashboard?.templates?.find((template) => template.id === campaignTemplateEl.value) || null;
}

function getSelectedTransactionalTemplate() {
  return state.dashboard?.templates?.find((template) => template.id === transactionalTemplateEl.value) || null;
}

function populateSelect(selectEl, items, selectedValue, labelBuilder) {
  clearElement(selectEl);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = labelBuilder(item);
    option.selected = item.id === selectedValue;
    selectEl.append(option);
  });
}

function renderChipList(container, items, tone) {
  clearElement(container);

  if (!items.length) {
    const item = document.createElement("span");
    item.className = `chip chip-${tone}`;
    item.textContent = tone === "warning" ? "No active warnings." : "No boost signals yet.";
    container.append(item);
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("span");
    item.className = `chip chip-${tone}`;
    item.textContent = entry;
    container.append(item);
  });
}

function renderCapabilities(capabilities) {
  clearElement(capabilitiesListEl);
  capabilityCountEl.textContent = `${capabilities.length} modules`;

  capabilities.forEach((capability) => {
    const item = document.createElement("article");
    item.className = "feature-item";
    item.innerHTML = `<strong>${capability.title}</strong><p>${capability.body}</p>`;
    capabilitiesListEl.append(item);
  });
}

function renderSegments(segments) {
  clearElement(segmentListEl);
  segmentCountEl.textContent = `${segments.length} segments`;

  segments.forEach((segment) => {
    const card = document.createElement("article");
    card.className = "segment-card";
    card.innerHTML = `
      <div class="segment-header">
        <strong>${segment.name}</strong>
        <span>${formatCount(segment.count)} contacts</span>
      </div>
      <p>${segment.description}</p>
      <div class="segment-footer">
        <span>${segment.averageEngagement}% avg engagement</span>
        <span>${segment.sample.length ? segment.sample.join(", ") : "No sample yet"}</span>
      </div>
    `;
    segmentListEl.append(card);
  });
}

function renderContacts(contacts, activeCount, totalCount) {
  clearElement(contactListEl);
  contactsSummaryEl.textContent = `${formatCount(activeCount)} active / ${formatCount(totalCount)} total`;

  contacts.forEach((contact) => {
    const row = document.createElement("article");
    row.className = "contact-card";
    row.innerHTML = `
      <div class="contact-header">
        <div>
          <strong>${contact.name}</strong>
          <p>${contact.company} · ${contact.email}</p>
        </div>
        <span class="status-pill status-${contact.status}">${contact.status}</span>
      </div>
      <div class="contact-footer">
        <span>Engagement ${contact.engagementScore}%</span>
        <span>${contact.tags.join(", ")}</span>
      </div>
    `;
    contactListEl.append(row);
  });
}

function renderTemplates(templates) {
  clearElement(templateListEl);
  templateSummaryEl.textContent = `${templates.length} templates`;
  templateCountEl.textContent = `${templates.length} ready`;

  templates.forEach((template) => {
    const card = document.createElement("article");
    card.className = "template-card";
    card.innerHTML = `
      <span class="template-category">${template.category}</span>
      <strong>${template.name}</strong>
      <p>${template.preview}</p>
      <code>${template.subject}</code>
    `;
    templateListEl.append(card);
  });
}

function renderPreview(preview) {
  state.preview = preview;

  intelligenceScoreEl.textContent = String(preview.score || 0);
  intelligenceBandEl.textContent = preview.band || "Needs work";
  intelligenceBandEl.className = `score-band band-${String(preview.band || "needs-work").toLowerCase().replace(/\s+/g, "-")}`;
  intelligenceSummaryEl.textContent = preview.topInsight || "Campaign intelligence will appear here once the composer is ready.";
  projectedOpenRateEl.textContent = formatRate(preview.projectedOpenRate);
  projectedClickRateEl.textContent = formatRate(preview.projectedClickRate);
  projectedBounceRateEl.textContent = formatRate(preview.projectedBounceRate);
  recommendedBatchEl.textContent = formatCount(preview.recommendedHourlyBatch);
  renderChipList(intelligenceBoostsEl, preview.boosts || [], "boost");
  renderChipList(intelligenceWarningsEl, preview.warnings || [], "warning");
}

function renderAutomationCenter(center) {
  clearElement(automationListEl);
  clearElement(activityListEl);

  automationSummaryEl.textContent = `${center.activeCount} active · ${formatCount(center.totalRuns)} total runs`;
  automationRunCountEl.textContent = formatCount(center.totalRuns);
  activitySummaryEl.textContent = `${center.activity.length} events`;

  center.automations.forEach((automation) => {
    const card = document.createElement("article");
    card.className = "automation-card";
    card.innerHTML = `
      <div class="automation-header">
        <div>
          <strong>${automation.name}</strong>
          <p>${automation.trigger}</p>
        </div>
        <span class="status-pill status-${automation.status}">${automation.status}</span>
      </div>
      <p>${automation.objective}</p>
      <div class="automation-metrics">
        <span>${automation.segmentName}</span>
        <span>${automation.templateName}</span>
        <span>Score ${automation.score}</span>
        <span>${automation.projectedOpenRate}% projected opens</span>
      </div>
      <div class="step-list">
        ${automation.steps.map((step) => `<div class="step-item"><span>${step.delay}</span><strong>${step.action}</strong></div>`).join("")}
      </div>
      <div class="automation-footer">
        <span>${formatCount(automation.runs)} runs · last run ${formatTime(automation.lastRunAt)}</span>
        <button class="mini-action" type="button" data-run-automation="${automation.id}">Run now</button>
      </div>
    `;
    automationListEl.append(card);
  });

  center.activity.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "activity-item";
    item.innerHTML = `
      <div class="activity-row">
        <strong>${entry.title}</strong>
        <span class="status-pill status-${entry.status}">${entry.kind}</span>
      </div>
      <p>${formatTime(entry.createdAt)}</p>
    `;
    activityListEl.append(item);
  });
}

function renderInfrastructure(infrastructure, growth, transactional) {
  clearElement(domainListEl);
  clearElement(smtpCardEl);
  clearElement(keyListEl);
  clearElement(webhookListEl);
  clearElement(formListEl);
  clearElement(transactionalListEl);

  domainSummaryEl.textContent = `${infrastructure.domains.length} domains`;
  smtpStatusEl.textContent = infrastructure.smtp.status;
  keySummaryEl.textContent = `${infrastructure.apiKeys.length} keys`;
  formSummaryEl.textContent = `${growth.totalForms} forms · ${formatCount(growth.submissionsToday)} submissions today`;

  infrastructure.domains.forEach((domain) => {
    const card = document.createElement("article");
    card.className = "domain-card";
    card.innerHTML = `
      <div class="domain-header">
        <strong>${domain.domain}</strong>
        <span class="status-pill status-${domain.status}">${domain.status}</span>
      </div>
      <div class="domain-meta">
        <span>DKIM ${domain.dkim}</span>
        <span>SPF ${domain.spf}</span>
        <span>DMARC ${domain.dmarc}</span>
        <span>Reputation ${domain.reputation}</span>
      </div>
      <p>Checked ${formatTime(domain.lastCheckedAt)}</p>
    `;
    domainListEl.append(card);
  });

  smtpCardEl.innerHTML = `
    <div class="smtp-meta">
      <span>Host <strong>${infrastructure.smtp.host}</strong></span>
      <span>Port <strong>${infrastructure.smtp.port}</strong></span>
      <span>User <strong>${infrastructure.smtp.username}</strong></span>
      <span>TLS <strong>${infrastructure.smtp.tls}</strong></span>
    </div>
  `;

  infrastructure.apiKeys.forEach((key) => {
    const card = document.createElement("article");
    card.className = "key-card";
    card.innerHTML = `
      <div class="domain-header">
        <strong>${key.name}</strong>
        <span class="status-pill status-ready">${key.mode}</span>
      </div>
      <p>${key.maskedKey}</p>
      <div class="domain-meta">
        <span>${key.scopes.join(", ")}</span>
        <span>Used ${formatTime(key.lastUsedAt)}</span>
      </div>
    `;
    keyListEl.append(card);
  });

  infrastructure.webhooks.forEach((hook) => {
    const card = document.createElement("article");
    card.className = "webhook-card";
    card.innerHTML = `
      <div class="domain-header">
        <strong>${hook.name}</strong>
        <span class="status-pill status-${hook.status}">${hook.status}</span>
      </div>
      <p>${hook.target}</p>
      <div class="domain-meta">
        <span>${hook.eventTypes.join(", ")}</span>
        <span>Seen ${formatTime(hook.lastSeenAt)}</span>
      </div>
    `;
    webhookListEl.append(card);
  });

  growth.forms.forEach((form) => {
    const card = document.createElement("article");
    card.className = "form-card";
    card.innerHTML = `
      <div class="domain-header">
        <strong>${form.name}</strong>
        <span class="status-pill status-active">${form.source}</span>
      </div>
      <div class="domain-meta">
        <span>${formatCount(form.submissionsToday)} today</span>
        <span>${formatCount(form.totalSubmissions)} total</span>
        <span>${formatRate(form.conversionRate)} conversion</span>
      </div>
      <p>Syncs into ${form.syncSegmentId}</p>
    `;
    formListEl.append(card);
  });

  transactional.events.forEach((event) => {
    const card = document.createElement("article");
    card.className = "transaction-card";
    card.innerHTML = `
      <div class="domain-header">
        <strong>${event.subject}</strong>
        <span class="status-pill status-active">${event.lane}</span>
      </div>
      <p>${event.recipient} · ${event.templateName}</p>
      <div class="domain-meta">
        <span>${event.status}</span>
        <span>${formatTime(event.sentAt)}</span>
      </div>
    `;
    transactionalListEl.append(card);
  });
}

function renderAnalyticsMetrics(analytics) {
  clearElement(analyticsMetricsEl);

  const metrics = [
    { label: "Total sent", value: formatCount(analytics.totalSent) },
    { label: "Delivered", value: formatCount(analytics.delivered) },
    { label: "Opens", value: formatCount(analytics.opened) },
    { label: "Clicks", value: formatCount(analytics.clicked) },
    { label: "Bounce rate", value: formatRate(analytics.bounceRate) },
    { label: "Avg score", value: String(analytics.averageDeliverability) }
  ];

  metrics.forEach((metric) => {
    const card = document.createElement("article");
    card.className = "metric-card";
    card.innerHTML = `<span>${metric.label}</span><strong>${metric.value}</strong>`;
    analyticsMetricsEl.append(card);
  });
}

function renderRecommendations(recommendations) {
  clearElement(recommendationListEl);

  recommendations.forEach((recommendation) => {
    const item = document.createElement("article");
    item.className = "recommendation-card";
    item.textContent = recommendation;
    recommendationListEl.append(item);
  });
}

function renderRecentCampaigns(campaigns) {
  clearElement(recentCampaignsEl);

  if (!campaigns.length) {
    recentCountEl.textContent = "0 items";
    recentCampaignsEl.innerHTML = `<p class="empty-state">No campaigns yet.</p>`;
    return;
  }

  recentCountEl.textContent = `${campaigns.length} ${campaigns.length === 1 ? "item" : "items"}`;

  campaigns.forEach((campaign) => {
    const card = document.createElement("article");
    card.className = "campaign-card";
    card.innerHTML = `
      <div class="campaign-card-header">
        <div>
          <strong>${campaign.name}</strong>
          <p>${campaign.segmentName} · ${campaign.templateName} · ${formatCount(campaign.recipients)} recipients</p>
        </div>
        <span class="muted-badge">${campaign.status}</span>
      </div>
      <p class="campaign-subject">${campaign.subject}</p>
      <div class="campaign-metrics">
        <span>Score ${campaign.intelligence.score}</span>
        <span>Opens ${formatCount(campaign.analytics.opened)}</span>
        <span>Clicks ${formatCount(campaign.analytics.clicked)}</span>
        <span>${formatTime(campaign.sentAt)}</span>
      </div>
    `;
    recentCampaignsEl.append(card);
  });
}

function populateCampaignComposer(dashboard, preserveValues) {
  const previousSegment = preserveValues ? campaignSegmentEl.value : "";
  const previousTemplate = preserveValues ? campaignTemplateEl.value : "";

  populateSelect(
    campaignSegmentEl,
    dashboard.contacts.segments,
    previousSegment || dashboard.contacts.segments[0]?.id,
    (segment) => `${segment.name} (${segment.count})`
  );

  populateSelect(
    campaignTemplateEl,
    dashboard.templates,
    previousTemplate || dashboard.templates[0]?.id,
    (template) => `${template.name} · ${template.category}`
  );

  if (!state.formInitialized || !preserveValues) {
    resetComposer();
    state.formInitialized = true;
  }
}

function populateTransactionalComposer(dashboard, preserveValues) {
  const previousTemplate = preserveValues ? transactionalTemplateEl.value : "";

  populateSelect(
    transactionalTemplateEl,
    dashboard.templates,
    previousTemplate || dashboard.templates.find((template) => template.category === "Transactional")?.id || dashboard.templates[0]?.id,
    (template) => `${template.name} · ${template.category}`
  );

  if (!state.transactionalInitialized || !preserveValues) {
    transactionalRecipientEl.value = "founder@example.com";
    applyTransactionalTemplate();
    state.transactionalInitialized = true;
  }
}

function applySelectedTemplate() {
  const template = getSelectedTemplate();
  if (!template) {
    return;
  }

  campaignSubjectEl.value = template.subject;
  campaignContentEl.value = template.content;
}

function applySelectedSegment() {
  const segment = getSelectedSegment();
  if (!segment) {
    return;
  }

  campaignRecipientsEl.value = String(segment.count || 1);
}

function applyTransactionalTemplate() {
  const template = getSelectedTransactionalTemplate();
  if (!template) {
    return;
  }

  transactionalSubjectEl.value = template.subject;
}

function resetComposer() {
  campaignNameEl.value = "";
  campaignAbSubjectEl.value = "";
  campaignSendWindowEl.value = "morning";
  campaignWarmupEl.checked = true;
  applySelectedTemplate();
  applySelectedSegment();
  setTextMessage(formMessageEl, "Composer reset and ready.");
  schedulePreview();
}

function collectCampaignPayload() {
  return {
    name: campaignNameEl.value.trim(),
    segmentId: campaignSegmentEl.value,
    templateId: campaignTemplateEl.value,
    recipients: Number(campaignRecipientsEl.value || 0),
    sendWindow: campaignSendWindowEl.value,
    smartWarmup: campaignWarmupEl.checked,
    subject: campaignSubjectEl.value.trim(),
    abVariantSubject: campaignAbSubjectEl.value.trim(),
    content: campaignContentEl.value.trim()
  };
}

function collectTransactionalPayload() {
  return {
    recipientEmail: transactionalRecipientEl.value.trim(),
    templateId: transactionalTemplateEl.value,
    subject: transactionalSubjectEl.value.trim(),
    lane: "API"
  };
}

function renderDashboard(dashboard, options = {}) {
  const preserveCampaignValues = options.preserveCampaignValues ?? true;
  const preserveTransactionalValues = options.preserveTransactionalValues ?? true;

  state.dashboard = dashboard;

  const progress = Math.min(100, Math.round((dashboard.sentToday / dashboard.dailyLimit) * 100));
  const bestSegment = dashboard.contacts.segments
    .slice()
    .sort((left, right) => right.averageEngagement - left.averageEngagement)[0];

  sentTodayEl.textContent = formatCount(dashboard.sentToday);
  remainingCountEl.textContent = formatCount(dashboard.remaining);
  quotaFillEl.style.width = `${progress}%`;
  deliveryModeLabelEl.textContent = formatDeliveryLabel(dashboard);
  avgScoreEl.textContent = String(dashboard.analytics.averageDeliverability);
  activeContactsCountEl.textContent = formatCount(dashboard.contacts.active);
  bestSegmentEl.textContent = bestSegment ? bestSegment.name : "No data";
  bestCampaignEl.textContent = dashboard.analytics.bestCampaign ? dashboard.analytics.bestCampaign.name : "No data";

  openRateMetricEl.textContent = formatRate(dashboard.analytics.openRate);
  clickRateMetricEl.textContent = formatRate(dashboard.analytics.clickRate);
  bounceRateMetricEl.textContent = formatRate(dashboard.analytics.bounceRate);

  renderCapabilities(dashboard.capabilities || []);
  renderSegments(dashboard.contacts.segments || []);
  renderContacts(dashboard.contacts.rows || [], dashboard.contacts.active || 0, dashboard.contacts.total || 0);
  renderTemplates(dashboard.templates || []);
  renderAutomationCenter(dashboard.automationCenter);
  renderInfrastructure(dashboard.infrastructure, dashboard.growth, dashboard.transactional);
  renderAnalyticsMetrics(dashboard.analytics || {});
  renderRecommendations(dashboard.recommendations || []);
  renderRecentCampaigns(dashboard.campaigns || []);
  populateCampaignComposer(dashboard, preserveCampaignValues);
  populateTransactionalComposer(dashboard, preserveTransactionalValues);
}

async function refreshPreview() {
  try {
    const response = await fetch("/api/intelligence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectCampaignPayload())
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to load send intelligence.");
    }

    renderPreview(result.intelligence);
  } catch (error) {
    setTextMessage(formMessageEl, error instanceof Error ? error.message : "Unable to load send intelligence.", "error");
  }
}

function schedulePreview() {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(refreshPreview, 180);
}

async function loadDashboard() {
  const response = await fetch("/api/dashboard");
  const payload = await response.json();
  renderDashboard(payload, {
    preserveCampaignValues: true,
    preserveTransactionalValues: true
  });
  await refreshPreview();
}

async function handleCampaignSubmit(event) {
  event.preventDefault();

  sendButtonEl.disabled = true;
  sendButtonEl.textContent = "Launching...";
  setTextMessage(formMessageEl, "Launching campaign and calculating outcomes...");

  try {
    const response = await fetch("/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectCampaignPayload())
    });
    const result = await response.json();

    if (!response.ok) {
      if (result.dashboard) {
        renderDashboard(result.dashboard);
      }
      throw new Error(result.error || "Unable to launch campaign.");
    }

    renderDashboard(result.dashboard, {
      preserveCampaignValues: false,
      preserveTransactionalValues: true
    });
    renderPreview(result.campaign.intelligence);
    setTextMessage(formMessageEl, result.message, "success");
  } catch (error) {
    setTextMessage(formMessageEl, error instanceof Error ? error.message : "Unable to launch campaign.", "error");
  } finally {
    sendButtonEl.disabled = false;
    sendButtonEl.textContent = "Launch campaign";
  }
}

async function runAutomation(automationId, button) {
  button.disabled = true;
  button.textContent = "Running...";
  setTextMessage(automationMessageEl, "Launching automation...");

  try {
    const response = await fetch("/api/automations/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ automationId })
    });
    const result = await response.json();

    if (!response.ok) {
      if (result.dashboard) {
        renderDashboard(result.dashboard);
      }
      throw new Error(result.error || "Unable to run automation.");
    }

    renderDashboard(result.dashboard, {
      preserveCampaignValues: true,
      preserveTransactionalValues: true
    });
    setTextMessage(automationMessageEl, result.message, "success");
  } catch (error) {
    setTextMessage(automationMessageEl, error instanceof Error ? error.message : "Unable to run automation.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Run now";
  }
}

async function handleTransactionalSubmit(event) {
  event.preventDefault();

  transactionalSendButtonEl.disabled = true;
  transactionalSendButtonEl.textContent = "Sending...";
  setTextMessage(transactionalMessageEl, "Sending transactional test...");

  try {
    const response = await fetch("/api/transactional/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectTransactionalPayload())
    });
    const result = await response.json();

    if (!response.ok) {
      if (result.dashboard) {
        renderDashboard(result.dashboard);
      }
      throw new Error(result.error || "Unable to send transactional email.");
    }

    renderDashboard(result.dashboard, {
      preserveCampaignValues: true,
      preserveTransactionalValues: true
    });
    setTextMessage(transactionalMessageEl, result.message, "success");
  } catch (error) {
    setTextMessage(
      transactionalMessageEl,
      error instanceof Error ? error.message : "Unable to send transactional email.",
      "error"
    );
  } finally {
    transactionalSendButtonEl.disabled = false;
    transactionalSendButtonEl.textContent = "Send transactional test";
  }
}

campaignTemplateEl.addEventListener("change", () => {
  applySelectedTemplate();
  schedulePreview();
});

campaignSegmentEl.addEventListener("change", () => {
  applySelectedSegment();
  schedulePreview();
});

transactionalTemplateEl.addEventListener("change", applyTransactionalTemplate);

[
  campaignNameEl,
  campaignRecipientsEl,
  campaignSendWindowEl,
  campaignWarmupEl,
  campaignSubjectEl,
  campaignAbSubjectEl,
  campaignContentEl
].forEach((element) => {
  const eventName = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
  element.addEventListener(eventName, schedulePreview);
});

automationListEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-run-automation]");
  if (!button) {
    return;
  }

  runAutomation(button.dataset.runAutomation, button);
});

formEl.addEventListener("submit", handleCampaignSubmit);
transactionalFormEl.addEventListener("submit", handleTransactionalSubmit);

loadDashboard().catch(() => {
  setTextMessage(formMessageEl, "Could not load the emails free dashboard.", "error");
});
