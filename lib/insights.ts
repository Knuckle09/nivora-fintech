import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthBounds } from "@/lib/format";

type InsightRow = {
  occurred_on: string;
  amount_minor: number;
  transaction_type: "income" | "expense" | "transfer";
  category_id: string | null;
  merchant: string;
};

function monthKey(value: string) {
  return value.slice(0, 7);
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function monthName(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T12:00:00+05:30`));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function getInsightsData(supabase: SupabaseClient, userId: string) {
  const { start: currentStart, end: currentEnd } = monthBounds();
  const historyStart = shiftMonth(currentStart, -6);
  const latestCompleteStart = shiftMonth(currentStart, -1);
  const baselineStart = shiftMonth(currentStart, -4);
  const [{ data: accounts, error: accountsError }] = await Promise.all([
    supabase.from("account_balances").select("id,balance_minor").eq("user_id", userId)
  ]);
  if (accountsError) throw new Error("Could not load your account balances.");

  const rows: InsightRow[] = [];
  let historyComplete = true;
  for (let from = 0; from <= 10_000; from += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select("occurred_on,amount_minor,transaction_type,category_id,merchant")
      .eq("user_id", userId)
      .gte("occurred_on", historyStart)
      .lt("occurred_on", currentEnd)
      .order("occurred_on", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error("Could not load your transaction history.");
    const page = (data ?? []) as InsightRow[];
    rows.push(...page);
    if (page.length < 1000) break;
    if (from === 10_000) historyComplete = false;
  }

  const categoryIds = [...new Set(rows.map((row) => row.category_id).filter((id): id is string => Boolean(id)))];
  const { data: categoryRows, error: categoryError } = categoryIds.length
    ? await supabase.from("categories").select("id,name,slug").in("id", categoryIds)
    : { data: [], error: null };
  if (categoryError) throw new Error("Could not load your categories.");
  const categories = new Map((categoryRows ?? []).map((category) => [category.id, category]));
  const spendByMonthCategory = new Map<string, number>();
  const historicalAmounts = new Map<string, number[]>();
  const recentMonthRows: (InsightRow & { categoryName: string; categoryKey: string; absAmount: number })[] = [];

  for (const row of rows) {
    if (row.transaction_type !== "expense") continue;
    const category = row.category_id ? categories.get(row.category_id) : undefined;
    const categoryKey = category?.id ?? "uncategorized";
    const absoluteAmount = Math.abs(Number(row.amount_minor));
    const period = monthKey(row.occurred_on);
    const key = `${period}:${categoryKey}`;
    spendByMonthCategory.set(key, (spendByMonthCategory.get(key) ?? 0) + absoluteAmount);
    if (period >= baselineStart && period < latestCompleteStart) {
      const values = historicalAmounts.get(categoryKey) ?? [];
      values.push(absoluteAmount);
      historicalAmounts.set(categoryKey, values);
    }
    if (period === latestCompleteStart.slice(0, 7)) {
      recentMonthRows.push({ ...row, categoryName: category?.name ?? "Uncategorized", categoryKey, absAmount: absoluteAmount });
    }
  }

  const comparisonKey = latestCompleteStart.slice(0, 7);
  const baselineKeys = [shiftMonth(currentStart, -4).slice(0, 7), shiftMonth(currentStart, -3).slice(0, 7), shiftMonth(currentStart, -2).slice(0, 7)];
  const categoryKeys = new Set([...spendByMonthCategory.keys()].map((key) => key.slice(key.indexOf(":") + 1)));
  const categoryChanges = [...categoryKeys].flatMap((categoryKey) => {
    const latestSpend = spendByMonthCategory.get(`${comparisonKey}:${categoryKey}`) ?? 0;
    const baselineValues = baselineKeys.map((month) => spendByMonthCategory.get(`${month}:${categoryKey}`) ?? 0);
    const baselineAverage = baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length;
    const difference = latestSpend - baselineAverage;
    const relativeChange = baselineAverage > 0 ? difference / baselineAverage : latestSpend > 0 ? 1 : 0;
    if (Math.abs(difference) < 1_000_000 || Math.abs(relativeChange) < 0.35) return [];
    const category = categories.get(categoryKey);
    return [{
      categoryId: category?.id ?? "uncategorized",
      slug: category?.slug ?? "uncategorized",
      name: category?.name ?? "Uncategorized",
      direction: difference > 0 ? "up" as const : "down" as const,
      latestSpend,
      baselineAverage: Math.round(baselineAverage),
      changePercent: Math.round(relativeChange * 100),
      difference: Math.abs(difference),
      period: monthName(latestCompleteStart)
    }];
  }).sort((left, right) => right.difference - left.difference).slice(0, 5);

  const unusualTransactions = recentMonthRows.filter((row) => {
    const typical = median(historicalAmounts.get(row.categoryKey) ?? []);
    return row.absAmount >= Math.max(1_000_000, typical * 3);
  }).sort((left, right) => right.absAmount - left.absAmount).slice(0, 5).map((row) => ({
    merchant: row.merchant,
    category: row.categoryName,
    amountMinor: row.absAmount,
    occurredOn: row.occurred_on,
    medianMinor: median(historicalAmounts.get(row.categoryKey) ?? [])
  }));

  const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = Number(todayParts.find((part) => part.type === "day")?.value ?? 1);
  const daysInMonth = new Date(Date.UTC(Number(currentStart.slice(0, 4)), Number(currentStart.slice(5, 7)), 0)).getUTCDate();
  const currentMonthRows = rows.filter((row) => row.occurred_on >= currentStart && row.occurred_on < currentEnd);
  const currentSpend = currentMonthRows.reduce((sum, row) => sum + (row.transaction_type === "expense" ? Math.abs(Number(row.amount_minor)) : 0), 0);
  const currentIncome = currentMonthRows.reduce((sum, row) => sum + (row.transaction_type === "income" ? Number(row.amount_minor) : 0), 0);
  const totalBalance = (accounts ?? []).reduce((sum, account) => sum + Number(account.balance_minor), 0);
  const averageDailyNet = (currentIncome - currentSpend) / Math.max(today, 1);
  const projectedBalance = Math.round(totalBalance + averageDailyNet * Math.max(daysInMonth - today, 0));
  const monthTrend = Array.from({ length: 6 }, (_, index) => {
    const month = shiftMonth(currentStart, index - 5);
    const nextMonth = shiftMonth(month, 1);
    const monthRows = rows.filter((row) => row.occurred_on >= month && row.occurred_on < nextMonth);
    return {
      month: monthName(month),
      spendMinor: monthRows.reduce((sum, row) => sum + (row.transaction_type === "expense" ? Math.abs(Number(row.amount_minor)) : 0), 0),
      current: month === currentStart
    };
  });

  return {
    categoryChanges: historyComplete ? categoryChanges : [],
    unusualTransactions: historyComplete ? unusualTransactions : [],
    monthTrend: historyComplete ? monthTrend : [],
    latestCompleteMonth: monthName(latestCompleteStart),
    trailingAverageMonths: baselineKeys.map(monthName),
    totalBalance,
    currentSpend,
    currentIncome,
    projectedBalance: historyComplete ? projectedBalance : totalBalance,
    projectionDaysRemaining: Math.max(daysInMonth - today, 0),
    historyCount: rows.length,
    historyComplete,
    hasHistory: rows.length > 0,
    outlierRule: "At least three times the category median, with a minimum transaction of INR 10,000.",
    trendRule: "Flags a difference of at least 35% and INR 10,000 versus the prior three complete months."
  };
}
