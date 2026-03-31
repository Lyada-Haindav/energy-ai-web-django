import { ArrowRight, Clock3, Flame, Leaf, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import EnergyBrand from "./EnergyBrand";

function CTAButton({ filled = false, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className={filled ? "energy-home-primary-button" : "energy-home-secondary-button"}>
      {children}
    </button>
  );
}

function FeatureCard({ icon: Icon, title, body, tone }) {
  const toneClass =
    tone === "deep"
      ? "group energy-home-clean-feature energy-home-clean-feature-deep"
      : tone === "fast"
        ? "group energy-home-clean-feature energy-home-clean-feature-fast"
        : "group energy-home-clean-feature energy-home-clean-feature-auto";

  return (
    <article className={toneClass}>
      <div className="relative z-10">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d7dfd2] bg-white/80 text-[#294437] shadow-[0_18px_40px_-32px_rgba(18,38,29,0.42)] transition duration-300 group-hover:scale-105">
          <Icon size={18} />
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.04em] text-[#13291f]">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-[#516457]">{body}</p>
      </div>
    </article>
  );
}

function ModePreviewCard({ icon: Icon, title, body, tone }) {
  const toneClass =
    tone === "fast"
      ? "energy-home-preview-mode energy-home-preview-mode-fast"
      : tone === "deep"
        ? "energy-home-preview-mode energy-home-preview-mode-deep"
        : "energy-home-preview-mode energy-home-preview-mode-auto";

  return (
    <article className={toneClass}>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dde6d9] bg-white/85 text-[#365b4a]">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold tracking-[-0.03em] text-[#183124]">{title}</h3>
        <p className="mt-1 text-sm leading-7 text-[#627568]">{body}</p>
      </div>
    </article>
  );
}

export default function HomePage({ isAuthenticated, user, onNavigate }) {
  const pageRef = useRef(null);
  const nebulaRef = useRef(null);
  const auraRef = useRef(null);
  const hazeRef = useRef(null);
  const depthFieldRef = useRef(null);
  const copyRef = useRef(null);
  const heroSceneRef = useRef(null);
  const stageWrapRef = useRef(null);
  const frameRef = useRef(0);
  const motionEnabledRef = useRef(false);
  const currentRef = useRef({ x: 0.5, y: 0.34 });
  const targetRef = useRef({ x: 0.5, y: 0.34 });

  function setTransform(node, value) {
    if (node) {
      node.style.transform = value;
    }
  }

  function applyMotionStyles({ x, y }) {
    const pointerX = x * Math.max(window.innerWidth || 0, 1);
    const pointerY = y * Math.max(window.innerHeight || 0, 1);
    const shiftX = (x - 0.5) * 26;
    const shiftY = (y - 0.42) * 20;
    const tiltX = (0.46 - y) * 4.2;
    const tiltY = (x - 0.5) * 6.2;

    setTransform(copyRef.current, `translate3d(${(-shiftX * 0.38).toFixed(2)}px, ${(-shiftY * 0.38).toFixed(2)}px, 0)`);
    setTransform(heroSceneRef.current, `translate3d(${(shiftX * 0.32).toFixed(2)}px, ${(shiftY * 0.32).toFixed(2)}px, 0)`);
    setTransform(
      stageWrapRef.current,
      `perspective(1800px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translate3d(${(shiftX * 0.58).toFixed(2)}px, ${(shiftY * 0.58).toFixed(2)}px, 0)`
    );
    setTransform(nebulaRef.current, `translate3d(${(shiftX * 0.16).toFixed(2)}px, ${(shiftY * 0.16).toFixed(2)}px, 0)`);
    setTransform(hazeRef.current, `translate3d(${(shiftX * 0.22).toFixed(2)}px, ${(shiftY * 0.22).toFixed(2)}px, 0)`);
    setTransform(depthFieldRef.current, `translate3d(${(shiftX * 0.28).toFixed(2)}px, ${(shiftY * 0.28).toFixed(2)}px, 0)`);
    setTransform(auraRef.current, `translate3d(${(pointerX - 230).toFixed(2)}px, ${(pointerY - 230).toFixed(2)}px, 0)`);
  }

  function applyParallax() {
    const node = pageRef.current;
    if (!node) {
      frameRef.current = 0;
      return;
    }

    const current = currentRef.current;
    const target = targetRef.current;
    current.x += (target.x - current.x) * 0.16;
    current.y += (target.y - current.y) * 0.16;

    applyMotionStyles({ x: current.x, y: current.y });

    const deltaX = Math.abs(target.x - current.x);
    const deltaY = Math.abs(target.y - current.y);
    if (deltaX < 0.0015 && deltaY < 0.0015) {
      frameRef.current = 0;
      return;
    }

    frameRef.current = requestAnimationFrame(applyParallax);
  }

  function queueParallax() {
    if (frameRef.current || !motionEnabledRef.current) {
      return;
    }

    frameRef.current = requestAnimationFrame(applyParallax);
  }

  function updateParallax(clientX, clientY) {
    if (!motionEnabledRef.current) {
      return;
    }

    if (!window.innerWidth || !window.innerHeight) {
      return;
    }

    const relativeX = Math.min(Math.max(clientX / window.innerWidth, 0), 1);
    const relativeY = Math.min(Math.max(clientY / window.innerHeight, 0), 1);
    targetRef.current = { x: relativeX, y: relativeY };
    queueParallax();
  }

  function resetParallax() {
    targetRef.current = { x: 0.5, y: 0.34 };
    queueParallax();
  }

  useEffect(() => {
    motionEnabledRef.current = false;
    currentRef.current = { x: 0.5, y: 0.34 };
    targetRef.current = { x: 0.5, y: 0.34 };
    applyMotionStyles({ x: 0.5, y: 0.34 });

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <main ref={pageRef} className="energy-home-page-clean relative min-h-screen overflow-hidden">
      <div className="energy-space-stars energy-space-layer energy-space-layer-stars opacity-95" />
      <div ref={nebulaRef} className="energy-space-nebula energy-space-layer energy-space-layer-nebula" />
      <div ref={auraRef} className="energy-space-cursor-aura" />
      <div ref={hazeRef} className="energy-home-haze energy-space-layer" />
      <div ref={depthFieldRef} className="energy-home-depth-field energy-space-layer" />

      <section className="energy-home-shell relative mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-0 pb-6 pt-0 sm:px-6 sm:pb-8 sm:pt-4">
        <header className="energy-home-clean-nav animate-page-in flex flex-wrap items-center justify-between gap-4 rounded-none border-x-0 border-t-0 px-4 py-3 sm:rounded-[26px] sm:border sm:px-5">
          <EnergyBrand
            size={48}
            titleClassName="text-xl sm:text-[1.35rem] text-[#183124]"
            subtitleClassName="text-[10px] sm:text-[11px] text-[#7d8d7e]"
          />

          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            {isAuthenticated ? (
              <>
                <span className="energy-home-clean-badge justify-center">{user?.name || "Signed in"}</span>
                {user?.isAdmin ? <CTAButton onClick={() => onNavigate("admin")}>Admin</CTAButton> : null}
                <CTAButton onClick={() => onNavigate("analytics")}>Analytics</CTAButton>
                <CTAButton filled onClick={() => onNavigate("chat")}>
                  Open Workspace
                  <ArrowRight size={16} />
                </CTAButton>
              </>
            ) : (
              <>
                <CTAButton onClick={() => onNavigate("login")}>Login</CTAButton>
                <CTAButton filled onClick={() => onNavigate("signup")}>
                  Start Free
                  <ArrowRight size={16} />
                </CTAButton>
              </>
            )}
          </div>
        </header>

        <section className="energy-home-hero-grid relative grid flex-1 items-center gap-10 overflow-hidden px-4 pb-10 pt-8 lg:grid-cols-[0.96fr_1.04fr] lg:gap-14">
          <div ref={copyRef} className="energy-home-copy max-w-2xl text-left">
            <div className="energy-home-clean-badge animate-rise">
              <Sparkles size={14} />
              One AI system. Three energy levels.
            </div>

            <h1 className="mt-8 animate-rise energy-stagger-1 font-display text-[3.35rem] font-bold tracking-[-0.08em] text-[#10261d] sm:text-7xl lg:text-[6.15rem]">
              <span className="block">The right answer at the</span>
              <span className="block text-[#132b21]">right speed.</span>
            </h1>

            <p className="mt-6 max-w-xl animate-rise energy-stagger-2 text-base leading-8 text-[#5f7064] sm:text-[1.36rem]">
              Energy AI answers simple prompts in Low-Energy mode, switches to High-Energy mode for harder reasoning, and uses Auto Balance to decide when speed matters more than depth.
            </p>

            <div className="mt-10 flex animate-rise energy-stagger-3 flex-col gap-3 sm:flex-row">
              <CTAButton filled onClick={() => onNavigate(isAuthenticated ? "chat" : "signup")}>
                {isAuthenticated ? "Open Workspace" : "Start now"}
                <ArrowRight size={16} />
              </CTAButton>
              <CTAButton onClick={() => onNavigate(isAuthenticated ? "analytics" : "login")}>
                {isAuthenticated ? "See Analytics" : "Sign in"}
              </CTAButton>
            </div>

            <div className="mt-8 flex animate-rise energy-stagger-4 flex-wrap gap-3">
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
          </div>

          <div ref={heroSceneRef} className="energy-home-clean-scene animate-page-in energy-stagger-2">
            <div ref={stageWrapRef} className="energy-home-stage-wrap">
              <div className="energy-home-preview-stack energy-home-stage">
                <div className="energy-home-preview-backdrop" />
                <div className="energy-home-preview-backdrop energy-home-preview-backdrop-secondary" />
                <div className="energy-home-preview-card">
                  <p className="energy-home-preview-kicker">Model preview</p>
                  <h2 className="energy-home-preview-title">Choose speed. Keep depth.</h2>

                  <div className="mt-5 space-y-3">
                    <ModePreviewCard
                      icon={Leaf}
                      title="Low-Energy"
                      body="Built for direct questions, short tasks, and faster response time."
                      tone="fast"
                    />
                    <ModePreviewCard
                      icon={Clock3}
                      title="Auto Balance"
                      body="Routes the prompt automatically so easy work stays fast and hard work gets more thinking time."
                      tone="auto"
                    />
                    <ModePreviewCard
                      icon={Flame}
                      title="High-Energy"
                      body="Uses more reasoning time for coding, debugging, planning, architecture, and deeper analysis."
                      tone="deep"
                    />
                  </div>

                  <div className="energy-home-preview-footer">
                    <span>Energy AI</span>
                    <strong>Fast for the easy parts. Deep for the important parts.</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="energy-home-feature-grid grid gap-4 px-4 pb-8 md:grid-cols-3 md:px-0">
          <FeatureCard icon={Leaf} title="Low Energy" body="Direct questions stay clean, fast, and immediate." tone="fast" />
          <FeatureCard icon={Clock3} title="Auto Balance" body="The router decides when to stay light and when to think longer." tone="auto" />
          <FeatureCard icon={Flame} title="High Energy" body="Debugging and complex coding get the deeper pass." tone="deep" />
        </section>
      </section>
    </main>
  );
}
