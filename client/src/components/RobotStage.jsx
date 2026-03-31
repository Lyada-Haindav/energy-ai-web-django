import { Cpu, Radar, Sparkles, Zap } from "lucide-react";

function Badge({ icon: Icon, children, className = "" }) {
  return (
    <div className={`energy-intel-badge ${className}`}>
      <Icon size={14} />
      <span>{children}</span>
    </div>
  );
}

function Readout({ label, value }) {
  return (
    <div className="energy-intel-readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function RobotStage({ compact = false, fullBleed = false, showReadouts = true, className = "" }) {
  const stageClass = compact
    ? "min-h-[300px] sm:min-h-[420px] energy-intel-stage-compact"
    : fullBleed
      ? "min-h-[340px] sm:min-h-[520px] lg:min-h-[700px]"
      : "min-h-[460px] sm:min-h-[540px]";

  return (
    <div className={`energy-intel-stage ${stageClass} ${className}`}>
      <div className="energy-intel-ambient energy-intel-ambient-a" />
      <div className="energy-intel-ambient energy-intel-ambient-b" />
      <div className="energy-intel-ambient energy-intel-ambient-c" />
      <div className="energy-intel-ambient energy-intel-ambient-d" />

      <Badge icon={Sparkles} className="left-4 top-5 sm:left-6">
        adaptive routing
      </Badge>
      <Badge icon={Radar} className="right-4 top-14 sm:right-6">
        source grounded
      </Badge>
      <Badge icon={Cpu} className="bottom-5 left-4 sm:left-6">
        multi-model core
      </Badge>

      <div className="energy-intel-shell">
        <div className="energy-intel-wave energy-intel-wave-a" />
        <div className="energy-intel-wave energy-intel-wave-b" />

        <div className="energy-intel-ring energy-intel-ring-a" />
        <div className="energy-intel-ring energy-intel-ring-b" />
        <div className="energy-intel-ring energy-intel-ring-c" />

        <div className="energy-intel-trace energy-intel-trace-a" />
        <div className="energy-intel-trace energy-intel-trace-b" />
        <div className="energy-intel-trace energy-intel-trace-c" />

        <div className="energy-intel-node energy-intel-node-a" />
        <div className="energy-intel-node energy-intel-node-b" />
        <div className="energy-intel-node energy-intel-node-c" />
        <div className="energy-intel-node energy-intel-node-d" />

        <div className="energy-intel-core">
          <div className="energy-intel-core-glow" />
          <div className="energy-intel-core-shell" />
          <div className="energy-intel-core-shell energy-intel-core-shell-inner" />
          <div className="energy-intel-core-center">
            <span className="energy-intel-core-kicker">Energy AI</span>
            <strong>Adaptive Core</strong>
            <span className="energy-intel-core-copy">fast / auto / deep</span>
            <span className="energy-intel-core-icon">
              <Zap size={18} />
            </span>
          </div>
        </div>
      </div>

      {showReadouts ? (
        <div className="absolute inset-x-5 bottom-5 grid gap-3 sm:inset-x-6 sm:grid-cols-3">
          <Readout label="low energy" value="fast replies" />
          <Readout label="adaptive" value="smart routing" />
          <Readout label="high energy" value="deep thinking" />
        </div>
      ) : null}
    </div>
  );
}
