import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { createSettlementVendor, getRestaurantSettings, getSettlementProfile, getSettlementSplitSummary, refreshSettlementVendor, refreshSettlementSplit, updateRestaurantSettings } from "../../services/restaurantService";
import { getHotelPaymentSettings, saveHotelPaymentSettings } from "../../services/hotelPaymentService";
import ToggleSwitch from "../../components/common/ToggleSwitch";
import { FiSettings } from "react-icons/fi";
import ModuleIcon from "../../components/common/ModuleIcon";
import LanguageSelector from "../../components/common/LanguageSelector";
import { useLanguage } from "../../i18n/LanguageContext";

const defaultSettings = {
  name: "",
  branchCode: "",
  slug: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  gstNumber: "",
  openingHours: "09:00-23:00",
  logoUrl: "",
  website: "",
  isActive: true,
  reservationsEnabled: true,
  onlineOrdersEnabled: true,
};

const getSettingsErrorMessage = (error, fallback) => {
  if (!error?.response) {
    return "Unable to connect to the server.";
  }
  const status = error.response.status;
  const serverMessage = error.response.data?.message;
  if (serverMessage) return serverMessage;
  if (status === 401) return "Session expired. Please log in again.";
  if (status === 403) return "You do not have permission to access these settings.";
  if (status === 404) return "Settings not found.";
  if (status === 503) return "Database temporarily unavailable. Please try again.";
  return fallback;
};

const toSavePayload = (settings) => {
  const {
    name,
    branchCode,
    slug,
    email,
    phone,
    address,
    city,
    gstNumber,
    openingHours,
    logoUrl,
    website,
    isActive,
    reservationsEnabled,
    onlineOrdersEnabled,
  } = settings;
  return {
    name,
    branchCode,
    slug,
    email,
    phone,
    address,
    city,
    gstNumber,
    openingHours,
    logoUrl,
    website,
    isActive,
    reservationsEnabled,
    onlineOrdersEnabled,
  };
};

const getPublicMenuUrl = (slug) => {
  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug || typeof window === "undefined") return "";
  return `${window.location.origin}/menu/${encodeURIComponent(normalizedSlug)}`;
};

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const hex = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
  return `${hex()}-${hex().slice(0, 4)}-4${hex().slice(1, 4)}-8${hex().slice(1, 4)}-${hex()}${hex().slice(0, 4)}`;
};

const canManageHotelUpi = (user) => ["admin", "hotel_admin", "restaurant_admin", "super_admin"].includes(String(user?.role || "").toLowerCase());

const hotelUpiState = (settings, capability, loaded) => {
  if (!loaded) return { configuration: "NOT CONFIGURED", activation: "NOT CONFIGURED", reason: "Loading Hotel UPI configuration." };
  const configured = Boolean(String(settings?.payeeName || "").trim() && /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(String(settings?.upiId || "").trim()));
  if (!configured) return { configuration: "NOT CONFIGURED", activation: "NOT CONFIGURED", reason: capability?.reason || "Configure a payee name and valid UPI ID." };
  if (!capability?.canCollect) return { configuration: "CONFIGURED", activation: "DISABLED", reason: capability?.reason || "Hotel UPI collection is unavailable for this deployment." };
  return { configuration: "CONFIGURED", activation: "READY FOR USE", reason: "" };
};

const SettlementForm = ({ onSubmit }) => {
  const [method, setMethod] = useState("BANK");
  const [form, setForm] = useState({ phone: "", email: "", accountType: "Proprietorship", pan: "", accountHolderName: "", accountNumber: "", confirmAccountNumber: "", ifsc: "", upiVpa: "", settlementCycle: "T+1" });
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <form className="mt-5 space-y-4 rounded-xl border border-slate-200 p-4" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, method }); }}>
      <div className="flex flex-wrap gap-2">
        {["BANK", "UPI"].map((value) => <button key={value} type="button" onClick={() => setMethod(value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${method === value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700"}`}>{value === "BANK" ? "Bank Account" : "UPI VPA"}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required type="tel" placeholder="Vendor phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm" />
        <input required type="email" placeholder="Vendor email" value={form.email} onChange={(event) => update("email", event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm" />
        <select value={form.accountType} onChange={(event) => update("accountType", event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm"><option value="Proprietorship">Proprietorship</option><option value="Individual">Individual</option><option value="Limited Liability Partnership (LLP)">LLP</option><option value="Private Ltd or Public Ltd">Private/Public Ltd</option></select>
        <input required placeholder="PAN" value={form.pan} onChange={(event) => update("pan", event.target.value.toUpperCase())} className="rounded-xl border border-slate-300 p-3 text-sm" />
        {method === "BANK" ? <>
          <input required placeholder="Account holder name" value={form.accountHolderName} onChange={(event) => update("accountHolderName", event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm" />
          <input required inputMode="numeric" placeholder="Account number" value={form.accountNumber} onChange={(event) => update("accountNumber", event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm" />
          <input required inputMode="numeric" placeholder="Confirm account number" value={form.confirmAccountNumber} onChange={(event) => update("confirmAccountNumber", event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm" />
          <input required placeholder="IFSC code" value={form.ifsc} onChange={(event) => update("ifsc", event.target.value.toUpperCase())} className="rounded-xl border border-slate-300 p-3 text-sm" />
        </> : <input required placeholder="UPI VPA" value={form.upiVpa} onChange={(event) => update("upiVpa", event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm sm:col-span-2" />}
        <select value={form.settlementCycle} onChange={(event) => update("settlementCycle", event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm sm:col-span-2"><option value="T+1">T+1 at 11:00 AM</option><option value="T+2">T+2 at 11:00 AM</option><option value="WEEKLY">Weekly Every 1st working day</option><option value="MONTHLY">Monthly Every 1st working day</option></select>
      </div>
      <button type="submit" className="min-h-11 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Verify & Add Settlement Account</button>
    </form>
  );
};

const Settings = () => {
  const { t } = useLanguage();
  const user = useSelector((state) => state.auth.user);
  const [settings, setSettings] = useState(defaultSettings);
  const [hotelPaymentSettings, setHotelPaymentSettings] = useState({ hotelId: "", restaurant: "", outlet: "", payeeName: "", upiId: "", isEnabled: false, status: "DISABLED", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingHotelPayment, setSavingHotelPayment] = useState(false);
  const [hotelPaymentReady, setHotelPaymentReady] = useState(false);
  const [hotelPaymentCapability, setHotelPaymentCapability] = useState({ canCollect: false, canEnable: false, reason: "Checking backend Hotel UPI capability." });
  const [hotelPaymentLoading, setHotelPaymentLoading] = useState(true);
  const [hotelPaymentError, setHotelPaymentError] = useState("");
  const [settlement, setSettlement] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(true);
  const [settlementSplits, setSettlementSplits] = useState(null);
  const publicMenuUrl = getPublicMenuUrl(settings.slug);
  const hotelPaymentState = hotelUpiState(hotelPaymentSettings, hotelPaymentCapability, hotelPaymentReady);
  const hotelUpiAdmin = canManageHotelUpi(user);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await getRestaurantSettings();
      setSettings({ ...defaultSettings, ...(data.data || {}) });
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, "Unable to load restaurant settings"));
    } finally {
      setLoading(false);
    }
  };

  const loadHotelPaymentSettings = async () => {
    setHotelPaymentLoading(true);
    setHotelPaymentError("");
    try {
      const { data } = await getHotelPaymentSettings();
      setHotelPaymentSettings({
        hotelId: data?.data?.settings?.hotelId || "",
        restaurant: data?.data?.settings?.restaurant || "",
        outlet: data?.data?.settings?.outlet || "",
        payeeName: data?.data?.settings?.payeeName || "",
        upiId: data?.data?.settings?.upiId || "",
        isEnabled: Boolean(data?.data?.settings?.isEnabled),
        status: data?.data?.settings?.status || "DISABLED",
        notes: data?.data?.settings?.notes || "",
      });
      setHotelPaymentCapability(data?.data?.capability || {
        canCollect: false,
        canEnable: false,
        reason: "The backend does not report Hotel UPI deployment capability. Deploy the compatible backend release first.",
      });
      setHotelPaymentReady(true);
    } catch (error) {
      setHotelPaymentReady(false);
      setHotelPaymentCapability({ canCollect: false, canEnable: false, reason: "Hotel UPI capability could not be confirmed by the backend." });
      setHotelPaymentError(error?.response?.data?.message || "Unable to load Hotel UPI settings");
    }
    finally {
      setHotelPaymentLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadHotelPaymentSettings();
    getSettlementProfile().then(({ data }) => setSettlement(data.data)).catch(() => setSettlement(null)).finally(() => setSettlementLoading(false));
    getSettlementSplitSummary().then(({ data }) => setSettlementSplits(data.data)).catch(() => setSettlementSplits(null));
  }, []);

  const handleChange = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await updateRestaurantSettings(toSavePayload(settings));
      toast.success("Settings saved successfully");
      await loadSettings();
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, "Unable to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const copyPublicMenuUrl = async () => {
    if (!publicMenuUrl) return;
    try {
      await navigator.clipboard.writeText(publicMenuUrl);
      toast.success("Public menu link copied");
    } catch {
      toast.error("Unable to copy the public menu link");
    }
  };

  const handleHotelPaymentSubmit = async (event) => {
    event.preventDefault();
    if (!hotelUpiAdmin) return;
    if (!String(hotelPaymentSettings.payeeName || "").trim() || !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(String(hotelPaymentSettings.upiId || "").trim())) {
      toast.error("Enter a payee name and a valid UPI ID before saving Hotel UPI settings.");
      return;
    }
    setSavingHotelPayment(true);
    try {
      const { data } = await saveHotelPaymentSettings({
        payeeName: hotelPaymentSettings.payeeName,
        upiId: hotelPaymentSettings.upiId,
        isEnabled: hotelPaymentSettings.isEnabled,
        notes: hotelPaymentSettings.notes,
      });
      setHotelPaymentSettings((current) => ({ ...current, status: data?.data?.settings?.status || (current.isEnabled ? "ACTIVE" : "DISABLED") }));
      toast.success("Hotel payment settings saved");
      await loadHotelPaymentSettings();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to save hotel payment settings");
    } finally {
      setSavingHotelPayment(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900 sm:text-2xl"><ModuleIcon icon={<FiSettings />} module="settings" variant="header" />{t("settings.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.description")}</p>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div><h3 className="text-base font-semibold text-slate-900">{t("settings.languageTitle")}</h3><p className="mt-1 text-sm text-slate-500">{t("settings.languageDescription")}</p></div>
        <LanguageSelector />
      </section>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" aria-busy={loading || saving}>
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div><h3 className="text-lg font-semibold text-slate-900">{t("settings.information")}</h3><p className="mt-1 text-sm text-slate-500">{t("settings.informationDescription")}</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Restaurant Name</span>
              <input
                type="text"
                value={settings.name}
                onChange={(event) => handleChange("name", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Branch Code</span>
              <input
                type="text"
                value={settings.branchCode}
                onChange={(event) => handleChange("branchCode", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Slug</span>
              <input
                type="text"
                value={settings.slug}
                onChange={(event) => handleChange("slug", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Website</span>
              <input
                type="url"
                value={settings.website}
                onChange={(event) => handleChange("website", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                placeholder="https://example.com"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Email</span>
              <input
                type="email"
                value={settings.email}
                onChange={(event) => handleChange("email", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                placeholder="contact@restosphere.com"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Phone</span>
              <input
                type="tel"
                value={settings.phone}
                onChange={(event) => handleChange("phone", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                placeholder="1234567890"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span>Address</span>
              <input
                type="text"
                value={settings.address}
                onChange={(event) => handleChange("address", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>City</span>
              <input
                type="text"
                value={settings.city}
                onChange={(event) => handleChange("city", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>GST Number</span>
              <input
                type="text"
                value={settings.gstNumber}
                onChange={(event) => handleChange("gstNumber", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Opening Hours</span>
              <input
                type="text"
                value={settings.openingHours}
                onChange={(event) => handleChange("openingHours", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                placeholder="09:00-23:00"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span>Logo URL</span>
              <input
                type="url"
                value={settings.logoUrl}
                onChange={(event) => handleChange("logoUrl", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                placeholder="https://..."
              />
            </label>
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">{t("settings.operational")}</h2>
            <div className="space-y-4">
              <ToggleSwitch
                label="Restaurant Active"
                checked={Boolean(settings.isActive)}
                onChange={(value) => handleChange("isActive", value)}
              />
              <ToggleSwitch
                label="Online Orders"
                checked={Boolean(settings.onlineOrdersEnabled)}
                onChange={(value) => handleChange("onlineOrdersEnabled", value)}
              />
              <ToggleSwitch
                label="Reservations Enabled"
                checked={Boolean(settings.reservationsEnabled)}
                onChange={(value) => handleChange("reservationsEnabled", value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{t("settings.preview")}</h2>
            <div className="space-y-3 text-sm text-slate-600">
              <p><strong>Name:</strong> {settings.name || "Not set"}</p>
              <p><strong>Branch code:</strong> {settings.branchCode || "Not set"}</p>
              <p><strong>Status:</strong> {settings.isActive ? "Active" : "Inactive"}</p>
              <p><strong>Reservations:</strong> {settings.reservationsEnabled ? "Enabled" : "Disabled"}</p>
              <p><strong>Online orders:</strong> {settings.onlineOrdersEnabled ? "Enabled" : "Disabled"}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Public Menu Link</h2>
            {publicMenuUrl ? <>
              <p className="break-all text-sm text-slate-600">{publicMenuUrl}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyPublicMenuUrl} className="min-h-10 rounded-xl border border-brand-200 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">Copy Link</button>
                <a href={publicMenuUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-xl bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-800">Open Menu</a>
              </div>
              <p className="text-xs text-slate-500">Use table QR codes for table-specific ordering.</p>
            </> : <p className="text-sm text-slate-500">Save a restaurant slug to create its public menu link.</p>}
          </div>

          <button
            type="submit"
            disabled={saving || loading}
            className="min-h-12 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("settings.saving") : t("settings.saveChanges")}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Hotel-Owned UPI Payments</h3>
            <p className="mt-1 text-sm text-slate-500">Each hotel can receive customer order payments directly into its own UPI account. The platform subscription flow remains separate.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hotelPaymentState.activation === "READY FOR USE" ? "bg-emerald-100 text-emerald-800" : hotelPaymentState.activation === "NOT CONFIGURED" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"}`}>{hotelPaymentState.activation}</span>
        </div>
        <form onSubmit={handleHotelPaymentSubmit} className="mt-4 space-y-4" aria-busy={hotelPaymentLoading || savingHotelPayment}>
          {hotelPaymentLoading ? <div className="h-24 animate-pulse rounded-2xl bg-slate-100" aria-label="Loading Hotel UPI settings" /> : null}
          {hotelPaymentError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="font-semibold">Hotel UPI settings are unavailable</p><p className="mt-1">{hotelPaymentError}</p><button type="button" onClick={loadHotelPaymentSettings} className="mt-2 min-h-10 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold">Retry</button></div> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configuration</p><p className="mt-1 font-semibold text-slate-900">{hotelPaymentState.configuration}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hotel / restaurant scope</p><p className="mt-1 break-words font-semibold text-slate-900">{hotelPaymentSettings.restaurant ? "Restaurant-specific" : "Hotel-wide default"}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outlet scope</p><p className="mt-1 break-words font-semibold text-slate-900">{hotelPaymentSettings.outlet ? "Outlet-specific" : "Hotel-wide default"}</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Payee name</span>
              <input
                type="text"
                value={hotelPaymentSettings.payeeName}
                onChange={(event) => setHotelPaymentSettings((current) => ({ ...current, payeeName: event.target.value }))}
                disabled={!hotelUpiAdmin || hotelPaymentLoading || savingHotelPayment}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                placeholder="Hotel Royal Palace"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>UPI ID</span>
              <input
                type="text"
                value={hotelPaymentSettings.upiId}
                onChange={(event) => setHotelPaymentSettings((current) => ({ ...current, upiId: event.target.value }))}
                disabled={!hotelUpiAdmin || hotelPaymentLoading || savingHotelPayment}
                className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
                placeholder="hotelname@upi"
              />
            </label>
          </div>
          <label className="space-y-2 text-sm text-slate-700">
            <span>Notes</span>
            <textarea
              value={hotelPaymentSettings.notes}
              onChange={(event) => setHotelPaymentSettings((current) => ({ ...current, notes: event.target.value }))}
              disabled={!hotelUpiAdmin || hotelPaymentLoading || savingHotelPayment}
              rows={3}
              className="w-full rounded-2xl border border-slate-300 p-3 text-sm text-slate-900"
              placeholder="This account receives direct hotel order payments only."
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="font-medium text-slate-800">Enable hotel-owned UPI collection</p>
              <p className="text-xs text-slate-500">Manual verification remains required before an order is marked as paid.</p>
            </div>
            <ToggleSwitch
              label="Enabled"
              checked={Boolean(hotelPaymentSettings.isEnabled)}
              disabled={!hotelUpiAdmin || hotelPaymentLoading || savingHotelPayment || (!hotelPaymentCapability.canEnable && !hotelPaymentSettings.isEnabled)}
              onChange={(value) => { if (hotelUpiAdmin) setHotelPaymentSettings((current) => ({ ...current, isEnabled: value })); }}
            />
          </div>
          {hotelPaymentReady && hotelPaymentState.reason ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{hotelPaymentState.reason}</p> : null}
          {hotelUpiAdmin ? <button type="submit" disabled={savingHotelPayment || hotelPaymentLoading} className="min-h-12 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
            {savingHotelPayment ? "Saving..." : "Save hotel payment settings"}
          </button> : <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Only an authorized hotel administrator can change the hotel payee, UPI ID, or activation state.</p>}
          {hotelPaymentState.activation !== "READY FOR USE" && hotelPaymentReady && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Hotel UPI is {hotelPaymentState.activation.toLowerCase()}. Save a payee name and valid UPI ID, then enable collection. This does not enable live gateway payments.</p>}
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-busy={settlementLoading}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-lg font-semibold text-slate-900">Payments & Settlement</h3><p className="mt-1 text-sm text-slate-500">Cashfree settlement account status for this restaurant.</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${settlement?.easySplit?.enabled && settlement?.configured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{settlement?.easySplit?.enabled && settlement?.configured ? "Configured" : "Activation Required"}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Vendor status</p><p className="mt-1 font-semibold text-slate-900">{settlement?.vendorStatus || "NOT_STARTED"}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{settlement?.payoutMethod === "UPI" ? "UPI verification" : "Bank verification"}</p><p className="mt-1 font-semibold text-slate-900">{settlement?.verificationStatus || "NOT_SUBMITTED"}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Settlement</p><p className="mt-1 font-semibold text-slate-900">{settlement?.settlementStatus || "DISABLED"}</p></div>
        </div>
        {!settlement?.easySplit?.enabled ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Easy Split activation is required before a settlement account can be added.</p> : null}
        {settlement?.configured ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">Settlement account</p><p className="mt-1">{settlement.accountHolderName || "Account holder"} {settlement.maskedAccountNumber || settlement.maskedUpiVpa}</p></div> : null}
        {settlement?.configured ? <button type="button" onClick={async () => { try { const { data } = await refreshSettlementVendor(); setSettlement(data.data); toast.success("Cashfree verification status refreshed"); } catch (error) { toast.error(error?.response?.data?.message || "Unable to refresh settlement status"); } }} className="mt-4 min-h-11 rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">Refresh provider status</button> : null}
        {settlement?.easySplit?.available && !settlement?.configured ? <SettlementForm onSubmit={async (payload) => { try { const { data } = await createSettlementVendor(payload, createIdempotencyKey()); setSettlement(data.data); toast.success("Settlement request submitted"); } catch (error) { toast.error(error?.response?.data?.message || "Unable to submit settlement account"); } }} /> : null}
        {settlementSplits ? <div className="mt-5 border-t border-slate-200 pt-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-slate-900">Cashfree allocation history</h4><p className="mt-1 text-xs text-slate-500">Customer payment and vendor settlement are tracked separately.</p></div><div className="text-right text-xs text-slate-600">Vendor share ₹{Number(settlementSplits.summary?.vendorShare || 0).toFixed(2)}<br />Platform share ₹{Number(settlementSplits.summary?.platformShare || 0).toFixed(2)}</div></div><div className="mt-3 space-y-2">{(settlementSplits.transactions || []).length ? settlementSplits.transactions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><p className="font-semibold text-slate-900">₹{Number(item.grossAmount || 0).toFixed(2)} · {item.splitStatus}</p><p className="mt-0.5 text-xs text-slate-500">Vendor ₹{Number(item.vendorShare || 0).toFixed(2)} · Settlement {item.settlementStatus}</p></div><button type="button" onClick={async () => { try { await refreshSettlementSplit(item.id); const { data } = await getSettlementSplitSummary(); setSettlementSplits(data.data); toast.success("Settlement status refreshed"); } catch (error) { toast.error(error?.response?.data?.message || "Unable to refresh settlement status"); } }} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">Refresh</button></div>) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No Cashfree payment allocations yet.</p>}</div></div> : null}
      </section>

      {loading && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
          {t("settings.loading")}
        </div>
      )}
    </div>
  );
};

export default Settings;
