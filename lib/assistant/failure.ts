import { APIError } from "openai";

export function describeAssistantFailure(error: unknown) {
  if (!(error instanceof APIError)) {
    return {
      status: 502,
      message: "Nivora couldn't complete a verified lookup. Please try again in a moment."
    };
  }

  const code = error.code?.toLowerCase();
  const message = error.message.toLowerCase();

  if (error.status === 429 && (
    code === "insufficient_quota" ||
    code === "billing_hard_limit_reached" ||
    code === "credit_balance_exhausted" ||
    message.includes("no credits remaining")
  )) {
    return {
      status: 503,
      message: "OpenAI API billing has no available credits. Add API credits to the OpenAI project used by Nivora, then try again."
    };
  }

  if (error.status === 429) {
    return { status: 429, message: "The assistant is receiving too many requests right now. Wait a moment, then try again." };
  }

  if (error.status === 401 || error.status === 403) {
    return {
      status: 503,
      message: "OpenAI rejected the configured API key. Update OPENAI_API_KEY for this Vercel environment, then redeploy."
    };
  }

  if (error.status === 404) {
    return {
      status: 503,
      message: "The configured OpenAI model is unavailable to this API project. Check OPENAI_MODEL and the project's model access."
    };
  }

  if (error.status !== undefined && error.status >= 500) {
    return { status: 503, message: "OpenAI is temporarily unavailable. Please try the verified lookup again shortly." };
  }

  return {
    status: 502,
    message: "OpenAI couldn't complete this request. Check the server-side model configuration, then try again."
  };
}
