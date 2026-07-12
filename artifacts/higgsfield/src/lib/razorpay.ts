// Loads Razorpay's Checkout.js on demand (only when a user actually attempts
// to pay) rather than in index.html, so the app doesn't take on a third-party
// script load for every visitor before billing is even configured.
let loadingPromise: Promise<void> | null = null;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script."));
    document.body.appendChild(script);
  });

  return loadingPromise;
}

export interface RazorpayCheckoutOptions {
  keyId: string;
  name: string;
  description: string;
  subscriptionId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  prefillEmail?: string;
  onSuccess: () => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(opts: RazorpayCheckoutOptions): Promise<void> {
  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay checkout script did not load correctly.");

  const instance = new window.Razorpay({
    key: opts.keyId,
    name: opts.name,
    description: opts.description,
    subscription_id: opts.subscriptionId,
    order_id: opts.orderId,
    amount: opts.amount,
    currency: opts.currency,
    prefill: opts.prefillEmail ? { email: opts.prefillEmail } : undefined,
    theme: { color: "#CEFF00" },
    handler: () => opts.onSuccess(),
    modal: { ondismiss: opts.onDismiss },
  });

  instance.open();
}
