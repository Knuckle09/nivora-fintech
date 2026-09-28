export default function FinanceLoading() {
  return <main className="finance-loading" aria-busy="true" aria-live="polite">
    <p className="eyebrow">PRIVATE WORKSPACE</p>
    <h1>Loading your ledger.</h1>
    <div className="loading-balance" aria-hidden="true" />
    <div className="loading-account-grid" aria-hidden="true"><span /><span /><span /></div>
    <span className="sr-only">Checking your accounts and recent activity.</span>
  </main>;
}
