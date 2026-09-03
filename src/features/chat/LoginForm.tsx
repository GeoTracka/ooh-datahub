"use client";

import { Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import styles from "./LoginForm.module.css";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "Email or password is incorrect"
            : "We couldn’t sign you in. Please try again.",
        );
        return;
      }
      router.replace("/ai");
    } catch {
      setError("We couldn’t reach the service. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.intro}>
        <span className={styles.eyebrow}>OOH Datahub</span>
        <h1>Welcome back</h1>
        <p>Sign in to plan campaigns with your inventory and governed audience evidence.</p>
      </div>

      <div className={styles.fields}>
        <label className={styles.field} htmlFor="login-email">
          <span>Email</span>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
          />
        </label>

        <label className={styles.field} htmlFor="login-password">
          <span>Password</span>
          <span className={styles.passwordField}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
            />
            <button
              className={styles.visibility}
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </span>
        </label>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={submitting}>
        {submitting ? (
          <LoaderCircle className={styles.spinner} aria-hidden="true" />
        ) : (
          <ShieldCheck aria-hidden="true" />
        )}
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
