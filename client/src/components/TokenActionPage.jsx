import { CheckCircle2, Loader2, Mail, RefreshCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export default function TokenActionPage({
  mode,
  token,
  email = "",
  onVerifyEmail,
  onResetPassword,
  onResendVerification,
  navigate
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(null);
  const [isBusy, setIsBusy] = useState(mode === "verify-email" && Boolean(token));
  const [isResending, setIsResending] = useState(false);
  const verifyEmailHandlerRef = useRef(onVerifyEmail);

  useEffect(() => {
    verifyEmailHandlerRef.current = onVerifyEmail;
  }, [onVerifyEmail]);

  useEffect(() => {
    if (mode !== "verify-email" || !token) {
      return undefined;
    }

    let ignore = false;

    async function runVerification() {
      if (!token) {
        setStatus({ tone: "error", text: "This verification link is missing its token." });
        setIsBusy(false);
        return;
      }

      try {
        const result = await verifyEmailHandlerRef.current(token, email);
        if (!ignore && result?.autoSignedIn) {
          navigate("chat");
          return;
        }
        if (!ignore) {
          setStatus({
            tone: "success",
            text: result?.alreadyVerified ? "Already verified. Login to continue." : "Email verified. Login to continue."
          });
        }
      } catch (error) {
        if (!ignore) {
          setStatus({ tone: "error", text: error.message || "Verification failed." });
        }
      } finally {
        if (!ignore) {
          setIsBusy(false);
        }
      }
    }

    void runVerification();

    return () => {
      ignore = true;
    };
  }, [email, mode, navigate, token]);

  async function submitReset(event) {
    event.preventDefault();

    if (!token) {
      setStatus({ tone: "error", text: "This reset link is missing its token." });
      return;
    }
    if (password.length < 8) {
      setStatus({ tone: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ tone: "error", text: "Passwords do not match." });
      return;
    }

    setStatus(null);
    setIsBusy(true);

    try {
      const result = await onResetPassword({ token, password });
      setStatus({ tone: "success", text: result.message || "Password updated." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Reset failed." });
    } finally {
      setIsBusy(false);
    }
  }

  async function resendVerification() {
    setIsResending(true);
    setStatus(null);

    try {
      const result = await onResendVerification({ email });
      setStatus({
        tone: result.emailDelivery?.previewOnly ? "neutral" : "success",
        text: result.emailDelivery?.previewOnly
          ? previewMessage("Verification link ready. Use the preview below.", result.emailDelivery?.error)
          : `${result.message || "Verification email sent."}`,
        previewUrl: result.emailDelivery?.previewOnly ? result.emailDelivery?.previewUrl : "",
        previewLabel: "Open verification preview"
      });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Could not resend verification email." });
    } finally {
      setIsResending(false);
    }
  }

  if (mode === "verify-email") {
    return (
      <AuthShell
        mode={mode}
        footer={
          <p>
            Need to sign in first?{" "}
            <button type="button" onClick={() => navigate("login")} className="font-semibold text-[#173324] transition hover:text-[#48725b]">
              Go to login
            </button>
          </p>
        }
      >
        <p className="text-xs uppercase tracking-[0.28em] text-[#8a968c]">Verification</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-[#173324]">
          {token ? "Confirming email" : "Check your inbox"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#5d7064]">
          {token ? "Validating your verification link." : email ? `Use the link sent to ${email}.` : "Open the newest link from your inbox."}
        </p>

        <div className="mt-7 space-y-4">
          {isBusy ? (
            <div className="rounded-[22px] border border-[#d6ddd0] bg-white/72 px-4 py-3 text-sm text-[#5d7064] backdrop-blur">
              <div className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Verifying email
              </div>
            </div>
          ) : null}

          {status ? (
            <Notice tone={status.tone}>
              <div>{status.text}</div>
              <PreviewLink href={status.previewUrl} label={status.previewLabel} />
            </Notice>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            {status?.tone === "success" ? (
              <button type="button" onClick={() => navigate("login", email ? { email } : {})} className="energy-home-primary-button">
                <CheckCircle2 size={16} />
                Sign in
              </button>
            ) : null}
            {email ? (
              <button type="button" onClick={resendVerification} disabled={isResending} className="energy-home-secondary-button disabled:cursor-not-allowed disabled:opacity-60">
                {isResending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                Resend
              </button>
            ) : null}
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode={mode}
      footer={
        <p>
          Back to account access?{" "}
            <button type="button" onClick={() => navigate("login")} className="font-semibold text-[#173324] transition hover:text-[#48725b]">
            Login
          </button>
        </p>
      }
    >
      <p className="text-xs uppercase tracking-[0.28em] text-[#8a968c]">Reset password</p>
      <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-[#173324]">Choose a new password</h2>
      <p className="mt-3 text-sm leading-7 text-[#5d7064]">Set a new password and continue to the workspace.</p>

      <form onSubmit={submitReset} className="mt-7 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#355445]">New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="energy-auth-input"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#355445]">Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Repeat the password"
            className="energy-auth-input"
          />
        </label>

        {status ? (
          <Notice tone={status.tone}>
            <div>{status.text}</div>
          </Notice>
        ) : null}

        {status?.tone === "success" ? (
          <button type="button" onClick={() => navigate("login", email ? { email } : {})} className="energy-home-secondary-button w-full justify-center">
            <CheckCircle2 size={16} />
            Sign in
          </button>
        ) : null}

        <button type="submit" disabled={isBusy} className="energy-home-primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
          {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
          Save password
        </button>
      </form>
    </AuthShell>
  );
}
