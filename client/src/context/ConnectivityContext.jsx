import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../services/api";

const ConnectivityContext = createContext({ state: "online", lastOnlineAt: null, retry: () => {} });

const isNetworkError = (detail) => !detail?.hasResponse;

export const ConnectivityProvider = ({ children }) => {
  const [state, setState] = useState(() => (navigator.onLine ? "reconnecting" : "offline"));
  const [lastOnlineAt, setLastOnlineAt] = useState(null);
  const checkInFlight = useRef(null);
  const retryTimer = useRef(null);
  const retryDelay = useRef(1000);

  const checkReachability = useCallback(() => {
    if (!navigator.onLine || checkInFlight.current) return checkInFlight.current;
    setState("reconnecting");
    checkInFlight.current = api.get("/health", { timeout: 5000, _connectivityProbe: true })
      .then(() => {
        retryDelay.current = 1000;
        setLastOnlineAt(Date.now());
        setState("online");
      })
      .catch(() => {
        setState("offline");
        const delay = retryDelay.current;
        retryDelay.current = Math.min(delay * 2, 30000);
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = null;
          checkReachability();
        }, delay);
      })
      .finally(() => {
        checkInFlight.current = null;
      });
    return checkInFlight.current;
  }, []);

  useEffect(() => {
    const onBrowserOffline = () => {
      setState("offline");
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
    const onBrowserOnline = () => {
      retryDelay.current = 1000;
      checkReachability();
    };
    const onApiReachability = (event) => {
      if (event.detail?.ok) {
        retryDelay.current = 1000;
        setLastOnlineAt(Date.now());
        setState("online");
      } else if (isNetworkError(event.detail)) {
        setState("offline");
        checkReachability();
      }
    };
    const onSocketState = (event) => {
      if (event.detail?.state === "reconnecting" && navigator.onLine) setState("reconnecting");
    };

    window.addEventListener("offline", onBrowserOffline);
    window.addEventListener("online", onBrowserOnline);
    window.addEventListener("restosphere:api-reachability", onApiReachability);
    window.addEventListener("restosphere:socket-state", onSocketState);
    checkReachability();
    return () => {
      window.removeEventListener("offline", onBrowserOffline);
      window.removeEventListener("online", onBrowserOnline);
      window.removeEventListener("restosphere:api-reachability", onApiReachability);
      window.removeEventListener("restosphere:socket-state", onSocketState);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
  }, [checkReachability]);

  return <ConnectivityContext.Provider value={{ state, lastOnlineAt, retry: checkReachability }}>{children}</ConnectivityContext.Provider>;
};

export const useConnectivity = () => useContext(ConnectivityContext);
