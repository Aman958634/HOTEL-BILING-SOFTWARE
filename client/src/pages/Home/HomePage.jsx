import { Link } from "react-router-dom";
import { FiCheck, FiRadio, FiShield } from "react-icons/fi";
import { useLanguage } from "../../i18n/LanguageContext";

const HomePage = () => {
  const { t } = useLanguage();
  const featureKeys = ["menu", "orders", "tables", "kitchen", "inventory", "reports"];

  return (
  <div className="landing-page space-y-16">
    <section className="landing-hero relative isolate overflow-hidden text-center">
      <div className="hero-ambient hero-ambient-left" aria-hidden="true" />
      <div className="hero-ambient hero-ambient-right" aria-hidden="true" />
      <div className="hero-ambient hero-ambient-ring" aria-hidden="true" />
      <div className="landing-hero-content relative z-10 animate-fade-in-up">
        <div className="hero-badge inline-flex items-center gap-2 rounded-full">
          ⭐ {t("home.badge")}
        </div>

        <div className="hero-copy">
          <h1 className="hero-title text-slate-950">
            {t("home.heroTitleBefore")} <span className="hero-title-highlight text-brand-700">{t("home.heroTitleHighlight")}</span>{t("home.heroTitleAfter") ? ` ${t("home.heroTitleAfter")}` : ""}
          </h1>
          <p className="hero-description mx-auto max-w-2xl text-lg leading-8 text-slate-600">
            {t("home.heroDescription")}
          </p>
        </div>

        <div className="hero-ctas flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/pricing"
            className="hero-primary-action inline-flex items-center justify-center rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-brand-800"
          >
            {t("home.viewPricing")}
          </Link>
          <Link
            to="/login"
            className="hero-secondary-action inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-slate-900 transition duration-200"
          >
            {t("header.login")}
          </Link>
        </div>

        <div className="hero-feature-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="hero-feature-card transition">
            <span className="hero-feature-icon" aria-hidden="true"><FiCheck /></span>
            <div><p className="text-sm font-semibold text-slate-900">{t("home.easyToUse")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("home.intuitiveInterface")}</p></div>
          </div>
          <div className="hero-feature-card transition">
            <span className="hero-feature-icon" aria-hidden="true"><FiRadio /></span>
            <div><p className="text-sm font-semibold text-slate-900">{t("home.realtimeUpdates")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("home.liveSynchronization")}</p></div>
          </div>
          <div className="hero-feature-card transition">
            <span className="hero-feature-icon" aria-hidden="true"><FiShield /></span>
            <div><p className="text-sm font-semibold text-slate-900">{t("home.secureReliable")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("home.uptime")}</p></div>
          </div>
        </div>
      </div>
    </section>

    <section className="space-y-8">
      <div className="space-y-3 text-center">
        <p className="landing-eyebrow text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">{t("home.eyebrow")}</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{t("home.sectionTitle")}</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {featureKeys.map((featureKey) => {
          const feature = t(`home.features.${featureKey}`);
          return <article key={featureKey} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-brand-700">✓</div>
            <h3 className="text-xl font-semibold text-slate-900">{feature[0]}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{feature[1]}</p>
          </article>;
        })}
      </div>
    </section>

    <footer className="rounded-[32px] bg-slate-950 px-6 py-5 text-slate-200 shadow-sm sm:px-8">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-lg font-bold text-white sm:text-xl">RestoSphere</p>
          <p className="mt-0.5 text-sm text-slate-400">{t("home.footerTagline")}</p>
          <p className="mt-1 text-sm text-slate-400">{t("home.operatedBy")}</p>
        </div>
        <p className="shrink-0 text-center text-sm text-slate-500 sm:text-right">
          {t("home.copyright")}
        </p>
      </div>
    </footer>
  </div>
  );
};

export default HomePage;
