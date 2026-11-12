import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-message">
      <div className="brand-mark">F</div>
      <h1>We couldn’t find that page.</h1>
      <p>The address may be mistyped, or the page may have moved.</p>
      <div className="app-message-actions"><Link className="button button-primary" href="/">Go to overview</Link></div>
    </main>
  );
}
