import toast from "react-hot-toast";
import { getApiErrorMessage } from "../utils/apiError";
import { createErrorNotifier, getErrorMetadata } from "../utils/errorNotifications";

const rawToastError = toast.error.bind(toast);
const rawToastDismiss = toast.dismiss.bind(toast);
const notifier = createErrorNotifier({
  showError: rawToastError,
  dismiss: rawToastDismiss,
});

/** Records an API error before components decide whether to show local UI. */
export const observeApiError = (error, options = {}) => {
  if (!error?.userMessage) error.userMessage = getApiErrorMessage(error, options.fallback);
  const record = notifier.getErrorMetadata(error, { ...options, message: error.userMessage });
  error.notificationIdentity = record.metadata.identity;
  error.notificationCode = record.metadata.code;
  return record.metadata;
};

/** Global subscription failures are represented by the blocking modal, never a toast. */
export const activateGlobalErrorCondition = (error, options = {}) => notifier.activateGlobalCondition(error, {
  ...options,
  message: error?.userMessage || getApiErrorMessage(error),
});

/** One toast for global auth/network failures; later reports are suppressed. */
export const reportGlobalError = (error, options = {}) => {
  activateGlobalErrorCondition(error, { ...options, global: true });
  return notifier.notifyError(error, { ...options, global: true, allowGlobalIdentity: true });
};

export const resolveGlobalErrorCondition = (code) => notifier.resolveGlobalCondition(code);

export const notifyError = (errorOrMessage, options = {}) => notifier.notifyError(errorOrMessage, options);

export const dismissErrorNotification = (identity) => notifier.dismissError(identity);

/**
 * Compatibility bridge for existing component-level toast.error calls. API
 * errors retain their interceptor-derived identity; non-API messages remain
 * local to their context. Success, warning, and informational toasts are not
 * changed.
 */
export const installErrorToastBridge = () => {
  if (toast.__restosphereErrorNotifierInstalled) return;
  Object.defineProperty(toast, "__restosphereErrorNotifierInstalled", { value: true, configurable: true });
  toast.error = (message, options = {}) => notifyError(message, { toastOptions: options });
  toast.dismiss = (id) => notifier.dismissError(id);
};

installErrorToastBridge();

export { getErrorMetadata };
