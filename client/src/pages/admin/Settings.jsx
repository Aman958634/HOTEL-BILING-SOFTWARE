import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getRestaurantSettings, updateRestaurantSettings } from "../../services/restaurantService";
import ToggleSwitch from "../../components/common/ToggleSwitch";

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

const Settings = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    loadSettings();
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Restaurant Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Update core restaurant details, availability, and operational settings.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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

        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Operational Controls</h2>
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

          <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Preview</h2>
            <div className="space-y-3 text-sm text-slate-600">
              <p><strong>Name:</strong> {settings.name || "Not set"}</p>
              <p><strong>Branch code:</strong> {settings.branchCode || "Not set"}</p>
              <p><strong>Status:</strong> {settings.isActive ? "Active" : "Inactive"}</p>
              <p><strong>Reservations:</strong> {settings.reservationsEnabled ? "Enabled" : "Disabled"}</p>
              <p><strong>Online orders:</strong> {settings.onlineOrdersEnabled ? "Enabled" : "Disabled"}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || loading}
            className="w-full rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
          Loading settings...
        </div>
      )}
    </div>
  );
};

export default Settings;
