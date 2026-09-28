"use client";

import { CircleAlert, RefreshCw } from "lucide-react";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="app-state-page">
    <section className="app-state-panel" role="alert">
      <span className="app-state-icon"><CircleAlert size={19} aria-hidden="true" /></span>
      <p className="eyebrow">PRIVATE WORKSPACE</p>
      <h1>Your finance data could not load.</h1>
      <p>Nothing was changed. Check the connection and try again.</p>
      <button className="button button-primary" type="button" onClick={reset}><RefreshCw size={15} aria-hidden="true" />Try again</button>
    </section>
  </main>;
}
