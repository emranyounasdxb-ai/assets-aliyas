"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
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
    <main className="login-page login-clean">
      <section className="login-form-panel">
        <div className="login-form">
          <div className="brand">
            <Brand />
          </div>
          <h1>Sign in</h1>
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
        </div>
      </section>
    </main>
  );
}
