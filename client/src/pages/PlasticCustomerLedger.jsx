import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, Button } from "../components";
import "./PlasticCustomerLedger.css";

function PlasticCustomerLedger() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCustId = searchParams.get("customerId") || "";

  const [loading, setLoading] = useState(true);
  const [fetchingLedger, setFetchingLedger] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustId);
  const [customerData, setCustomerData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);

  // Date filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await API.get("/customers");
      if (res.data?.customers) {
        setCustomers(res.data.customers || []);
        if (!selectedCustomerId && res.data.customers.length > 0) {
          setSelectedCustomerId(res.data.customers[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
      alert("Failed to load customer list");
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (custId, start, end) => {
    if (!custId) return;
    try {
      setFetchingLedger(true);
      let url = `/plastic-erp/finance/ledger/${custId}`;
      const params = [];
      if (start) params.push(`from_date=${start}`);
      if (end) params.push(`to_date=${end}`);
      if (params.length > 0) url += `?${params.join("&")}`;

      const res = await API.get(url);
      if (res.data?.success) {
        setCustomerData(res.data.customer);
        setEntries(res.data.entries || []);
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch customer ledger:", err);
      alert(err.response?.data?.message || "Failed to fetch customer ledger");
    } finally {
      setFetchingLedger(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      setSearchParams({ customerId: selectedCustomerId });
      fetchLedger(selectedCustomerId, fromDate, toDate);
    }
  }, [selectedCustomerId, fromDate, toDate]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <LoadingScreen message="Loading Customer Ledgers..." />;

  const closingBal = Number(summary?.closingBalance || 0);

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <div className="no-print">
          <PageHeader
            title="Customer Ledger & Account Statement"
            subtitle="Complete chronological debit/credit audit trail with real-time running balances."
            badge="ACCOUNTING STATEMENT"
            actions={
              <div className="pledger-header-actions">
                <Link to="/plastic-erp/finance/receivables" className="sb-link-btn">
                  <Button variant="secondary" size="md">Receivables Dashboard</Button>
                </Link>
                <Link to="/plastic-erp/payments" className="sb-link-btn">
                  <Button variant="primary" size="md">+ Collect Payment</Button>
                </Link>
                <Button variant="secondary" size="md" onClick={handlePrint}>
                  🖨️ Print Statement
                </Button>
              </div>
            }
          />
        </div>

        {/* Customer Selector & Filters */}
        <div className="no-print">
          <Card className="pledger-filter-card">
            <div className="pledger-selector-bar">
              <div className="selector-field cust-select-field">
                <label>Select Customer Account</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="sb-select"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.mobile ? `(${c.mobile})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="selector-field">
                <label>From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="sb-input"
                />
              </div>

              <div className="selector-field">
                <label>To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="sb-input"
                />
              </div>

              {(fromDate || toDate) && (
                <div className="selector-field align-bottom">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                    }}
                  >
                    Clear Dates
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* PRINTABLE STATEMENT CONTAINER */}
        <div className="ledger-statement-document">
          {/* Customer Profile Banner */}
          {customerData && (
            <div className="cust-statement-header">
              <div className="cust-statement-info">
                <h2>{customerData.name}</h2>
                <div className="cust-meta-row">
                  <span><strong>Mobile:</strong> {customerData.mobile || "—"}</span>
                  <span><strong>Email:</strong> {customerData.email || "—"}</span>
                </div>
                <div className="cust-address">{customerData.address || "Address not specified"}</div>
              </div>

              <div className="cust-balance-summary">
                <div className="bal-label">Current Closing Balance</div>
                <div className={`bal-amount ${closingBal > 0 ? "debit" : "credit"}`}>
                  ₹{Math.abs(closingBal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  <span className="dr-cr-tag">{closingBal >= 0 ? " Dr (Due)" : " Cr (Advance)"}</span>
                </div>
                <div className="statement-period">
                  {fromDate || toDate
                    ? `Period: ${fromDate || "Beginning"} to ${toDate || "Present"}`
                    : "Full Historical Statement"}
                </div>
              </div>
            </div>
          )}

          {/* Statement Summary KPI Cards */}
          <div className="statement-kpis">
            <div className="st-kpi debit">
              <div className="st-lbl">Total Debits (Invoiced / Charges)</div>
              <div className="st-val">
                ₹{Number(summary?.totalDebit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="st-kpi credit">
              <div className="st-lbl">Total Credits (Paid / Credit Notes)</div>
              <div className="st-val">
                ₹{Number(summary?.totalCredit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="st-kpi net">
              <div className="st-lbl">Net Outstanding Due</div>
              <div className="st-val">
                ₹{Number(summary?.closingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          {fetchingLedger ? (
            <div className="ledger-loading">Loading transaction history...</div>
          ) : entries.length === 0 ? (
            <div className="ledger-empty">No transactions found for this customer account.</div>
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Ref / Voucher #</th>
                    <th>Particulars / Description</th>
                    <th className="text-right">Debit (₹)</th>
                    <th className="text-right">Credit (₹)</th>
                    <th className="text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((item) => {
                    const dr = Number(item.debit || 0);
                    const cr = Number(item.credit || 0);
                    const bal = Number(item.balance || 0);
                    return (
                      <tr key={item.id}>
                        <td>
                          {item.transaction_date
                            ? new Date(item.transaction_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>
                          <span className={`txn-badge ${String(item.transaction_type).toLowerCase()}`}>
                            {item.transaction_type}
                          </span>
                        </td>
                        <td>
                          <strong className="voucher-num">
                            {item.reference_id ? `#${item.reference_id}` : "—"}
                          </strong>
                        </td>
                        <td>{item.description || "—"}</td>
                        <td className="text-right dr-val">
                          {dr > 0 ? `₹${dr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="text-right cr-val">
                          {cr > 0 ? `₹${cr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="text-right bal-val">
                          <strong>₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                          <span className={`dr-cr-mini ${bal >= 0 ? "dr" : "cr"}`}>
                            {bal >= 0 ? " Dr" : " Cr"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="ledger-foot-row">
                    <td colSpan="4" className="text-right bold">
                      Totals:
                    </td>
                    <td className="text-right bold dr-val">
                      ₹{Number(summary?.totalDebit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right bold cr-val">
                      ₹{Number(summary?.totalCredit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right bold">
                      ₹{Math.abs(closingBal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      {closingBal >= 0 ? " Dr" : " Cr"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Statement Footer */}
          <div className="statement-footer">
            <p>This is a computer-generated account statement and does not require a signature.</p>
            <p className="timestamp">Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlasticCustomerLedger;
