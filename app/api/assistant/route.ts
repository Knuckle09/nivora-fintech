import { NextResponse } from "next/server";
import { APIError } from "openai";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { describeAssistantFailure } from "@/lib/assistant/failure";
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
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "The assistant needs a Groq API key before it can answer." }, { status: 503 });
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
  } catch (error) {
    if (error instanceof APIError) {
      console.error("[assistant] Groq request failed", {
        status: error.status,
        code: error.code,
        requestId: error.requestID
      });
    } else {
      console.error("[assistant] request failed", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }
    const failure = describeAssistantFailure(error);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
