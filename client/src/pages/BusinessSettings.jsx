import { useEffect, useState } from "react";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import AppShell from "../components/AppShell";
import "./BusinessSettings.css";

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee (INR - ₹)" },
  { code: "USD", symbol: "$", name: "US Dollar (USD - $)" },
  { code: "EUR", symbol: "€", name: "Euro (EUR - €)" },
  { code: "GBP", symbol: "£", name: "British Pound (GBP - £)" },
  { code: "AED", symbol: "AED", name: "UAE Dirham (AED)" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar (CAD - CA$)" },
  { code: "AUD", symbol: "AU$", name: "Australian Dollar (AUD - AU$)" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar (SGD - S$)" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen (JPY - ¥)" },
];

function BusinessSettings() {
  const [settings, setSettings] = useState({
    business_name: "",
    tagline: "",
    logo: "",
    address: "",
    phone: "",
    email: "",
    tax_number: "",
    default_tax_percent: 18,
    tax_enabled: true,
    currency: "INR",
    currency_symbol: "₹",
    terms_conditions: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [logoPreview, setLogoPreview] = useState("");

  const loadSettings = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await API.get("/business-settings");

      if (response.data && response.data.settings) {
        const data = response.data.settings;
        setSettings({
          business_name: data.business_name || "",
          tagline: data.tagline || "",
          logo: data.logo || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          tax_number: data.tax_number || "",
          default_tax_percent:
            data.default_tax_percent !== undefined
              ? Number(data.default_tax_percent)
              : 18,
          tax_enabled:
            data.tax_enabled !== undefined ? Boolean(data.tax_enabled) : true,
          currency: data.currency || "INR",
          currency_symbol: data.currency_symbol || "₹",
          terms_conditions: data.terms_conditions || "",
        });
        setLogoPreview(data.logo || "");
      }
    } catch (err) {
      console.error("Error loading business settings:", err);
      setErrorMessage(
        err.response?.data?.message || "Failed to load business settings"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTaxToggle = (enabled) => {
    setSettings((prev) => ({
      ...prev,
      tax_enabled: enabled,
    }));
  };

  const handleCurrencyChange = (e) => {
    const selectedCode = e.target.value;
    const currencyObj = CURRENCIES.find((c) => c.code === selectedCode);
    setSettings((prev) => ({
      ...prev,
      currency: selectedCode,
      currency_symbol: currencyObj ? currencyObj.symbol : prev.currency_symbol,
    }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG, JPG, SVG, WebP)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Logo image size should be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setSettings((prev) => ({ ...prev, logo: base64 }));
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, logo: "" }));
    setLogoPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!settings.business_name.trim()) {
      setErrorMessage("Business name is required");
      return;
    }

    const tax = Number(settings.default_tax_percent);
    if (settings.tax_enabled && (isNaN(tax) || tax < 0 || tax > 100)) {
      setErrorMessage("Default tax percentage must be between 0 and 100");
      return;
    }

    try {
      setSaving(true);

      const response = await API.put("/business-settings", {
        ...settings,
        tax_enabled: Boolean(settings.tax_enabled),
        default_tax_percent: isNaN(tax) ? 18 : tax,
      });

      if (response.data && response.data.success) {
        setSuccessMessage("Business settings saved successfully! ✅");
        if (response.data.settings) {
          const data = response.data.settings;
          setSettings({
            business_name: data.business_name || "",
            tagline: data.tagline || "",
            logo: data.logo || "",
            address: data.address || "",
            phone: data.phone || "",
            email: data.email || "",
            tax_number: data.tax_number || "",
            default_tax_percent:
              data.default_tax_percent !== undefined
                ? Number(data.default_tax_percent)
                : 18,
            tax_enabled:
              data.tax_enabled !== undefined ? Boolean(data.tax_enabled) : true,
            currency: data.currency || "INR",
            currency_symbol: data.currency_symbol || "₹",
            terms_conditions: data.terms_conditions || "",
          });
          setLogoPreview(data.logo || "");
        }
        setTimeout(() => {
          setSuccessMessage("");
        }, 4000);
      }
    } catch (err) {
      console.error("Error saving business settings:", err);
      setErrorMessage(
        err.response?.data?.message || "Failed to save business settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen title="Loading Business Settings..." subtitle="Fetching company configuration..." />;
  }

  return (
    <AppShell
      activePage="settings"
      headerActions={
        <button
          type="button"
          className="sb-btn-primary"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? "Saving..." : "💾 Save Changes"}
        </button>
      }
    >
      {/* Header Bar */}
      <div className="bs-header-bar">
        <div>
          <div className="bs-badge-tag">ORGANIZATION PROFILE</div>
          <h1 className="bs-title">Business Settings</h1>
          <p className="bs-subtitle">
            Configure company branding, contact information, GST / tax rules, and invoice footer details.
          </p>
        </div>

        <div className="bs-header-actions">
          <button
            type="button"
            className="sb-btn-refresh-sm"
            onClick={loadSettings}
          >
            🔄 Reload
          </button>
          <button
            type="button"
            className="sb-btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving..." : "💾 Save All Settings"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="bs-alert-box alert-success">
          <span>✅ {successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bs-alert-box alert-danger">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* Main Settings Grid: Left Form Cards + Right Live Branding Preview */}
      <form onSubmit={handleSubmit} className="bs-layout-grid">
        <div className="bs-cards-column">
          {/* Card 1: Company Profile & Logo */}
          <div className="bs-card">
            <div className="bs-card-header">
              <span className="bs-section-icon">🏢</span>
              <div>
                <h2 className="bs-card-title">Company Profile & Branding</h2>
                <span className="bs-card-sub">Identity details shown at the top of customer invoices</span>
              </div>
            </div>

            <div className="bs-card-body">
              <div className="form-group">
                <label>Company / Legal Business Name *</label>
                <input
                  type="text"
                  name="business_name"
                  placeholder="e.g. Shiv Enterprises, Apex Polychem"
                  value={settings.business_name}
                  onChange={handleChange}
                  required
                  className="bs-input"
                />
              </div>

              <div className="form-group">
                <label>Tagline / Subtitle</label>
                <input
                  type="text"
                  name="tagline"
                  placeholder="e.g. All Brands Electronic Appliances Sales & Service"
                  value={settings.tagline}
                  onChange={handleChange}
                  className="bs-input"
                />
              </div>

              <div className="form-group">
                <label>Company Logo</label>
                <div className="bs-logo-upload-wrap">
                  {logoPreview ? (
                    <div className="bs-logo-preview-box">
                      <img src={logoPreview} alt="Business Logo" className="bs-preview-img" />
                      <button
                        type="button"
                        className="bs-btn-remove-logo"
                        onClick={handleRemoveLogo}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : (
                    <div className="bs-logo-placeholder">
                      <span>📷</span>
                      <small>No logo uploaded</small>
                    </div>
                  )}

                  <div className="bs-logo-actions">
                    <label className="bs-upload-btn-label">
                      📁 Select Image File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        style={{ display: "none" }}
                      />
                    </label>
                    <span className="bs-help-text">PNG, JPG, SVG, WebP up to 2MB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Contact & Address Details */}
          <div className="bs-card">
            <div className="bs-card-header">
              <span className="bs-section-icon">📍</span>
              <div>
                <h2 className="bs-card-title">Contact & Registered Address</h2>
                <span className="bs-card-sub">Phone, email, and location printed on invoices</span>
              </div>
            </div>

            <div className="bs-card-body">
              <div className="bs-grid-2">
                <div className="form-group">
                  <label>Business Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="e.g. +91 9876543210"
                    value={settings.phone}
                    onChange={handleChange}
                    className="bs-input"
                  />
                </div>

                <div className="form-group">
                  <label>Business Email Address</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="e.g. contact@shiventerprises.com"
                    value={settings.email}
                    onChange={handleChange}
                    className="bs-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Registered Business Address</label>
                <textarea
                  name="address"
                  rows="3"
                  placeholder="e.g. 101 Crystal Plaza, Ring Road, Surat, Gujarat - 395002"
                  value={settings.address}
                  onChange={handleChange}
                  className="bs-textarea"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Tax & GST Configuration */}
          <div className="bs-card">
            <div className="bs-card-header">
              <span className="bs-section-icon">🏛️</span>
              <div>
                <h2 className="bs-card-title">Tax & GST Configuration</h2>
                <span className="bs-card-sub">Control whether sales invoices compute and display GST</span>
              </div>
            </div>

            <div className="bs-card-body">
              {/* Toggle Switch */}
              <div className="bs-tax-toggle-panel">
                <div className="bs-tax-toggle-info">
                  <strong>GST / Tax Calculation Status</strong>
                  <span>Enable to calculate GST on bills; disable for non-GST billing</span>
                </div>

                <div className="bs-toggle-switch-group">
                  <button
                    type="button"
                    className={`bs-toggle-btn ${settings.tax_enabled ? "active-enabled" : ""}`}
                    onClick={() => handleTaxToggle(true)}
                  >
                    🟢 Active (ON)
                  </button>
                  <button
                    type="button"
                    className={`bs-toggle-btn ${!settings.tax_enabled ? "active-disabled" : ""}`}
                    onClick={() => handleTaxToggle(false)}
                  >
                    ⚪ Disabled (OFF)
                  </button>
                </div>
              </div>

              {!settings.tax_enabled && (
                <div className="bs-tax-disabled-callout">
                  <span>ℹ️</span>
                  <div>
                    <strong>GST is currently DISABLED for this business.</strong>
                    <p>New invoices will calculate 0% tax. Your GSTIN and default rate are securely preserved below.</p>
                  </div>
                </div>
              )}

              <div className="bs-grid-2" style={{ marginTop: "14px" }}>
                <div className="form-group">
                  <label>
                    GSTIN / Tax ID
                    {!settings.tax_enabled && <span className="bs-tag-disabled"> (Disabled)</span>}
                  </label>
                  <input
                    type="text"
                    name="tax_number"
                    placeholder="e.g. 24ABCDE1234F1Z5"
                    value={settings.tax_number}
                    onChange={handleChange}
                    disabled={!settings.tax_enabled}
                    className="bs-input"
                  />
                </div>

                <div className="form-group">
                  <label>
                    Default Tax Rate (%)
                    {!settings.tax_enabled && <span className="bs-tag-disabled"> (Calculated at 0%)</span>}
                  </label>
                  <input
                    type="number"
                    name="default_tax_percent"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="18"
                    value={settings.default_tax_percent}
                    onChange={handleChange}
                    disabled={!settings.tax_enabled}
                    className="bs-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Currency & Invoice Footer */}
          <div className="bs-card">
            <div className="bs-card-header">
              <span className="bs-section-icon">💵</span>
              <div>
                <h2 className="bs-card-title">Currency & Invoice Terms</h2>
                <span className="bs-card-sub">Base currency formatting and printable legal footer terms</span>
              </div>
            </div>

            <div className="bs-card-body">
              <div className="bs-grid-2">
                <div className="form-group">
                  <label>Display Currency</label>
                  <select
                    name="currency"
                    value={settings.currency}
                    onChange={handleCurrencyChange}
                    className="bs-select"
                  >
                    {CURRENCIES.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Currency Symbol</label>
                  <input
                    type="text"
                    name="currency_symbol"
                    placeholder="₹"
                    value={settings.currency_symbol}
                    onChange={handleChange}
                    className="bs-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Terms & Conditions / Invoice Footer Note</label>
                <textarea
                  name="terms_conditions"
                  rows="2"
                  placeholder="e.g. Goods once sold cannot be returned without valid terms."
                  value={settings.terms_conditions}
                  onChange={handleChange}
                  className="bs-textarea"
                />
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="bs-bottom-submit">
            <button
              type="submit"
              className="sb-btn-primary bs-save-large"
              disabled={saving}
            >
              {saving ? "💾 Saving Settings..." : "💾 Save Business Settings"}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Branding Preview */}
        <div className="bs-preview-column">
          <div className="bs-preview-sticky">
            <div className="bs-preview-card">
              <div className="bs-preview-header">
                <h3>👁️ Live Invoice Branding Preview</h3>
                <p>This is how your business identity renders on printed customer bills.</p>
              </div>

              <div className="bs-invoice-mockup">
                <div className="mockup-top-row">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="mockup-logo-img" />
                  ) : (
                    <div className="mockup-logo-placeholder">
                      <span>🏢</span>
                    </div>
                  )}

                  <div className="mockup-info">
                    <h4 className="mockup-title">{settings.business_name || "Your Business Name"}</h4>
                    {settings.tagline && <p className="mockup-tagline">{settings.tagline}</p>}
                    {settings.address && <p className="mockup-detail">📍 {settings.address}</p>}
                    {settings.phone && <p className="mockup-detail">📞 {settings.phone}</p>}
                    {settings.email && <p className="mockup-detail">✉️ {settings.email}</p>}
                    {settings.tax_enabled && settings.tax_number && (
                      <p className="mockup-gst">
                        <strong>GSTIN:</strong> {settings.tax_number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mockup-sep" />

                <div className="mockup-stats-box">
                  <div className="mockup-stat-row">
                    <span>GST Status:</span>
                    <strong className={settings.tax_enabled ? "text-mint" : "text-muted"}>
                      {settings.tax_enabled ? `Active (${settings.default_tax_percent}%)` : "Disabled (0%)"}
                    </strong>
                  </div>
                  <div className="mockup-stat-row">
                    <span>Currency Sample:</span>
                    <strong>{settings.currency_symbol} 1,250.00 ({settings.currency})</strong>
                  </div>
                </div>

                {settings.terms_conditions && (
                  <div className="mockup-terms-box">
                    <small>
                      <strong>Terms:</strong> {settings.terms_conditions}
                    </small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </AppShell>
  );
}

export default BusinessSettings;
