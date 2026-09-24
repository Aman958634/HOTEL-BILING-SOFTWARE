import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import en from "./locales/en";
import hi from "./locales/hi";
import gu from "./locales/gu";

export const SUPPORTED_LANGUAGES = ["en", "hi", "gu"];
const LANGUAGE_STORAGE_PREFIX = "restosphere.language";
const translations = { en, hi, gu };
const LanguageContext = createContext(null);

const getStorageKey = (userId) => `${LANGUAGE_STORAGE_PREFIX}.${userId || "anonymous"}`;

const readLanguage = (userId) => {
  try {
    const stored = localStorage.getItem(getStorageKey(userId)) || localStorage.getItem(`${LANGUAGE_STORAGE_PREFIX}.anonymous`);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : "en";
  } catch {
    return "en";
  }
};

const resolvePath = (source, path) => path.split(".").reduce((value, part) => value?.[part], source);

export const LanguageProvider = ({ children }) => {
  const user = useSelector((state) => state.auth.user);
  const userId = user?._id || user?.id || user?.email || "anonymous";
  const [language, setLanguageState] = useState(() => readLanguage(userId));

  useEffect(() => {
    setLanguageState(readLanguage(userId));
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(userId), language);
    } catch {
      // Language selection remains available for the current session.
    }
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
  }, [language, userId]);

  const setLanguage = (nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
    setLanguageState(nextLanguage);
  };

  const value = useMemo(() => {
    const locale = translations[language] || en;
    const t = (key, fallback = key) => resolvePath(locale, key) ?? resolvePath(en, key) ?? fallback;
    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
};
