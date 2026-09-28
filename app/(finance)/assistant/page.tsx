import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/chat";

export const metadata: Metadata = { title: "Ask Nivora | Nivora" };

export default function AssistantPage() {
  return <div className="dashboard-page assistant-page">
    <div className="page-heading"><div><p className="eyebrow">A FINANCIAL VIEW, GROUNDED IN YOUR LEDGER</p><h1>Ask Nivora.</h1><p className="page-subtitle">Plain-language answers, checked against your accounts.</p></div></div>
    <AssistantChat />
  </div>;
}
