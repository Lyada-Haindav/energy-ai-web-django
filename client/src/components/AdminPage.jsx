import { Activity, AlertTriangle, ArrowLeft, BrainCircuit, Database, Gauge, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAdminOverview, triggerAdminRetrain } from "../lib/api";
import EnergyBrand from "./EnergyBrand";

function formatTime(timestamp) {
  if (!timestamp) {
    return "Not yet";
  }

  try {
    return new Date(timestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return "Unknown";
  }
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <article className="energy-panel relative overflow-hidden rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="energy-eyebrow">{label}</p>
          <p className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-[#173324]">{value}</p>
          {hint ? <p className="mt-2 text-sm text-[#5d7064]">{hint}</p> : null}
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d6ddd0] bg-white/72 text-[#173324]">
          <Icon size={18} />
        </span>
      </div>
    </article>
  );
}

function TrainingRow({ label, value, hint }) {
  return (
    <div className="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a968c]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[#173324]">{value}</p>
      {hint ? <p className="mt-1 text-sm text-[#7d8d7e]">{hint}</p> : null}
    </div>
  );
}

function InsightList({ title, items, empty }) {
  return (
    <div className="rounded-[28px] border border-[#d6ddd0] bg-white/72 p-5">
      <p className="energy-eyebrow">{title}</p>
      <div className="mt-4 space-y-2.5">
        {Array.isArray(items) && items.length > 0 ? (
          items.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#dce4d8] bg-white/82 px-4 py-3">
              <span className="text-sm text-[#5d7064]">{item.label}</span>
              <span className="text-sm font-semibold text-[#173324]">{item.count ?? item.value ?? 0}</span>
            </div>
          ))
        ) : (
          <div className="rounded-[18px] border border-[#dce4d8] bg-white/82 px-4 py-4 text-sm text-[#7d8d7e]">{empty}</div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage({ user, onNavigate }) {
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetraining, setIsRetraining] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview({ silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const result = await fetchAdminOverview();
      setOverview(result);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Could not load admin overview.");
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadOverview();

    const interval = window.setInterval(() => {
      void loadOverview({ silent: true });
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  async function handleRetrain() {
    setIsRetraining(true);
    try {
      await triggerAdminRetrain();
      await loadOverview({ silent: true });
      setError("");
    } catch (retrainError) {
      setError(retrainError.message || "Could not start retraining.");
    } finally {
      setIsRetraining(false);
    }
  }

  const training = overview?.training;
  const stats = overview?.stats;
  const quality = overview?.quality;
  const health = overview?.health;
  const controls = overview?.controls;
  const modelSummary = useMemo(() => {
    if (!training?.metadata) {
      return null;
    }

    return {
      router: training.metadata.router_examples || 0,
      fast: training.metadata.fast_examples || 0,
      deep: training.metadata.deep_examples || 0
    };
  }, [training]);

  const energyScorecard = useMemo(() => quality?.energyScorecard || [], [quality]);

  return (
    <main className="energy-home-page-clean energy-clean-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-[#efcb81]/18 blur-3xl animate-drift" />
        <div className="absolute right-[-5rem] top-[8%] h-80 w-80 rounded-full bg-[#bfd6bf]/14 blur-3xl animate-float" />
        <div className="absolute bottom-[-10rem] left-[10%] h-80 w-80 rounded-full bg-[#f0b98f]/16 blur-3xl animate-drift" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="energy-home-clean-nav flex flex-wrap items-center justify-between gap-3 rounded-[28px] px-4 py-3">
          <EnergyBrand size={44} titleClassName="text-xl text-[#173324]" subtitleClassName="text-[10px] text-[#7d8d7e]" />

          <div className="flex flex-wrap items-center gap-2">
            <span className="energy-chip border-[#d6ddd0] bg-white/72 text-[#48725b]">
              <ShieldCheck size={13} />
              Admin
            </span>
            <span className="energy-chip border-[#d6ddd0] bg-white/72 text-[#5d7064]">{user?.email || "Unknown user"}</span>
            <button type="button" onClick={() => onNavigate("home")} className="energy-home-secondary-button px-4 py-2 text-sm">
              <ArrowLeft size={14} />
              Home
            </button>
            <button type="button" onClick={() => onNavigate("chat")} className="energy-home-primary-button px-4 py-2 text-sm">
              Open Chat
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="energy-panel rounded-[34px] p-6">
            <p className="energy-eyebrow">Admin Console</p>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-[-0.06em] text-[#173324] sm:text-5xl">
              Control training, health, and quality from one place.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#5d7064] sm:text-lg">
              This page is intentionally separate at <span className="font-semibold text-[#173324]">/admin</span> so the main product stays clean while admin controls remain protected.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRetrain}
                disabled={isRetraining || training?.inProgress}
                className="energy-home-primary-button px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetraining || training?.inProgress ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {training?.inProgress ? "Retraining..." : "Retrain Models"}
              </button>
              <button type="button" onClick={() => void loadOverview()} className="energy-home-secondary-button px-5 py-3 text-sm">
                <Activity size={15} />
                Refresh Overview
              </button>
            </div>

            {error ? (
              <div className="mt-5 rounded-[24px] border border-[#edc6bf] bg-[#fff1ed] px-4 py-3 text-sm text-[#9a4a3b]">{error}</div>
            ) : null}
          </div>

          <div className="energy-panel rounded-[34px] p-6">
            <p className="energy-eyebrow">Training Status</p>
            {isLoading && !overview ? (
              <div className="mt-6 inline-flex items-center gap-3 rounded-[20px] border border-[#d6ddd0] bg-white/72 px-4 py-3 text-sm text-[#5d7064]">
                <Loader2 size={15} className="animate-spin" />
                Loading admin overview
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <TrainingRow label="State" value={training?.lastTrainResult?.status || "idle"} hint={training?.lastTrainResult?.detail || "Waiting for training activity"} />
                <TrainingRow label="Last Started" value={formatTime(training?.lastTrainStartedAt)} />
                <TrainingRow label="Last Completed" value={formatTime(training?.lastTrainCompletedAt)} />
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Users" value={stats?.users || 0} hint={`${stats?.verifiedUsers || 0} verified`} />
          <StatCard icon={Activity} label="Chat Sessions" value={stats?.chatSessions || 0} hint={`${stats?.activeChats24h || 0} active in 24h`} />
          <StatCard icon={Database} label="Auth Sessions" value={stats?.authSessions || 0} hint="Active login sessions" />
          <StatCard icon={BrainCircuit} label="Approved Pairs" value={training?.files?.approved || 0} hint={`${training?.files?.candidates || 0} candidates, ${training?.files?.rejected || 0} rejected`} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="energy-panel rounded-[34px] p-6">
            <p className="energy-eyebrow">Model Artifacts</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <TrainingRow label="Router Rows" value={modelSummary?.router || 0} />
              <TrainingRow label="Fast Rows" value={modelSummary?.fast || 0} />
              <TrainingRow label="Deep Rows" value={modelSummary?.deep || 0} />
            </div>
          </div>

          <div className="energy-panel rounded-[34px] p-6">
            <p className="energy-eyebrow">Training Queue</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <TrainingRow label="Auto Train" value={training?.enabled ? "Enabled" : "Manual only"} />
              <TrainingRow label="Min New Pairs" value={training?.minNewExamples || 0} />
              <TrainingRow label="Cooldown" value={`${Math.round((training?.cooldownMs || 0) / 60000)} min`} />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="energy-panel rounded-[34px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="energy-eyebrow">Quality Signals</p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.05em] text-[#173324]">Feedback and model trust</h2>
              </div>
              <span className="energy-chip border-[#d6ddd0] bg-white/72 text-[#5d7064]">
                <Gauge size={13} />
                Approval {quality?.approvalRate || 0}%
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TrainingRow label="Upvotes" value={quality?.approvedFeedback || 0} />
              <TrainingRow label="Corrections" value={quality?.correctedFeedback || 0} />
              <TrainingRow label="Rejected" value={quality?.rejectedFeedback || 0} />
              <TrainingRow label="Candidates" value={quality?.candidateRows || 0} hint={`${stats?.avgMessagesPerChat || 0} avg msgs/chat`} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {energyScorecard.map((entry) => (
                <TrainingRow
                  key={entry.mode}
                  label={entry.mode === "low" ? "Low Energy Accuracy" : "High Energy Accuracy"}
                  value={`${entry.accuracy || 0}%`}
                  hint={`${entry.approved || 0} approved, ${entry.rejected || 0} rejected`}
                />
              ))}
            </div>
          </div>

          <InsightList title="Worst Prompts" items={quality?.worstPrompts} empty="Bad-answer inbox is clean right now." />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <InsightList title="Route Hotspots" items={quality?.routeHotspots} empty="No route pain points recorded yet." />

          <div className="energy-panel rounded-[34px] p-6">
            <p className="energy-eyebrow">Health and Reliability</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TrainingRow label="Uptime" value={`${Math.floor((health?.uptimeSeconds || 0) / 60)} min`} />
              <TrainingRow label="RSS Memory" value={`${health?.memoryMb?.rss || 0} MB`} />
              <TrainingRow label="Heap Used" value={`${health?.memoryMb?.heapUsed || 0} MB`} />
              <TrainingRow label="Storage" value={health?.storage?.mode || "file"} hint={health?.nodeVersion || ""} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(health?.rateLimits || []).map((limit) => (
                <TrainingRow
                  key={limit.id}
                  label={`${limit.id} limit`}
                  value={`${limit.max} / ${Math.round((limit.windowMs || 0) / 1000)}s`}
                  hint={`${limit.trackedKeys || 0} active keys`}
                />
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-[#d6ddd0] bg-white/72 p-4">
              <div className="flex items-center gap-2 text-[#5d7064]">
                <AlertTriangle size={15} />
                <span className="text-sm font-semibold">Admin workspace controls</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(controls?.workspaceModes || []).map((mode) => (
                  <span key={mode.id} className="energy-chip border-[#d6ddd0] bg-white/82 text-[#5d7064]">
                    {mode.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
