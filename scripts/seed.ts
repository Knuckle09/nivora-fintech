import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_EMAIL and SEED_USER_PASSWORD in .env.local.");
}
const seedEmail = email;
const seedPassword = password;
const todayInIndia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function stableUuid(key: string) {
  const bytes = createHash("sha1").update(key).digest("hex").slice(0, 32).split("");
  bytes[12] = "5";
  bytes[16] = ((parseInt(bytes[16], 16) & 3) | 8).toString(16);
  const hex = bytes.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomFor(seed: string) {
  let state = createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function dateFor(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

type SeedTransaction = {
  user_id: string;
  account_id: string;
  category_id: string | null;
  merchant: string;
  description: string;
  amount_minor: number;
  transaction_type: "income" | "expense" | "transfer";
  occurred_on: string;
  transfer_group_id: string | null;
  seed_key: string;
};

async function main() {
  let userId: string | undefined;
  for (let page = 1; !userId; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    userId = data.users.find((user) => user.email?.toLowerCase() === seedEmail.toLowerCase())?.id;
    if (userId || data.users.length < 1000) break;
  }

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: seedEmail,
      password: seedPassword,
      email_confirm: true,
      user_metadata: { full_name: "Aarav Mehta" }
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("id,slug")
    .is("user_id", null);
  if (categoryError) throw categoryError;
  const categoryIds = new Map((categories ?? []).map((category) => [category.slug, category.id]));

  const accountSeeds = [
    { seed_key: "seed-checking", name: "Everyday checking", account_type: "checking", institution: "HDFC Bank", opening_balance_minor: 21250000, color: "ledger", last_four: "4821", sort_order: 0 },
    { seed_key: "seed-savings", name: "Rainy day savings", account_type: "savings", institution: "Kotak Mahindra Bank", opening_balance_minor: 42800000, color: "graphite", last_four: "1906", sort_order: 1 },
    { seed_key: "seed-investments", name: "Index portfolio", account_type: "investment", institution: "Zerodha", opening_balance_minor: 58600000, color: "gold", last_four: null, sort_order: 2 },
    { seed_key: "seed-credit", name: "Travel rewards card", account_type: "credit", institution: "HDFC Bank", opening_balance_minor: -4850000, color: "graphite", last_four: "7704", sort_order: 3 }
  ];

  const { data: accounts, error: accountError } = await supabase
    .from("accounts")
    .upsert(accountSeeds.map((account) => ({ ...account, user_id: userId, currency: "INR" })), { onConflict: "user_id,seed_key" })
    .select("id,seed_key");
  if (accountError) throw accountError;
  const accountIds = new Map((accounts ?? []).map((account) => [account.seed_key, account.id]));
  const checkingId = accountIds.get("seed-checking");
  const savingsId = accountIds.get("seed-savings");
  const investmentId = accountIds.get("seed-investments");
  const creditId = accountIds.get("seed-credit");
  if (!checkingId || !savingsId || !investmentId || !creditId) throw new Error("The seeded accounts could not be resolved.");

  const random = randomFor(`${seedEmail}:nivora-seed-v1`);
  const rows: SeedTransaction[] = [];
  const now = new Date();
  let creditSpend = 0;
  const months: { year: number; month: number }[] = [];
  for (let offset = 7; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    months.push({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
  }

  function add(input: {
    account: string;
    category: string | null;
    merchant: string;
    description: string;
    amountRupees: number;
    type: SeedTransaction["transaction_type"];
    date: string;
    key: string;
    transferKey?: string;
  }) {
    if (input.date > todayInIndia) return;
    const accountId = accountIds.get(input.account);
    const categoryId = input.category ? categoryIds.get(input.category) : null;
    if (!accountId || (input.category && !categoryId)) throw new Error(`Seed reference missing for ${input.key}.`);
    rows.push({
      user_id: userId!,
      account_id: accountId,
      category_id: categoryId ?? null,
      merchant: input.merchant,
      description: input.description,
      amount_minor: Math.round(input.amountRupees * 100),
      transaction_type: input.type,
      occurred_on: input.date,
      transfer_group_id: input.transferKey ? stableUuid(`${userId}:${input.transferKey}`) : null,
      seed_key: input.key
    });
  }

  function purchaseAmount(min: number, max: number) {
    return Math.round((min + random() * (max - min)) / 10) * 10;
  }

  const merchants: Record<string, string[]> = {
    food: ["Nature's Basket", "Swiggy", "Blue Tokai", "Theobroma", "BigBasket", "Dosa Corner", "Third Wave Coffee", "Licious", "Cafe Noir"],
    transport: ["Namma Yatri", "Metro Recharge", "Rapido", "Indian Oil", "BMTC Pass", "Uber India"],
    shopping: ["Myntra", "Croma", "Fabindia", "Amazon India", "Decathlon", "Westside", "Nykaa"],
    health: ["Apollo Pharmacy", "Practo", "Manipal Clinic", "Cult.fit", "HealthKart"],
    utilities: ["BESCOM", "ACT Fibernet", "Airtel", "BWSSB", "Tata Play"],
    entertainment: ["BookMyShow", "Spotify", "PVR Cinemas", "Netflix", "Theatre Bengaluru"],
    travel: ["IRCTC", "MakeMyTrip", "Air India", "Ola Outstation", "Treebo Hotels"],
    education: ["Coursera", "Sapna Book House", "O'Reilly Learning", "Udemy"],
    "personal-care": ["Urban Company", "Tira Beauty", "Green Trends", "Forest Essentials"]
  };
  const categoryWeights: [string, number, number, number][] = [
    ["food", 3, 5, 350], ["transport", 2, 4, 260], ["shopping", 0, 2, 450],
    ["health", 0, 2, 170], ["entertainment", 0, 2, 240],
    ["education", 0, 1, 120], ["personal-care", 0, 2, 140]
  ];

  for (const { year, month } of months) {
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const payday = 1 + Math.floor(random() * 3);
    add({ account: "seed-checking", category: "salary", merchant: "Northstar Studio", description: "Monthly salary", amountRupees: purchaseAmount(138000, 158000), type: "income", date: dateFor(year, month, payday), key: `${monthKey}-salary` });
    if (random() > 0.68) add({ account: "seed-checking", category: "salary", merchant: "Northstar Studio", description: "Quarterly performance award", amountRupees: purchaseAmount(8500, 18500), type: "income", date: dateFor(year, month, 12), key: `${monthKey}-award` });
    add({ account: "seed-checking", category: "housing", merchant: "Cedar Grove Residences", description: "Monthly rent", amountRupees: 32500, type: "expense", date: dateFor(year, month, 5 + Math.floor(random() * 3)), key: `${monthKey}-rent` });

    const bills = [
      ["BESCOM", "Utilities", purchaseAmount(1100, 2650), 8, "utilities"],
      ["ACT Fibernet", "Home internet", 1179, 11, "utilities"],
      ["Airtel", "Mobile plan", purchaseAmount(549, 799), 14, "utilities"]
    ] as const;
    for (let index = 0; index < bills.length; index += 1) {
      const [merchant, description, amount, day, category] = bills[index];
      add({ account: "seed-checking", category, merchant, description, amountRupees: amount, type: "expense", date: dateFor(year, month, day + Math.floor(random() * 3)), key: `${monthKey}-bill-${index}` });
    }

    let monthCreditSpend = 0;
    let itemIndex = 0;
    for (const [slug, minimum, maximum, average] of categoryWeights) {
      const count = minimum + Math.floor(random() * (maximum - minimum + 1));
      for (let countIndex = 0; countIndex < count; countIndex += 1) {
        let amount = purchaseAmount(average * 0.48, average * 1.65);
        if (slug === "shopping" && month === 7 && year === now.getUTCFullYear() && countIndex === 0) amount = purchaseAmount(27800, 36500);
        if (slug === "travel" && countIndex === 0 && random() > 0.74) amount = purchaseAmount(12000, 29500);
        const merchant = merchants[slug][Math.floor(random() * merchants[slug].length)];
        const paidByCard = slug === "food" || slug === "shopping" || slug === "entertainment" || (slug === "health" && random() > 0.5);
        const cardKey = `seed-credit`;
        add({ account: paidByCard ? cardKey : "seed-checking", category: slug, merchant, description: slug === "food" ? "Everyday food & dining" : slug === "transport" ? "Local travel" : `${slug.replace("-", " ")} purchase`, amountRupees: amount, type: "expense", date: dateFor(year, month, 9 + Math.floor(random() * 19)), key: `${monthKey}-purchase-${itemIndex++}` });
        if (paidByCard) monthCreditSpend += amount;
      }
    }
    if (month === 7 && year === now.getUTCFullYear()) {
      const oneOff = purchaseAmount(12000, 18000);
      add({ account: "seed-credit", category: "travel", merchant: "Taj MG Road", description: "Weekend stay", amountRupees: oneOff, type: "expense", date: dateFor(year, month, 19), key: `${monthKey}-weekend-stay` });
      monthCreditSpend += oneOff;
    }

    const savingsMove = purchaseAmount(17500, 27000);
    const savingsTransfer = `${monthKey}-savings-transfer`;
    add({ account: "seed-checking", category: null, merchant: "Kotak Mahindra Bank", description: "Monthly savings transfer", amountRupees: -savingsMove, type: "transfer", date: dateFor(year, month, 22), key: `${savingsTransfer}-out`, transferKey: savingsTransfer });
    add({ account: "seed-savings", category: null, merchant: "HDFC Bank", description: "Monthly savings transfer", amountRupees: savingsMove, type: "transfer", date: dateFor(year, month, 22), key: `${savingsTransfer}-in`, transferKey: savingsTransfer });

    const investmentMove = purchaseAmount(18000, 32000);
    const investmentTransfer = `${monthKey}-investment-transfer`;
    add({ account: "seed-checking", category: null, merchant: "Zerodha", description: "Index fund contribution", amountRupees: -investmentMove, type: "transfer", date: dateFor(year, month, 24), key: `${investmentTransfer}-out`, transferKey: investmentTransfer });
    add({ account: "seed-investments", category: null, merchant: "HDFC Bank", description: "Index fund contribution", amountRupees: investmentMove, type: "transfer", date: dateFor(year, month, 24), key: `${investmentTransfer}-in`, transferKey: investmentTransfer });
    add({ account: "seed-savings", category: "interest", merchant: "Kotak Mahindra Bank", description: "Savings interest", amountRupees: purchaseAmount(950, 1580), type: "income", date: dateFor(year, month, 28), key: `${monthKey}-interest` });
    if (month % 3 === 0) add({ account: "seed-investments", category: "investments", merchant: "Nifty 50 Index Fund", description: "Quarterly distribution", amountRupees: purchaseAmount(700, 2250), type: "income", date: dateFor(year, month, 27), key: `${monthKey}-distribution` });

    creditSpend += monthCreditSpend;
    const repay = Math.min(creditSpend, Math.round(monthCreditSpend * (0.65 + random() * 0.3)));
    if (repay > 0) {
      const cardPayment = `${monthKey}-card-payment`;
      add({ account: "seed-checking", category: null, merchant: "HDFC Bank", description: "Card payment", amountRupees: -repay, type: "transfer", date: dateFor(year, month, 26), key: `${cardPayment}-out`, transferKey: cardPayment });
      add({ account: "seed-credit", category: null, merchant: "HDFC Bank", description: "Card payment", amountRupees: repay, type: "transfer", date: dateFor(year, month, 26), key: `${cardPayment}-in`, transferKey: cardPayment });
      creditSpend -= repay;
    }
  }

  for (let offset = 0; offset < rows.length; offset += 400) {
    const { error } = await supabase.from("transactions").upsert(rows.slice(offset, offset + 400), { onConflict: "user_id,seed_key" });
    if (error) throw error;
  }

  const { data: balances, error: balanceError } = await supabase
    .from("account_balances")
    .select("name,balance_minor")
    .eq("user_id", userId);
  if (balanceError) throw balanceError;
  console.log(`Seeded ${rows.length} varied ledger entries across ${months.length} months for ${seedEmail}.`);
  console.log(`Created ${accountSeeds.length} accounts. Net balance: INR ${(balances ?? []).reduce((total, account) => total + Number(account.balance_minor), 0) / 100}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seeding failed.");
  process.exitCode = 1;
});
