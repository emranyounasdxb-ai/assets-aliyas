"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Buildings,
  ShieldCheck,
  Stack,
  Wallet,
} from "@phosphor-icons/react";
import { Button, ErrorText, Field } from "./ui";
import { Brand } from "./brand";
export function Login({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function signIn(
    action: "login" | "demo",
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();
    setError("");
    setPending(true);
    const fields = event ? new FormData(event.currentTarget) : null;
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          email: fields?.get("email"),
          password: fields?.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sign in failed. Please try again.",
      );
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <Brand />
        </div>
        <div className="login-story-copy">
          <div className="eyebrow">A CLEARER VIEW OF YOUR PROPERTIES</div>
          <h1>
            Good properties.
            <br />
            Even better managed.
          </h1>
          <p>
            A considered workspace for your buildings, your tenants and
            everything in between.
          </p>
          <div className="login-features">
            <span>
              <Buildings size={20} />
              Your entire portfolio
            </span>
            <span>
              <Wallet size={20} />
              Every rental payment
            </span>
            <span>
              <ShieldCheck size={20} />
              Documents kept private
            </span>
          </div>
        </div>
        <div className="login-buildings" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className={`sketch-tower tower-${n}`}>
              {Array.from(
                { length: n === 3 ? 24 : 18 },
                (_, i) => `window-${i}`,
              ).map((id) => (
                <i key={id} />
              ))}
            </div>
          ))}
        </div>
        <div className="login-bottom">
          Built around the way you manage property.
          <Stack size={20} />
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>A little more organised.</h2>
          <p>Sign in to manage your portfolio.</p>
          <form onSubmit={(e) => signIn("login", e)}>
            <Field label="Email address">
              <input
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@company.com"
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                minLength={8}
              />
            </Field>
            <ErrorText message={error} />
            <Button
              type="submit"
              variant="primary"
              disabled={pending}
              className="full-width"
            >
              {pending ? (
                "Signing in…"
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </form>
          {demo && (
            <div className="demo-signin">
              <div className="divider-label">
                <span />
                TAKE A LOOK AROUND
                <span />
              </div>
              <Button
                className="full-width"
                disabled={pending}
                onClick={() => signIn("demo")}
              >
                Explore demo workspace
                <ArrowRight size={18} />
              </Button>
              <small>
                A local preview with fictional properties and tenants.
              </small>
            </div>
          )}
          <p className="login-note">
            <ShieldCheck size={16} />
            Private access for your property team.
          </p>
        </div>
        <div className="login-copyright">
          © {new Date().getFullYear()} Aliyas Assets
        </div>
      </section>
    </main>
  );
}
