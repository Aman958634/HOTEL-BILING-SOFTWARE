import { FiGlobe } from "react-icons/fi";
import { SUPPORTED_LANGUAGES, useLanguage } from "../../i18n/LanguageContext";

const LanguageSelector = ({ compact = false }) => {
  const { language, setLanguage, t } = useLanguage();
  const labels = {
    en: t("language.english"),
    hi: t("language.hindi"),
    gu: t("language.gujarati"),
  };

  return (
    <label className={`language-selector${compact ? " language-selector--compact" : ""}`}>
      <FiGlobe aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select aria-label={t("language.label")} value={language} onChange={(event) => setLanguage(event.target.value)}>
        {SUPPORTED_LANGUAGES.map((option) => <option key={option} value={option}>{labels[option]}</option>)}
      </select>
    </label>
  );
};

export default LanguageSelector;
