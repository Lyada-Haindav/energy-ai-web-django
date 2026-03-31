import { Clock3, Flame, Leaf, Sparkles } from "lucide-react";
import EnergyBrand from "./EnergyBrand";

const MODE_COPY = {
  login: {
    badge: "Access",
    title: "Enter Energy AI",
    description: "Fast routing, deep reasoning, and a cleaner workspace."
  },
  signup: {
    badge: "Sign up",
    title: "Create your workspace",
    description: "Start with a cleaner interface and adaptive reasoning."
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
    <main className="energy-home-page-clean energy-clean-shell relative min-h-screen overflow-hidden">
      <div className="energy-space-stars opacity-90" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[14%] h-52 w-52 rounded-full bg-[#efcb81]/20 blur-3xl" />
        <div className="absolute right-[14%] top-[18%] h-64 w-64 rounded-full bg-[#bfd6bf]/16 blur-3xl" />
        <div className="absolute bottom-[12%] left-[24%] h-56 w-56 rounded-full bg-[#f0b98f]/14 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-5 sm:px-6">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_460px]">
          <div className="animate-page-in">
            <div className="energy-home-clean-nav inline-flex rounded-full px-4 py-2">
              <EnergyBrand size={38} showSubtitle={false} titleClassName="text-base text-[#173324]" />
            </div>

            <div className="mt-8 max-w-3xl">
              <div className="energy-home-clean-badge">
                <Sparkles size={14} />
                {copy.badge}
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold tracking-[-0.06em] text-[#13291f] sm:text-6xl">
                {copy.title}
              </h1>
              <p className="mt-4 text-base leading-8 text-[#5d7064] sm:text-lg">{copy.description}</p>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <span className="energy-home-mode-pill energy-home-mode-pill-fast">
                <Leaf size={14} />
                Low Energy
              </span>
              <span className="energy-home-mode-pill energy-home-mode-pill-auto">
                <Clock3 size={14} />
                Auto Balance
              </span>
              <span className="energy-home-mode-pill energy-home-mode-pill-deep">
                <Flame size={14} />
                High Energy
              </span>
            </div>

            <div className="mt-8 max-w-[760px]">
              <div className="energy-home-preview-card relative w-full max-w-[620px]">
                <p className="energy-home-preview-kicker">Energy AI</p>
                <h2 className="energy-home-preview-title text-[2.25rem] sm:text-[2.8rem]">Sign in fast. Think deeper when needed.</h2>
                <div className="mt-5 space-y-3">
                  <div className="energy-home-preview-mode energy-home-preview-mode-fast">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dde6d9] bg-white/85 text-[#365b4a]">
                      <Leaf size={16} />
                    </span>
                    <div>
                      <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[#183124]">Low-Energy</h3>
                      <p className="mt-1 text-sm leading-7 text-[#627568]">Short tasks stay quick and clean.</p>
                    </div>
                  </div>
                  <div className="energy-home-preview-mode energy-home-preview-mode-auto">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dde6d9] bg-white/85 text-[#8a6c2f]">
                      <Clock3 size={16} />
                    </span>
                    <div>
                      <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[#183124]">Auto Balance</h3>
                      <p className="mt-1 text-sm leading-7 text-[#627568]">Energy AI decides when the prompt needs deeper work.</p>
                    </div>
                  </div>
                </div>
              </div>
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
