import { Cpu, Sparkles } from "lucide-react";
import EnergyBrand from "./EnergyBrand";
import RobotStage from "./RobotStage";

const MODE_COPY = {
  login: {
    badge: "Access",
    title: "Enter Energy AI",
    description: "Fast routing, deep reasoning, and a darker workspace."
  },
  signup: {
    badge: "Sign up",
    title: "Create your workspace",
    description: "Start with a cleaner dark interface and adaptive reasoning."
  },
  "forgot-password": {
    badge: "Recovery",
    title: "Recover access",
    description: "Get back into your private Energy AI workspace."
  },
  "reset-password": {
    badge: "Reset",
    title: "Set a new password",
    description: "Secure the account and continue."
  },
  "verify-email": {
    badge: "Verify",
    title: "Confirm your email",
    description: "One more step before the workspace opens."
  }
};

export default function AuthShell({ mode, children, footer }) {
  const copy = MODE_COPY[mode] || MODE_COPY.login;

  return (
    <main className="energy-space-page relative min-h-screen overflow-hidden">
      <div className="energy-space-stars opacity-90" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[14%] h-52 w-52 rounded-full bg-[#6d28d9]/18 blur-3xl" />
        <div className="absolute right-[14%] top-[18%] h-64 w-64 rounded-full bg-[#06b6d4]/14 blur-3xl" />
        <div className="absolute bottom-[12%] left-[24%] h-56 w-56 rounded-full bg-[#4f46e5]/14 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-5 sm:px-6">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_460px]">
          <div className="animate-page-in">
            <div className="energy-space-nav inline-flex rounded-full px-4 py-2">
              <EnergyBrand size={38} showSubtitle={false} titleClassName="text-base" />
            </div>

            <div className="mt-8 max-w-3xl">
              <div className="energy-space-badge">
                <Sparkles size={14} />
                {copy.badge}
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold tracking-[-0.06em] text-white sm:text-6xl">
                {copy.title}
              </h1>
              <p className="mt-4 text-base leading-8 text-white/58 sm:text-lg">{copy.description}</p>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <span className="energy-space-badge">
                <Cpu size={14} />
                adaptive core
              </span>
              <span className="energy-space-badge">source grounding</span>
            </div>

            <div className="mt-8 max-w-[760px]">
              <RobotStage compact showReadouts={false} className="energy-auth-stage" />
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="energy-auth-card animate-page-in w-full p-5 sm:p-6">
              <div className="relative z-10">
                {children}
                {footer ? <div className="mt-6 border-t border-white/10 pt-4 text-sm text-white/56">{footer}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
