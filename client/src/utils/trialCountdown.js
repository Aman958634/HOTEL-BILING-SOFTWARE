const asTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

/** Uses a server timestamp captured with the entitlement response, never a new trial end date. */
export const getServerClockOffset = (serverTime, clientNow = Date.now()) => {
  const serverNow = asTimestamp(serverTime);
  return serverNow ? serverNow - clientNow : 0;
};

/** Returns a clamped, exact breakdown of trialEndsAt minus server-relative current time. */
export const getTrialCountdown = (trialEndsAt, clockOffset = 0, clientNow = Date.now()) => {
  const remainingMs = Math.max(0, asTimestamp(trialEndsAt) - (clientNow + clockOffset));
  const seconds = Math.floor(remainingMs / 1000);
  return {
    remainingMs,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
};