import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import "./TrialExpired.css";

function TrialExpired() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(() => {
    try {
      const storedExpired = localStorage.getItem("trial_expired_info");
      if (storedExpired) {
        const parsed = JSON.parse(storedExpired);
        if (parsed.company_name) {
          return {
            name: parsed.company_name,
            trial_end_at: parsed.trial_end_at,
          };
        }
      }

      const storedCompany = localStorage.getItem("company");
      if (storedCompany) {
        const parsed = JSON.parse(storedCompany);
        if (parsed.name) {
          return {
            name: parsed.name,
            trial_end_at: parsed.trial_end_at,
          };
        }
      }
    } catch (e) {
      console.warn("Could not read stored company info:", e);
    }

    return {
      name: "Your Business",
      trial_end_at: null,
    };
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("company");
      if (stored) {
        const comp = JSON.parse(stored);
        if (comp.is_demo === 1 || comp.id === 1) {
          navigate("/dashboard");
          return;
        }
      }
    } catch {
      // ignore
    }

    const token = localStorage.getItem("token");
    if (token) {
      API.get("/auth/me")
        .then((res) => {
          const comp = res.data?.data?.company;
          if (comp?.is_demo === 1 || comp?.id === 1) {
            navigate("/dashboard");
            return;
          }
          if (comp) {
            setCompanyInfo({
              name: comp.name,
              trial_end_at: comp.trial_end_at,
            });
          }
        })
        .catch((err) => {
          console.warn("Could not fetch user info on expired screen:", err);
        });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    localStorage.removeItem("company");
    localStorage.removeItem("trial_expired_info");
    navigate("/");
  };

  const formattedEndDate = companyInfo.trial_end_at
    ? new Date(companyInfo.trial_end_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recently ended";

  return (
    <div className="trial-expired-page">
      <div className="trial-expired-card">
        <div className="trial-expired-icon-wrapper">
          <span>🔒</span>
        </div>

        <h1>Your 3-day trial has expired</h1>
        <p className="trial-expired-subtitle">
          Thank you for exploring SmartBilling. Your free trial period has concluded.
          To resume managing invoices, products, and clients, please upgrade your subscription.
        </p>

        <div className="trial-details-box">
          <div className="trial-detail-row">
            <span className="trial-detail-label">Company Account</span>
            <span className="trial-detail-value">{companyInfo.name}</span>
          </div>
          <div className="trial-detail-row">
            <span className="trial-detail-label">Trial Ended On</span>
            <span className="trial-detail-value">{formattedEndDate}</span>
          </div>
          <div className="trial-detail-row">
            <span className="trial-detail-label">Status</span>
            <span className="trial-detail-value" style={{ color: "#ef4444" }}>
              Expired
            </span>
          </div>
        </div>

        <div className="trial-expired-actions">
          <button
            type="button"
            className="upgrade-button"
            onClick={() => setShowModal(true)}
          >
            Upgrade Plan
          </button>
          <button
            type="button"
            className="logout-trial-button"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </div>

      {showModal && (
        <div className="upgrade-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>💳</div>
            <h3>Upgrade SmartBilling</h3>
            <p>
              Online automated billing & payment gateway integration is coming soon!
              <br /><br />
              To upgrade your company account immediately, please reach out to our team at{" "}
              <strong>support@smartbilling.com</strong> or call our support line.
            </p>
            <button type="button" onClick={() => setShowModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrialExpired;
