export const registerPWAServiceWorker = () => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      // Detect a deployed update without forcing a refresh during a payment or order workflow.
      registration.update().catch(() => {});
    } catch {
      // Installation support must never affect login, billing, or API traffic.
    }
  };

  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => { void register(); }, { once: true });
};