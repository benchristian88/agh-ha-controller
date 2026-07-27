import { type FormEvent, type ReactNode, useState } from "react";
import { ErrorState } from "../../components/Feedback";
import { api } from "../../lib/api";
import type { User } from "../../lib/types";

interface AuthPageProps {
  onAuthenticated: (user: User) => void;
}

export function LoginPage({ onAuthenticated }: AuthPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await api.login({ email, password });
      onAuthenticated(result.user);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Manage every AdGuard Home node from one control plane."
    >
      <form onSubmit={(event) => void submit(event)} className="form-stack">
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error !== undefined && <ErrorState error={error} />}
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}

export function SetupPage({
  onAuthenticated,
  publicBaseUrl,
  controllerTime,
  secureCookies,
}: AuthPageProps & {
  publicBaseUrl: string;
  controllerTime: string;
  secureCookies: boolean;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await api.setup({ email, displayName, password });
      onAuthenticated(result.user);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your administrator"
      subtitle="This one-time setup creates the first local account."
    >
      <div className="notice notice--warning">
        Back up the database, session secret, and credential encryption key
        separately. Lost encryption keys cannot be recovered.
      </div>
      <dl className="setup-checks">
        <div>
          <dt>Public URL</dt>
          <dd>{publicBaseUrl}</dd>
        </div>
        <div>
          <dt>Controller time</dt>
          <dd>{new Date(controllerTime).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Session cookies</dt>
          <dd>{secureCookies ? "Secure HTTPS" : "Development HTTP"}</dd>
        </div>
      </dl>
      <form onSubmit={(event) => void submit(event)} className="form-stack">
        <label>
          Display name
          <input
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
          />
        </label>
        <small>
          Use at least 12 characters. Passwords are stored as Argon2id hashes.
        </small>
        {error !== undefined && <ErrorState error={error} />}
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Creating administrator…" : "Create administrator"}
        </button>
      </form>
    </AuthLayout>
  );
}

function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">
          A
        </div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
        <p className="auth-footnote">
          The controller never proxies DNS. Your nodes continue serving if it is
          offline.
        </p>
      </section>
    </main>
  );
}
