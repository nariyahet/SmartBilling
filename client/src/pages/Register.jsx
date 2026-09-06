import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import "./Register.css";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    company_name: "",
    name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errorMsg) setErrorMsg("");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const { company_name, name, email, password, confirm_password } = formData;

    // Client-side validation
    if (!company_name.trim() || !name.trim() || !email.trim() || !password || !confirm_password) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirm_password) {
      setErrorMsg("Passwords do not match. Please re-check.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/auth/register", {
        company_name: company_name.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password,
      });

      const responseData = response.data?.data;
      const token = responseData?.token;
      const company = responseData?.company;
      const admin = responseData?.admin;

      if (!token) {
        setErrorMsg("Registration succeeded but authentication token was not received.");
        return;
      }

      // Store credentials in localStorage
      localStorage.setItem("token", token);
      if (admin) {
        localStorage.setItem("admin", JSON.stringify(admin));
      }
      if (company) {
        localStorage.setItem("company", JSON.stringify(company));
      }

      // Format trial end date
      let trialEndText = "";
      if (company?.trial_end_at) {
        const endDate = new Date(company.trial_end_at);
        trialEndText = ` Your free trial is active until ${endDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}.`;
      }

      setSuccessMsg(`Welcome to SmartBilling!${trialEndText} Redirecting to your dashboard...`);

      // Automatically navigate to dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (err) {
      console.error("Registration error:", err);
      const message =
        err.response?.data?.message ||
        "Registration failed. Please check your details and try again.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-header">
          <h1>Smart Billing</h1>
          <p>Create your business account</p>
          <div className="trial-badge">
            <span>✨</span> 3-Day Full-Feature Free Trial
          </div>
        </div>

        {errorMsg && (
          <div className="register-error-banner">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="register-success-banner">
            <span>🎉</span> {successMsg}
          </div>
        )}

        <form className="register-form" onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="company_name">Business / Company Name *</label>
            <input
              id="company_name"
              type="text"
              name="company_name"
              placeholder="e.g., Acme Solutions"
              value={formData.company_name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Owner Full Name *</label>
            <input
              id="name"
              type="text"
              name="name"
              placeholder="e.g., Jane Doe"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="name@company.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password (min 8 characters) *</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Create a secure password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm_password">Confirm Password *</label>
            <input
              id="confirm_password"
              type="password"
              name="confirm_password"
              placeholder="Confirm your password"
              value={formData.confirm_password}
              onChange={handleChange}
              autoComplete="new-password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="register-button"
            disabled={loading}
          >
            {loading ? "Setting up your account..." : "Start 3-Day Free Trial"}
          </button>
        </form>

        <div className="register-footer">
          Already have an account?
          <Link to="/">Log in</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
