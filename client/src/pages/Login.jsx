import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const data = response.data?.data;
      const token = data?.token;

      if (!token) {
        setErrorMsg("Login failed: Authentication token was not received.");
        return;
      }

      localStorage.setItem("token", token);
      if (data?.admin) {
        localStorage.setItem("admin", JSON.stringify(data.admin));
      }
      if (data?.company) {
        localStorage.setItem("company", JSON.stringify(data.company));
      }

      // Check if trial already expired (normal trial accounts only)
      if (
        data?.company?.is_demo !== 1 &&
        data?.company?.id !== 1 &&
        data?.company?.subscription_status === "trial" &&
        data?.company?.trial_end_at &&
        new Date(data.company.trial_end_at) < new Date()
      ) {
        localStorage.setItem(
          "trial_expired_info",
          JSON.stringify({
            company_name: data.company.name,
            trial_end_at: data.company.trial_end_at,
          })
        );
        window.location.href = "/trial-expired";
        return;
      }

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Login Error:", error);

      const message =
        error.response?.data?.message ||
        "Invalid email or password. Please verify your credentials.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sb-login-wrapper login-page">
      {/* Subtle Ambient Decorative Orbs - strictly contained */}
      <div className="sb-login-ambient-backdrop" aria-hidden="true">
        <div className="sb-login-ambient-1" />
        <div className="sb-login-ambient-2" />
      </div>

      <div className="sb-login-container">
        <div className="sb-login-card login-card">
          {/* Header & ERP Branding */}
          <div className="sb-login-header login-header">
            <div className="sb-brand-badge" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>

            <h1>Smart Billing</h1>

            <div className="sb-erp-pill">
              <span className="sb-erp-pill-dot" />
              Plastic Recycling ERP
            </div>

            <p className="sb-login-subtitle">Admin Login</p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="sb-login-error" role="alert">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} noValidate={false}>
            <div className="sb-form-group form-group">
              <label htmlFor="login-email" className="sb-form-label">
                Email Address
              </label>
              <div className="sb-input-wrapper">
                <span className="sb-input-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  id="login-email"
                  type="email"
                  className={`sb-input-field ${errorMsg ? "input-error" : ""}`}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="sb-form-group form-group">
              <label htmlFor="login-password" className="sb-form-label">
                Password
              </label>
              <div className="sb-input-wrapper">
                <span className="sb-input-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className={`sb-input-field has-toggle ${errorMsg ? "input-error" : ""}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="sb-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={0}
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="sb-login-button login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="sb-spinner" aria-hidden="true" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Navigation to Registration */}
          <div className="sb-login-footer">
            New business?{" "}
            <Link to="/register" className="sb-register-link">
              Start 3-month free trial
            </Link>
          </div>
        </div>

        {/* Enterprise Security Sub-note */}
        <div className="sb-security-note">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Multi-Tenant Enterprise Security • 256-bit SSL</span>
        </div>
      </div>
    </div>
  );
}

export default Login;