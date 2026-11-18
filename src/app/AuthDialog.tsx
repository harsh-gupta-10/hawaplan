import { useEffect, useState } from "react";
import { Cloud, Eye, EyeOff, LockKeyhole, ShieldCheck, X } from "lucide-react";

export type AuthMode = "login" | "signup" | "delete";

interface Props {
  mode: AuthMode;
  username?: string;
  onClose: () => void;
  onAuthenticate: (
    mode: "signup" | "login",
    username: string,
    password: string,
  ) => Promise<void>;
  onDelete: (password: string) => Promise<void>;
}

export default function AuthDialog({
  mode: initialMode,
  username: currentUsername,
  onClose,
  onAuthenticate,
  onDelete,
}: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "delete") await onDelete(password);
      else await onAuthenticate(mode, username, password);
      onClose();
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={19} />
        </button>
        <div className="auth-emblem">
          <Cloud size={24} />
        </div>
        <span className="eyebrow">YOUR SPACE, YOUR PLAN</span>
        <h2 id="auth-heading">
          {mode === "signup"
            ? "Save your clearer days."
            : mode === "login"
              ? "Welcome back."
              : "Delete your account?"}
        </h2>
        <p className="auth-intro">
          {mode === "delete"
            ? `This permanently removes @${currentUsername}'s saved plans, preferences, and chat history from Cloudflare D1.`
            : "Keep your plans and conversations in sync across devices. Guest data on this device will be brought into your account."}
        </p>
        {mode !== "delete" && (
          <div className="auth-switch">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Create account
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode !== "delete" && (
            <label className="auth-field">
              Username
              <input
                autoFocus
                autoComplete="username"
                pattern="[a-zA-Z0-9_]{3,24}"
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. myfamily"
                required
              />
              <small>3–24 letters, numbers, or underscores</small>
            </label>
          )}
          <label className="auth-field">
            {mode === "delete" ? "Confirm with your password" : "Password"}
            <span className="password-field">
              <input
                autoFocus={mode === "delete"}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                type={showPassword ? "text" : "password"}
                minLength={mode === "delete" ? 1 : 12}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  mode === "signup" ? "At least 12 characters" : "Your password"
                }
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className={`auth-submit ${mode === "delete" ? "danger" : ""}`}
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create my account"
                : mode === "login"
                  ? "Sign in and sync"
                  : "Delete account and data"}
          </button>
        </form>
        {mode !== "delete" && (
          <div className="auth-foot">
            <ShieldCheck size={16} />
            <span>
              Your password is hashed before storage. There is no email recovery
              yet, so keep it somewhere safe.
            </span>
          </div>
        )}
        {mode === "delete" && (
          <div className="auth-foot">
            <LockKeyhole size={16} />
            <span>
              This cannot be undone. Your data saved on this device will also be
              cleared.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
