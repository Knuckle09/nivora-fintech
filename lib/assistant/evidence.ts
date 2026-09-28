import { formatINR } from "@/lib/format";

export type EvidenceFact = { id: string; valueMinor: number; label: string };

export const cannotVerify = "I couldn't verify that from the available account and transaction data. Try a date range, spending category, or account balance question.";

function hasNumberOutsideFactMarker(text: string) {
  const plainText = text.replace(/\{\{fact:[^{}]+\}\}/g, " ");
  if (/\p{N}|₹|\bINR\b/u.test(plainText)) return true;
  return /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|lakhs|crore|crores|million|billion|percent|percentage|twice|double|half|couple|dozen|pair|single|triple)\b/i.test(plainText);
}

export function resolveAnswer(text: string, facts: Map<string, EvidenceFact>, complete: boolean) {
  if (!text || hasNumberOutsideFactMarker(text)) return cannotVerify;
  let invalidReference = false;
  const answer = text.replace(/\{\{fact:([^{}]+)\}\}/g, (marker, id: string) => {
    const fact = facts.get(id);
    if (!fact || !complete) {
      invalidReference = true;
      return "";
    }
    return formatINR(fact.valueMinor);
  });
  if (invalidReference || /\{\{fact:/.test(answer)) return cannotVerify;
  return answer.trim() || cannotVerify;
}

export function getPlannedExpenseRupees(message: string) {
  const matches = [
    { match: message.match(/(?:₹|INR\b|Rs\.?)\s*([\d][\d,]*(?:\.\d{1,2})?)/i), multiplier: 1 },
    { match: message.match(/\b([\d][\d,]*(?:\.\d{1,2})?)\s*(?:rupees?\b|rs\.?\b|inr\b)/i), multiplier: 1 },
    { match: message.match(/\b([\d]+(?:\.\d{1,2})?)\s*k(?:\s*(?:rupees?\b|rs\.?\b|inr\b))?/i), multiplier: 1000 }
  ];
  for (const { match, multiplier } of matches) {
    if (!match) continue;
    const amount = Number(match[1].replaceAll(",", "")) * multiplier;
    if (Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000) return amount;
  }
  return null;
}
