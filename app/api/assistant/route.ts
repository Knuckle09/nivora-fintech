import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { runGroundedAssistant } from "@/lib/assistant/respond";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const requestSchema = z.object({
  message: z.string().trim().min(2).max(1200),
  priorQuestions: z.array(z.string().trim().min(2).max(1200)).max(4).optional().default([])
});

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase is not configured for this deployment." }, { status: 503 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to ask about your finances." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "The assistant needs an OpenAI API key before it can answer." }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Keep your question under 1,200 characters and try again." }, { status: 400 });

  try {
    const result = await runGroundedAssistant({
      supabase,
      userId: user.id,
      message: parsed.data.message,
      priorQuestions: parsed.data.priorQuestions
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Nivora couldn't complete a verified lookup. Please try again." }, { status: 502 });
  }
}
