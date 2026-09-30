# Architecture

## Assistant tool-calling loop

```mermaid
sequenceDiagram
  actor User
  participant UI as Next.js chat
  participant API as Authenticated route
  participant LLM as Groq Chat Completions / GPT-OSS 20B
  participant Tools as Server tool dispatcher
  participant DB as Supabase Postgres

  User->>UI: Ask a finance question
  UI->>API: POST question + recent questions
  API->>API: Verify Supabase user; validate request
  API->>DB: Load that user's accounts and available categories
  API->>LLM: Question, scoped context, function schemas
  LLM->>API: Function call with date/category/account arguments
  API->>Tools: Validate arguments with Zod
  Tools->>DB: Query with user_id filter and session RLS
  DB-->>Tools: Rows or computed balances
  Tools-->>API: Totals, short transaction sample, evidence facts
  alt Affordability request
    API->>API: Compute decision and format only liquid-balance facts
  else Other finance question
    API->>LLM: Function result and evidence IDs
    LLM-->>API: Concise answer containing fact markers
    API->>API: Resolve only returned fact IDs; reject unsupported numbers
  end
  API-->>UI: Answer and checked source/date/count metadata
  UI-->>User: Answer plus visible lookup note
```

The first Groq Chat Completions call is forced to use a tool. The server uses Groq's OpenAI-compatible endpoint and the `openai/gpt-oss-20b` model, which is listed for function calling and has a Free-plan quota. Available tools are `getTransactions`, `getSpendingByCategory`, and `getAccountBalance`; the dispatcher validates every argument with Zod, including real calendar dates, account IDs, and a maximum date span. For an affordability question, the server forces `getAccountBalance`, binds the planned amount to a parseable INR amount from the user's question, and renders the result from the liquid-balance and post-expense facts itself. That prevents the model from silently substituting an amount or treating investment assets as spendable cash. The server uses the signed-in user's Supabase session, adds explicit `user_id` filters, and relies on row-level security as a second boundary. The service-role key is used only by the local seed script, never by request handlers.

The database returns integer minor-unit amounts. Tool results include an evidence-fact list. Any amount in model-generated prose must be written as a `{{fact:ID}}` marker, and the server replaces it only when that exact ID was returned by a tool. Digits, currency symbols, common number words, missing fact IDs, and incomplete paginated results fail closed to a fixed “couldn't verify” answer. The deterministic affordability response formats amounts only from the returned liquid-balance facts. Merchant-level details are capped at forty rows; aggregate lookups are paginated, and any result that hits the 11,000-row cap is marked incomplete and cannot be used to produce a numeric answer. Dashboard month-to-date totals use a server-side SQL aggregate rather than a capped PostgREST row page. The UI also shows which source, date range, and record count were checked.

This is a strong guard against invented figures, not a formal proof that every qualitative interpretation is correct. The model is instructed to describe observed ledger patterns rather than infer why a person spent money; the ledger cannot establish a purchase's motivation. Tool results and visible lookup notes make the underlying evidence inspectable.

## Realtime updates

After authentication, the browser creates a Supabase Realtime `postgres_changes` channel filtered to the current user's `transactions` rows. The migration adds that table to the `supabase_realtime` publication. On an insert or update event, the client calls `router.refresh()` instead of mutating a local copy of the balance. The refreshed Server Components re-read the transaction and `account_balances` view using the authenticated Supabase client, so the same RLS rules apply and the database remains authoritative. Adding a transaction returns only after the insert succeeds; no optimistic balance is shown.

## Identity and data boundaries

- `proxy.ts` refreshes Supabase auth cookies and checks signed claims; protected routes and API handlers also verify the user server-side.
- `accounts`, `transactions`, `profiles`, and user-owned `categories` have row-level security. A composite foreign key prevents a transaction from referencing another user's account.
- Global categories are readable but not mutable by regular users. A category is passed to the assistant by UUID, not slug, so a user category may safely share a slug with a global category.
- `account_balances` is a `security_invoker` view. It computes opening balance plus signed ledger rows without elevating caller privileges.
- Groq calls run only on the server. Chat history is sent explicitly with each request and is not persisted by the application. API failures return no generated financial answer. Groq says inference inputs and outputs are not retained by default, but reliability/abuse monitoring may temporarily log them for up to 30 days; admins can enable Zero Data Retention in Groq Data Controls. Review [Groq's data policy](https://console.groq.com/docs/your-data) before using real financial records.

## Rule-based insights

Insights are deterministic comparisons over recorded rows, not machine learning. Category changes compare the latest complete month with the prior three complete months, and large transactions compare with the category's trailing median. The month-end projection extends the current month's recorded daily net pace. Missing future bills, cash-flow seasonality, and unrecorded activity are not inferred.
