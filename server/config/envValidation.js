const present = (name) => {
  const value = String(process.env[name] || "").trim();
  return Boolean(value) && !/^replace_with|^your_/i.test(value);
};

export const validateProductionEnvironment = () => {
  if (process.env.NODE_ENV !== "production") return;

  const required = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "CLIENT_URL"];
  if (!present("MONGO_URI") && !present("MONGODB_URI")) required.unshift("MONGO_URI or MONGODB_URI");
  if (String(process.env.PUBLIC_MENU_ENABLED || "true").toLowerCase() !== "false") {
    required.push("PUBLIC_MENU_CONTEXT_SECRET");
  }
  if (String(process.env.LIVE_DIGITAL_PAYMENTS || "false").toLowerCase() === "true") {
    const hasRazorpay = present("RAZORPAY_KEY_ID") && present("RAZORPAY_KEY_SECRET");
    const hasStripe = present("STRIPE_SECRET_KEY") && present("STRIPE_WEBHOOK_SECRET");
    if (!hasRazorpay && !hasStripe) required.push("live payment provider credentials");
  }

  const missing = required.filter((name) => name === "live payment provider credentials" || !present(name));
  if (missing.length) {
    throw new Error(`Production configuration is missing: ${missing.join(", ")}`);
  }
};
