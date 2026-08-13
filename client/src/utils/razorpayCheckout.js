import { createBillingCheckout, verifyBillingPayment } from "../services/billingService";

const ensureRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

/**
 * Shared tenant checkout using existing /admin/billing endpoints.
 * Returns verified subscription payload on success.
 */
export const startPlanCheckout = async ({ planKey, planName, onVerified }) => {
  const { data } = await createBillingCheckout({ planName: planKey });
  const checkout = data?.data;
  if (!checkout) throw new Error("Checkout could not be created");

  if (checkout.testMode) {
    const verify = await verifyBillingPayment({
      paymentId: checkout.paymentId,
      testSuccess: true,
    });
    const subscription = verify.data?.data || null;
    if (onVerified) onVerified(subscription, checkout);
    return { subscription, checkout, testMode: true };
  }

  await ensureRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: checkout.keyId,
      amount: Math.round(Number(checkout.amount) * 100),
      currency: checkout.currency || "INR",
      name: "RestoSphere",
      description: `${planName || planKey} plan`,
      order_id: checkout.razorpayOrderId,
      handler: async (response) => {
        try {
          const verify = await verifyBillingPayment({
            paymentId: checkout.paymentId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          const subscription = verify.data?.data || null;
          if (onVerified) onVerified(subscription, checkout, response);
          resolve({
            subscription,
            checkout,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
          });
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    });

    rzp.on("payment.failed", (response) => {
      reject(new Error(response?.error?.description || "Payment failed"));
    });

    rzp.open();
  });
};
