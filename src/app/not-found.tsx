import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <span className="eyebrow">ALIYAS ASSETS · 404</span>
      <h1>This space is unoccupied</h1>
      <p>The page may have moved. Head back to your portfolio to continue.</p>
      <Link href="/" className="button primary">
        Back to overview
      </Link>
    </main>
  );
}
