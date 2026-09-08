import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./PlasticDashboard.css";

const POLYMER_COLORS = {
  PET: "#059669",
  PP: "#0284c7",
  HDPE: "#d97706",
  LDPE: "#7c3aed",
  OTHER: "#64748b",
};

function PlasticDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [plasticStats, setPlasticStats] = useState({
    totalPurchasedKg: 0,
    totalPurchaseAmount: 0,
    currentStockKg: 0,
    currentStockValue: 0,
    totalSuppliers: 0,
    totalTruckInwards: 0,
    totalPurchaseBills: 0,
    lowStockMaterials: [],
  });

  const [stockList, setStockList] = useState([]);
  const [truckInwards, setTruckInwards] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);

  const [plasticPeriod, setPlasticPeriod] = useState("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₹");

  const formatCurrency = (amount) => {
    return `${currencySymbol}${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  const [phase3Analytics, setPhase3Analytics] = useState(null);
  const [phase4Analytics, setPhase4Analytics] = useState(null);

  const fetchDashboardData = async (
    period = plasticPeriod,
    fromDate = customFromDate,
    toDate = customToDate,
    isRefresh = false
  ) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      let statsUrl = `/dashboard/plastic-stats?period=${period}`;
      if (period === "custom" && fromDate && toDate) {
        statsUrl += `&from_date=${fromDate}&to_date=${toDate}`;
      }

      const [statsRes, stockRes, inwardsRes, billsRes, suppliersRes, settingsRes, p3Res, p4Res] =
        await Promise.allSettled([
          API.get(statsUrl),
          API.get("/raw-material-stock"),
          API.get("/truck-inwards"),
          API.get("/purchase-bills"),
          API.get("/suppliers"),
          API.get("/business-settings"),
          API.get("/dashboard/plastic-phase3-analytics"),
          API.get("/dashboard/plastic-phase4-analytics"),
        ]);

      if (statsRes.status === "fulfilled" && statsRes.value.data?.success && statsRes.value.data?.stats) {
        setPlasticStats(statsRes.value.data.stats);
      }

      if (stockRes.status === "fulfilled" && stockRes.value.data?.success) {
        setStockList(Array.isArray(stockRes.value.data.stock) ? stockRes.value.data.stock : []);
      }

      if (inwardsRes.status === "fulfilled" && inwardsRes.value.data?.success) {
        setTruckInwards(
          Array.isArray(inwardsRes.value.data.truck_inwards)
            ? inwardsRes.value.data.truck_inwards
            : []
        );
      }

      if (billsRes.status === "fulfilled" && billsRes.value.data?.success) {
        setPurchaseBills(
          Array.isArray(billsRes.value.data.purchase_bills)
            ? billsRes.value.data.purchase_bills
            : []
        );
      }

      if (suppliersRes.status === "fulfilled" && suppliersRes.value.data?.success) {
        setSuppliersList(
          Array.isArray(suppliersRes.value.data.suppliers)
            ? suppliersRes.value.data.suppliers
            : []
        );
      }

      if (settingsRes.status === "fulfilled" && settingsRes.value.data?.settings?.currency_symbol) {
        setCurrencySymbol(settingsRes.value.data.settings.currency_symbol);
      }

      if (p3Res.status === "fulfilled" && p3Res.value.data?.success) {
        setPhase3Analytics(p3Res.value.data.analytics || p3Res.value.data.phase3 || null);
      }

      if (p4Res.status === "fulfilled" && p4Res.value.data?.success) {
        setPhase4Analytics(p4Res.value.data.analytics || null);
      }
    } catch (err) {
      console.error("Failed to load plastic dashboard data:", err);
      setError("Unable to load plastic recycling operations data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData(plasticPeriod, customFromDate, customToDate, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (newPeriod) => {
    setPlasticPeriod(newPeriod);
    if (newPeriod !== "custom") {
      fetchDashboardData(newPeriod, customFromDate, customToDate, true);
    }
  };

  const handleApplyCustomFilter = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (customFromDate && customToDate) {
      fetchDashboardData("custom", customFromDate, customToDate, true);
    }
  };

  // Section A: Monthly Purchase Trend respecting active period filter
  const monthlyTrendData = useMemo(() => {
    if (!Array.isArray(purchaseBills) || purchaseBills.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const currentDay = String(now.getDate()).padStart(2, "0");
    const todayDateStr = `${currentYear}-${currentMonth}-${currentDay}`;
    const currentMonthKey = `${currentYear}-${currentMonth}`;

    const parseDateInfo = (dateVal) => {
      if (!dateVal) return null;
      if (typeof dateVal === "string") {
        const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const year = Number(match[1]);
          const month = Number(match[2]);
          const day = Number(match[3]);
          return {
            year,
            month,
            day,
            dateStr: `${match[1]}-${match[2]}-${match[3]}`,
            monthKey: `${match[1]}-${match[2]}`,
          };
        }
      }
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const monthStr = String(month).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      return {
        year,
        month,
        day,
        dateStr: `${year}-${monthStr}-${dayStr}`,
        monthKey: `${year}-${monthStr}`,
      };
    };

    // 1. Filter purchase bills based on active period
    const filteredBills = purchaseBills.filter((bill) => {
      const parsed = parseDateInfo(bill.purchase_date);
      if (!parsed) return false;

      if (plasticPeriod === "today") {
        return parsed.dateStr === todayDateStr;
      }
      if (plasticPeriod === "month") {
        return parsed.monthKey === currentMonthKey;
      }
      if (plasticPeriod === "year") {
        return parsed.year === currentYear;
      }
      if (plasticPeriod === "custom") {
        if (customFromDate && customToDate) {
          return parsed.dateStr >= customFromDate && parsed.dateStr <= customToDate;
        }
        return true;
      }
      return true;
    });

    if (filteredBills.length === 0) return [];

    // 2. Group according to period for optimal readability:
    // - "today": group by individual bill number (PB-1001, etc.)
    // - "month": group by day of the month (e.g. 07 Sep)
    // - "year": group by month of the year (e.g. Sep 2026)
    // - "custom": if range <= 31 days group by day; if > 31 days group by month
    const isToday = plasticPeriod === "today";
    const isDaily =
      plasticPeriod === "month" ||
      (plasticPeriod === "custom" &&
        customFromDate &&
        customToDate &&
        Math.abs(new Date(customToDate) - new Date(customFromDate)) / (1000 * 60 * 60 * 24) <= 31);

    const map = {};

    filteredBills.forEach((bill) => {
      const parsed = parseDateInfo(bill.purchase_date);
      if (!parsed) return;

      let key;
      let label;

      if (isToday) {
        key = bill.purchase_bill_no || `Bill #${bill.id}`;
        label = bill.purchase_bill_no || "Today";
      } else if (isDaily) {
        key = parsed.dateStr;
        const d = new Date(parsed.year, parsed.month - 1, parsed.day);
        label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      } else {
        key = parsed.monthKey;
        const d = new Date(parsed.year, parsed.month - 1, 1);
        label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      }

      if (!map[key]) {
        map[key] = {
          key,
          month: label,
          amount: 0,
          billsCount: 0,
        };
      }
      map[key].amount += Number(bill.grand_total) || 0;
      map[key].billsCount += 1;
    });

    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [purchaseBills, plasticPeriod, customFromDate, customToDate]);

  // Section B: Polymer Stock Distribution (PET, PP, HDPE, LDPE, OTHER)
  const polymerDistribution = useMemo(() => {
    const buckets = {
      PET: { name: "PET", quantityKg: 0, materialsCount: 0, color: POLYMER_COLORS.PET },
      PP: { name: "PP", quantityKg: 0, materialsCount: 0, color: POLYMER_COLORS.PP },
      HDPE: { name: "HDPE", quantityKg: 0, materialsCount: 0, color: POLYMER_COLORS.HDPE },
      LDPE: { name: "LDPE", quantityKg: 0, materialsCount: 0, color: POLYMER_COLORS.LDPE },
      OTHER: { name: "OTHER", quantityKg: 0, materialsCount: 0, color: POLYMER_COLORS.OTHER },
    };

    let totalStockAcrossAll = 0;

    stockList.forEach((item) => {
      const type = (item.plastic_type || "OTHER").toUpperCase();
      const target = buckets[type] || buckets.OTHER;
      // Convert TON to KG for clean distribution if unit is TON
      const qtyInKg =
        item.unit === "TON"
          ? Number(item.current_stock || 0) * 1000
          : Number(item.current_stock || 0);

      target.quantityKg += qtyInKg;
      target.materialsCount += 1;
      totalStockAcrossAll += qtyInKg;
    });

    const data = Object.values(buckets).map((b) => ({
      ...b,
      percentage:
        totalStockAcrossAll > 0
          ? Number(((b.quantityKg / totalStockAcrossAll) * 100).toFixed(1))
          : 0,
    }));

    return {
      chartData: data.filter((d) => d.quantityKg > 0),
      allData: data,
      totalStockAcrossAll,
    };
  }, [stockList]);

  // Section C: Top 5 Recent Truck Inwards
  const recentInwards = useMemo(() => {
    return Array.isArray(truckInwards) ? truckInwards.slice(0, 5) : [];
  }, [truckInwards]);

  // Section D: Low Stock Raw Materials
  const lowStockItems = useMemo(() => {
    if (Array.isArray(plasticStats.lowStockMaterials) && plasticStats.lowStockMaterials.length > 0) {
      return plasticStats.lowStockMaterials.slice(0, 5);
    }
    return stockList
      .filter((mat) => Number(mat.current_stock || 0) <= Number(mat.minimum_stock || 0))
      .slice(0, 5);
  }, [plasticStats.lowStockMaterials, stockList]);

  // Section E: Top 5 Recent Purchase Bills
  const recentBills = useMemo(() => {
    return Array.isArray(purchaseBills) ? purchaseBills.slice(0, 5) : [];
  }, [purchaseBills]);

  // Section F: Top Suppliers by actual purchase bill spend
  const topSuppliers = useMemo(() => {
    if (Array.isArray(purchaseBills) && purchaseBills.length > 0) {
      const supMap = {};
      purchaseBills.forEach((pb) => {
        const name = pb.supplier_name || "Unknown Supplier";
        if (!supMap[name]) {
          supMap[name] = {
            name,
            code: pb.supplier_code || "",
            totalSpend: 0,
            billsCount: 0,
          };
        }
        supMap[name].totalSpend += Number(pb.grand_total) || 0;
        supMap[name].billsCount += 1;
      });

      return Object.values(supMap)
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 5);
    }

    // If no purchase bills yet, show registered active suppliers without fabricated totals
    if (Array.isArray(suppliersList) && suppliersList.length > 0) {
      return suppliersList.slice(0, 5).map((s) => ({
        name: s.supplier_name,
        code: s.supplier_code,
        city: s.city || s.state || "Kim, Gujarat",
        mobile: s.mobile,
        isRegistryOnly: true,
      }));
    }

    return [];
  }, [purchaseBills, suppliersList]);

  if (loading) {
    return <LoadingScreen title="Loading Plastic ERP..." subtitle="Retrieving plant operations metrics..." />;
  }

  const quickOperations = [
    {
      title: "Scrap Suppliers",
      icon: "🏢",
      count: `${plasticStats.totalSuppliers} Active`,
      desc: "Manage scrap vendors, mobile contacts, and GST records",
      link: "/plastic-erp/suppliers",
      color: "#0284c7",
    },
    {
      title: "Raw Material Catalog",
      icon: "♻️",
      count: "Polymers & Scrap",
      desc: "PET, PP, HDPE, LDPE grades and minimum stock thresholds",
      link: "/plastic-erp/raw-materials",
      color: "#059669",
    },
    {
      title: "Truck Inward",
      icon: "🚚",
      count: `${plasticStats.totalTruckInwards} Inbound`,
      desc: "Log inbound scrap vehicles, material type, and driver info",
      link: "/plastic-erp/truck-inward",
      color: "#d97706",
    },
    {
      title: "Weighbridge Slips",
      icon: "⚖️",
      count: "Dual Weighment",
      desc: "Gross & tare scale recordings with net weight calculation",
      link: "/plastic-erp/weighment",
      color: "#7c3aed",
    },
    {
      title: "Purchase Bills",
      icon: "📑",
      count: `${plasticStats.totalPurchaseBills} Invoices`,
      desc: "Generate supplier bills with company GST ON/OFF calculation",
      link: "/plastic-erp/purchase-bills",
      color: "#e11d48",
    },
    {
      title: "Stock & Adjustments",
      icon: "📦",
      count: `${Number(plasticStats.currentStockKg || 0).toLocaleString("en-IN")} KG`,
      desc: "Real-time scrap inventory, valuation, and movement audit logs",
      link: "/plastic-erp/stock",
      color: "#0d9488",
    },
    {
      title: "Production & Shop Floor",
      icon: "⚙️",
      count: `${plasticStats.activeBatches || 0} Batches Live`,
      desc: "Work orders, daily production plans, live batch tracking & execution",
      link: "/plastic-erp/production",
      color: "#059669",
    },
    {
      title: "BOM & Recipes",
      icon: "📋",
      count: "Formulations",
      desc: "Raw material ratios, regrind % limits, masterbatch formulations",
      link: "/plastic-erp/recipes",
      color: "#2563eb",
    },
    {
      title: "WIP & Finished Goods",
      icon: "🏷️",
      count: `${Number(plasticStats.finishedGoodsStockKg || 0).toLocaleString("en-IN")} KG FG`,
      desc: "Crushed flake WIP stages, finished pellets inventory & lot records",
      link: "/plastic-erp/wip-fg",
      color: "#7c3aed",
    },
    {
      title: "Quality Control (QC)",
      icon: "🔬",
      count: `${plasticStats.qcPending || 0} Pending`,
      desc: "Incoming, in-process, and finished goods lab tests & MFI/moisture",
      link: "/plastic-erp/quality",
      color: "#db2777",
    },
    {
      title: "Scrap & Regrind",
      icon: "♻️",
      count: `${Number(plasticStats.regrindGeneratedKg || 0).toLocaleString("en-IN")} KG`,
      desc: "Extruder purging, startup scrap tracking, regrind generation & reuse",
      link: "/plastic-erp/scrap-regrind",
      color: "#d97706",
    },
    {
      title: "Plant Machines",
      icon: "🏭",
      count: `${plasticStats.activeMachines || 0} Active`,
      desc: "Extruders, crushers, downtime logs, and preventive maintenance",
      link: "/plastic-erp/machines",
      color: "#0284c7",
    },
    {
      title: "Shifts & Operators",
      icon: "👷",
      count: "Workforce",
      desc: "Plant shifts, machine operators, skill levels, and assignment",
      link: "/plastic-erp/operations",
      color: "#0d9488",
    },
    {
      title: "Batch Traceability",
      icon: "🔍",
      count: "End-to-End",
      desc: "Upstream scrap supplier slips to downstream customer FG lots",
      link: "/plastic-erp/traceability",
      color: "#4f46e5",
    },
    {
      title: "Production Costing",
      icon: "💰",
      count: formatCurrency(plasticStats.totalProductionCost),
      desc: "Batch-wise costing, labour, machine power, and standard variance",
      link: "/plastic-erp/costing",
      color: "#9333ea",
    },
    {
      title: "Operational Reports",
      icon: "📊",
      count: "Plant Intelligence",
      desc: "Daily plant reports, material yield, machine OEE, and live alerts",
      link: "/plastic-erp/reports",
      color: "#0f172a",
    },
    {
      title: "Sales Orders",
      icon: "📋",
      count: `${plasticStats.pendingOrders ?? 0} Pending`,
      desc: "Customer orders, delivery dates, finished goods stock reservation",
      link: "/plastic-erp/sales-orders",
      color: "#2563eb",
    },
    {
      title: "Dispatch & Deliveries",
      icon: "🚚",
      count: `${plasticStats.todayDispatches ?? 0} Today`,
      desc: "Outward dispatch queue, truck loading, FG stock deduction, 1-click billing",
      link: "/plastic-erp/dispatches",
      color: "#0284c7",
    },
    {
      title: "Delivery Challans",
      icon: "📄",
      count: "Rule 55 DC",
      desc: "Goods delivery challans, e-way bills, driver slips, printable passes",
      link: "/plastic-erp/transport/challans",
      color: "#059669",
    },
    {
      title: "Transport & Fleet",
      icon: "🚛",
      count: "Vehicle Master",
      desc: "Dedicated vehicles, transporter registry, capacity & driver directory",
      link: "/plastic-erp/transport/vehicles",
      color: "#6366f1",
    },
    {
      title: "Customer Collections",
      icon: "💵",
      count: formatCurrency(plasticStats.paymentsCollected || 0),
      desc: "Bank/UPI/Cash payment receipts, ledger updates, invoice matching",
      link: "/plastic-erp/payments",
      color: "#10b981",
    },
    {
      title: "Receivables & Aging",
      icon: "⏳",
      count: formatCurrency(plasticStats.outstandingReceivables || 0),
      desc: "Customer outstanding dues, 30/60/90+ day aging buckets & overdue tracking",
      link: "/plastic-erp/finance/receivables",
      color: "#dc2626",
    },
    {
      title: "Customer Ledger",
      icon: "📑",
      count: "Audit Trail",
      desc: "Debit/credit financial statement with live running balances",
      link: "/plastic-erp/finance/ledger",
      color: "#475569",
    },
    {
      title: "Sales Returns & QC",
      icon: "🔄",
      count: `${plasticStats.salesReturns || 0} Returns`,
      desc: "Defective material inspection, granule restock, scrap regrind & credit notes",
      link: "/plastic-erp/sales-returns",
      color: "#d97706",
    },
    {
      title: "Credit & Debit Notes",
      icon: "⚖️",
      count: "Tax Notes",
      desc: "GST credit notes for returns/discounts and supplementary debit notes",
      link: "/plastic-erp/finance/credit-notes",
      color: "#b45309",
    },
    {
      title: "Sales & Margin Intelligence",
      icon: "📈",
      count: `${Number(plasticStats.grossMarginPercent || 0).toFixed(1)}% Margin`,
      desc: "Executive analytics, actual lot costing margins vs selling price",
      link: "/plastic-erp/sales-reports",
      color: "#0d9488",
    },
    {
      title: "Employee Master",
      icon: "👥",
      count: `${plasticStats.totalEmployees || 0} Staff`,
      desc: "Directory of operators, workers, wage profiles & KYC documents",
      link: "/plastic-erp/employees",
      color: "#059669",
    },
    {
      title: "Attendance & Shifts",
      icon: "⏱️",
      count: `${plasticStats.todayPresentEmployees || 0} Today`,
      desc: "Daily roll call, shift assignments, biometric sync & overtime hours",
      link: "/plastic-erp/attendance",
      color: "#0284c7",
    },
    {
      title: "Leave Management",
      icon: "🏖️",
      count: `${plasticStats.pendingLeavesCount || 0} Pending`,
      desc: "Casual, sick & earned leave applications, approvals & annual quotas",
      link: "/plastic-erp/leaves",
      color: "#d97706",
    },
    {
      title: "Workforce & Labour",
      icon: "🏭",
      count: "Labour Cost",
      desc: "Link production operators to HR masters & compute shift labour expenditures",
      link: "/plastic-erp/workforce",
      color: "#7c3aed",
    },
    {
      title: "Monthly Payroll",
      icon: "💰",
      count: formatCurrency(plasticStats.monthPayrollAmount || 0),
      desc: "Automated salary computation, deductions, PF, ESIC & printable payslips",
      link: "/plastic-erp/payroll",
      color: "#16a34a",
    },
    {
      title: "Employee Advances",
      icon: "💳",
      count: formatCurrency(plasticStats.outstandingAdvanceAmount || 0),
      desc: "Salary advances, recovery schedules & outstanding loan ledgers",
      link: "/plastic-erp/advances",
      color: "#ea580c",
    },
    {
      title: "Plant Expenses",
      icon: "🧾",
      count: formatCurrency(plasticStats.monthExpensesAmount || 0),
      desc: "Power, maintenance, machine spares, transport fuel & factory rent",
      link: "/plastic-erp/expenses",
      color: "#e11d48",
    },
    {
      title: "HR & Expense Reports",
      icon: "📊",
      count: "Reports",
      desc: "Salary register, expense analytics, advance status & labour cost/kg",
      link: "/plastic-erp/hr-reports",
      color: "#0891b2",
    },
  ];

  return (
    <div className="plastic-dashboard-page">
      <PlasticNavbar />

      <main className="plastic-dashboard-container">
        {/* Header Block */}
        <header className="plastic-header-bar">
          <div className="plastic-header-left">
            <span className="plant-tag">🏭 KIM, SURAT PLANT OPERATIONS</span>
            <h1>♻️ Plastic Recycling ERP</h1>
            <p>Complete scrap purchase and raw material management system</p>
          </div>

          <div className="plastic-period-controls">
            <div className="period-pill-group">
              <button
                type="button"
                className={`period-pill ${plasticPeriod === "today" ? "active" : ""}`}
                onClick={() => handlePeriodChange("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`period-pill ${plasticPeriod === "month" ? "active" : ""}`}
                onClick={() => handlePeriodChange("month")}
              >
                This Month
              </button>
              <button
                type="button"
                className={`period-pill ${plasticPeriod === "year" ? "active" : ""}`}
                onClick={() => handlePeriodChange("year")}
              >
                This Year
              </button>
              <button
                type="button"
                className={`period-pill ${plasticPeriod === "custom" ? "active" : ""}`}
                onClick={() => handlePeriodChange("custom")}
              >
                Custom Range
              </button>
            </div>

            <button
              type="button"
              className="plastic-refresh-btn"
              disabled={refreshing}
              onClick={() => fetchDashboardData(plasticPeriod, customFromDate, customToDate, true)}
            >
              {refreshing ? "⏳ Refreshing..." : "🔄 Refresh"}
            </button>
          </div>
        </header>

        {error && <div className="plastic-alert error">{error}</div>}

        {/* Custom Date Selector */}
        {plasticPeriod === "custom" && (
          <form className="plastic-custom-date-box" onSubmit={handleApplyCustomFilter}>
            <div className="custom-input-wrap">
              <label>From Date:</label>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                required
              />
            </div>
            <div className="custom-input-wrap">
              <label>To Date:</label>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="plastic-btn-primary">
              Apply Filter
            </button>
          </form>
        )}

        {/* 6 Executive KPI Metric Cards */}
        <section className="plastic-kpi-grid">
          <div className="plastic-kpi-card accent-green">
            <div className="kpi-icon-wrap">⚖️</div>
            <div className="kpi-details">
              <span className="kpi-label">Raw Material Purchased</span>
              <strong className="kpi-value">
                {Number(plasticStats.totalPurchasedKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="kpi-subtext">Total volume inward</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-blue">
            <div className="kpi-icon-wrap">💵</div>
            <div className="kpi-details">
              <span className="kpi-label">Total Purchase Amount</span>
              <strong className="kpi-value">{formatCurrency(plasticStats.totalPurchaseAmount)}</strong>
              <span className="kpi-subtext">Cumulative scrap spend</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-teal">
            <div className="kpi-icon-wrap">🏭</div>
            <div className="kpi-details">
              <span className="kpi-label">Current Scrap Stock</span>
              <strong className="kpi-value">
                {Number(plasticStats.currentStockKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="kpi-subtext val">Valuation: {formatCurrency(plasticStats.currentStockValue)}</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-amber">
            <div className="kpi-icon-wrap">🏢</div>
            <div className="kpi-details">
              <span className="kpi-label">Active Suppliers</span>
              <strong className="kpi-value">{plasticStats.totalSuppliers || 0}</strong>
              <span className="kpi-subtext">Registered scrap vendors</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-purple">
            <div className="kpi-icon-wrap">🚚</div>
            <div className="kpi-details">
              <span className="kpi-label">Truck Inwards</span>
              <strong className="kpi-value">{plasticStats.totalTruckInwards || 0}</strong>
              <span className="kpi-subtext">Vehicles logged</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-rose">
            <div className="kpi-icon-wrap">📑</div>
            <div className="kpi-details">
              <span className="kpi-label">Purchase Bills</span>
              <strong className="kpi-value">{plasticStats.totalPurchaseBills || 0}</strong>
              <span className="kpi-subtext">Billed transactions</span>
            </div>
          </div>
        </section>

        {/* Phase 2: Plant Operations & Production KPIs */}
        <div className="section-title-wrap" style={{ marginBottom: "14px", marginTop: "10px" }}>
          <h2 style={{ fontSize: "16px", color: "#065f46" }}>⚙️ Plant Operations, Production & Quality KPIs</h2>
        </div>
        <section className="plastic-kpi-grid">
          <div className="plastic-kpi-card accent-emerald">
            <div className="kpi-icon-wrap">⚙️</div>
            <div className="kpi-details">
              <span className="kpi-label">Active Batches</span>
              <strong className="kpi-value">{plasticStats.activeBatches || 0} Running</strong>
              <span className="kpi-subtext">Live on extrusion shop floor</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-indigo">
            <div className="kpi-icon-wrap">🏷️</div>
            <div className="kpi-details">
              <span className="kpi-label">Finished Goods Stock</span>
              <strong className="kpi-value">
                {Number(plasticStats.finishedGoodsStockKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="kpi-subtext">Pellets / granules in warehouse</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-cyan">
            <div className="kpi-icon-wrap">🔄</div>
            <div className="kpi-details">
              <span className="kpi-label">WIP Inventory</span>
              <strong className="kpi-value">
                {Number(plasticStats.currentWipKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="kpi-subtext">Flakes & material in process</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-amber">
            <div className="kpi-icon-wrap">♻️</div>
            <div className="kpi-details">
              <span className="kpi-label">Regrind Generated</span>
              <strong className="kpi-value">
                {Number(plasticStats.regrindGeneratedKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="kpi-subtext">Recycled back to production</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-purple">
            <div className="kpi-icon-wrap">🏭</div>
            <div className="kpi-details">
              <span className="kpi-label">Active Machines</span>
              <strong className="kpi-value">
                {plasticStats.activeMachines || 0} Operational
              </strong>
              <span className="kpi-subtext">
                {plasticStats.machineUtilizationPercent || 0}% Plant Utilization
              </span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-rose">
            <div className="kpi-icon-wrap">🔬</div>
            <div className="kpi-details">
              <span className="kpi-label">Quality Status</span>
              <strong className="kpi-value">{plasticStats.qcPending || 0} Pending</strong>
              <span className="kpi-subtext">
                {plasticStats.qcRejected || 0} Rejection(s) logged
              </span>
            </div>
          </div>
        </section>

        {/* Phase 3: Sales, Outward Dispatch & Financial Collections KPIs */}
        <div className="section-title-wrap" style={{ marginBottom: "14px", marginTop: "16px" }}>
          <h2 style={{ fontSize: "16px", color: "#1e3a8a" }}>💼 Sales, Dispatch & Finance Intelligence (Phase 3)</h2>
        </div>
        <section className="plastic-kpi-grid">
          <div className="plastic-kpi-card accent-blue">
            <div className="kpi-icon-wrap">📋</div>
            <div className="kpi-details">
              <span className="kpi-label">Active Sales Orders</span>
              <strong className="kpi-value">
                {plasticStats.pendingOrders || 0} Orders
              </strong>
              <span className="kpi-subtext">Total Confirmed: {plasticStats.salesOrders || 0}</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-green">
            <div className="kpi-icon-wrap">🚚</div>
            <div className="kpi-details">
              <span className="kpi-label">Dispatch Operations</span>
              <strong className="kpi-value">
                {plasticStats.totalDispatches || 0} Shipped
              </strong>
              <span className="kpi-subtext">
                {plasticStats.todayDispatches || 0} shipped today
              </span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-emerald">
            <div className="kpi-icon-wrap">💵</div>
            <div className="kpi-details">
              <span className="kpi-label">Realized Collections</span>
              <strong className="kpi-value">
                {formatCurrency(plasticStats.paymentsCollected || 0)}
              </strong>
              <span className="kpi-subtext">Cash, bank & UPI receipts</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-rose">
            <div className="kpi-icon-wrap">⏳</div>
            <div className="kpi-details">
              <span className="kpi-label">Net Receivables Dues</span>
              <strong className="kpi-value">
                {formatCurrency(plasticStats.outstandingReceivables || 0)}
              </strong>
              <span className="kpi-subtext">Customer outstanding balance</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-purple">
            <div className="kpi-icon-wrap">📈</div>
            <div className="kpi-details">
              <span className="kpi-label">Gross Profit & Margin</span>
              <strong className="kpi-value">
                {formatCurrency(plasticStats.grossProfit || 0)}
              </strong>
              <span className="kpi-subtext">
                {Number(plasticStats.grossMarginPercent || 0).toFixed(1)}% Realized margin
              </span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-amber">
            <div className="kpi-icon-wrap">🏷️</div>
            <div className="kpi-details">
              <span className="kpi-label">Finished Goods Sold</span>
              <strong className="kpi-value">
                {Number(plasticStats.finishedGoodsSoldKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="kpi-subtext">
                {plasticStats.salesReturns || 0} returns ({formatCurrency(plasticStats.salesReturnAmount || 0)})
              </span>
            </div>
          </div>
        </section>

        {/* Phase 4: HR, Payroll & Plant Expense Management KPIs */}
        <div className="section-title-wrap" style={{ marginBottom: "14px", marginTop: "16px" }}>
          <h2 style={{ fontSize: "16px", color: "#047857" }}>👥 HR, Workforce, Payroll & Expense Intelligence (Phase 4)</h2>
        </div>
        <section className="plastic-kpi-grid">
          <div className="plastic-kpi-card accent-emerald">
            <div className="kpi-icon-wrap">👥</div>
            <div className="kpi-details">
              <span className="kpi-label">Active Plant Staff</span>
              <strong className="kpi-value">{plasticStats.totalEmployees || 0} Employees</strong>
              <span className="kpi-subtext">{plasticStats.todayPresentEmployees || 0} clocked in today</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-indigo">
            <div className="kpi-icon-wrap">💰</div>
            <div className="kpi-details">
              <span className="kpi-label">Monthly Payroll Net</span>
              <strong className="kpi-value">{formatCurrency(plasticStats.monthPayrollAmount || 0)}</strong>
              <span className="kpi-subtext">Disbursed salary batch</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-rose">
            <div className="kpi-icon-wrap">🧾</div>
            <div className="kpi-details">
              <span className="kpi-label">Month Plant Overheads</span>
              <strong className="kpi-value">{formatCurrency(plasticStats.monthExpensesAmount || 0)}</strong>
              <span className="kpi-subtext">Power, spares & fuel vouchers</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-amber">
            <div className="kpi-icon-wrap">💳</div>
            <div className="kpi-details">
              <span className="kpi-label">Staff Advances Balance</span>
              <strong className="kpi-value">{formatCurrency(plasticStats.outstandingAdvanceAmount || 0)}</strong>
              <span className="kpi-subtext">{plasticStats.activeAdvances || 0} active loans ongoing</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-purple">
            <div className="kpi-icon-wrap">🏖️</div>
            <div className="kpi-details">
              <span className="kpi-label">Pending Leave Reviews</span>
              <strong className="kpi-value">{plasticStats.pendingLeavesCount || 0} Applications</strong>
              <span className="kpi-subtext">Awaiting manager sanction</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-teal">
            <div className="kpi-icon-wrap">📊</div>
            <div className="kpi-details">
              <span className="kpi-label">HR Quick Actions</span>
              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                <Link to="/plastic-erp/payroll" className="plastic-chip" style={{ textDecoration: "none", cursor: "pointer" }}>Run Payroll</Link>
                <Link to="/plastic-erp/attendance" className="plastic-chip" style={{ textDecoration: "none", cursor: "pointer" }}>Roll Call</Link>
              </div>
              <span className="kpi-subtext" style={{ marginTop: "4px" }}>Manage monthly plant workforce</span>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* ROW 1: Sections A & B (Charts & Distribution)        */}
        {/* ---------------------------------------------------- */}
        <div className="plastic-dashboard-dual-grid">
          {/* Section A: Monthly Purchase Trend */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>📈 Monthly Purchase Trend</h2>
                <p>
                  {plasticPeriod === "today"
                    ? "Scrap purchase transactions logged today"
                    : plasticPeriod === "month"
                    ? "Daily scrap purchase spend for this month"
                    : plasticPeriod === "year"
                    ? "Monthly scrap purchase spend for this year"
                    : customFromDate && customToDate
                    ? `Scrap purchase spend from ${formatDate(customFromDate)} to ${formatDate(customToDate)}`
                    : "Scrap purchase spend trend over time"}
                </p>
              </div>
              <span className="exec-badge-pill">
                {monthlyTrendData.length > 0
                  ? `${monthlyTrendData.length} ${
                      plasticPeriod === "today"
                        ? "Bills"
                        : plasticPeriod === "month"
                        ? "Days"
                        : "Periods"
                    }`
                  : "Trend"}
              </span>
            </div>

            {monthlyTrendData.length > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                  <BarChart data={monthlyTrendData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `₹${Number(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val, name, item) => [
                        `${formatCurrency(val)}${
                          item?.payload?.billsCount
                            ? ` (${item.payload.billsCount} bill${item.payload.billsCount === 1 ? "" : "s"})`
                            : ""
                        }`,
                        "Spend",
                      ]}
                      labelFormatter={(label) =>
                        `${
                          plasticPeriod === "today"
                            ? "Bill"
                            : plasticPeriod === "month"
                            ? "Date"
                            : "Period"
                        }: ${label}`
                      }
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Bar dataKey="amount" name="Spend" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">📊</span>
                <h3>No Purchase Trend Recorded</h3>
                <p>
                  {plasticPeriod === "today"
                    ? "No purchase bills recorded for today."
                    : plasticPeriod === "month"
                    ? "No purchase bills recorded for this month."
                    : plasticPeriod === "year"
                    ? "No purchase bills recorded for this year."
                    : "No purchase bills recorded for this period."}
                </p>
              </div>
            )}
          </section>

          {/* Section B: Scrap Stock by Material */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>♻️ Scrap Stock by Material</h2>
                <p>Inventory volume distribution by polymer grade</p>
              </div>
              <span className="exec-badge-pill">
                {polymerDistribution.totalStockAcrossAll.toLocaleString("en-IN")} KG Total
              </span>
            </div>

            {polymerDistribution.totalStockAcrossAll > 0 ? (
              <div className="polymer-distribution-wrap">
                <div className="donut-chart-box">
                  <ResponsiveContainer width="100%" height={210} minWidth={0}>
                    <PieChart>
                      <Pie
                        data={polymerDistribution.chartData}
                        dataKey="quantityKg"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {polymerDistribution.chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val, name, item) => [
                          `${Number(val).toLocaleString("en-IN")} KG (${item.payload.percentage}%)`,
                          name,
                        ]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="polymer-legend-grid">
                  {polymerDistribution.allData.map((poly) => (
                    <div className="polymer-legend-row" key={poly.name}>
                      <div className="polymer-legend-label">
                        <span className="polymer-color-dot" style={{ backgroundColor: poly.color }} />
                        <strong>{poly.name}</strong>
                      </div>
                      <div className="polymer-legend-metrics">
                        <span>{Number(poly.quantityKg).toLocaleString("en-IN")} KG</span>
                        <span className="polymer-pct-badge">{poly.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">📦</span>
                <h3>No Material Stock Available</h3>
                <p>Register raw materials and record inward weighments to display polymer distribution.</p>
              </div>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------- */}
        {/* ROW 2: Sections C & E (Recent Inwards & Bills)       */}
        {/* ---------------------------------------------------- */}
        <div className="plastic-dashboard-dual-grid">
          {/* Section C: Recent Truck Inwards */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>🚚 Recent Truck Inwards</h2>
                <p>Latest inbound scrap vehicles recorded at Kim plant</p>
              </div>
              <Link to="/plastic-erp/truck-inward" className="exec-view-all-link">
                View All →
              </Link>
            </div>

            {recentInwards.length > 0 ? (
              <div className="exec-table-wrap">
                <table className="exec-mini-table">
                  <thead>
                    <tr>
                      <th>Inward Slip</th>
                      <th>Truck No</th>
                      <th>Date</th>
                      <th>Supplier / Material</th>
                      <th style={{ textAlign: "right" }}>Net Weight</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInwards.map((ti) => (
                      <tr key={ti.id}>
                        <td>
                          <strong>{ti.inward_no}</strong>
                        </td>
                        <td>{ti.truck_number}</td>
                        <td>{formatDate(ti.inward_date)}</td>
                        <td>
                          <div className="cell-subline">
                            <span className="cell-title">{ti.supplier_name}</span>
                            <span className="cell-sub">{ti.material_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {Number(ti.net_weight || 0).toLocaleString("en-IN")} KG
                        </td>
                        <td>
                          <span
                            className={`exec-status-badge status-${(ti.quality_status || "PENDING").toLowerCase()}`}
                          >
                            {ti.quality_status || "PENDING"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">🚚</span>
                <h3>No Inward Trucks Recorded</h3>
                <p>Log incoming scrap delivery vehicles at the plant weighbridge.</p>
              </div>
            )}
          </section>

          {/* Section E: Recent Purchase Bills */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>📑 Recent Purchase Bills</h2>
                <p>Latest supplier scrap purchase bills</p>
              </div>
              <Link to="/plastic-erp/purchase-bills" className="exec-view-all-link">
                View All →
              </Link>
            </div>

            {recentBills.length > 0 ? (
              <div className="exec-table-wrap">
                <table className="exec-mini-table">
                  <thead>
                    <tr>
                      <th>Bill No</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Grand Total</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBills.map((pb) => (
                      <tr key={pb.id}>
                        <td>
                          <strong>{pb.purchase_bill_no}</strong>
                        </td>
                        <td>{pb.supplier_name}</td>
                        <td>{formatDate(pb.purchase_date)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(pb.grand_total)}
                        </td>
                        <td>
                          <span
                            className={`exec-status-badge pay-${(pb.payment_status || "UNPAID").toLowerCase()}`}
                          >
                            {pb.payment_status || "UNPAID"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">📑</span>
                <h3>No Purchase Bills Generated</h3>
                <p>Create purchase bills from inward slips to track vendor invoices.</p>
              </div>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------- */}
        {/* ROW 3: Sections D & F (Low Stock & Top Suppliers)    */}
        {/* ---------------------------------------------------- */}
        <div className="plastic-dashboard-dual-grid">
          {/* Section D: Low Stock Raw Materials */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>⚠️ Low Stock Raw Materials</h2>
                <p>Materials currently at or below minimum threshold</p>
              </div>
              <Link to="/plastic-erp/stock" className="exec-view-all-link">
                View All →
              </Link>
            </div>

            {lowStockItems.length > 0 ? (
              <div className="exec-alert-list">
                {lowStockItems.map((mat) => (
                  <div className="exec-alert-row" key={mat.id || mat.material_name}>
                    <div className="exec-alert-left">
                      <span className="polymer-badge-mini">{mat.plastic_type || "SCRAP"}</span>
                      <div>
                        <h4>{mat.material_name}</h4>
                        <p>
                          Safety Threshold: {mat.minimum_stock} {mat.unit || "KG"}
                        </p>
                      </div>
                    </div>
                    <div className="exec-alert-right">
                      <span className="stock-critical-value">
                        {mat.current_stock} {mat.unit || "KG"}
                      </span>
                      <Link to="/plastic-erp/stock" className="exec-action-link">
                        Adjust Stock →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">✅</span>
                <h3>All Scrap Polymers Sufficiently Stocked</h3>
                <p>All raw material inventory levels exceed minimum safety thresholds.</p>
              </div>
            )}
          </section>

          {/* Section F: Top Suppliers */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>🏢 Top Suppliers</h2>
                <p>Key scrap vendor volume and billing overview</p>
              </div>
              <Link to="/plastic-erp/suppliers" className="exec-view-all-link">
                View All →
              </Link>
            </div>

            {topSuppliers.length > 0 ? (
              <div className="exec-table-wrap">
                <table className="exec-mini-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Supplier Name</th>
                      <th>Bills</th>
                      <th style={{ textAlign: "right" }}>Total Volume / Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSuppliers.map((sup, idx) => (
                      <tr key={sup.name}>
                        <td style={{ color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>
                        <td>
                          <div className="cell-subline">
                            <span className="cell-title">{sup.name}</span>
                            {sup.code && <span className="cell-sub">{sup.code}</span>}
                          </div>
                        </td>
                        <td>
                          {sup.isRegistryOnly ? (
                            <span style={{ color: "#64748b", fontSize: "12px" }}>Active Vendor</span>
                          ) : (
                            <span className="count-pill">{sup.billsCount} Bills</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {sup.isRegistryOnly ? (
                            <span style={{ color: "#64748b", fontSize: "12px" }}>{sup.city}</span>
                          ) : (
                            formatCurrency(sup.totalSpend)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">🏢</span>
                <h3>No Suppliers Registered</h3>
                <p>Add scrap vendors to track purchases, truck deliveries, and balances.</p>
              </div>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------- */}
        {/* Phase 3 Alerts Strip (if any active alerts)          */}
        {/* ---------------------------------------------------- */}
        {phase3Analytics?.alerts && (
          (phase3Analytics.alerts.pendingOrders > 0) ||
          (phase3Analytics.alerts.readyDispatches > 0) ||
          (phase3Analytics.alerts.overdueInvoices > 0) ||
          (phase3Analytics.alerts.lowStockFg > 0)
        ) && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
            {phase3Analytics.alerts.pendingOrders > 0 && (
              <Link to="/plastic-erp/sales-orders" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                <span>📋 {phase3Analytics.alerts.pendingOrders} Sales Order(s) Awaiting Confirmation</span>
              </Link>
            )}
            {phase3Analytics.alerts.readyDispatches > 0 && (
              <Link to="/plastic-erp/dispatches" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                <span>🚚 {phase3Analytics.alerts.readyDispatches} Dispatch(es) Ready for Truck Loading</span>
              </Link>
            )}
            {phase3Analytics.alerts.overdueInvoices > 0 && (
              <Link to="/plastic-erp/finance/receivables" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                <span>⏳ {phase3Analytics.alerts.overdueInvoices} Overdue Invoice(s)</span>
              </Link>
            )}
            {phase3Analytics.alerts.lowStockFg > 0 && (
              <Link to="/plastic-erp/wip-fg" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                <span>⚠️ {phase3Analytics.alerts.lowStockFg} Finished Good(s) at Low Stock</span>
              </Link>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* Phase 4 HR, Payroll & Expense Operational Alerts     */}
        {/* ---------------------------------------------------- */}
        {phase4Analytics?.alerts && (
          (phase4Analytics.alerts.pendingLeaves > 0) ||
          (phase4Analytics.alerts.activeAdvances > 0) ||
          (phase4Analytics.alerts.draftPayrolls > 0) ||
          (phase4Analytics.alerts.pendingExpenseBills > 0)
        ) && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
            {phase4Analytics.alerts.pendingLeaves > 0 && (
              <Link to="/plastic-erp/leaves" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                <span>🏖️ {phase4Analytics.alerts.pendingLeaves} Leave Application(s) Pending Approval</span>
              </Link>
            )}
            {phase4Analytics.alerts.draftPayrolls > 0 && (
              <Link to="/plastic-erp/payroll" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                <span>💰 {phase4Analytics.alerts.draftPayrolls} Draft Payroll Batch(es) Ready for Review</span>
              </Link>
            )}
            {phase4Analytics.alerts.pendingExpenseBills > 0 && (
              <Link to="/plastic-erp/expenses" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                <span>🧾 {phase4Analytics.alerts.pendingExpenseBills} Plant Expense Voucher(s) Unpaid</span>
              </Link>
            )}
            {phase4Analytics.alerts.activeAdvances > 0 && (
              <Link to="/plastic-erp/advances" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                <span>💳 {phase4Analytics.alerts.activeAdvances} Active Employee Advance(s) in Recovery</span>
              </Link>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* ROW 4: Phase 3 Dispatches & Top Finished Goods       */}
        {/* ---------------------------------------------------- */}
        <div className="plastic-dashboard-dual-grid">
          {/* Recent Outward Dispatches */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>🚚 Recent Outward Dispatches</h2>
                <p>Latest outbound finished goods dispatches</p>
              </div>
              <Link to="/plastic-erp/dispatches" className="exec-view-all-link">
                View All →
              </Link>
            </div>

            {Array.isArray(phase3Analytics?.recentDispatches) && phase3Analytics.recentDispatches.length > 0 ? (
              <div className="exec-table-wrap">
                <table className="exec-mini-table">
                  <thead>
                    <tr>
                      <th>Dispatch No</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Vehicle</th>
                      <th style={{ textAlign: "right" }}>Volume</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phase3Analytics.recentDispatches.map((d) => (
                      <tr key={d.id}>
                        <td><strong>{d.dispatch_no}</strong></td>
                        <td>{d.customer_name}</td>
                        <td>{formatDate(d.dispatch_date)}</td>
                        <td>{d.vehicle_number || "-"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {Number(d.total_kg || 0).toLocaleString("en-IN")} KG
                        </td>
                        <td>
                          <span className={`exec-status-badge status-${(d.status || "").toLowerCase()}`}>
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">🚚</span>
                <h3>No Outward Dispatches Yet</h3>
                <p>Create dispatches against confirmed sales orders to track outward shipments.</p>
              </div>
            )}
          </section>

          {/* Top Selling Finished Goods */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>🏷️ Top Selling Finished Goods</h2>
                <p>Leading plastic granules and finished products by volume</p>
              </div>
              <Link to="/plastic-erp/wip-fg" className="exec-view-all-link">
                View Catalog →
              </Link>
            </div>

            {Array.isArray(phase3Analytics?.topFinishedGoods) && phase3Analytics.topFinishedGoods.length > 0 ? (
              <div className="exec-table-wrap">
                <table className="exec-mini-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Polymer</th>
                      <th style={{ textAlign: "right" }}>Sold Volume</th>
                      <th style={{ textAlign: "right" }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phase3Analytics.topFinishedGoods.map((fg) => (
                      <tr key={fg.id}>
                        <td>
                          <div className="cell-subline">
                            <span className="cell-title">{fg.fg_name}</span>
                            <span className="cell-sub">{fg.fg_code}</span>
                          </div>
                        </td>
                        <td>
                          <span className="polymer-badge-mini">{fg.plastic_type}</span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {Number(fg.sold_qty || 0).toLocaleString("en-IN")} KG
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(fg.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">🏷️</span>
                <h3>No Finished Goods Sales Recorded</h3>
                <p>Dispatch finished granules to record product-wise sales and revenue.</p>
              </div>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------- */}
        {/* ROW 5: Phase 3 Top Customers & Sales Pipeline        */}
        {/* ---------------------------------------------------- */}
        <div className="plastic-dashboard-dual-grid">
          {/* Key Sales Customers */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>👥 Key Sales Customers</h2>
                <p>Top revenue-generating plastic granule buyers</p>
              </div>
              <Link to="/plastic-erp/finance/receivables" className="exec-view-all-link">
                Receivables →
              </Link>
            </div>

            {Array.isArray(phase3Analytics?.topCustomers) && phase3Analytics.topCustomers.length > 0 ? (
              <div className="exec-table-wrap">
                <table className="exec-mini-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Mobile</th>
                      <th style={{ textAlign: "right" }}>Total Revenue</th>
                      <th style={{ textAlign: "right" }}>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phase3Analytics.topCustomers.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                            {c.invoices_count} Invoice{c.invoices_count === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td>{c.mobile || "-"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(c.total_revenue)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: Number(c.outstanding) > 0 ? "#dc2626" : "#059669" }}>
                          {formatCurrency(c.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">👥</span>
                <h3>No Customer Revenue History</h3>
                <p>Generate customer invoices from dispatches to view client ranking.</p>
              </div>
            )}
          </section>

          {/* Sales Order Pipeline */}
          <section className="plastic-executive-card">
            <div className="exec-card-header">
              <div>
                <h2>📊 Sales Order Pipeline</h2>
                <p>Order status distribution and pipeline value</p>
              </div>
              <Link to="/plastic-erp/sales-orders" className="exec-view-all-link">
                View Orders →
              </Link>
            </div>

            {Array.isArray(phase3Analytics?.pipeline) && phase3Analytics.pipeline.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px", padding: "8px 0" }}>
                {phase3Analytics.pipeline.map((pipe) => (
                  <div key={pipe.status} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                    <span className={`exec-status-badge status-${(pipe.status || "").toLowerCase()}`}>
                      {pipe.status}
                    </span>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "6px" }}>
                      {pipe.count}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      {formatCurrency(pipe.value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="plastic-empty-card mini">
                <span className="empty-icon">📋</span>
                <h3>No Orders in Pipeline</h3>
                <p>Create customer sales orders to monitor fulfillment stages.</p>
              </div>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------- */}
        {/* Plant Operations & Modules Navigation Grid           */}
        {/* ---------------------------------------------------- */}
        <section className="plastic-section-block">
          <div className="section-title-wrap">
            <h2>Plant Operations & Modules</h2>
            <p>Access scrap inward slips, weighbridge records, and purchase billing workflows</p>
          </div>

          <div className="operations-grid">
            {quickOperations.map((op) => (
              <Link to={op.link} key={op.title} className="operation-card">
                <div className="op-card-top">
                  <span className="op-icon">{op.icon}</span>
                  <span className="op-badge" style={{ backgroundColor: `${op.color}15`, color: op.color }}>
                    {op.count}
                  </span>
                </div>
                <h3>{op.title}</h3>
                <p>{op.desc}</p>
                <span className="op-link-text" style={{ color: op.color }}>
                  Manage {op.title} →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default PlasticDashboard;
