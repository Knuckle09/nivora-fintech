"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { Category, Transaction } from "@/lib/finance-types";
import { formatDate, formatINR } from "@/lib/format";

export function TransactionExplorer({ transactions, categories }: { transactions: Transaction[]; categories: Category[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const filtered = useMemo(() => transactions.filter((transaction) => {
    const matchesQuery = `${transaction.merchant} ${transaction.description} ${transaction.account?.name ?? ""} ${transaction.category?.name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "all" || transaction.category_id === category;
    const matchesType = type === "all" || transaction.transaction_type === type;
    return matchesQuery && matchesCategory && matchesType;
  }), [transactions, query, category, type]);

  return <section className="explorer-panel" aria-labelledby="ledger-title">
    <div className="explorer-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2 id="ledger-title">Your ledger</h2></div><span className="explorer-total">{filtered.length} shown</span></div>
    <div className="filter-bar">
      <label className="search-control"><Search size={17} aria-hidden="true" /><span className="sr-only">Search recent transactions</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recent activity" /></label>
      <label className="filter-control"><SlidersHorizontal size={15} aria-hidden="true" /><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="filter-control"><span className="sr-only">Filter by transaction type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All activity</option><option value="expense">Money out</option><option value="income">Money in</option><option value="transfer">Transfers</option></select></label>
    </div>
    {filtered.length ? <div className="transaction-list explorer-list">
      {filtered.map((transaction) => <article className="transaction-row" key={transaction.id}>
        <span className={`transaction-category-icon category-${transaction.category?.color ?? "graphite"}`} aria-hidden="true">{transaction.merchant.trim().slice(0, 1).toUpperCase()}</span>
        <div className="transaction-copy"><strong>{transaction.merchant}</strong><span>{transaction.category?.name ?? "Transfer"} <span className="transaction-separator">·</span> {transaction.account?.name ?? "Account"}</span></div>
        <time className="transaction-date" dateTime={transaction.occurred_on}>{formatDate(transaction.occurred_on)}</time>
        <strong className={`transaction-amount${transaction.amount_minor > 0 ? " amount-positive" : ""}`}>{transaction.amount_minor > 0 ? "+" : "−"}{formatINR(Math.abs(transaction.amount_minor))}</strong>
      </article>)}
    </div> : <div className="empty-state filter-empty"><h3>No matching transactions</h3><p>Adjust the filters or try another search.</p></div>}
    {transactions.length === 250 && <p className="list-limit-note">Showing the 250 most recent entries. Search and filters apply to this list.</p>}
  </section>;
}
