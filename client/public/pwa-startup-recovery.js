(function () {
  "use strict";

  var RECOVERY_KEY = "restosphere:pwa-shell-recovery:v1";
  var APP_CACHE = /^(workbox-precache|workbox-runtime|restosphere-)/;

  var storage = function () {
    try { return window.sessionStorage; } catch (_error) { return null; }
  };

  var paymentIsActive = function () {
    var path = String(window.location.pathname || "").toLowerCase();
    if (path.indexOf("/payment/cashfree/return") !== -1 || path === "/subscribe/checkout") return true;
    return Boolean(document.querySelector(".razorpay-container, iframe[src*='razorpay'], iframe[src*='cashfree'], [data-cashfree-checkout]"));
  };

  var canRecover = function () {
    try {
      var session = storage();
      if (!session || navigator.onLine === false || paymentIsActive() || session.getItem(RECOVERY_KEY)) return false;
      session.setItem(RECOVERY_KEY, "1");
      return true;
    } catch (_error) {
      return false;
    }
  };

  var clearRecoveryAttempt = function () {
    try {
      var session = storage();
      if (session) session.removeItem(RECOVERY_KEY);
    } catch (_error) {
      // Storage is optional for recovery; never turn a reset action into a crash.
    }
  };

  var ownsRootScope = function (registration) {
    try {
      var scope = new URL(registration.scope);
      return scope.origin === window.location.origin && scope.pathname === "/";
    } catch (_error) {
      return false;
    }
  };

  var clearStalePwaState = async function () {
    var tasks = [];
    if (navigator.serviceWorker) {
      tasks.push(navigator.serviceWorker.getRegistrations().then(function (registrations) {
        return Promise.all(registrations.filter(ownsRootScope).map(function (registration) {
          return registration.unregister();
        }));
      }));
    }
    var cacheStorage = window.caches;
    if (cacheStorage) {
      tasks.push(cacheStorage.keys().then(function (keys) {
        return Promise.all(keys.filter(function (key) { return APP_CACHE.test(key); }).map(function (key) {
          return cacheStorage.delete(key);
        }));
      }));
    }
    await Promise.all(tasks.map(function (task) { return Promise.resolve(task).catch(function () {}); }));
  };

  var recover = function (reason) {
    if (!canRecover()) return false;
    console.error("RestoSphere PWA app-shell recovery started.", { category: "PWA_APP_SHELL_RECOVERY", reason: String(reason || "asset-load-failure") });
    clearStalePwaState().finally(function () { window.location.reload(); });
    return true;
  };

  window.__restosphereRecoverPwaShell = recover;
  window.__restosphereClearPwaShellRecovery = clearRecoveryAttempt;

  // This runs before the React module. It can recover when an old cached HTML
  // document references a deployment bundle that no longer exists.
  window.addEventListener("error", function (event) {
    var target = event.target;
    if (target && target.tagName === "SCRIPT" && target.type === "module") recover("entry-module-load");
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    var message = String(event.reason && (event.reason.message || event.reason) || "").toLowerCase();
    if (message.indexOf("failed to fetch dynamically imported module") !== -1 || message.indexOf("importing a module script failed") !== -1 || message.indexOf("chunkloaderror") !== -1 || message.indexOf("loading chunk") !== -1) {
      recover("lazy-module-load");
    }
  });
}());
