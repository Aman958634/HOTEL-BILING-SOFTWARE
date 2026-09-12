import { useCallback, useEffect, useState } from "react";

const standaloneMode = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
const iosDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(standaloneMode);
  const [isPrompting, setIsPrompting] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showUnsupportedMessage, setShowUnsupportedMessage] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
      setShowIOSInstructions(false);
      setShowUnsupportedMessage(false);
    };
    const onDisplayModeChange = (event) => setInstalled(event.matches || window.navigator.standalone === true);

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
      setIsPrompting(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === "accepted") setInstalled(true);
      } finally {
        setDeferredPrompt(null);
        setIsPrompting(false);
      }
      return;
    }
    if (iosDevice()) {
      setShowIOSInstructions(true);
      return;
    }
    setShowUnsupportedMessage(true);
  }, [deferredPrompt, installed, isPrompting]);

  return {
    installed,
    isPrompting,
    requestInstall,
    showIOSInstructions,
    showUnsupportedMessage,
    closeInstallHelp: () => {
      setShowIOSInstructions(false);
      setShowUnsupportedMessage(false);
    },
  };
};

export default usePWAInstall;