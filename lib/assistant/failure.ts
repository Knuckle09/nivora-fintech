import { APIError } from "openai";

export function describeAssistantFailure(error: unknown) {
  if (!(error instanceof APIError)) {
    return {
      status: 502,
      message: "Nivora couldn't complete a verified lookup. Please try again in a moment."
    };
  }

  if (error.status === 429) {
    return {
      status: 429,
      message: "Groq's free-plan rate or daily limit may have been reached. Check your Groq limits or wait before trying again."
    };
  }

  if (error.status === 401 || error.status === 403) {
    return {
      status: 503,
      message: "Groq rejected the configured API key or model access. Update GROQ_API_KEY and check GROQ_MODEL for this Vercel environment, then redeploy."
    };
  }

  if (error.status === 404) {
    return {
      status: 503,
      message: "The configured Groq model is unavailable. Check GROQ_MODEL and the model's availability in your Groq project."
    };
  }

  if (error.status !== undefined && error.status >= 500) {
    return { status: 503, message: "Groq is temporarily unavailable. Please try the verified lookup again shortly." };
  }

  return {
    status: 502,
    message: "Groq couldn't complete this request. Check the server-side model configuration, then try again."
  };
}
