import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AddAccountForm } from "@/components/accounts/add-account-form";

export const metadata = { title: "Add an account | Nivora" };

export default function NewAccountPage() {
  return <div className="dashboard-page">
    <Link className="back-link" href="/dashboard"><ArrowLeft size={16} aria-hidden="true" />Overview</Link>
    <div className="page-heading"><div><p className="eyebrow">A CLEARER PICTURE</p><h1>Add an account.</h1><p className="page-subtitle">Bring a checking, savings, investment, or credit account into view.</p></div></div>
    <section className="account-create-panel" aria-labelledby="account-form-title">
      <div className="account-create-aside"><span className="account-create-icon"><ShieldCheck size={21} aria-hidden="true" /></span><p className="eyebrow">PRIVATE BY DESIGN</p><h2 id="account-form-title">Start with the essentials.</h2><p>Only the account details you choose to enter are stored. Your account number is never requested.</p></div>
      <AddAccountForm />
    </section>
  </div>;
}
