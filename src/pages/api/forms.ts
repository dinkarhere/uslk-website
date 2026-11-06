import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { buildEmail, isSameOrigin, parseSubmission } from "@/lib/forms";

/** Runs on demand as a Cloudflare Worker; every other page is static. */
export const prerender = false;

const MAX_BODY_BYTES = 20_000;

/** The Workers rate-limit binding, or undefined outside Cloudflare (e.g. `pnpm cms`). */
async function getRateLimiter() {
  try {
    const { env } = await import("cloudflare:workers");
    return env.FORM_LIMITER;
  } catch {
    return undefined;
  }
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** No-JS fallback: send the visitor back to the form with a status flag. */
const redirectBack = (request: Request, status: "sent" | "error") => {
  const self = new URL(request.url);
  let target = new URL("/", self);
  try {
    const referer = new URL(request.headers.get("referer") ?? "");
    if (referer.host === self.host) target = referer; // never redirect off-site
  } catch {
    /* missing or malformed referer: fall back to home */
  }
  target.searchParams.set("form", status);
  target.hash = "form";
  return Response.redirect(target.toString(), 303);
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const fail = (status: number, message: string, errors?: Record<string, string>) =>
    wantsJson ? json(status, { ok: false, message, errors }) : redirectBack(request, "error");

  if (!isSameOrigin(request)) return fail(403, "Forbidden");

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return fail(413, "Submission too large");

  // 5 submissions per minute per IP (binding configured in wrangler.jsonc).
  const limiter = await getRateLimiter();
  if (limiter) {
    const { success } = await limiter.limit({ key: clientAddress || "unknown" });
    if (!success) return fail(429, "Too many submissions. Please wait a minute and try again.");
  }

  let fields: Record<string, string>;
  try {
    const form = await request.formData();
    fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  } catch {
    return fail(400, "Could not read the form");
  }

  const parsed = parseSubmission(fields);
  if (!parsed.ok) {
    // Pretend success to bots so they don't retry.
    if (parsed.reason === "spam") return wantsJson ? json(200, { ok: true }) : redirectBack(request, "sent");
    return fail(422, "Please check the highlighted fields.", parsed.errors);
  }

  const apiKey = getSecret("RESEND_API_KEY");
  const to = getSecret("CONTACT_TO_EMAIL");
  const from = getSecret("CONTACT_FROM_EMAIL");
  const email = buildEmail(parsed.data);

  if (!apiKey || !to || !from) {
    if (import.meta.env.DEV) {
      console.info("[forms] Email not configured; submission:", email.subject);
      return wantsJson ? json(200, { ok: true }) : redirectBack(request, "sent");
    }
    console.error("[forms] RESEND_API_KEY / CONTACT_TO_EMAIL not set");
    return fail(503, "The form is temporarily unavailable. Please email us directly.");
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: to.split(",").map((s) => s.trim()),
        reply_to: email.replyTo,
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
    if (!res.ok) {
      console.error("[forms] Resend error", res.status, await res.text());
      return fail(502, "We couldn’t send your message. Please try again or email us directly.");
    }
  } catch (err) {
    console.error("[forms] Resend request failed", err);
    return fail(502, "We couldn’t send your message. Please try again or email us directly.");
  }

  return wantsJson ? json(200, { ok: true }) : redirectBack(request, "sent");
};

export const ALL: APIRoute = () => new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
