"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ confirmationError }: { confirmationError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(confirmationError ? "That confirmation link could not be verified. Request a new one by signing up again." : "");
  const [success, setSuccess] = useState(false);
  const configured = hasSupabasePublicEnv();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setSuccess(true);
          setMessage("Check your inbox for a confirmation link to finish creating your account.");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't complete that request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About Nivora">
        <Link className="wordmark wordmark-large" href="/" aria-label="Nivora home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Nivora</span>
        </Link>
        <div className="auth-story-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> YOUR MONEY, IN FOCUS</p>
          <h1>Make room for <em>better</em> decisions.</h1>
          <p className="auth-story-note">One clear view of your accounts, spending, and the choices ahead.</p>
        </div>
        <div className="auth-story-bottom">
          <span>Private by design</span><span className="story-rule" /><span>Grounded in your data</span>
        </div>
        <span className="auth-index" aria-hidden="true">01 / 04</span>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-mobile-brand wordmark" aria-hidden="true">
          <span className="brand-mark"><span /></span><span>Nivora</span>
        </div>
        <div className="auth-card">
          <p className="eyebrow auth-eyebrow">PERSONAL FINANCE, WITH CONTEXT</p>
          <h2 id="auth-title">{mode === "signin" ? "Welcome back" : "Start with clarity"}</h2>
          <p className="auth-subtitle">{mode === "signin" ? "Sign in to see where things stand." : "Create an account for your private money dashboard."}</p>

          {!configured && (
            <div className="auth-config-note" role="status">
              <CircleAlert size={17} aria-hidden="true" />
              <span>Supabase is not configured yet. Add the project URL and publishable key to <code>.env.local</code>.</span>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="email">Email address</label>
            <div className="input-with-icon">
              <Mail size={17} aria-hidden="true" />
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={!configured || busy} />
            </div>

            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <LockKeyhole size={17} aria-hidden="true" />
              <input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" disabled={!configured || busy} />
            </div>

            {message && (
              <p className={`form-message${success ? " form-message-success" : ""}`} role="status">
                {success ? <Check size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
                <span>{message}</span>
              </p>
            )}

            <button className="button button-primary auth-submit" type="submit" disabled={!configured || busy}>
              {busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : null}
              <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
              {!busy && <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "signin" ? "New to Nivora?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setSuccess(false); }}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="auth-legal">Your financial data stays yours. Nivora never sells personal information.</p>
        </div>
      </section>
    </main>
  );
}
