// Bloom AI helper endpoint (POST /api/ai).
// Keeps the Anthropic API key on the server, only answers signed-in Bloom users,
// and enforces a per-student daily limit stored in Supabase.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.BLOOM_MODEL || "claude-opus-5-5";
const DAILY_LIMIT = Number(process.env.BLOOM_AI_DAILY_LIMIT || 40);
const MAX_CHARS = 30000; // total text per request
const MAX_TURNS = 24;
// Models that accept the server-side refusal fallback.
const FALLBACK_MODELS = ["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"];

const CRISIS = /(kill(ing)?\s+my\s?self|suicid|end(ing)?\s+(my\s+life|it\s+all)|want(ed)?\s+to\s+die|wanna\s+die|hurt(ing)?\s+my\s?self|self[\s-]?harm|cut(ting)?\s+my\s?self|better\s+off\s+dead|no\s+reason\s+to\s+live|not\s+safe\s+(at\s+home|right\s+now))/i;
const SAFETY_TEXT =
  "It sounds like things might feel really heavy right now, and you deserve support from a real person. " +
  "If you might be in danger, please contact your local emergency number or tell a trusted adult near you now: " +
  "a parent or carer, teacher, or school counsellor. Bloom's helpers aren't a crisis service. The Support page has more options.";

const GUARD = `You are an AI helper inside Bloom, a study and wellbeing website made by Project Budline, a student-led initiative. The people using it are secondary school students, mostly aged 14 to 18.
- Be warm, plain, encouraging and age-appropriate.
- Never diagnose or assess mental health, never give risk scores, and never claim to be a therapist or counsellor.
- Never ask for personal details such as full names, addresses, school names, phone numbers or social media handles.
- Don't produce sexual, graphic or otherwise age-inappropriate content.
- If a student says they are in danger or might hurt themselves or someone else, reply briefly and calmly, encourage them to contact a trusted adult or their local emergency number now, mention Bloom's Support page, and don't continue as a counsellor.
- Follow the more specific instructions for each helper that appear in the conversation.`;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const reply = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function toMessages(input) {
  let turns;
  if (typeof input === "string") turns = [{ role: "user", content: input }];
  else if (Array.isArray(input)) turns = input;
  else return null;
  turns = turns
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map((t) => ({ role: t.role, content: t.content }));
  if (!turns.length || turns[0].role !== "user" || turns[turns.length - 1].role !== "user") return null;
  // Keep the helper's instruction turn plus the most recent turns.
  if (turns.length > MAX_TURNS) turns = [turns[0], ...turns.slice(-(MAX_TURNS - 1))];
  return turns;
}

export default async (req) => {
  if (req.method !== "POST") return reply(405, { code: "bad_request", error: "Use POST." });

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey || !process.env.ANTHROPIC_API_KEY) {
    return reply(503, { code: "not_configured", error: "The AI helpers aren't set up on this site yet." });
  }

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return reply(401, { code: "not_signed_in", error: "Sign in to use the AI helpers." });

  // Checks the student's sign-in and counts today's use in one call.
  let used;
  try {
    const r = await fetch(`${sbUrl}/rest/v1/rpc/bloom_use_ai`, {
      method: "POST",
      headers: { apikey: sbKey, authorization: auth, "content-type": "application/json" },
      body: "{}",
    });
    if (r.status === 401 || r.status === 403) return reply(401, { code: "not_signed_in", error: "Your sign-in has expired. Sign in again to use the AI helpers." });
    if (!r.ok) return reply(502, { code: "upstream_error", error: "Couldn't check your account just now. Try again in a moment." });
    used = Number(await r.json());
  } catch {
    return reply(502, { code: "upstream_error", error: "Couldn't check your account just now. Try again in a moment." });
  }
  if (!(used <= DAILY_LIMIT)) {
    return reply(429, { code: "rate_limited", error: `You've used today's ${DAILY_LIMIT} AI messages. They reset tomorrow, and everything else in Bloom still works.` });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return reply(400, { code: "bad_request", error: "That message couldn't be read." });
  }
  const messages = toMessages(body && body.input);
  if (!messages) return reply(400, { code: "bad_request", error: "That message couldn't be read." });
  const totalChars = messages.reduce((n, m) => n + m.content.length, 0);
  if (totalChars > MAX_CHARS) return reply(413, { code: "bad_request", error: "That's a lot of text at once. Try a shorter message or clear the chat." });

  const lastUser = messages[messages.length - 1].content;
  if (body.mode !== "json" && CRISIS.test(lastUser)) return reply(200, { text: SAFETY_TEXT, safety: true });

  const params = {
    model: MODEL,
    max_tokens: 4000, // replies are deliberately short; this caps cost per message
    system: GUARD,
    messages,
    output_config: { effort: body.mode === "json" ? "medium" : "low" },
  };
  if (FALLBACK_MODELS.includes(MODEL)) {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }

  try {
    const res = await client.beta.messages.create(params);
    if (res.stop_reason === "refusal") {
      return reply(422, { code: "refused", error: "The AI couldn't help with that one. Try asking in a different way." });
    }
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) return reply(502, { code: "upstream_error", error: "The AI didn't send a reply. Try again." });
    return reply(200, { text, truncated: res.stop_reason === "max_tokens" });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return reply(429, { code: "rate_limited", error: "The AI is busy right now. Try again in a minute." });
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error("Anthropic auth problem:", error.message);
      return reply(503, { code: "not_configured", error: "The AI helpers aren't set up correctly on this site." });
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("Bad request to Anthropic:", error.message);
      return reply(400, { code: "bad_request", error: "That message couldn't be sent. Try clearing the chat." });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
      return reply(502, { code: "upstream_error", error: "Something interrupted the AI. Try again." });
    }
    console.error("Unexpected error:", error);
    return reply(502, { code: "upstream_error", error: "Something interrupted the AI. Try again." });
  }
};

export const config = { path: "/api/ai" };
