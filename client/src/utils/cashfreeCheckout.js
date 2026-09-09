const CASHFREE_SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

const loadCashfreeScript = () => new Promise((resolve, reject) => {
  if (window.Cashfree) return resolve(window.Cashfree);
  const existing = document.querySelector(`script[src="${CASHFREE_SDK_URL}"]`);
  if (existing) {
    existing.addEventListener("load", () => resolve(window.Cashfree), { once: true });
    existing.addEventListener("error", () => reject(new Error("Cashfree checkout could not be loaded")), { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = CASHFREE_SDK_URL;
  script.async = true;
  script.onload = () => window.Cashfree ? resolve(window.Cashfree) : reject(new Error("Cashfree checkout could not be loaded"));
  script.onerror = () => reject(new Error("Cashfree checkout could not be loaded"));
  document.head.appendChild(script);
});

export const openCashfreeCheckout = async (paymentSessionId, cashfreeEnvironment) => {
  if (typeof paymentSessionId !== "string" || !paymentSessionId.trim()) throw new Error("Cashfree payment session is missing or invalid");
  if (!["sandbox", "production"].includes(String(cashfreeEnvironment || "").toLowerCase())) throw new Error("Cashfree payment environment is missing or invalid");
  const Cashfree = await loadCashfreeScript();
  const mode = String(cashfreeEnvironment).toLowerCase();
  console.info("Cashfree frontend mode:", mode, "payment session present:", true, "payment session type:", typeof paymentSessionId);
  const cashfree = Cashfree({ mode });
  return cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
};
