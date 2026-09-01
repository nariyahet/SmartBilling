import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import "./SalesReport.css";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

function SalesReport() {
  const navigate = useNavigate();

  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/dashboard/sales-report");

      console.log("Sales Report Response:", response.data);

      if (response.data?.success) {
        setDailySales(response.data.dailySales || []);
        setMonthlySales(response.data.monthlySales || []);
      } else {
        setError(response.data?.message || "Unable to load sales report");
      }
    } catch (error) {
      console.error("Sales Report Error:", error);

      setError(error.response?.data?.message || "Unable to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadReport = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await API.get("/dashboard/sales-report");

        if (!isMounted) return;

        if (response.data?.success) {
          setDailySales(response.data.dailySales || []);
          setMonthlySales(response.data.monthlySales || []);
        } else {
          setError(response.data?.message || "Unable to load sales report");
        }
      } catch (error) {
        if (!isMounted) return;

        console.error("Sales report error:", error);

        setError(
          error.response?.data?.message || "Unable to load sales report",
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <LoadingScreen title="Loading Sales Report..." subtitle="Please wait..." />;
  }

  const chartData = [...monthlySales].reverse().map((item) => ({
    month: String(item.month || ""),
    total: Number(item.total) || 0,
  }));

  return (
    <div className="sales-report-container">
      <div className="sales-report-header">
        <div>
          <h1>📈 Sales Report</h1>

          <p>View your daily and monthly sales</p>
        </div>

        <div className="sales-header-actions">
          <button
            type="button"
            className="sales-refresh-button"
            onClick={fetchSalesReport}
          >
            🔄 Refresh
          </button>

          <button
            type="button"
            className="sales-dashboard-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className="sales-report-error">
          <span>{error}</span>

          <button type="button" onClick={fetchSalesReport}>
            Retry
          </button>
        </div>
      )}

      <div className="sales-report-card">
        <div className="sales-card-header">
          <div>
            <h2>📅 Daily Sales</h2>

            <p>Daily invoice sales overview</p>
          </div>

          <span className="sales-count">{dailySales.length}</span>
        </div>

        {dailySales.length === 0 ? (
          <div className="sales-empty">
            <div className="sales-empty-icon">📊</div>

            <h3>No Sales Data</h3>

            <p>No daily sales data available.</p>
          </div>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Total Sales</th>
                </tr>
              </thead>

              <tbody>
                {dailySales.map((item, index) => (
                  <tr key={item.date || index}>
                    <td>{index + 1}</td>

                    <td>{formatDate(item.date)}</td>

                    <td>
                      <strong>{formatCurrency(item.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sales-report-card">
        <div className="sales-card-header">
          <div>
            <h2>📆 Monthly Sales</h2>

            <p>Monthly sales performance</p>
          </div>

          <span className="sales-count">{monthlySales.length}</span>
        </div>

        {chartData.length > 0 && (
          <div className="sales-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 20,
                  left: 10,
                  bottom: 10,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="month"
                  tick={{
                    fontSize: 12,
                  }}
                />

                <YAxis
                  tick={{
                    fontSize: 12,
                  }}
                  tickFormatter={(value) =>
                    `₹${Number(value).toLocaleString("en-IN")}`
                  }
                />

                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={(label) => `Month: ${label}`}
                />

                <Bar
                  dataKey="total"
                  name="Sales"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {monthlySales.length === 0 ? (
          <div className="sales-empty">
            <div className="sales-empty-icon">📊</div>

            <h3>No Monthly Sales</h3>

            <p>No monthly sales data available.</p>
          </div>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Month</th>
                  <th>Total Sales</th>
                </tr>
              </thead>

              <tbody>
                {monthlySales.map((item, index) => (
                  <tr key={item.month || index}>
                    <td>{index + 1}</td>

                    <td>{item.month}</td>

                    <td>
                      <strong>{formatCurrency(item.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SalesReport;
