import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const transactionsArgs = dateRangeSchema.extend({ category: z.string().nullable() });
const categorySpendArgs = dateRangeSchema;
const balanceArgs = z.object({
  accountId: z.string().uuid().nullable(),
  plannedExpenseRupees: z.number().int().min(0).max(100_000_000).nullable()
});

export const assistantTools = [
  {
    type: "function" as const,
    name: "getTransactions",
    description: "Read the signed-in user's actual transactions in an inclusive date range. Use a category ID from the supplied category list, or null for all categories. Dates must be exact calendar dates.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Inclusive start date in YYYY-MM-DD format." },
        endDate: { type: "string", description: "Inclusive end date in YYYY-MM-DD format." },
        category: { type: ["string", "null"], description: "A category ID from the supplied list, or null." }
      },
      required: ["startDate", "endDate", "category"],
      additionalProperties: false
    }
  },
  {
    type: "function" as const,
    name: "getSpendingByCategory",
    description: "Calculate expense totals grouped by category from the signed-in user's real transactions for an inclusive date range. Transfers are excluded.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Inclusive start date in YYYY-MM-DD format." },
        endDate: { type: "string", description: "Inclusive end date in YYYY-MM-DD format." }
      },
      required: ["startDate", "endDate"],
      additionalProperties: false
    }
  },
  {
    type: "function" as const,
    name: "getAccountBalance",
    description: "Read the signed-in user's current computed account balance. Pass an account ID from the supplied account list for one account, or null to total all accounts. For an affordability check, pass the planned expense in whole INR so the server can calculate the post-expense balance.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        accountId: { type: ["string", "null"], description: "UUID from the supplied account list, or null for all accounts." },
        plannedExpenseRupees: { type: ["integer", "null"], description: "A user-stated planned expense in whole INR, or null." }
      },
      required: ["accountId", "plannedExpenseRupees"],
      additionalProperties: false
    }
  }
];

type DateRange = z.infer<typeof dateRangeSchema>;
type TransactionToolRow = {
  id: string;
  occurred_on: string;
  merchant: string;
  description: string;
  amount_minor: number;
  transaction_type: string;
  category_id: string | null;
  account_id: string;
};
type CategorySpendRow = { amount_minor: number; category_id: string | null };
type ToolResult = {
  checked: { source: string; period: string; recordCount?: number; complete?: boolean };
  facts: { id: string; valueMinor: number; label: string }[];
  [key: string]: unknown;
};

function dateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error("The requested date range is invalid.");
  }
  return parsed;
}

function validateRange(input: DateRange) {
  const start = dateValue(input.startDate);
  const end = dateValue(input.endDate);
  const dayCount = (end.getTime() - start.getTime()) / 86_400_000;
  if (dayCount < 0 || dayCount > 366) throw new Error("Choose a date range of at most twelve months.");
  return { start: input.startDate, end: input.endDate, dayCount };
}

function periodLabel(start: string, end: string) {
  const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const format = (value: string) => dateFormat.format(new Date(`${value}T12:00:00+05:30`));
  return `${format(start)} – ${format(end)}`;
}

async function readAllPages<T>(loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  const pageSize = 1000;
  let complete = true;

  for (let from = 0; from <= 10_000; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) throw new Error("A database lookup failed.");
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    if (from === 10_000) complete = false;
  }

  return { rows, complete };
}

export async function getAssistantDirectory(supabase: SupabaseClient, userId: string) {
  const [{ data: accounts, error: accountsError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase.from("account_balances").select("id,name,account_type").eq("user_id", userId).order("sort_order"),
    supabase.from("categories").select("id,name,slug,kind").order("name")
  ]);
  if (accountsError || categoriesError) throw new Error("Your finance workspace could not be loaded.");
  return { accounts: accounts ?? [], categories: categories ?? [] };
}

export async function executeAssistantTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  rawArguments: string
): Promise<ToolResult> {
  const json: unknown = JSON.parse(rawArguments);

  if (name === "getTransactions") {
    const args = transactionsArgs.parse(json);
    const range = validateRange(args);
    let categoryId: string | null = null;
    if (args.category) {
      const { data: category, error } = await supabase
        .from("categories")
        .select("id,slug,name,user_id")
        .eq("id", args.category)
        .maybeSingle();
      if (error) throw new Error("A database lookup failed.");
      if (!category || (category.user_id !== null && category.user_id !== userId)) {
        return { checked: { source: "transactions", period: periodLabel(range.start, range.end), recordCount: 0, complete: true }, facts: [], found: false, message: "No matching category is available." };
      }
      categoryId = category.id;
    }

    const { rows, complete } = await readAllPages<TransactionToolRow>((from, to) => {
      let query = supabase
        .from("transactions")
        .select("id,occurred_on,merchant,description,amount_minor,transaction_type,category_id,account_id")
        .eq("user_id", userId)
        .gte("occurred_on", range.start)
        .lte("occurred_on", range.end)
        .order("occurred_on", { ascending: false })
        .range(from, to);
      if (categoryId) query = query.eq("category_id", categoryId);
      return query;
    });
    const categoryIds = [...new Set(rows.map((row) => row.category_id).filter((id): id is string => Boolean(id)))];
    const { data: categoryRows, error: categoryLookupError } = categoryIds.length
      ? await supabase.from("categories").select("id,name").in("id", categoryIds)
      : { data: [], error: null };
    if (categoryLookupError) throw new Error("A database lookup failed.");
    const categoryNames = new Map((categoryRows ?? []).map((category) => [category.id, category.name]));
    const expenseMinor = rows.reduce((sum, row) => sum + (row.transaction_type === "expense" ? Math.abs(Number(row.amount_minor)) : 0), 0);
    const incomeMinor = rows.reduce((sum, row) => sum + (row.transaction_type === "income" ? Number(row.amount_minor) : 0), 0);
    const categoryKey = args.category ?? "all";
    return {
      checked: { source: "transactions", period: periodLabel(range.start, range.end), recordCount: rows.length, complete },
      facts: [
        { id: `transactions:${categoryKey}:${range.start}:${range.end}:spend`, valueMinor: expenseMinor, label: "expenses in this period" },
        { id: `transactions:${categoryKey}:${range.start}:${range.end}:income`, valueMinor: incomeMinor, label: "income in this period" }
      ],
      found: rows.length > 0,
      totalTransactions: rows.length,
      complete,
      transactionDetailsComplete: rows.length <= 80,
      transactions: rows.slice(0, 80).map((row) => ({
        date: row.occurred_on,
        merchant: row.merchant,
        description: row.description,
        amountMinor: Number(row.amount_minor),
        type: row.transaction_type,
        category: row.category_id ? categoryNames.get(row.category_id) ?? "Uncategorized" : "Uncategorized",
        accountId: row.account_id
      }))
    };
  }

  if (name === "getSpendingByCategory") {
    const args = categorySpendArgs.parse(json);
    const range = validateRange(args);
    const { rows, complete } = await readAllPages<CategorySpendRow>((from, to) => supabase
      .from("transactions")
      .select("amount_minor,category_id")
      .eq("user_id", userId)
      .eq("transaction_type", "expense")
      .gte("occurred_on", range.start)
      .lte("occurred_on", range.end)
      .order("occurred_on", { ascending: false })
      .range(from, to));

    const categoryIds = [...new Set(rows.map((row) => row.category_id).filter((id): id is string => Boolean(id)))];
    const { data: categoryRows, error: categoryLookupError } = categoryIds.length
      ? await supabase.from("categories").select("id,name,slug").in("id", categoryIds)
      : { data: [], error: null };
    if (categoryLookupError) throw new Error("A database lookup failed.");
    const categoriesById = new Map((categoryRows ?? []).map((category) => [category.id, category]));

    const grouped = new Map<string, { id: string; name: string; slug: string; valueMinor: number; count: number }>();
    for (const row of rows) {
      const category = row.category_id ? categoriesById.get(row.category_id) : undefined;
      const slug = category?.slug ?? "uncategorized";
      const id = category?.id ?? "uncategorized";
      const current = grouped.get(id) ?? { id, name: category?.name ?? "Uncategorized", slug, valueMinor: 0, count: 0 };
      current.valueMinor += Math.abs(Number(row.amount_minor));
      current.count += 1;
      grouped.set(id, current);
    }
    const categories = [...grouped.values()].sort((left, right) => right.valueMinor - left.valueMinor);
    const totalMinor = categories.reduce((sum, category) => sum + category.valueMinor, 0);
    return {
      checked: { source: "category spending", period: periodLabel(range.start, range.end), recordCount: rows.length, complete },
      complete,
      totalSpendMinor: totalMinor,
      facts: [
        { id: `spend:all:${range.start}:${range.end}`, valueMinor: totalMinor, label: "total spending" },
        ...categories.map((category) => ({ id: `spend:${category.id}:${range.start}:${range.end}`, valueMinor: category.valueMinor, label: `${category.name} spending` }))
      ],
      categories: categories.map(({ id, name, slug, valueMinor, count }) => ({ id, name, slug, amountMinor: valueMinor, transactionCount: count }))
    };
  }

  if (name === "getAccountBalance") {
    const args = balanceArgs.parse(json);
    const query = supabase
      .from("account_balances")
      .select("id,name,account_type,currency,balance_minor")
      .eq("user_id", userId);
    const { data: rows, error } = args.accountId
      ? await query.eq("id", args.accountId).limit(1)
      : await query.order("sort_order");
    if (error) throw new Error("A database lookup failed.");
    if (args.accountId && !rows?.length) {
      return { checked: { source: "account balances", period: "current balance", recordCount: 0, complete: true }, facts: [], found: false, message: "That account is not available in this workspace." };
    }
    const accounts = (rows ?? []).map((row) => ({ ...row, balanceMinor: Number(row.balance_minor) }));
    const totalMinor = accounts.reduce((sum, account) => sum + account.balanceMinor, 0);
    const liquidMinor = accounts
      .filter((account) => account.account_type === "checking" || account.account_type === "savings" || account.account_type === "credit")
      .reduce((sum, account) => sum + account.balanceMinor, 0);
    const facts = args.accountId
      ? accounts.map((account) => ({ id: `balance:${account.id}`, valueMinor: account.balanceMinor, label: `${account.name} balance` }))
      : [
          { id: "balance:all", valueMinor: totalMinor, label: "net balance across all accounts" },
          { id: "balance:liquid", valueMinor: liquidMinor, label: "cash accounts less recorded credit balances" }
        ];
    if (args.plannedExpenseRupees !== null) {
      facts.push({
        id: `balance:after-planned-expense:${args.accountId ?? "all"}:${args.plannedExpenseRupees}`,
        valueMinor: totalMinor - args.plannedExpenseRupees * 100,
        label: "balance after the planned expense"
      });
      if (!args.accountId) {
        facts.push({
          id: `balance:liquid-after-planned-expense:${args.plannedExpenseRupees}`,
          valueMinor: liquidMinor - args.plannedExpenseRupees * 100,
          label: "cash accounts less credit balances after the planned expense"
        });
      }
    }
    return {
      checked: { source: "account balances", period: "current balance", recordCount: accounts.length, complete: true },
      found: accounts.length > 0,
      accounts,
      plannedExpenseMinor: args.plannedExpenseRupees === null ? null : args.plannedExpenseRupees * 100,
      facts
    };
  }

  throw new Error("The assistant requested an unavailable tool.");
}
