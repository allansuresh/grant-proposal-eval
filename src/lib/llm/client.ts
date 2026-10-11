import "server-only"; // build fails if this is ever imported into browser code
import Anthropic from "@anthropic-ai/sdk";
import { LlmError, type MessagesApi } from "./call";

// The API key is read here, on the server only. It is never sent to the
// browser, and nothing in a client component can import this file.

let client: Anthropic | null = null;

export function getMessagesApi(): MessagesApi {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new LlmError("not_configured", "AI scoring is not configured on this server (missing ANTHROPIC_API_KEY).");
  }
  client ??= new Anthropic({
    apiKey,
    maxRetries: 2, // SDK retries network errors, 429 and 5xx with exponential backoff
    timeout: 90_000, // ms; a single scoring call normally takes 10–30 s
  });
  return client.messages;
}
