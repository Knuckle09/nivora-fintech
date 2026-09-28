import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { monthBounds } from "@/lib/format";
import type { Account, Category, Transaction } from "@/lib/finance-types";

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(`Could not load your finance data: ${error.message}`);
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function getFinanceData() {
  if (!hasSupabasePublicEnv()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { start, end, previousStart, previousComparableEnd } = monthBounds();
  const [accountResult, categoryResult, recentResult, monthResult, previousResult] =
    await Promise.all([
      supabase.from("account_balances").select("*").order("sort_order"),
      supabase.from("categories").select("id,name,slug,kind,color,icon").order("name"),
      supabase
        .from("transactions")
        .select("*, account:accounts(name,account_type,color), category:categories(name,slug,color)")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(250),
      supabase.rpc("transaction_totals", { p_start: start, p_end_exclusive: end }),
      supabase.rpc("transaction_totals", { p_start: previousStart, p_end_exclusive: nextDate(previousComparableEnd) })
    ]);

  throwOnError(accountResult.error);
  throwOnError(categoryResult.error);
  throwOnError(recentResult.error);
  throwOnError(monthResult.error);
  throwOnError(previousResult.error);

  const accounts = (accountResult.data ?? []) as Account[];
  const categories = (categoryResult.data ?? []) as Category[];
  const recentTransactions = (recentResult.data ?? []) as Transaction[];
  const monthTotals = monthResult.data?.[0];
  const previousTotals = previousResult.data?.[0];

  return {
    accounts,
    categories,
    recentTransactions,
    totalBalance: accounts.reduce((sum, account) => sum + account.balance_minor, 0),
    monthIncome: Number(monthTotals?.income_minor ?? 0),
    monthSpend: Number(monthTotals?.spend_minor ?? 0),
    previousMonthSpend: Number(previousTotals?.spend_minor ?? 0),
    monthBounds: { start, end, previousStart, previousComparableEnd }
  };
}
