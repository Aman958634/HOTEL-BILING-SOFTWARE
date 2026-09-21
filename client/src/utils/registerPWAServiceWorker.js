const UPDATE_RELOAD_KEY = "restosphere:pwa-update-reload:v1";
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

const session = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const hasPaymentInProgress = () => {
  const path = window.location.pathname.toLowerCase();
  // Cashfree uses a same-window redirect. Do not reload while its callback is
  // resolving, and keep the dedicated subscription checkout route stable.
  if (path.includes("/payment/cashfree/return") || path === "/subscribe/checkout") return true;

  // Razorpay is rendered in an iframe/modal. The DOM check covers both the
  // public subscription checkout and the existing operational-payment UI
  // without changing either payment implementation.
  return Boolean(
    document.querySelector(
      ".razorpay-container, iframe[src*='razorpay'], iframe[src*='cashfree'], [data-cashfree-checkout]"
    )
  );
};

const reloadWhenSafe = () => {
  const storage = session();
  if (!storage?.getItem(UPDATE_RELOAD_KEY)) return;

  const attemptReload = () => {
    if (hasPaymentInProgress()) {
      window.setTimeout(attemptReload, 2000);
      return;
    }
    // Remove the marker before reloading. A controller change can only cause
    // one refresh, so a bad deployment never creates a reload loop.
    storage.removeItem(UPDATE_RELOAD_KEY);
    window.location.reload();
  };

  attemptReload();
};

const activateWhenSafe = (registration) => {
  const waiting = registration.waiting;
  if (!waiting) return;

  const requestActivation = () => {
    if (registration.waiting !== waiting) return;
    if (hasPaymentInProgress()) {
      window.setTimeout(requestActivation, 2000);
      return;
    }
    const storage = session();
    if (storage) storage.setItem(UPDATE_RELOAD_KEY, "1");
    waiting.postMessage({ type: "RESTOSPHERE_SKIP_WAITING" });
  };

  requestActivation();
};

export const registerPWAServiceWorker = () => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const register = async () => {
    try {
      // `none` makes every deploy's sw.js and imported update bridge bypass
      // the browser HTTP cache, while Vite's hashed JS/CSS remain immutable.
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });

      const inspectForUpdate = () => activateWhenSafe(registration);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed") inspectForUpdate();
          if (installing.state === "redundant") {
            console.error("RestoSphere service worker installation became redundant.", { category: "PWA_SW_INSTALL_FAILURE" });
          }
        });
      });
      inspectForUpdate();

      navigator.serviceWorker.addEventListener("controllerchange", reloadWhenSafe);
      reloadWhenSafe();

      const checkForUpdate = () => registration.update().catch((error) => {
        console.warn("RestoSphere service worker update check failed.", error);
      });
      checkForUpdate();
      window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
    } catch (error) {
      // Registration must never affect installation, authentication, or API traffic.
      console.warn("RestoSphere service worker could not be registered.", error);
    }
  };

  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => { void register(); }, { once: true });
};
