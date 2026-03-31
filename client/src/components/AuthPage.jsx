import { ArrowRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import AuthShell from "./AuthShell";

function Notice({ tone = "neutral", children }) {
  const toneClass =
    tone === "error"
      ? "border-[#edc6bf] bg-[#fff1ed] text-[#9a4a3b]"
      : tone === "success"
        ? "border-[#cfe4d4] bg-[#eff8f0] text-[#2f6a47]"
        : "border-[#dddcc8] bg-[#fffaf0] text-[#7c6840]";

  return <div className={`rounded-[22px] border px-4 py-4 text-sm leading-7 ${toneClass}`}>{children}</div>;
}

function previewMessage(baseText, error) {
  return error ? `${baseText} ${error}` : baseText;
}

function PreviewLink({ href, label }) {
  if (!href) {
    return null;
  }

  return (
    <a href={href} className="energy-space-secondary mt-3 inline-flex px-4 py-2.5 text-sm">
      {label}
    </a>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, autoComplete }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#355445]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="energy-auth-input"
      />
    </label>
  );
}

export default function AuthPage({
  mode,
  onLogin,
  onRegister,
  onForgotPassword,
  navigate,
  defaultEmail = ""
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot-password";

  const title = useMemo(() => {
    if (isSignup) {
      return "Create account";
    }
    if (isForgot) {
      return "Recover access";
    }
    return "Sign in";
  }, [isForgot, isSignup]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      if (isSignup) {
        const result = await onRegister({ name, email, password });
        setStatus({
          tone: result.emailDelivery?.previewOnly ? "neutral" : "success",
          text: result.emailDelivery?.previewOnly
            ? previewMessage("Account created. Use the preview link below.", result.emailDelivery?.error)
            : "Account created. Verify your email to continue.",
          previewUrl: result.emailDelivery?.previewOnly ? result.emailDelivery?.previewUrl : "",
          previewLabel: "Open verification preview"
        });
        return;
      }

      if (isForgot) {
        const result = await onForgotPassword({ email });
        setStatus({
          tone: result.emailDelivery?.previewOnly ? "neutral" : "success",
          text: result.emailDelivery?.previewOnly
            ? previewMessage("Reset link ready. Use the preview below.", result.emailDelivery?.error)
            : `${result.message || "If that account exists, a reset email is on the way."}`,
          previewUrl: result.emailDelivery?.previewOnly ? result.emailDelivery?.previewUrl : "",
          previewLabel: "Open reset preview"
        });
        return;
      }

      await onLogin({ email, password });
      navigate("chat");
    } catch (error) {
      if (isLogin && error.status === 403) {
        navigate("verify-email", { email });
        return;
      }

      setStatus({
        tone: "error",
        text:
          (isLogin && error.status === 404
            ? `${error.message || "No account found."} Create it again.`
            : isSignup && error.status === 409
              ? `${error.message || "Account already exists."} Try login instead.`
              : error.message) || "Request failed."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = isSignup ? (
    <p>
      Already have an account?{" "}
      <button type="button" onClick={() => navigate("login")} className="font-semibold text-[#173324] transition hover:text-[#48725b]">
        Login
      </button>
    </p>
  ) : isForgot ? (
    <p>
      Remembered it?{" "}
      <button type="button" onClick={() => navigate("login")} className="font-semibold text-[#173324] transition hover:text-[#48725b]">
        Back to login
      </button>
    </p>
  ) : (
    <p>
      Need an account?{" "}
      <button type="button" onClick={() => navigate("signup")} className="font-semibold text-[#173324] transition hover:text-[#48725b]">
        Create one
      </button>
    </p>
  );

  return (
    <AuthShell mode={mode} footer={footer}>
      <p className="text-xs uppercase tracking-[0.28em] text-[#8a968c]">{isSignup ? "Sign up" : isForgot ? "Recovery" : "Login"}</p>
      <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-[#173324]">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-[#5d7064]">
        {isSignup ? "Create your private workspace." : isForgot ? "We will send a reset link." : "Continue to your workspace."}
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {isSignup ? <Field label="Full name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" /> : null}

        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />

        {!isForgot ? (
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
        ) : null}

        {status ? (
          <Notice tone={status.tone}>
            <div>{status.text}</div>
            <PreviewLink href={status.previewUrl} label={status.previewLabel} />
          </Notice>
        ) : null}

        <button type="submit" disabled={isSubmitting} className="energy-home-primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {isSignup ? "Create account" : isForgot ? "Send reset link" : "Sign in"}
        </button>

        {!isForgot && !isSignup ? (
          <button type="button" onClick={() => navigate("forgot-password")} className="w-full text-sm font-semibold text-[#5d7064] transition hover:text-[#173324]">
            Forgot password?
          </button>
        ) : null}
      </form>
    </AuthShell>
  );
}
