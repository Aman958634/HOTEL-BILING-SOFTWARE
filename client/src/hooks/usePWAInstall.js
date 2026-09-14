import { useCallback, useEffect, useState } from "react";

const standaloneMode = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
const iosDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};
const iosSafari = () => iosDevice() && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(navigator.userAgent);

const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(standaloneMode);
  const [isPrompting, setIsPrompting] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      if (standaloneMode()) return;
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
      setShowIOSInstructions(false);
    };
    const onDisplayModeChange = (event) => {
      const isStandalone = event.matches || window.navigator.standalone === true;
      setInstalled(isStandalone);
      if (isStandalone) setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayMode?.addEventListener?.("change", onDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const requestInstall = useCallback(async () => {
    if (installed || isPrompting) return;
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      setIsPrompting(true);
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === "accepted" && standaloneMode()) setInstalled(true);
      } catch (error) {
        console.warn("RestoSphere install prompt could not be opened.", error);
      } finally {
        setDeferredPrompt((currentPrompt) => currentPrompt === prompt ? null : currentPrompt);
        setIsPrompting(false);
      }
      return;
    }
    if (iosSafari()) setShowIOSInstructions(true);
  }, [deferredPrompt, installed, isPrompting]);

  return {
    installed,
    isPrompting,
    showInstallAction: !installed && (Boolean(deferredPrompt) || iosSafari()),
    requestInstall,
    showIOSInstructions,
    closeInstallHelp: () => setShowIOSInstructions(false),
  };
};

export default usePWAInstall;