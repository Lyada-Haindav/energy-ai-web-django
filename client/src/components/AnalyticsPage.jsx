import { BarChart3, BatteryCharging, Flame, Gauge, Leaf, Sparkles, Timer } from "lucide-react";
import { energyKeyFromMeta, modelDisplayName } from "../lib/energy";

const CHATGPT_TYPICAL_QUERY_WH = 0.3;

const LOCAL_ENERGY_PROFILES = {
  fast: {
    baseWh: 0.05,
    referenceLatencyMs: 450
  },
  deep: {
    baseWh: 0.18,
    referenceLatencyMs: 1500
  },
  auto: {
    baseWh: 0.09,
    referenceLatencyMs: 850
  }
};

const EXTERNAL_BENCHMARKS = [
  {
    id: "chatgpt-typical",
    label: "ChatGPT Typical",
    kind: "published",
    whPerResponse: CHATGPT_TYPICAL_QUERY_WH,
    detail: "Published estimate: OpenAI Academy cites Epoch AI at about 0.3 Wh for a typical ChatGPT query."
  },
  {
    id: "gemini-frontier-proxy",
    label: "Gemini Frontier Proxy",
    kind: "proxy",
    whPerResponse: CHATGPT_TYPICAL_QUERY_WH,
    detail: "Proxy estimate only. Google does not publish direct per-query Gemini energy, so this uses the same frontier-chat class benchmark."
  }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function estimateResponseWh(meta = {}) {
  const energyKey = energyKeyFromMeta(meta);
  const profile = LOCAL_ENERGY_PROFILES[energyKey] || LOCAL_ENERGY_PROFILES.auto;
  const latencyMs = Number(meta.latencyMs || 0) || profile.referenceLatencyMs;
  const latencyFactor = clamp(latencyMs / profile.referenceLatencyMs, 0.65, 1.75);
  const energyScoreFactor =
    meta.energyScore === "D"
      ? 1.2
      : meta.energyScore === "C"
        ? 1.08
        : meta.energyScore === "B"
          ? 1
          : 0.92;

  return Number((profile.baseWh * latencyFactor * energyScoreFactor).toFixed(4));
}

function formatEnergy(wh) {
  if (!Number.isFinite(wh) || wh <= 0) {
    return "0 mWh";
  }

  if (wh < 1) {
    return `${Math.round(wh * 1000)} mWh`;
  }

  return `${wh.toFixed(2)} Wh`;
}

function summarizeMessages(sessions) {
  const assistantMessages = sessions
    .flatMap((session) => session.messages || [])
    .filter((message) => message.role === "assistant" && message.meta?.model && message.meta.model !== "bootstrap");
  const recentAssistantMessages = assistantMessages.slice(-12);

  const modelCounts = new Map();
  const efficiencySeries = [];
  const completionLatencySeries = [];
  const consumptionSeries = [];
  let lowEnergyResponses = 0;
  let highEnergyResponses = 0;
  let totalEstimatedWh = 0;

  assistantMessages.forEach((message, index) => {
    const energyKey = energyKeyFromMeta(message.meta);
    const label = modelDisplayName(message.meta.model);
    const estimatedWh = estimateResponseWh(message.meta);
    const current = modelCounts.get(label) || { label, count: 0, energyKey, estimatedWh: 0 };
    current.count += 1;
    current.estimatedWh += estimatedWh;
    current.energyKey = current.energyKey === "auto" ? energyKey : current.energyKey;
    modelCounts.set(label, current);

    if (energyKey === "fast") {
      lowEnergyResponses += 1;
    }
    if (energyKey === "deep") {
      highEnergyResponses += 1;
    }

    totalEstimatedWh += estimatedWh;
    consumptionSeries.push({ x: index + 1, y: Math.round(estimatedWh * 1000) });

    const efficiencyPct = clamp(Math.round((1 - estimatedWh / CHATGPT_TYPICAL_QUERY_WH) * 100), 0, 98);
    efficiencySeries.push({ x: index + 1, y: efficiencyPct });

    const completionLatency = Number(message.meta.latencyMs || 0);
    if (completionLatency > 0) {
      completionLatencySeries.push({ x: index + 1, y: completionLatency });
    }
  });

  const recentResponseLatencyPoints = recentAssistantMessages
    .map((message, index) => {
      const latency =
        Number(message.meta?.firstTokenLatencyMs || 0) ||
        Number(message.meta?.startLatencyMs || 0) ||
        Number(message.meta?.latencyMs || 0);
      return latency > 0 ? { x: index + 1, y: latency } : null;
    })
    .filter(Boolean);

  const usageBars = [...modelCounts.values()].sort((left, right) => right.count - left.count);
  const avgLatency = recentResponseLatencyPoints.length
    ? Math.round(recentResponseLatencyPoints.reduce((sum, point) => sum + point.y, 0) / recentResponseLatencyPoints.length)
    : 0;
  const avgEnergyPerResponseWh = assistantMessages.length ? totalEstimatedWh / assistantMessages.length : 0;
  const benchmarkComparisons = EXTERNAL_BENCHMARKS.map((benchmark) => {
    const totalWh = assistantMessages.length * benchmark.whPerResponse;
    const savingsPct = totalWh > 0 ? clamp(Math.round((1 - totalEstimatedWh / totalWh) * 100), -999, 99) : 0;

    return {
      ...benchmark,
      totalWh,
      savingsPct
    };
  });

  return {
    totalAssistantResponses: assistantMessages.length,
    lowEnergyResponses,
    highEnergyResponses,
    usageBars,
    efficiencySeries,
    recentResponseLatencyPoints,
    completionLatencySeries,
    consumptionSeries,
    avgLatency,
    totalEstimatedWh,
    avgEnergyPerResponseWh,
    benchmarkComparisons
  };
}

function sparklinePath(points) {
  if (points.length === 0) {
    return "";
  }

  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const range = Math.max(maxY - minY, 1);
  const span = Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = (index / span) * 100;
      const y = 100 - ((point.y - minY) / range) * 100;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function MetricCard({ title, value, icon: Icon, tint, note = "", delay = 0 }) {
  return (
    <article className="energy-panel energy-sheen animate-rise p-4 sm:p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="energy-eyebrow">{title}</p>
          {note ? <p className="mt-1 text-sm text-[#5f776b]">{note}</p> : null}
        </div>
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tint}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="font-display text-3xl font-bold tracking-[-0.05em] text-[#13241b] sm:text-4xl">{value}</p>
    </article>
  );
}

function EmptyState({ title, body }) {
  return (
    <section className="energy-panel energy-sheen p-5">
      <h3 className="font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[#5d7468]">{body}</p>
    </section>
  );
}

function ModelUsageChart({ usageBars }) {
  if (usageBars.length === 0) {
    return <EmptyState title="Model Usage" body="Start chatting to generate usage analytics for the new dashboard." />;
  }

  const maxCount = Math.max(...usageBars.map((item) => item.count), 1);

  return (
    <section className="energy-panel energy-sheen p-5">
      <p className="energy-eyebrow">Model mix</p>
      <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">Which engines carried the work</h3>

      <div className="mt-5 space-y-4">
        {usageBars.map((item) => (
          <div key={item.label} className="rounded-[24px] border border-[#dce7df] bg-white/72 p-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm text-[#486154]">
              <span className="font-semibold text-[#173127]">{item.label}</span>
              <span className="font-mono">{item.count}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#edf2ef]">
              <div
                className={`energy-meter-fill h-full rounded-full ${
                  item.energyKey === "deep"
                    ? "bg-[linear-gradient(90deg,#f0b39f_0%,#c95a3c_100%)]"
                    : item.energyKey === "fast"
                      ? "bg-[linear-gradient(90deg,#9fe0bc_0%,#2f8f63_100%)]"
                      : "bg-[linear-gradient(90deg,#f7dc97_0%,#b97d1c_100%)]"
                }`}
                style={{ width: `${Math.max((item.count / maxCount) * 100, 10)}%` }}
              />
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#6b8075]">Estimated energy {formatEnergy(item.estimatedWh)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LineChart({ title, points, suffix, stroke, note = "", formatter = (value, unit) => `${value}${unit}` }) {
  const path = sparklinePath(points);

  if (points.length === 0) {
    return <EmptyState title={title} body={note || "Not enough responses yet to render this graph."} />;
  }

  return (
    <section className="energy-panel energy-sheen p-5">
      <p className="energy-eyebrow">Trend view</p>
      <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">{title}</h3>
      {note ? <p className="mt-2 text-sm leading-7 text-[#5d7468]">{note}</p> : null}

      <div className="mt-4 rounded-[26px] border border-[#dde8e1] bg-white/82 p-3">
        <svg viewBox="0 0 100 100" className="h-40 w-full rounded-[20px] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9f6_100%)] p-2 sm:h-48">
          <path d="M 0 85 L 100 85" fill="none" stroke="rgba(17,33,25,0.08)" strokeWidth="1" />
          <path d="M 0 50 L 100 50" fill="none" stroke="rgba(17,33,25,0.08)" strokeWidth="1" />
          <path d="M 0 15 L 100 15" fill="none" stroke="rgba(17,33,25,0.08)" strokeWidth="1" />
          <path d={path} fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" className="energy-chart-path animate-draw-line" />
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[#6b8075]">
        <span>Earlier</span>
        <span>Recent</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#173127]">Last point: {formatter(points[points.length - 1].y, suffix)}</p>
    </section>
  );
}

function BenchmarkComparison({ totalResponses, totalEstimatedWh, benchmarkComparisons }) {
  if (totalResponses === 0) {
    return (
      <EmptyState
        title="Energy Benchmarks"
        body="Send a few prompts and this view will compare Energy AI with external benchmark profiles."
      />
    );
  }

  const rows = [
    {
      id: "energy-ai-local",
      label: "Energy AI Local Estimate",
      kind: "local",
      totalWh: totalEstimatedWh,
      detail: "Scaled from your low/high energy mix and measured response latency."
    },
    ...benchmarkComparisons
  ];
  const maxWh = Math.max(...rows.map((row) => row.totalWh), 0.001);

  return (
    <section className="energy-panel energy-sheen p-5">
      <p className="energy-eyebrow">Benchmark layer</p>
      <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">How your current usage compares</h3>
      <p className="mt-2 text-sm leading-7 text-[#5d7468]">
        Same-response comparison for {totalResponses} assistant replies. ChatGPT uses a published benchmark. Gemini is shown as
        a proxy because Google does not publish direct per-query Gemini energy.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {rows.map((row) => {
          const benchmark = benchmarkComparisons.find((item) => item.id === row.id);
          const width = Math.max((row.totalWh / maxWh) * 100, 12);
          const toneClass =
            row.kind === "local"
              ? "bg-[linear-gradient(135deg,#f4fbf7_0%,#e8f7ef_100%)] border-[#cde7d8]"
              : row.kind === "published"
                ? "bg-[linear-gradient(135deg,#fff8e8_0%,#fff0cf_100%)] border-[#ecd9ab]"
                : "bg-[linear-gradient(135deg,#eef4ff_0%,#e0ebff_100%)] border-[#c8d7f2]";
          const barClass =
            row.kind === "local"
              ? "bg-[linear-gradient(90deg,#9fe0bc_0%,#2f8f63_100%)]"
              : row.kind === "published"
                ? "bg-[linear-gradient(90deg,#f7dc97_0%,#b97d1c_100%)]"
                : "bg-[linear-gradient(90deg,#a2c5ff_0%,#4a78de_100%)]";

          return (
            <article key={row.id} className={`rounded-[28px] border p-5 ${toneClass}`}>
              <p className="text-sm font-semibold text-[#173127]">{row.label}</p>
              <p className="mt-2 text-sm leading-7 text-[#5b6f65]">{row.detail}</p>
              <p className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-[#13241b]">{formatEnergy(row.totalWh)}</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70">
                    <div className={`energy-meter-fill h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#6b8075]">
                {benchmark
                  ? benchmark.savingsPct >= 0
                    ? `${benchmark.savingsPct}% more than Energy AI`
                    : `${Math.abs(benchmark.savingsPct)}% less than Energy AI`
                  : "Your current estimated total"}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MethodologyNote() {
  return (
    <section className="energy-panel energy-sheen p-5">
      <p className="energy-eyebrow">Methodology</p>
      <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#13241b]">What these numbers mean</h3>
      <div className="mt-4 space-y-3 text-sm leading-7 text-[#5d7468]">
        <p>Energy AI values are estimates, not hardware power measurements. They scale by low/high energy route and observed latency for each response.</p>
        <p>ChatGPT uses the public August 22, 2025 OpenAI Academy benchmark that cites Epoch AI at roughly 0.3 Wh for a typical query.</p>
        <p>Google does not publish direct per-query Gemini energy. The Gemini comparison uses a frontier-chat proxy, while Google&apos;s 2025 environmental report says Ironwood TPU is nearly 30x more energy efficient than its 2018 first Cloud TPU.</p>
        <p className="pt-1">
          <a
            href="https://academy.openai.com/public/clubs/higher-education-05x4z/resources/environmental-impact-of-ai"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#0f2f20] underline decoration-[#9bb6a5] underline-offset-4"
          >
            OpenAI energy note
          </a>
          {" · "}
          <a
            href="https://sustainability.google/intl/es_es/google-2025-environmental-report/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#0f2f20] underline decoration-[#9bb6a5] underline-offset-4"
          >
            Google 2025 environmental report
          </a>
          {" · "}
          <a
            href="https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-deep-think/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#0f2f20] underline decoration-[#9bb6a5] underline-offset-4"
          >
            Gemini reasoning mode
          </a>
        </p>
      </div>
    </section>
  );
}

export default function AnalyticsPage({ sessions }) {
  const metrics = summarizeMessages(sessions);
  const chatgptBenchmark = metrics.benchmarkComparisons.find((item) => item.id === "chatgpt-typical");
  const geminiBenchmark = metrics.benchmarkComparisons.find((item) => item.id === "gemini-frontier-proxy");

  return (
    <section className="energy-page-enter space-y-4">
      <header className="energy-panel-dark animate-page-in p-5 sm:p-6">
        <span className="energy-orbit-ring left-[6%] top-[20%] h-24 w-24" />
        <span className="energy-orbit-ring energy-orbit-ring-reverse right-[18%] top-[30%] h-[4.5rem] w-[4.5rem]" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="energy-chip border-white/12 bg-white/10 text-[#f2d7a5]">
              <Sparkles size={14} />
              Analytics dashboard
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-white sm:text-4xl">
              Energy AI usage, benchmarked like a live control room.
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/72">
              Track local response energy estimates, compare them against frontier chat benchmarks, and see when the system
              stays lightweight versus escalating into heavier reasoning.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-3 text-white">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Tracked replies</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-[-0.04em]">{metrics.totalAssistantResponses}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-3 text-white">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Est. energy</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-[-0.04em]">{formatEnergy(metrics.totalEstimatedWh)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Total Responses" value={metrics.totalAssistantResponses} icon={BarChart3} tint="bg-[#edf6f1] text-[#214d34]" delay={40} />
        <MetricCard
          title="Est. Energy Used"
          value={formatEnergy(metrics.totalEstimatedWh)}
          icon={BatteryCharging}
          tint="bg-[#eef6fb] text-[#24537a]"
          note="Estimated from route plus latency"
          delay={100}
        />
        <MetricCard title="Low Energy" value={metrics.lowEnergyResponses} icon={Leaf} tint="bg-[#edf9f1] text-[#1d6d47]" delay={160} />
        <MetricCard title="High Energy" value={metrics.highEnergyResponses} icon={Flame} tint="bg-[#fff3f0] text-[#a14a34]" delay={220} />
        <MetricCard
          title="Avg First Reply"
          value={metrics.avgLatency ? `${metrics.avgLatency} ms` : "Waiting..."}
          icon={Timer}
          tint="bg-[#fff6e5] text-[#9b6a1d]"
          note="Recent replies, measured from send to first visible response"
          delay={280}
        />
        <MetricCard
          title="Vs ChatGPT"
          value={chatgptBenchmark ? `${chatgptBenchmark.savingsPct}% lower` : "N/A"}
          icon={Gauge}
          tint="bg-[#ecf3ff] text-[#3557a8]"
          note="Against the typical-query benchmark"
          delay={340}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ModelUsageChart usageBars={metrics.usageBars} />
        <LineChart
          title="Estimated Energy Per Response"
          points={metrics.consumptionSeries}
          suffix=" mWh"
          stroke="#24537a"
          note="Lower is better. This chart estimates local response energy from mode and latency."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title="Efficiency Vs ChatGPT Benchmark"
          points={metrics.efficiencySeries}
          suffix="%"
          stroke="#2f8f63"
          note="Percentage lower than the public typical ChatGPT query estimate."
        />
        <MetricCard
          title="Gemini Proxy"
          value={geminiBenchmark ? formatEnergy(geminiBenchmark.totalWh) : "N/A"}
          icon={Gauge}
          tint="bg-[#eef3ff] text-[#3557a8]"
          note="Proxy only because Google does not publish direct per-query Gemini energy"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title="Completion Trend"
          points={metrics.completionLatencySeries}
          suffix=" ms"
          stroke="#b97816"
          note="Full reply completion time across all tracked responses."
        />
        <MetricCard
          title="Avg Energy / Reply"
          value={formatEnergy(metrics.avgEnergyPerResponseWh)}
          icon={BatteryCharging}
          tint="bg-[#eef6fb] text-[#24537a]"
          note="Average estimated energy for each assistant response"
        />
      </div>

      <BenchmarkComparison
        totalResponses={metrics.totalAssistantResponses}
        totalEstimatedWh={metrics.totalEstimatedWh}
        benchmarkComparisons={metrics.benchmarkComparisons}
      />

      <MethodologyNote />
    </section>
  );
}
