import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accountSchema = z.object({
  name: z.string().trim().min(2).max(60),
  institution: z.string().trim().min(2).max(60),
  account_type: z.enum(["checking", "savings", "investment", "credit"]),
  opening_balance: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
  last_four: z.union([z.literal(""), z.string().regex(/^\d{4}$/)])
});

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv()) return NextResponse.json({ error: "Supabase is not configured for this deployment." }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to add an account." }, { status: 401 });

  const parsed = accountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the account details and try again." }, { status: 400 });
  const input = parsed.data;
  const amountMinor = Math.round(Number(input.opening_balance) * 100);
  const balance = input.account_type === "credit" ? -amountMinor : amountMinor;
  const color = input.account_type === "investment" ? "gold" : input.account_type === "savings" ? "graphite" : "ledger";
  const { data, error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: input.name,
    institution: input.institution,
    account_type: input.account_type,
    opening_balance_minor: balance,
    last_four: input.last_four || null,
    color,
    sort_order: 99
  }).select("id").single();

  if (error) return NextResponse.json({ error: "The account could not be saved. Please try again." }, { status: 400 });
  return NextResponse.json({ accountId: data.id }, { status: 201 });
}
