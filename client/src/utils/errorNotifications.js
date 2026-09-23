const GLOBAL_SUBSCRIPTION_CODES = new Set([
  "SUBSCRIPTION_EXPIRED",
  "SUBSCRIPTION_CANCELLED",
  "SUBSCRIPTION_SUSPENDED",
  "SUBSCRIPTION_INACTIVE",
]);

const normalizePart = (value) => String(value || "")
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, "_")
  .replace(/^_|_$/g, "");

const normalizePath = (url) => {
  try {
    const pathname = new URL(String(url || ""), "https://restosphere.local").pathname;
    return pathname
      .replace(/[0-9a-f]{24}/gi, ":id")
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
      .replace(/\/\d+(?=\/|$)/g, "/:id");
  } catch {
    return String(url || "unknown").split("?")[0] || "unknown";
  }
};

const messageKey = (message) => String(message || "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, " ")
  .slice(0, 240);

const getPayload = (error) => error?.response?.data || {};

export const getErrorMetadata = (error, { context = "", global: forceGlobal = false } = {}) => {
  const payload = getPayload(error);
  const config = error?.config || {};
  const status = Number(error?.response?.status || 0) || "NETWORK";
  const code = normalizePart(payload?.code || error?.code || `HTTP_${status}`) || "UNKNOWN_ERROR";
  const tenant = normalizePart(
    payload?.details?.tenantId ||
    payload?.details?.restaurantId ||
    config?.headers?.["X-Restaurant-Id"] ||
    config?.headers?.["x-restaurant-id"]
  ) || "CURRENT_TENANT";
  const method = String(config.method || "GET").toUpperCase();
  const request = normalizePath(config.url);
  const global = forceGlobal || GLOBAL_SUBSCRIPTION_CODES.has(code);
  const identity = global
    ? `global:${code}:${tenant}`
    : `error:${code}:${status}:${method}:${request}:${tenant}:${normalizePart(context) || "DEFAULT"}`;

  return {
    code,
    status,
    tenant,
    request,
    method,
    global,
    identity,
  };
};

export const isSubscriptionMessage = (message) => /(?:free )?trial has ended|subscription (?:has )?(?:expired|cancelled|suspended|inactive)|upgrade subscription/i.test(String(message || ""));

/**
 * Framework-independent notification state. Keeping this separate from the
 * toast library makes concurrent-error behaviour testable without a browser.
 */
export const createErrorNotifier = ({ showError, dismiss, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout } = {}) => {
  const active = new Map();
  const globalConditions = new Map();
  const recentByMessage = new Map();
  let localSequence = 0;

  const release = (identity) => {
    const entry = active.get(identity);
    if (!entry) return;
    if (entry.timer) cancel(entry.timer);
    active.delete(identity);
  };

  const remember = (error, options = {}) => {
    const metadata = getErrorMetadata(error, options);
    const message = options.message || error?.userMessage || getPayload(error)?.message || error?.message || "Something went wrong. Please try again.";
    const key = messageKey(message);
    if (key) {
      const recent = (recentByMessage.get(key) || []).filter((entry) => now() - entry.at < 1500);
      recent.push({ identity: metadata.identity, metadata, at: now() });
      recentByMessage.set(key, recent.slice(-8));
    }
    return { metadata, message };
  };

  const activateGlobalCondition = (error, options = {}) => {
    const record = remember(error, options);
    if (record.metadata.global) globalConditions.set(record.metadata.identity, record);
    return record;
  };

  const resolveGlobalCondition = (code) => {
    const normalizedCode = normalizePart(code);
    for (const [identity, condition] of globalConditions) {
      if (!normalizedCode || condition.metadata.code === normalizedCode) globalConditions.delete(identity);
    }
  };

  const isSuppressedByGlobalCondition = (message, metadata, allowGlobalIdentity) => {
    if (metadata?.global && !allowGlobalIdentity) return true;
    for (const condition of globalConditions.values()) {
      if (allowGlobalIdentity && condition.metadata.identity === metadata?.identity) continue;
      if (condition.metadata.global && isSubscriptionMessage(message)) return true;
      if (condition.metadata.code === "NETWORK_UNAVAILABLE") return true;
      if (condition.metadata.code === "AUTH_SESSION_EXPIRED" && /session|refresh token|sign in|login/i.test(String(message || ""))) return true;
    }
    return false;
  };

  const identityForMessage = (message, context) => {
    const remembered = (recentByMessage.get(messageKey(message)) || []).filter((entry) => now() - entry.at < 1500);
    const unique = [...new Map(remembered.map((entry) => [entry.identity, entry.metadata])).values()];
    // A plain toast.error call can safely inherit a request identity only when
    // every recent API error with that exact message is the same error. This
    // prevents two unrelated endpoints that happen to use identical text from
    // being collapsed together.
    if (unique.length === 1) return unique[0];
    return {
      code: "LOCAL_ERROR",
      identity: `local:${normalizePart(context) || "DEFAULT"}:${messageKey(message) || "UNKNOWN"}:${++localSequence}`,
      global: false,
      dedupe: false,
    };
  };

  const notifyError = (errorOrMessage, { fallback, context = "", global = false, allowGlobalIdentity = false, toastOptions = {} } = {}) => {
    const isErrorObject = errorOrMessage && typeof errorOrMessage === "object" && !(errorOrMessage instanceof String);
    const message = isErrorObject
      ? (errorOrMessage.userMessage || getPayload(errorOrMessage)?.message || fallback || "Something went wrong. Please try again.")
      : (String(errorOrMessage || fallback || "Something went wrong. Please try again."));
    const metadata = isErrorObject ? remember(errorOrMessage, { context, message, global }).metadata : identityForMessage(message, context);
    if (isSuppressedByGlobalCondition(message, metadata, allowGlobalIdentity)) return null;

    const identity = toastOptions.id || metadata.identity;
    if (active.has(identity)) return identity;
    const duration = Number.isFinite(toastOptions.duration) ? toastOptions.duration : 4000;
    const timer = duration > 0 && duration !== Infinity
      ? schedule(() => release(identity), duration + 1000)
      : null;
    active.set(identity, { timer });
    showError?.(message, { ...toastOptions, id: identity });
    return identity;
  };

  const dismissError = (identity) => {
    dismiss?.(identity);
    release(identity);
  };

  return {
    activateGlobalCondition,
    dismissError,
    getErrorMetadata: remember,
    notifyError,
    resolveGlobalCondition,
    activeCount: () => active.size,
    globalConditionCount: () => globalConditions.size,
  };
};
