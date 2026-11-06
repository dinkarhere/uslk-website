import { describe, expect, it } from "vitest";
import { buildEmail, isSameOrigin, MIN_FILL_MS, parseSubmission } from "../src/lib/forms";

const now = 1_800_000_000_000;
const human = { ts: String(now - MIN_FILL_MS - 1000), website: "" };

const contact = { ...human, form: "contact", firstName: "Asha", lastName: "Patil", email: " Asha@Example.com ", message: "Hello" };
const donate = { ...human, form: "donate", firstName: "Asha", lastName: "Patil", email: "asha@example.com", cause: "Plantation", amount: "2500" };

describe("parseSubmission", () => {
  it("accepts and normalises a valid contact submission", () => {
    const r = parseSubmission(contact, now);
    expect(r.ok).toBe(true);
    if (r.ok && r.data.form === "contact") expect(r.data.email).toBe("asha@example.com");
  });

  it("accepts a donation and coerces the amount", () => {
    const r = parseSubmission(donate, now);
    expect(r).toMatchObject({ ok: true, data: { form: "donate", amount: 2500 } });
  });

  it("flags the honeypot as spam", () => {
    expect(parseSubmission({ ...contact, website: "http://spam" }, now)).toEqual({ ok: false, reason: "spam" });
  });

  it("flags submissions that are too fast or missing a timestamp as spam", () => {
    expect(parseSubmission({ ...contact, ts: String(now - 100) }, now)).toMatchObject({ reason: "spam" });
    expect(parseSubmission({ ...contact, ts: "" }, now)).toMatchObject({ reason: "spam" });
    expect(parseSubmission({ ...contact, ts: "0" }, now)).toMatchObject({ reason: "spam" });
    expect(parseSubmission({ ...contact, ts: String(now + 3_600_000) }, now)).toMatchObject({ reason: "spam" });
  });

  it("returns per-field errors", () => {
    const r = parseSubmission({ ...donate, email: "nope", amount: "0", firstName: "" }, now);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "invalid") {
      expect(Object.keys(r.errors).sort()).toEqual(["amount", "email", "firstName"]);
    }
  });

  it("rejects unknown form types and fractional amounts", () => {
    expect(parseSubmission({ ...contact, form: "other" }, now).ok).toBe(false);
    expect(parseSubmission({ ...donate, amount: "10.5" }, now).ok).toBe(false);
  });

  it("rejects over-long input", () => {
    expect(parseSubmission({ ...contact, message: "x".repeat(5001) }, now).ok).toBe(false);
  });
});

describe("isSameOrigin", () => {
  const req = (origin?: string) =>
    new Request("https://uslkfoundation.com/api/forms", { method: "POST", headers: origin ? { origin } : {} });

  it("allows same-origin posts", () => expect(isSameOrigin(req("https://uslkfoundation.com"))).toBe(true));
  it("blocks cross-origin posts", () => expect(isSameOrigin(req("https://evil.example"))).toBe(false));
  it("blocks requests without Origin", () => expect(isSameOrigin(req())).toBe(false));
  it("blocks malformed Origin", () => expect(isSameOrigin(req("not a url"))).toBe(false));
});

describe("buildEmail", () => {
  it("escapes HTML and strips newlines from the subject", () => {
    const r = parseSubmission({ ...contact, firstName: "<b>Asha\r\nBcc: x@y.z</b>", message: "<script>alert(1)</script>" }, now);
    if (!r.ok) throw new Error("expected valid");
    const email = buildEmail(r.data);
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.replyTo).toBe("asha@example.com");
  });

  it("formats donation amounts in rupees", () => {
    const r = parseSubmission({ ...donate, amount: "150000" }, now);
    if (!r.ok) throw new Error("expected valid");
    expect(buildEmail(r.data).subject).toContain("₹1,50,000");
  });
});
