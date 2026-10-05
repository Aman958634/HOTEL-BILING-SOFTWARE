import { FiCoffee, FiFileText, FiShoppingBag } from "react-icons/fi";

const CutleryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3v7M9 3v7M3 3v4a3 3 0 0 0 6 0V3M6 10v11" />
    <path d="M17 3c-2.2 2.4-2.6 5.5-1.3 8.1L18 15v6M18 3v12" />
  </svg>
);

const AppLoader = () => (
  <main className="app-loader" role="status" aria-live="polite" aria-label="Preparing your restaurant dashboard">
    <span className="app-loader__decor app-loader__decor--leaf" aria-hidden="true" />
    <span className="app-loader__decor app-loader__decor--tomato" aria-hidden="true" />
    <span className="app-loader__decor app-loader__decor--dots" aria-hidden="true" />

    <div className="app-loader__content">
      <div className="app-loader__visual" aria-hidden="true">
        <span className="app-loader__bubble app-loader__bubble--coffee"><FiCoffee /></span>
        <span className="app-loader__bubble app-loader__bubble--order"><FiFileText /></span>
        <span className="app-loader__bubble app-loader__bubble--bag"><FiShoppingBag /></span>
        <span className="app-loader__bubble app-loader__bubble--cutlery"><CutleryIcon /></span>

        <svg className="app-loader__ring" viewBox="0 0 260 260" fill="none">
          <circle className="app-loader__ring-track" cx="130" cy="130" r="110" />
          <circle className="app-loader__ring-progress" cx="130" cy="130" r="110" />
        </svg>

        <div className="app-loader__dish">
          <svg viewBox="0 0 180 160" fill="none" aria-hidden="true">
            <path className="app-loader__steam" d="M67 48c-8-9 4-15-1-24M91 43c-8-9 4-15-1-24M116 48c-8-9 4-15-1-24" />
            <path className="app-loader__cloche" d="M43 98c2-28 21-48 47-48s45 20 47 48H43Z" />
            <path className="app-loader__cloche-highlight" d="M65 77c8-13 18-20 30-20" />
            <circle className="app-loader__cloche-knob" cx="90" cy="47" r="5" />
            <path className="app-loader__plate" d="M30 105h120c0 12-15 22-60 22s-60-10-60-22Z" />
            <path className="app-loader__plate-line" d="M45 133h90" />
            <path className="app-loader__food" d="M72 96c3-9 11-14 18-14s15 5 18 14" />
          </svg>
        </div>
      </div>

      <div className="app-loader__copy">
        <p className="app-loader__brand"><span>Resto</span><strong>Sphere</strong></p>
        <p className="app-loader__message">Preparing your restaurant dashboard...</p>
        <div className="app-loader__progress" aria-hidden="true"><span /></div>
        <div className="app-loader__dots" aria-hidden="true"><i /><i /><i /></div>
      </div>

      <p className="app-loader__tip"><span aria-hidden="true">💡</span> Good food takes a little time. Thanks for waiting!</p>
    </div>
  </main>
);

export default AppLoader;
