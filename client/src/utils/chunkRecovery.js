const RECOVERY_KEY = "restosphere:chunk-recovery";

const storage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const isChunkLoadError = (error) => {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("failed to fetch dynamically imported module")
    || message.includes("importing a module script failed")
    || message.includes("chunkloaderror")
    || message.includes("loading chunk");
};

export const markChunkRecoveryAttempt = () => {
  const session = storage();
  if (!session || session.getItem(RECOVERY_KEY)) return false;
  session.setItem(RECOVERY_KEY, "1");
  return true;
};

export const clearChunkRecoveryAttempt = () => {
  storage()?.removeItem(RECOVERY_KEY);
};
