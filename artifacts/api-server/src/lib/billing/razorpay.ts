import Razorpay from "razorpay";

// Lazily constructed — never throw at import time just because keys aren't
// set yet. Every billing route must check `isRazorpayConfigured()` first and
// return a clear 503 instead of letting this throw or return undefined
// downstream.
let client: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    // Callers must check isRazorpayConfigured() first; this is a programmer
    // error, not a user-facing path.
    throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
}

export const PAYMENTS_NOT_CONFIGURED_MESSAGE =
  "Payment processing is not yet configured. This will start working automatically once billing credentials are added — no code changes needed.";
