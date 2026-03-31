import { ArrowRight, Cpu, Flame, Leaf, Radar, Sparkles, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import EnergyBrand, { EnergyLogo } from "./EnergyBrand";
import RobotStage from "./RobotStage";

function CTAButton({ filled = false, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className={filled ? "energy-space-primary" : "energy-space-secondary"}>
      {children}
    </button>
  );
}

function FeatureCard({ icon: Icon, title, body, tone }) {
  const accentClass =
    tone === "deep"
      ? "from-[#6d28d9]/30 to-[#06b6d4]/10"
      : tone === "fast"
        ? "from-[#06b6d4]/28 to-transparent"
        : "from-[#7c3aed]/26 to-transparent";

  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/18">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentClass}`} />
      <div className="relative z-10">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white transition duration-300 group-hover:scale-105">
          <Icon size={18} />
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.04em] text-white">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-white/62">{body}</p>
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
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerFine = window.matchMedia("(pointer: fine)");

    const updateMotionMode = () => {
      motionEnabledRef.current = !prefersReducedMotion.matches && pointerFine.matches;
      if (!motionEnabledRef.current) {
        currentRef.current = { x: 0.5, y: 0.34 };
        targetRef.current = { x: 0.5, y: 0.34 };
        applyMotionStyles({ x: 0.5, y: 0.34 });
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = 0;
        }
        return;
      }

      resetParallax();
    };

    updateMotionMode();
    const handleWindowPointerMove = (event) => {
      updateParallax(event.clientX, event.clientY);
    };
    const handleWindowPointerLeave = () => resetParallax();

    window.addEventListener("resize", updateMotionMode);
    window.addEventListener("pointermove", handleWindowPointerMove, { passive: true });
    window.addEventListener("blur", handleWindowPointerLeave);
    document.addEventListener("mouseleave", handleWindowPointerLeave);

    return () => {
      window.removeEventListener("resize", updateMotionMode);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("blur", handleWindowPointerLeave);
      document.removeEventListener("mouseleave", handleWindowPointerLeave);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <main ref={pageRef} className="energy-space-page relative min-h-screen overflow-hidden">
      <div className="energy-space-stars energy-space-layer energy-space-layer-stars opacity-95" />
      <div ref={nebulaRef} className="energy-space-nebula energy-space-layer energy-space-layer-nebula" />
      <div ref={auraRef} className="energy-space-cursor-aura" />
      <div ref={hazeRef} className="energy-home-haze energy-space-layer" />
      <div ref={depthFieldRef} className="energy-home-depth-field energy-space-layer" />

      <section className="energy-home-shell relative mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-0 pb-6 pt-0 sm:px-6 sm:pb-8 sm:pt-4">
        <header className="energy-space-nav animate-page-in flex flex-wrap items-center justify-between gap-4 rounded-none border-x-0 border-t-0 px-4 py-3 sm:rounded-[26px] sm:border sm:px-4">
          <EnergyBrand size={48} titleClassName="text-xl sm:text-[1.35rem]" subtitleClassName="text-[10px] sm:text-[11px]" />

          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            {isAuthenticated ? (
              <>
                <span className="energy-space-badge justify-center">{user?.name || "Signed in"}</span>
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

        <section className="energy-home-hero-grid relative grid flex-1 items-center gap-10 overflow-hidden px-4 pb-10 pt-8 lg:grid-cols-[0.94fr_1.06fr] lg:gap-14">
          <div ref={copyRef} className="energy-home-copy max-w-2xl text-left">
            <div className="energy-space-badge animate-rise">
              <Sparkles size={14} />
              Adaptive local intelligence
            </div>

            <h1 className="mt-8 animate-rise energy-stagger-1 font-display text-5xl font-bold tracking-[-0.07em] text-white sm:text-7xl lg:text-[6.2rem]">
              <span className="flex items-center gap-4 sm:gap-5">
                <EnergyLogo size={60} className="sm:h-[78px] sm:w-[78px]" />
                <span>Energy AI</span>
              </span>
              <span className="mt-3 block bg-[linear-gradient(135deg,#8b5cf6_0%,#6366f1_34%,#38bdf8_68%,#67e8f9_100%)] bg-clip-text text-transparent">
                beautifully fast. seriously deep.
              </span>
            </h1>

            <p className="mt-6 max-w-xl animate-rise energy-stagger-2 text-base leading-8 text-white/56 sm:text-xl">
              A dark AI workspace that stays quick for simple prompts and spends more reasoning only when the work deserves it.
            </p>

            <div className="mt-10 flex animate-rise energy-stagger-3 flex-col gap-3 sm:flex-row">
              <CTAButton filled onClick={() => onNavigate(isAuthenticated ? "chat" : "signup")}>
                {isAuthenticated ? "Open Workspace" : "Launch Energy AI"}
                <ArrowRight size={16} />
              </CTAButton>
              <CTAButton onClick={() => onNavigate(isAuthenticated ? "analytics" : "login")}>
                {isAuthenticated ? "See Analytics" : "Login"}
              </CTAButton>
            </div>

            <div className="mt-10 grid animate-rise energy-stagger-4 gap-3 sm:grid-cols-3">
              <div className="energy-home-stat">
                <span>low energy</span>
                <strong>fast answers</strong>
              </div>
              <div className="energy-home-stat">
                <span>adaptive</span>
                <strong>smart routing</strong>
              </div>
              <div className="energy-home-stat">
                <span>high energy</span>
                <strong>deep work</strong>
              </div>
            </div>

            <div className="mt-8 flex animate-rise energy-stagger-5 flex-wrap gap-3">
              <span className="energy-space-badge">
                <Leaf size={14} />
                low energy
              </span>
              <span className="energy-space-badge">
                <Cpu size={14} />
                adaptive core
              </span>
              <span className="energy-space-badge">
                <Flame size={14} />
                high energy
              </span>
            </div>
          </div>

          <div ref={heroSceneRef} className="energy-home-scene animate-page-in energy-stagger-2">
            <div
              className="energy-home-float left-[3%] top-[12%] hidden lg:inline-flex"
              style={{ "--energy-float-x": "-0.34", "--energy-float-y": "-0.22" }}
            >
              <Sparkles size={14} />
              source grounded
            </div>
            <div
              className="energy-home-float right-[2%] top-[20%] hidden lg:inline-flex"
              style={{ "--energy-float-x": "0.32", "--energy-float-y": "-0.16" }}
            >
              <Radar size={14} />
              cursor reactive
            </div>
            <div
              className="energy-home-float bottom-[14%] left-[8%] hidden lg:inline-flex"
              style={{ "--energy-float-x": "-0.24", "--energy-float-y": "0.2" }}
            >
              <Zap size={14} />
              live orchestration
            </div>
            <div ref={stageWrapRef} className="energy-home-stage-wrap">
              <RobotStage fullBleed className="energy-home-stage" />
            </div>
          </div>
        </section>

        <section className="energy-home-feature-grid grid gap-4 px-4 pb-8 md:grid-cols-3 md:px-0">
          <FeatureCard icon={Leaf} title="Low Energy" body="Direct prompts stay lean and immediate." tone="fast" />
          <FeatureCard icon={Cpu} title="Adaptive Core" body="The router decides when to stay light and when to think longer." tone="auto" />
          <FeatureCard icon={Flame} title="High Energy" body="Debugging and complex coding get the deeper pass." tone="deep" />
        </section>
      </section>
    </main>
  );
}
