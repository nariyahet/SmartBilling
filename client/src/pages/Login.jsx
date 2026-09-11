import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password");
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
        alert("Login failed: Token not received");
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

      alert(
        error.response?.data?.message ||
          "Invalid email or password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Smart Billing</h1>
          <p>Admin Login</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
            fontSize: "13px",
            color: "#6b7280",
          }}
        >
          New business?{" "}
          <Link
            to="/register"
            style={{
              color: "var(--sb-primary, #0879D1)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Start 3-day free trial
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;