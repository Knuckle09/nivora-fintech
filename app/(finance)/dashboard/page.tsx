import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Plus, WalletCards } from "lucide-react";
import { QuickAddTransaction } from "@/components/transactions/quick-add";
import { getFinanceData } from "@/lib/finance-data";
import { formatDate, formatINR, monthLabel } from "@/lib/format";

export const metadata = { title: "Overview | Nivora" };

export default async function DashboardPage() {
  const data = await getFinanceData();
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  const salutation = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const spendChange = data.previousMonthSpend > 0
    ? Math.round(((data.monthSpend - data.previousMonthSpend) / data.previousMonthSpend) * 100)
    : null;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div><p className="eyebrow">{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date()).toUpperCase()}</p><h1>{salutation}.</h1><p className="page-subtitle">Here is where your money stands today.</p></div>
        <QuickAddTransaction categories={data.categories} accounts={data.accounts} />
      </div>

      <section className="balance-panel" aria-labelledby="total-balance-title">
        <div className="balance-panel-main">
          <div className="balance-label-row"><p id="total-balance-title" className="balance-label">Total balance</p><span className="balance-currency">INR <span aria-hidden="true">·</span> ALL ACCOUNTS</span></div>
          <p className="balance-amount">{formatINR(data.totalBalance)}</p>
          <p className="balance-footnote">Across {data.accounts.length} connected {data.accounts.length === 1 ? "account" : "accounts"}</p>
        </div>
        <div className="balance-panel-rule" />
        <div className="balance-panel-stats">
          <div className="balance-stat"><span className="stat-icon stat-icon-in"><ArrowDownLeft size={16} aria-hidden="true" /></span><div><span className="stat-caption">Money in · {monthLabel()}</span><strong>{formatINR(data.monthIncome)}</strong></div></div>
          <div className="balance-stat"><span className="stat-icon stat-icon-out"><ArrowUpRight size={16} aria-hidden="true" /></span><div><span className="stat-caption">Money out · {monthLabel()}</span><strong>{formatINR(data.monthSpend)}</strong></div></div>
          <div className="balance-comparison">{spendChange === null ? "Building your monthly picture" : <><span className={spendChange > 0 ? "change-up" : "change-down"}>{spendChange > 0 ? "+" : ""}{spendChange}%</span> vs. same days last month</>}</div>
        </div>
        <span className="balance-index" aria-hidden="true">Nº 01</span>
      </section>

      <section className="section-block" aria-labelledby="accounts-title">
        <div className="section-heading"><div><p className="eyebrow">THE WHOLE PICTURE</p><h2 id="accounts-title">Your accounts</h2></div>{data.accounts.length ? <Link className="text-link" href="/accounts/new"><Plus size={15} aria-hidden="true" />Add account</Link> : null}</div>
        {data.accounts.length ? (
          <div className="account-grid">
            {data.accounts.map((account) => (
              <article className={`account-card account-${account.color}`} key={account.id}>
                <div className="account-card-top"><span className="account-institution">{account.institution}</span><span className="account-type">{account.account_type}</span></div>
                <div className="account-name-row"><span className="account-symbol" aria-hidden="true"><WalletCards size={18} /></span><h3>{account.name}</h3></div>
                <p className="account-balance">{formatINR(account.balance_minor)}</p>
                <div className="account-card-foot"><span>{account.last_four ? `•••• ${account.last_four}` : "INR account"}</span><span className="account-ledger-mark" aria-hidden="true">N</span></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state account-empty"><span className="empty-mark"><WalletCards size={20} aria-hidden="true" /></span><div><h3>Your first account starts here</h3><p>Add your checking, savings, or investment account to begin tracking your money.</p></div><Link className="button button-secondary" href="/accounts/new"><Plus size={16} aria-hidden="true" />Add an account</Link></div>
        )}
      </section>

      <section className="section-block activity-section" aria-labelledby="recent-title">
        <div className="section-heading"><div><p className="eyebrow">THE LATEST MOVEMENT</p><h2 id="recent-title">Recent activity</h2></div><Link className="text-link" href="/transactions">All transactions <ArrowRight size={15} aria-hidden="true" /></Link></div>
        {data.recentTransactions.length ? (
          <div className="transaction-list">
            {data.recentTransactions.slice(0, 8).map((transaction) => (
              <article className="transaction-row" key={transaction.id}>
                <span className={`transaction-category-icon category-${transaction.category?.color ?? "graphite"}`} aria-hidden="true">{transaction.merchant.trim().slice(0, 1).toUpperCase()}</span>
                <div className="transaction-copy"><strong>{transaction.merchant}</strong><span>{transaction.category?.name ?? "Transfer"} <span className="transaction-separator">·</span> {transaction.account?.name ?? "Account"}</span></div>
                <time className="transaction-date" dateTime={transaction.occurred_on}>{formatDate(transaction.occurred_on, { year: undefined })}</time>
                <strong className={`transaction-amount${transaction.amount_minor > 0 ? " amount-positive" : ""}`}>{transaction.amount_minor > 0 ? "+" : "−"}{formatINR(Math.abs(transaction.amount_minor))}</strong>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>No transactions yet. Add your first entry or run the seed script to load a realistic sample history.</p></div>
        )}
      </section>
    </div>
  );
}
