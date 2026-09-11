import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button, Tabs, StatusBadge } from "../components";
import "./PlasticGstManagement.css";

function PlasticGstManagement() {
  const [activeTab, setActiveTab] = useState("gstr1"); // gstr1, gstr3b, itc, all
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [searchTerm, setSearchTerm] = useState("");
  const [gstTypeFilter, setGstTypeFilter] = useState("ALL");

  // Data states
  const [gstr1Data, setGstr1Data] = useState(null);
  const [gstr3bData, setGstr3bData] = useState(null);
  const [itcRecords, setItcRecords] = useState([]);
  const [itcSummary, setItcSummary] = useState(null);
  const [allRecords, setAllRecords] = useState([]);
  const [allSummary, setAllSummary] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "gstr1") {
        const res = await API.get("/plastic-erp/accounting/gst/gstr-1", {
          params: { month, year },
        });
        if (res.data?.success) setGstr1Data(res.data);
      } else if (activeTab === "gstr3b") {
        const res = await API.get("/plastic-erp/accounting/gst/gstr-3b", {
          params: { month, year },
        });
        if (res.data?.success) setGstr3bData(res.data);
      } else if (activeTab === "itc") {
        const res = await API.get("/plastic-erp/accounting/gst/itc-register", {
          params: { month, year },
        });
        if (res.data?.success) {
          setItcRecords(res.data.records || []);
          setItcSummary(res.data.summary || null);
        }
      } else if (activeTab === "all") {
        const res = await API.get("/plastic-erp/accounting/gst/records", {
          params: {
            gst_type: gstTypeFilter,
            search: searchTerm,
          },
        });
        if (res.data?.success) {
          setAllRecords(res.data.records || []);
          setAllSummary(res.data.summary || null);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load GST data");
    } finally {
      setLoading(false);
    }
  }, [activeTab, month, year, gstTypeFilter, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateItcStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "ELIGIBLE" ? "INELIGIBLE" : "ELIGIBLE";
    try {
      const res = await API.patch(`/plastic-erp/accounting/gst/itc-status/${id}`, {
        itc_eligibility: nextStatus,
      });
      if (res.data?.success) {
        setSuccessMsg(`Record #${id} ITC updated to ${nextStatus}`);
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update ITC status");
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const tabItems = [
    { key: "gstr1", label: "GSTR-1 Outward Supplies", icon: "📑" },
    { key: "gstr3b", label: "GSTR-3B Monthly Return", icon: "📊" },
    { key: "itc", label: "ITC Register & Eligibility", icon: "📥" },
    { key: "all", label: "All GST Transactions", icon: "📋" },
  ];

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="GST Management & Returns Preparation"
          subtitle="Comprehensive GSTR-1, GSTR-3B preparation tables, ITC register, and statutory audit verification"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "Accounting & GST", to: "/plastic-erp/accounting-dashboard" },
            { label: "GST Returns" },
          ]}
          actions={
            <div className="gst-period-picker">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="sb-select gst-month-select"
              >
                {monthNames.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="sb-select gst-year-select"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
              <Button
                variant="outline"
                icon="🔄"
                onClick={fetchData}
              >
                Refresh
              </Button>
            </div>
          }
        />

        {/* Advisory alert */}
        <div className="gst-advisory-banner">
          <span className="adv-icon">⚖️</span>
          <span>
            <strong>Statutory Preparation Notice:</strong> Verify all self-assessment computations with your certified GST practitioner before final portal submission.
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="gst-tabs-wrap">
          <Tabs
            items={tabItems}
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k)}
          />
        </div>

        {successMsg && <div className="sb-alert-success">{successMsg}</div>}
        {error && <div className="sb-alert-danger">{error}</div>}

        {loading ? (
          <LoadingScreen message="Loading GST compliance records..." />
        ) : (
          <>
            {/* TAB 1: GSTR-1 */}
            {activeTab === "gstr1" && gstr1Data && (
              <div className="gst-tab-content">
                <div className="gst-kpis-grid">
                  <KpiCard
                    title="B2B Outward Supplies"
                    value={`₹${(gstr1Data.summary?.b2bTaxable || 0).toLocaleString("en-IN")}`}
                    subtitle={`${gstr1Data.summary?.b2bCount || 0} Invoices | Tax: ₹${(gstr1Data.summary?.b2bTax || 0).toLocaleString("en-IN")}`}
                    icon="🏢"
                    color="blue"
                  />
                  <KpiCard
                    title="B2C (Unregistered)"
                    value={`₹${(gstr1Data.summary?.b2cTaxable || 0).toLocaleString("en-IN")}`}
                    subtitle={`${gstr1Data.summary?.b2cCount || 0} Invoices | Tax: ₹${(gstr1Data.summary?.b2cTax || 0).toLocaleString("en-IN")}`}
                    icon="👥"
                    color="teal"
                  />
                  <KpiCard
                    title="Credit / Debit Notes"
                    value={`₹${(gstr1Data.summary?.cdnTaxable || 0).toLocaleString("en-IN")}`}
                    subtitle={`${gstr1Data.summary?.cdnCount || 0} Notes | Tax: ₹${(gstr1Data.summary?.cdnTax || 0).toLocaleString("en-IN")}`}
                    icon="📝"
                    color="amber"
                  />
                  <KpiCard
                    title="Total Outward Tax Liability"
                    value={`₹${(gstr1Data.summary?.totalOutputTax || 0).toLocaleString("en-IN")}`}
                    subtitle={`CGST: ₹${(gstr1Data.summary?.totalOutputCGST || 0).toLocaleString("en-IN")} | SGST: ₹${(gstr1Data.summary?.totalOutputSGST || 0).toLocaleString("en-IN")}`}
                    icon="💰"
                    color="navy"
                  />
                </div>

                {/* Section: B2B Table */}
                <Card
                  title="Table 4: B2B Invoices (Registered Recipients)"
                  subtitle={`Showing ${gstr1Data.b2bSupplies?.length || 0} outward registered transactions for ${monthNames[month - 1]} ${year}`}
                >
                  <div className="gst-table-wrapper">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>Invoice No</th>
                          <th>Date</th>
                          <th>Recipient Name</th>
                          <th>GSTIN</th>
                          <th>POS</th>
                          <th className="cell-right">Taxable Value</th>
                          <th className="cell-right">CGST</th>
                          <th className="cell-right">SGST</th>
                          <th className="cell-right">IGST</th>
                          <th className="cell-right">Total Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstr1Data.b2bSupplies?.length === 0 ? (
                          <tr><td colSpan="10" className="gst-table-empty">No B2B invoices found for selected tax period.</td></tr>
                        ) : (
                          gstr1Data.b2bSupplies.map((row) => (
                            <tr key={row.id}>
                              <td><strong>{row.invoice_no}</strong></td>
                              <td>{row.invoice_date?.split("T")[0]}</td>
                              <td>{row.party_name}</td>
                              <td><code className="gst-code-chip">{row.party_gstin}</code></td>
                              <td>{row.place_of_supply || "Home State"}</td>
                              <td className="cell-right">₹{Number(row.taxable_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(row.cgst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(row.sgst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(row.igst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">
                                <strong className="text-navy">₹{Number(row.total_tax).toLocaleString("en-IN")}</strong>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Section: HSN Summary */}
                <Card
                  title="Table 12: HSN Summary of Outward Supplies"
                  subtitle="HSN code-wise breakdown of sales quantities and taxes"
                >
                  <div className="gst-table-wrapper">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>HSN Code</th>
                          <th>Description</th>
                          <th>UQC</th>
                          <th className="cell-right">Total Taxable Value</th>
                          <th className="cell-right">CGST</th>
                          <th className="cell-right">SGST</th>
                          <th className="cell-right">IGST</th>
                          <th className="cell-right">Total Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstr1Data.hsnSummary?.length === 0 ? (
                          <tr><td colSpan="8" className="gst-table-empty">No HSN data available for this period.</td></tr>
                        ) : (
                          gstr1Data.hsnSummary.map((hsn, idx) => (
                            <tr key={idx}>
                              <td><code className="gst-code-chip">{hsn.hsn_code}</code></td>
                              <td>{hsn.description}</td>
                              <td>{hsn.uqc}</td>
                              <td className="cell-right">₹{Number(hsn.total_taxable_value).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(hsn.cgst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(hsn.sgst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(hsn.igst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">
                                <strong className="text-teal">₹{Number(hsn.total_tax_amount).toLocaleString("en-IN")}</strong>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 2: GSTR-3B */}
            {activeTab === "gstr3b" && gstr3bData && (
              <div className="gst-tab-content">
                <Card
                  title="Table 3.1: Details of Outward Supplies and Inward Supplies Liable to Reverse Charge"
                  subtitle="Consolidated outward tax liability figures"
                >
                  <div className="gst-table-wrapper">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>Nature of Supplies</th>
                          <th className="cell-right">Total Taxable Value</th>
                          <th className="cell-right">Integrated Tax (IGST)</th>
                          <th className="cell-right">Central Tax (CGST)</th>
                          <th className="cell-right">State/UT Tax (SGST)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</strong></td>
                          <td className="cell-right">₹{Number(gstr3bData.table3_1?.taxable_amount || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right">₹{Number(gstr3bData.table3_1?.igst || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right">₹{Number(gstr3bData.table3_1?.cgst || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right">₹{Number(gstr3bData.table3_1?.sgst || 0).toLocaleString("en-IN")}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card
                  title="Table 4: Eligible Input Tax Credit (ITC)"
                  subtitle="Available ITC breakdown from inward purchase bills and reverse charges"
                >
                  <div className="gst-table-wrapper">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>Details</th>
                          <th className="cell-right">Integrated Tax (IGST)</th>
                          <th className="cell-right">Central Tax (CGST)</th>
                          <th className="cell-right">State/UT Tax (SGST)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>(A) ITC Available (whether in full or part) - All other ITC (Purchases/Services)</strong></td>
                          <td className="cell-right text-teal">₹{Number(gstr3bData.table4_itc?.itc_igst || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right text-teal">₹{Number(gstr3bData.table4_itc?.itc_cgst || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right text-teal">₹{Number(gstr3bData.table4_itc?.itc_sgst || 0).toLocaleString("en-IN")}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card
                  title="Table 6: Net Tax Payable (Output Liability − Eligible ITC)"
                  subtitle="Final self-assessment cash liability"
                >
                  <div className="gst-net-tax-grid">
                    <div className="net-box">
                      <span className="net-label">Central Tax (CGST) Payable</span>
                      <strong className="net-amt">₹{Number(gstr3bData.netTaxPayable?.cgstPayable || 0).toLocaleString("en-IN")}</strong>
                      <span className="net-calc">Output ₹{(gstr3bData.table3_1?.cgst || 0).toLocaleString("en-IN")} - ITC ₹{(gstr3bData.table4_itc?.itc_cgst || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="net-box">
                      <span className="net-label">State Tax (SGST) Payable</span>
                      <strong className="net-amt">₹{Number(gstr3bData.netTaxPayable?.sgstPayable || 0).toLocaleString("en-IN")}</strong>
                      <span className="net-calc">Output ₹{(gstr3bData.table3_1?.sgst || 0).toLocaleString("en-IN")} - ITC ₹{(gstr3bData.table4_itc?.itc_sgst || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="net-box">
                      <span className="net-label">Integrated Tax (IGST) Payable</span>
                      <strong className="net-amt">₹{Number(gstr3bData.netTaxPayable?.igstPayable || 0).toLocaleString("en-IN")}</strong>
                      <span className="net-calc">Output ₹{(gstr3bData.table3_1?.igst || 0).toLocaleString("en-IN")} - ITC ₹{(gstr3bData.table4_itc?.itc_igst || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="net-box net-box-total">
                      <span className="net-label">Total Net Cash / Ledger Payable</span>
                      <strong className="net-amt text-navy">₹{Number(gstr3bData.netTaxPayable?.totalPayable || 0).toLocaleString("en-IN")}</strong>
                      <span className="net-calc">Net self-assessment liability</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 3: ITC REGISTER */}
            {activeTab === "itc" && (
              <div className="gst-tab-content">
                {itcSummary && (
                  <div className="gst-kpis-grid">
                    <KpiCard
                      title="Eligible ITC"
                      value={`₹${(itcSummary.eligibleITC || 0).toLocaleString("en-IN")}`}
                      subtitle="Ready for GSTR-3B claim"
                      icon="✅"
                      color="teal"
                    />
                    <KpiCard
                      title="Ineligible / Blocked ITC"
                      value={`₹${(itcSummary.ineligibleITC || 0).toLocaleString("en-IN")}`}
                      subtitle="Under Section 17(5)"
                      icon="🚫"
                      color="amber"
                    />
                    <KpiCard
                      title="Total Input Tax"
                      value={`₹${(itcSummary.totalInputTax || 0).toLocaleString("en-IN")}`}
                      subtitle={`${itcRecords.length} Inward Purchase Bills`}
                      icon="📥"
                      color="blue"
                    />
                  </div>
                )}

                <Card
                  title="Input Tax Credit (ITC) Register"
                  subtitle="Click the eligibility button to toggle an invoice between ELIGIBLE and INELIGIBLE"
                >
                  <div className="gst-table-wrapper">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>Bill No</th>
                          <th>Date</th>
                          <th>Supplier Name</th>
                          <th>Supplier GSTIN</th>
                          <th className="cell-right">Taxable Amount</th>
                          <th className="cell-right">CGST</th>
                          <th className="cell-right">SGST</th>
                          <th className="cell-right">IGST</th>
                          <th className="cell-right">Total ITC</th>
                          <th className="cell-center">Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itcRecords.length === 0 ? (
                          <tr><td colSpan="10" className="gst-table-empty">No input tax credit records found for this period.</td></tr>
                        ) : (
                          itcRecords.map((r) => (
                            <tr key={r.id}>
                              <td><strong>{r.invoice_no}</strong></td>
                              <td>{r.invoice_date?.split("T")[0]}</td>
                              <td>{r.party_name}</td>
                              <td><code className="gst-code-chip">{r.party_gstin || "UNREGISTERED"}</code></td>
                              <td className="cell-right">₹{Number(r.taxable_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(r.cgst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(r.sgst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(r.igst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">
                                <strong className="text-teal">₹{Number(r.total_tax).toLocaleString("en-IN")}</strong>
                              </td>
                              <td className="cell-center">
                                <Button
                                  variant={r.itc_eligibility === "ELIGIBLE" ? "primary" : "outline"}
                                  size="sm"
                                  onClick={() => handleUpdateItcStatus(r.id, r.itc_eligibility)}
                                  title="Click to toggle eligibility"
                                >
                                  {r.itc_eligibility} ⇄
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 4: ALL RECORDS */}
            {activeTab === "all" && (
              <div className="gst-tab-content">
                <Card className="gst-filter-card">
                  <div className="gst-all-filters">
                    <form onSubmit={handleSearchSubmit} className="gst-search-form">
                      <input
                        type="text"
                        placeholder="Search Invoice #, Party Name, GSTIN, HSN..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="sb-input gst-search-input"
                      />
                      <Button type="submit" variant="primary" icon="🔍">
                        Search
                      </Button>
                    </form>
                    <div className="gst-type-radios">
                      <label className="radio-label">
                        <input
                          type="radio"
                          value="ALL"
                          checked={gstTypeFilter === "ALL"}
                          onChange={() => setGstTypeFilter("ALL")}
                        /> All
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          value="OUTPUT"
                          checked={gstTypeFilter === "OUTPUT"}
                          onChange={() => setGstTypeFilter("OUTPUT")}
                        /> Outward (Sales)
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          value="INPUT"
                          checked={gstTypeFilter === "INPUT"}
                          onChange={() => setGstTypeFilter("INPUT")}
                        /> Inward (Purchases)
                      </label>
                    </div>
                  </div>
                </Card>

                {allSummary && (
                  <div className="gst-summary-strip">
                    <span>Records: <strong>{allSummary.totalRecords}</strong></span>
                    <span>Total Taxable: <strong>₹{allSummary.totalTaxable.toLocaleString("en-IN")}</strong></span>
                    <span>CGST: <strong>₹{allSummary.totalCGST.toLocaleString("en-IN")}</strong></span>
                    <span>SGST: <strong>₹{allSummary.totalSGST.toLocaleString("en-IN")}</strong></span>
                    <span>IGST: <strong>₹{allSummary.totalIGST.toLocaleString("en-IN")}</strong></span>
                    <span>Total Tax: <strong className="text-teal">₹{allSummary.totalTax.toLocaleString("en-IN")}</strong></span>
                  </div>
                )}

                <Card title="GST Transaction Log" subtitle="Comprehensive audit register of all tax postings">
                  <div className="gst-table-wrapper">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Doc #</th>
                          <th>Date</th>
                          <th>Party</th>
                          <th>GSTIN</th>
                          <th>HSN</th>
                          <th className="cell-right">Taxable</th>
                          <th className="cell-right">CGST</th>
                          <th className="cell-right">SGST</th>
                          <th className="cell-right">IGST</th>
                          <th className="cell-right">Total Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRecords.length === 0 ? (
                          <tr><td colSpan="11" className="gst-table-empty">No GST transactions found matching criteria.</td></tr>
                        ) : (
                          allRecords.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <StatusBadge status={r.gst_type} />
                              </td>
                              <td><strong>{r.invoice_no}</strong></td>
                              <td>{r.invoice_date?.split("T")[0]}</td>
                              <td>{r.party_name}</td>
                              <td><code className="gst-code-chip">{r.party_gstin || "—"}</code></td>
                              <td>{r.hsn_code}</td>
                              <td className="cell-right">₹{Number(r.taxable_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(r.cgst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(r.sgst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">₹{Number(r.igst_amount).toLocaleString("en-IN")}</td>
                              <td className="cell-right">
                                <strong className="text-teal">₹{Number(r.total_tax).toLocaleString("en-IN")}</strong>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default PlasticGstManagement;
