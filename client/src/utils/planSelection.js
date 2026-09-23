const PLAN_KEY = "restosphere_selected_plan";
const PREMIUM_DURATION_KEY = "restosphere_selected_premium_duration_years";
const CHECKOUT_RESULT_KEY = "restosphere_checkout_result";

export const saveSelectedPlan = (planKey, premiumDurationYears = null) => {
  if (!planKey) return;
  localStorage.setItem(PLAN_KEY, String(planKey).toLowerCase());
  const years = Number(premiumDurationYears);
  if (Number.isInteger(years) && years >= 1 && years <= 5) {
    localStorage.setItem(PREMIUM_DURATION_KEY, String(years));
  } else {
    localStorage.removeItem(PREMIUM_DURATION_KEY);
  }
};

export const getSelectedPlan = () => localStorage.getItem(PLAN_KEY) || "";
export const getSelectedPremiumDurationYears = () => {
  const years = Number(localStorage.getItem(PREMIUM_DURATION_KEY));
  return Number.isInteger(years) && years >= 1 && years <= 5 ? years : 1;
};

export const clearSelectedPlan = () => {
  localStorage.removeItem(PLAN_KEY);
  localStorage.removeItem(PREMIUM_DURATION_KEY);
};

export const saveCheckoutResult = (payload) => {
  sessionStorage.setItem(CHECKOUT_RESULT_KEY, JSON.stringify(payload || {}));
};

export const getCheckoutResult = () => {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearCheckoutResult = () => sessionStorage.removeItem(CHECKOUT_RESULT_KEY);

export const planDisplayName = (key) => {
  const map = {
    trial: "Free Trial",
    free_trial: "Free Trial",
    basic: "Basic",
    professional: "Pro",
    pro: "Pro",
    enterprise: "Premium",
    premium: "Premium",
  };
  return map[String(key || "").toLowerCase()] || key || "—";
};
