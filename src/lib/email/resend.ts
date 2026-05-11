import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM = "Neo <noreply@nura.sh>";
const REPLY_TO = "team@nura.sh";

export type SendResult = { ok: true; id: string } | { ok: false; reason: string };

/**
 * Send an email via Resend. Returns a structured result instead of throwing —
 * caller decides whether a failed send is fatal (e.g. invite flow falls back
 * to "copy link" UI when this returns ok:false).
 *
 * NOTE: Resend's SDK returns {data, error} per their docs — we deliberately
 * do NOT wrap their call in try/catch.
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  tags?: { name: string; value: string }[];
}): Promise<SendResult> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", opts.subject);
    return { ok: false, reason: "no_api_key" };
  }
  const { data, error } = await resend.emails.send(
    {
      from: FROM,
      to: opts.to,
      replyTo: REPLY_TO,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      tags: opts.tags,
    },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined
  );
  if (error) {
    console.error("[email] send failed", error);
    return { ok: false, reason: error.message ?? "send_failed" };
  }
  if (!data?.id) {
    return { ok: false, reason: "no_id_returned" };
  }
  return { ok: true, id: data.id };
}
