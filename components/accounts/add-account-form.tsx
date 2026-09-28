"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

export function AddAccountForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The account could not be saved.");
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The account could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="account-form" onSubmit={submit}>
    <label htmlFor="account-name">Account name</label>
    <input id="account-name" name="name" required maxLength={60} placeholder="Everyday account" />
    <label htmlFor="account-institution">Institution</label>
    <input id="account-institution" name="institution" required maxLength={60} placeholder="Your bank or brokerage" />
    <div className="form-grid-two">
      <div><label htmlFor="account-type">Account type</label><select id="account-type" name="account_type" defaultValue="checking"><option value="checking">Checking</option><option value="savings">Savings</option><option value="investment">Investment</option><option value="credit">Credit card</option></select></div>
      <div><label htmlFor="account-balance">Starting balance (INR)</label><input id="account-balance" name="opening_balance" type="number" min="0" max="100000000" step="0.01" required defaultValue="0" /></div>
    </div>
    <label htmlFor="account-last-four">Last four digits <span className="label-optional">optional</span></label>
    <input id="account-last-four" name="last_four" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="0000" />
    <p className="form-hint">Only a display label is stored. Never enter full account or card details.</p>
    {message && <p className="form-message" role="alert"><CircleAlert size={16} aria-hidden="true" />{message}</p>}
    <button className="button button-primary dialog-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}<span>{busy ? "Saving account" : "Add account"}</span></button>
  </form>;
}
