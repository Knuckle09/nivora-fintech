import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const transactionSchema = z.object({
  merchant: z.string().trim().min(1).max(80),
  amount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  account_id: z.uuid(),
  category_id: z.uuid(),
  type: z.enum(["income", "expense"]),
  description: z.string().max(160).optional().default("")
});

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv()) return NextResponse.json({ error: "Supabase is not configured for this deployment." }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to add a transaction." }, { status: 401 });

  const parsed = transactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the transaction details and try again." }, { status: 400 });
  const input = parsed.data;
  const [year, month, day] = input.occurred_on.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return NextResponse.json({ error: "Choose a valid transaction date." }, { status: 400 });
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  if (input.occurred_on > today) {
    return NextResponse.json({ error: "Future-dated entries are not supported. Add it when the transaction posts." }, { status: 400 });
  }

  const transactionType = input.type;
  const amountMinor = Math.round(Number(input.amount) * 100) * (transactionType === "income" ? 1 : -1);
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("kind")
    .eq("id", input.category_id)
    .maybeSingle();
  if (categoryError || !category || category.kind !== transactionType) {
    return NextResponse.json({ error: "Choose a category that matches the transaction type." }, { status: 400 });
  }
  const { data, error } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: input.account_id,
    category_id: input.category_id,
    merchant: input.merchant,
    description: input.description,
    amount_minor: amountMinor,
    transaction_type: transactionType,
    occurred_on: input.occurred_on
  }).select("id").single();

  if (error) return NextResponse.json({ error: "The transaction could not be saved. Check that the account and category are yours." }, { status: 400 });
  return NextResponse.json({ transactionId: data.id }, { status: 201 });
}
