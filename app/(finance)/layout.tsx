import { redirect } from "next/navigation";
import { hasSupabasePublicEnv } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Account, Category } from "@/lib/finance-types";

export const dynamic = "force-dynamic";

export default async function FinanceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!hasSupabasePublicEnv()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: categories, error: categoryError }, { data: accounts, error: accountError }] = await Promise.all([
    supabase.from("categories").select("id,name,slug,kind,color,icon").order("name"),
    supabase.from("account_balances").select("*").order("sort_order")
  ]);
  if (categoryError || accountError) throw new Error("Your finance workspace could not be loaded.");

  const email = user.email ?? "Signed-in account";
  const displayName = typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
    ? user.user_metadata.full_name.trim()
    : email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return <AppShell userEmail={email} displayName={displayName} categories={(categories ?? []) as Category[]} accounts={(accounts ?? []) as Account[]}>{children}</AppShell>;
}
