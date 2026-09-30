import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { runGroundedAssistant } from "../lib/assistant/respond.js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;

if (!url || !anonKey || !email || !password || !process.env.GROQ_API_KEY) {
  throw new Error("Set Supabase URL/key, Groq API key, and the seeded user's email/password before running live assistant checks.");
}
const userEmail = email;
const userPassword = password;

const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({ email: userEmail, password: userPassword });
  if (error || !data.user) throw new Error("Could not sign in as the seeded user.");

  const questions = [
    "How much did I spend on food last month?",
    "Compare last month with the previous three months and explain which categories drove the change.",
    "Can I afford a 40000 rupee expense this month based on checking and savings balances, less recorded credit balance?"
  ];

  for (const question of questions) {
    const result = await runGroundedAssistant({ supabase, userId: data.user.id, message: question });
    if (!result.lookups.length || !result.grounded) throw new Error(`The assistant did not complete a grounded lookup for: ${question}`);
    console.log(`Q: ${question}`);
    console.log(`A: ${result.answer}`);
    console.log(`Checked: ${result.lookups.map((lookup) => `${lookup.source} (${lookup.period})`).join("; ")}`);
  }

  await supabase.auth.signOut();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Live assistant verification failed.");
  process.exitCode = 1;
});
