import { z } from "astro/zod";

/**
 * Form handling shared by /api/forms. Kept free of Astro/Cloudflare runtime
 * imports so it can be unit-tested in Node.
 */

const name = z.string().trim().min(1, "Required").max(80, "Too long");
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254));

export const contactSchema = z.object({
  form: z.literal("contact"),
  firstName: name,
  lastName: name,
  email,
  message: z.string().trim().max(5000, "Message is too long").default(""),
});

export const donateSchema = z.object({
  form: z.literal("donate"),
  firstName: name,
  lastName: name,
  email,
  cause: z.string().trim().min(1, "Please choose a cause").max(120),
  amount: z.coerce
    .number({ error: "Enter an amount" })
    .int("Whole rupees only")
    .min(1, "Enter an amount")
    .max(10_000_000, "Please contact us directly for large donations"),
});

export const submissionSchema = z.discriminatedUnion("form", [contactSchema, donateSchema]);
export type Submission = z.infer<typeof submissionSchema>;

export type FieldErrors = Record<string, string>;

export type ParseResult =
  | { ok: true; data: Submission }
  | { ok: false; reason: "spam" }
  | { ok: false; reason: "invalid"; errors: FieldErrors };

/** Minimum time a human needs to fill the form; faster submissions are treated as bots. */
export const MIN_FILL_MS = 2500;

/**
 * Validates raw form fields. Spam checks: a hidden honeypot field (`website`)
 * must be empty and the form must not be submitted implausibly fast (`ts` is
 * set when the page renders the form).
 */
export function parseSubmission(fields: Record<string, string>, now = Date.now()): ParseResult {
  if (fields.website) return { ok: false, reason: "spam" };
  // `ts` is rendered into the HTML at build time and refreshed by JS on page
  // load, so it is always present for real visitors (with or without JS).
  const startedAt = Number(fields.ts);
  const validTs = /^\d{13}$/.test(fields.ts ?? "") && startedAt <= now + 60_000;
  if (!validTs || now - startedAt < MIN_FILL_MS) return { ok: false, reason: "spam" };

  const result = submissionSchema.safeParse(fields);
  if (result.success) return { ok: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { ok: false, reason: "invalid", errors };
}

/**
 * CSRF protection for a cookie-less endpoint: only accept browser posts from
 * our own origin. Requests without an Origin header (non-browser clients) are
 * rejected too.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Strips CR/LF so user input can never inject extra email headers via the subject. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function buildEmail(s: Submission): { subject: string; text: string; html: string; replyTo: string } {
  const fullName = oneLine(`${s.firstName} ${s.lastName}`);
  const rows: [string, string][] =
    s.form === "contact"
      ? [
          ["Name", fullName],
          ["Email", s.email],
          ["Message", s.message || "(no message)"],
        ]
      : [
          ["Name", fullName],
          ["Email", s.email],
          ["Cause", s.cause],
          ["Pledged amount", inr.format(s.amount)],
        ];

  const subject =
    s.form === "contact"
      ? `Website contact: ${fullName}`
      : `Donation pledge: ${inr.format(s.amount)} for ${oneLine(s.cause)} from ${fullName}`;

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n\n");
  const html = `<table cellpadding="6" style="font-family:sans-serif;font-size:14px">${rows
    .map(
      ([k, v]) =>
        `<tr><th align="left" valign="top">${escapeHtml(k)}</th><td style="white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table>`;

  return { subject: subject.slice(0, 200), text, html, replyTo: s.email };
}
