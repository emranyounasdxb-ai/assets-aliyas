"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <span className="eyebrow">ALIYAS ASSETS</span>
      <h1>Your workspace could not load</h1>
      <p>
        The connection may have been interrupted. Your saved records are safe.
      </p>
      <button type="button" className="button primary" onClick={reset}>
        Try again
      </button>
      <Link className="text-link" href="/login">
        Return to sign in
      </Link>
    </main>
  );
}
