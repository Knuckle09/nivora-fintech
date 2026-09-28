"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { ArrowUp, Check, CircleAlert, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";

type Lookup = { source: string; period: string; recordCount?: number; complete?: boolean };
type ChatMessage = { role: "user" | "assistant"; content: string; lookups?: Lookup[]; failed?: boolean };

const suggestions = [
  "How much did I spend on food last month?",
  "What drove my highest spending categories last month?",
  "Can I afford a ₹40,000 expense this month?"
];

function lookupDescription(lookup: Lookup) {
  const names: Record<string, string> = {
    "account balances": "account balances",
    "category spending": "spending by category",
    transactions: "transactions"
  };
  const count = lookup.recordCount === undefined ? "" : ` · ${lookup.recordCount} ${lookup.recordCount === 1 ? "entry" : "entries"}`;
  return `${names[lookup.source] ?? lookup.source} · ${lookup.period}${count}`;
}

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  async function send(text = draft) {
    const question = text.trim();
    if (!question || thinking) return;
    setError("");
    setDraft("");
    setThinking(true);
    const priorQuestions = messages.filter((message) => message.role === "user").map((message) => message.content).slice(-4);
    setMessages((current) => [...current, { role: "user", content: question }]);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, priorQuestions })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The verified lookup failed.");
      setMessages((current) => [...current, { role: "assistant", content: result.answer, lookups: result.lookups }]);
    } catch (caught) {
      const failure = caught instanceof Error ? caught.message : "Nivora couldn't finish this lookup. Please try again.";
      setError(failure);
      setMessages((current) => [...current, { role: "assistant", content: "I couldn't complete a verified lookup just now. Your question is still here; please try again in a moment.", failed: true }]);
    } finally {
      setThinking(false);
      window.requestAnimationFrame(() => historyEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
      textareaRef.current?.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return <section className="assistant-workspace" aria-label="Nivora finance assistant">
    <div className="assistant-context-bar"><span className="assistant-context-icon"><ShieldCheck size={16} aria-hidden="true" /></span><span>Figures are read from your account data before they appear here.</span><span className="assistant-context-live"><span className="sync-dot" />LIVE DATA</span></div>
    <div className="chat-history" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversation with Nivora">
      {!messages.length && <div className="assistant-welcome"><span className="assistant-avatar"><Sparkles size={19} aria-hidden="true" /></span><div><p className="eyebrow">YOUR FINANCIAL COPILOT</p><h2>What would you like to understand?</h2><p>Ask about spending, account balances, or a specific time period. Nivora shows what it checked with every answer.</p></div></div>}
      {messages.map((message, index) => <article className={`chat-message chat-message-${message.role}`} key={`${index}-${message.role}`}>
        {message.role === "assistant" && <span className="assistant-avatar message-avatar"><Sparkles size={16} aria-hidden="true" /></span>}
        <div className="chat-message-body">
          {message.role === "assistant" && <span className="message-author">Nivora</span>}
          <p>{message.content}</p>
          {message.lookups?.length ? <div className="message-lookups" aria-label="Data checked for this answer"><span className="lookup-check"><Check size={12} aria-hidden="true" />Checked</span>{message.lookups.map((lookup, lookupIndex) => <span className="lookup-chip" key={`${lookup.source}-${lookupIndex}`}>{lookupDescription(lookup)}{lookup.complete === false ? " · incomplete" : ""}</span>)}</div> : null}
          {message.failed && <span className="message-failure"><CircleAlert size={13} aria-hidden="true" /> No figures were returned.</span>}
        </div>
      </article>)}
      {thinking && <div className="chat-message chat-message-assistant" role="status"><span className="assistant-avatar message-avatar"><Sparkles size={16} aria-hidden="true" /></span><div className="chat-message-body"><span className="message-author">Nivora</span><p className="thinking-copy"><LoaderCircle size={15} className="spin" aria-hidden="true" />Checking your accounts and transactions...</p></div></div>}
      <div ref={historyEndRef} />
    </div>

    {!messages.length && <div className="suggestion-list" aria-label="Suggested questions">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setDraft(suggestion)}>{suggestion}<ArrowUp size={14} aria-hidden="true" /></button>)}</div>}

    <form className="chat-composer" onSubmit={submit} ref={formRef}>
      <label className="sr-only" htmlFor="assistant-question">Ask Nivora a question about your finances</label>
      <textarea id="assistant-question" ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} maxLength={1200} rows={2} placeholder="Ask about your money..." disabled={thinking} />
      <div className="composer-footer"><span>{thinking ? "Reviewing your ledger" : "Your data stays scoped to your account"}</span><button className="send-button" type="submit" disabled={thinking || !draft.trim()} aria-label="Send question">{thinking ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}</button></div>
    </form>
    {error && <p className="chat-error" role="status"><CircleAlert size={14} aria-hidden="true" />{error}</p>}
    <p className="assistant-footnote">Nivora can explain recorded activity. It does not provide investment, tax, or credit advice.</p>
  </section>;
}
