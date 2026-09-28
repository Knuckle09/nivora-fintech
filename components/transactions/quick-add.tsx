"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle, Plus, X } from "lucide-react";
import type { Account, Category } from "@/lib/finance-types";

export function QuickAddTransaction({
  categories,
  accounts,
  compact = false
}: {
  categories: Category[];
  accounts: Account[];
  compact?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const availableCategories = categories.filter((category) => category.kind === kind);

  function open() {
    setMessage("");
    setSuccess(false);
    dialogRef.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save this transaction.");
      setSuccess(true);
      setMessage("Transaction added to your ledger.");
      router.refresh();
      window.setTimeout(() => dialogRef.current?.close(), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this transaction.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={compact ? "button button-primary add-compact" : "button button-primary"} type="button" onClick={open} disabled={accounts.length === 0} title={accounts.length === 0 ? "Add an account first" : undefined}>
        <Plus size={17} aria-hidden="true" /><span>{compact ? "Add transaction" : "Add transaction"}</span>
      </button>
      <dialog ref={dialogRef} className="transaction-dialog" aria-labelledby="add-transaction-title" onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
        <div className="dialog-topline">
          <div><p className="eyebrow">YOUR LEDGER</p><h2 id="add-transaction-title">Add a transaction</h2></div>
          <button className="icon-button" type="button" onClick={() => dialogRef.current?.close()} aria-label="Close transaction form"><X size={19} aria-hidden="true" /></button>
        </div>
        <form className="transaction-form" onSubmit={submit}>
          <input type="hidden" name="type" value={kind} />
          <div className="segmented-control" role="group" aria-label="Transaction type">
            <button type="button" className={kind === "expense" ? "segment-active" : ""} onClick={() => setKind("expense")}>Expense</button>
            <button type="button" className={kind === "income" ? "segment-active" : ""} onClick={() => setKind("income")}>Income</button>
          </div>
          <label htmlFor="transaction-merchant">Merchant or source</label>
          <input id="transaction-merchant" name="merchant" required maxLength={80} placeholder={kind === "expense" ? "e.g. Blue Tokai" : "e.g. Monthly salary"} />
          <div className="form-grid-two">
            <div><label htmlFor="transaction-amount">Amount (INR)</label><input id="transaction-amount" name="amount" type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" required placeholder="0.00" /></div>
            <div><label htmlFor="transaction-date">Date</label><input id="transaction-date" name="occurred_on" type="date" required defaultValue={new Date().toLocaleDateString("en-CA")} /></div>
          </div>
          <label htmlFor="transaction-account">Account</label>
          <select id="transaction-account" name="account_id" required defaultValue="" disabled={accounts.length === 0}>
            <option value="" disabled>{accounts.length ? "Select an account" : "Add an account first"}</option>
            {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
          </select>
          <label htmlFor="transaction-category">Category</label>
          <select key={kind} id="transaction-category" name="category_id" required defaultValue="">
            <option value="" disabled>Select a category</option>
            {availableCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select>
          {message && <p className={`form-message${success ? " form-message-success" : ""}`} role="status">{success ? <Check size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}{message}</p>}
          <button className="button button-primary dialog-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}<span>{busy ? "Saving" : "Save transaction"}</span></button>
        </form>
      </dialog>
    </>
  );
}
