export const registerPWAServiceWorker = () => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "redundant") {
            console.error("RestoSphere service worker installation became redundant.", { category: "PWA_SW_INSTALL_FAILURE" });
          }
        });
      });
      // Detect a deployed update without forcing a refresh during a payment or order workflow.
      registration.update().catch((error) => console.warn("RestoSphere service-worker update check failed.", error));
    } catch (error) {
      // Installation support must never affect login, billing, or API traffic.
      console.warn("RestoSphere service worker could not be registered.", error);
    }
  };

  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => { void register(); }, { once: true });
};
