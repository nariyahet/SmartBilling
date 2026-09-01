import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
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
  const navigate = useNavigate();

  const [settings, setSettings] = useState({
    business_name: "",
    tagline: "",
    logo: "",
    address: "",
    phone: "",
    email: "",
    tax_number: "",
    default_tax_percent: 18,
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
    if (isNaN(tax) || tax < 0 || tax > 100) {
      setErrorMessage("Default tax percentage must be between 0 and 100");
      return;
    }

    try {
      setSaving(true);

      const response = await API.put("/business-settings", {
        ...settings,
        default_tax_percent: tax,
      });

      if (response.data && response.data.success) {
        setSuccessMessage("Business settings saved successfully!");
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    navigate("/");
  };

  if (loading) {
    return <LoadingScreen title="Loading Business Settings..." subtitle="Please wait..." />;
  }

  return (
    <div className="settings-page">
      {/* NAVIGATION */}
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h2>Smart Billing</h2>
        </div>

        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">
            🏠 Dashboard
          </Link>

          <Link to="/products" className="nav-link">
            📦 Products
          </Link>

          <Link to="/customers" className="nav-link">
            👥 Customers
          </Link>

          <Link to="/invoices/create" className="nav-link">
            🧾 Invoices
          </Link>

          <Link to="/invoices/history" className="nav-link">
            📋 Invoice History
          </Link>

          <Link to="/sales-report" className="nav-link">
            📊 Sales Report
          </Link>

          <Link to="/settings" className="nav-link active">
            ⚙️ Business Settings
          </Link>

          <button type="button" className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </nav>

      {/* HEADER */}
      <div className="settings-header">
        <div>
          <h1>⚙️ Business Settings</h1>
          <p>Configure your business branding, tax profile, and invoice defaults</p>
        </div>

        <button
          type="button"
          className="settings-back-button"
          onClick={() => navigate("/dashboard")}
        >
          ← Dashboard
        </button>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="settings-layout">
        {/* SETTINGS FORM */}
        <div className="settings-form-card">
          <h2>🏢 Company Information</h2>

          {/* NOTIFICATIONS AT TOP OF FORM */}
          {successMessage && (
            <div className="settings-alert alert-success" role="alert">
              <span className="alert-icon">✅</span>
              <span className="alert-text">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="settings-alert alert-danger" role="alert">
              <span className="alert-icon">⚠️</span>
              <span className="alert-text">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="settings-form-grid">
              <div className="form-group full-width">
                <label>
                  Business Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="business_name"
                  placeholder="e.g. Shiv Enterprises"
                  value={settings.business_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Tagline / Subtitle</label>
                <input
                  type="text"
                  name="tagline"
                  placeholder="e.g. All Brands Electronic Appliances Sales & Service"
                  value={settings.tagline}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group full-width">
                <label>Business Logo</label>
                <div className="logo-upload-box">
                  {logoPreview ? (
                    <div className="logo-preview-wrapper">
                      <img
                        src={logoPreview}
                        alt="Business Logo Preview"
                        className="logo-preview-img"
                      />
                      <button
                        type="button"
                        className="remove-logo-btn"
                        onClick={handleRemoveLogo}
                      >
                        ✕ Remove Logo
                      </button>
                    </div>
                  ) : (
                    <div className="logo-placeholder">
                      <div className="upload-icon">📷</div>
                      <p>No logo uploaded yet</p>
                    </div>
                  )}

                  <div className="upload-controls">
                    <label className="upload-btn-label">
                      📁 Choose Image File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="file-input-hidden"
                      />
                    </label>
                    <span className="file-help">PNG, JPG, SVG up to 2MB</span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="e.g. +91 9876543210"
                  value={settings.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="e.g. contact@shiventerprises.com"
                  value={settings.email}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group full-width">
                <label>Business Address</label>
                <textarea
                  name="address"
                  rows="3"
                  placeholder="e.g. 101 Crystal Plaza, Ring Road, Surat, Gujarat - 395002"
                  value={settings.address}
                  onChange={handleChange}
                ></textarea>
              </div>

              <div className="form-group">
                <label>GST / Tax Number</label>
                <input
                  type="text"
                  name="tax_number"
                  placeholder="e.g. 24ABCDE1234F1Z5"
                  value={settings.tax_number}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Default GST / Tax Rate (%)</label>
                <input
                  type="number"
                  name="default_tax_percent"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="18"
                  value={settings.default_tax_percent}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Currency</label>
                <select
                  name="currency"
                  value={settings.currency}
                  onChange={handleCurrencyChange}
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
                />
              </div>

              <div className="form-group full-width">
                <label>Terms & Conditions / Invoice Footer Note</label>
                <textarea
                  name="terms_conditions"
                  rows="2"
                  placeholder="e.g. Goods once sold cannot be returned without valid terms."
                  value={settings.terms_conditions}
                  onChange={handleChange}
                ></textarea>
              </div>
            </div>

            <div className="settings-submit-container">
              <button
                type="submit"
                className="settings-save-button"
                disabled={saving}
              >
                {saving ? "💾 Saving Settings..." : "💾 Save Business Settings"}
              </button>
            </div>
          </form>
        </div>

        {/* LIVE INVOICE BRANDING PREVIEW CARD */}
        <div className="settings-preview-card">
          <div className="preview-card-header">
            <h3>👁️ Live Invoice Branding Preview</h3>
            <p>Here is how your business header will appear on customer invoices</p>
          </div>

          <div className="invoice-header-mockup">
            <div className="mockup-top">
              {logoPreview && (
                <div className="mockup-logo">
                  <img src={logoPreview} alt="Business Logo" />
                </div>
              )}
              <div className="mockup-business-info">
                <h4>{settings.business_name || "Your Business Name"}</h4>
                {settings.tagline && (
                  <p className="mockup-tagline">{settings.tagline}</p>
                )}
                {settings.address && (
                  <p className="mockup-detail">📍 {settings.address}</p>
                )}
                {settings.phone && (
                  <p className="mockup-detail">📞 {settings.phone}</p>
                )}
                {settings.email && (
                  <p className="mockup-detail">✉️ {settings.email}</p>
                )}
                {settings.tax_number && (
                  <p className="mockup-tax">
                    <strong>GST / Tax ID:</strong> {settings.tax_number}
                  </p>
                )}
              </div>
            </div>

            <div className="mockup-divider"></div>

            <div className="mockup-sample-invoice">
              <div className="mockup-row">
                <span>Default Tax Rate:</span>
                <strong>{settings.default_tax_percent}%</strong>
              </div>
              <div className="mockup-row">
                <span>Currency Display:</span>
                <strong>
                  {settings.currency_symbol} 1,250.00 ({settings.currency})
                </strong>
              </div>
            </div>

            {settings.terms_conditions && (
              <div className="mockup-terms">
                <small>
                  <strong>Footer Note:</strong> {settings.terms_conditions}
                </small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessSettings;
