const unsafeMessage = (value) => {
  if (typeof value !== "string") return true;
  const message = value.trim();
  return !message || message.length > 240 || /<\/?[a-z][\s\S]*>/i.test(message) || /\n\s*at\s|stack trace|axioserror|request failed with status|e11000|^error:/i.test(message);
};

/** Returns a concise, user-safe message for API feedback. */
export const getApiErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  const responseMessage = error?.response?.data?.message;
  const directMessage = error?.userMessage || error?.message;
  const candidate = !unsafeMessage(responseMessage) ? responseMessage : !unsafeMessage(directMessage) ? directMessage : "";

  if (/network error|failed to fetch|network request failed/i.test(candidate)) {
    return "Unable to connect. Check your connection and try again.";
  }

  return candidate || fallback;
};

export default getApiErrorMessage;
