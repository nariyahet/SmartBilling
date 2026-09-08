import { useState, useEffect } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticEmployees.css";

function PlasticEmployees() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [meta, setMeta] = useState({ departments: [], designations: [] });

  // Filters
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const initialEmpForm = {
    employee_code: "",
    full_name: "",
    mobile: "",
    email: "",
    department: "PRODUCTION",
    designation: "Plant Operator",
    joining_date: new Date().toISOString().slice(0, 10),
    employment_type: "FULL_TIME",
    gender: "MALE",
    date_of_birth: "",
    address: "",
    pan_number: "",
    aadhaar_number: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    notes: "",
  };

  const initialSalaryForm = {
    salary_type: "MONTHLY",
    base_salary: 18000,
    hra: 0,
    conveyance_allowance: 0,
    special_allowance: 0,
    overtime_rate_per_hour: 100,
    pf_applicable: false,
    pf_employee_percent: 12.0,
    esic_applicable: false,
    esic_employee_percent: 0.75,
    pt_applicable: false,
    pt_amount: 200,
    effective_date: new Date().toISOString().slice(0, 10),
  };

  const [empForm, setEmpForm] = useState(initialEmpForm);
  const [salaryForm, setSalaryForm] = useState(initialSalaryForm);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (departmentFilter !== "ALL") params.department = departmentFilter;
      if (statusFilter !== "ALL") params.status = statusFilter;

      const [empRes, metaRes] = await Promise.all([
        API.get("/plastic-erp/employees", { params }),
        API.get("/plastic-erp/employees/meta"),
      ]);

      if (empRes.data?.success) setEmployees(empRes.data.employees || []);
      if (metaRes.data?.success) {
        setMeta({
          departments: metaRes.data.departments || [],
          designations: metaRes.data.designations || [],
        });
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      alert("Failed to load employee list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentFilter, statusFilter]);


  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEmployees();
  };

  const handleOpenCreateModal = async () => {
    try {
      const codeRes = await API.get("/plastic-erp/employees/next-code");
      setEmpForm({
        ...initialEmpForm,
        employee_code: codeRes.data?.nextCode || "EMP-0001",
      });
      setSelectedEmp(null);
      setEmpModalOpen(true);
    } catch (err) {
      console.error("Failed to generate code:", err);
      setEmpForm(initialEmpForm);
      setSelectedEmp(null);
      setEmpModalOpen(true);
    }
  };

  const handleOpenEditModal = (emp) => {
    setSelectedEmp(emp);
    setEmpForm({
      employee_code: emp.employee_code || "",
      full_name: emp.full_name || "",
      mobile: emp.mobile || "",
      email: emp.email || "",
      department: emp.department || "PRODUCTION",
      designation: emp.designation || "Plant Operator",
      joining_date: emp.joining_date ? emp.joining_date.slice(0, 10) : "",
      employment_type: emp.employment_type || "FULL_TIME",
      gender: emp.gender || "MALE",
      date_of_birth: emp.date_of_birth ? emp.date_of_birth.slice(0, 10) : "",
      address: emp.address || "",
      pan_number: emp.pan_number || "",
      aadhaar_number: emp.aadhaar_number || "",
      bank_name: emp.bank_name || "",
      account_number: emp.account_number || "",
      ifsc_code: emp.ifsc_code || "",
      emergency_contact_name: emp.emergency_contact_name || "",
      emergency_contact_phone: emp.emergency_contact_phone || "",
      notes: emp.notes || "",
    });
    setEmpModalOpen(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.full_name || !empForm.mobile || !empForm.department) {
      alert("Name, mobile number, and department are required.");
      return;
    }

    try {
      setSubmitting(true);
      if (selectedEmp) {
        await API.put(`/plastic-erp/employees/${selectedEmp.id}`, empForm);
        alert("Employee updated successfully");
      } else {
        await API.post("/plastic-erp/employees", empForm);
        alert("Employee registered successfully");
      }
      setEmpModalOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error("Failed to save employee:", err);
      alert(err.response?.data?.message || "Failed to save employee");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSalaryModal = (emp) => {
    setSelectedEmp(emp);
    setSalaryForm({
      salary_type: emp.salary_type || "MONTHLY",
      base_salary: Number(emp.base_salary) || 18000,
      hra: Number(emp.hra) || 0,
      conveyance_allowance: Number(emp.conveyance_allowance) || 0,
      special_allowance: Number(emp.special_allowance) || 0,
      overtime_rate_per_hour: Number(emp.overtime_rate_per_hour) || 100,
      pf_applicable: Boolean(emp.pf_applicable),
      pf_employee_percent: Number(emp.pf_employee_percent) || 12.0,
      esic_applicable: Boolean(emp.esic_applicable),
      esic_employee_percent: Number(emp.esic_employee_percent) || 0.75,
      pt_applicable: Boolean(emp.pt_applicable),
      pt_amount: Number(emp.pt_amount) || 200,
      effective_date: new Date().toISOString().slice(0, 10),
    });
    setSalaryModalOpen(true);
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (Number(salaryForm.base_salary) <= 0) {
      alert("Base salary must be greater than 0");
      return;
    }

    try {
      setSubmitting(true);
      await API.put(`/plastic-erp/employees/${selectedEmp.id}/salary`, salaryForm);
      alert("Salary structure updated successfully");
      setSalaryModalOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error("Failed to update salary:", err);
      alert(err.response?.data?.message || "Failed to update salary structure");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewEmployee = (emp) => {
    setSelectedEmp(emp);
    setViewModalOpen(true);
  };

  const handleDeleteEmployee = async (emp) => {
    if (!window.confirm(`Are you sure you want to deactivate/delete employee ${emp.full_name} (${emp.employee_code})?`)) {
      return;
    }
    try {
      await API.delete(`/plastic-erp/employees/${emp.id}`);
      alert("Employee deleted successfully");
      fetchEmployees();
    } catch (err) {
      console.error("Failed to delete employee:", err);
      alert(err.response?.data?.message || "Failed to delete employee");
    }
  };

  // KPIs
  const totalActive = employees.filter((e) => e.status === "ACTIVE").length;
  const prodWorkers = employees.filter((e) => e.department === "PRODUCTION" && e.status === "ACTIVE").length;
  const staffMembers = employees.filter((e) => e.department !== "PRODUCTION" && e.status === "ACTIVE").length;
  const totalBasePayroll = employees
    .filter((e) => e.status === "ACTIVE")
    .reduce((acc, e) => acc + Number(e.base_salary || 0), 0);

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Page Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / HR & Payroll</span>
            <h1 className="plastic-title">👥 Employee Master & Directory</h1>
            <p className="plastic-subtitle">
              Manage plant operators, sorters, technicians, and administrative staff with verified wage structures.
            </p>
          </div>
          <button
            type="button"
            className="plastic-btn plastic-btn-primary"
            onClick={handleOpenCreateModal}
          >
            + Register Employee
          </button>
        </div>

        {/* KPI Cards */}
        <div className="plastic-kpi-grid">
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">👥</span>
            <div>
              <span className="plastic-kpi-label">Active Employees</span>
              <h3 className="plastic-kpi-val">{totalActive}</h3>
              <small className="plastic-kpi-sub">Total enrolled staff</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">🏭</span>
            <div>
              <span className="plastic-kpi-label">Production Crew</span>
              <h3 className="plastic-kpi-val">{prodWorkers}</h3>
              <small className="plastic-kpi-sub">Plant floor operators & labor</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">💼</span>
            <div>
              <span className="plastic-kpi-label">Admin & QC Staff</span>
              <h3 className="plastic-kpi-val">{staffMembers}</h3>
              <small className="plastic-kpi-sub">Office, lab & supervisors</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">💰</span>
            <div>
              <span className="plastic-kpi-label">Monthly Base Budget</span>
              <h3 className="plastic-kpi-val">₹{totalBasePayroll.toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Committed active wage roll</small>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="plastic-filter-card">
          <form className="plastic-filter-form" onSubmit={handleSearchSubmit}>
            <div className="filter-group filter-search">
              <label htmlFor="emp-search">Search Directory</label>
              <input
                id="emp-search"
                type="text"
                className="plastic-input"
                placeholder="Search name, code, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="dept-filter">Department</label>
              <select
                id="dept-filter"
                className="plastic-select"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {meta.departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                className="plastic-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated</option>
                <option value="ON_LEAVE">On Leave</option>
              </select>
            </div>

            <div className="filter-group filter-actions">
              <button type="submit" className="plastic-btn plastic-btn-secondary">
                Filter
              </button>
              <button
                type="button"
                className="plastic-btn plastic-btn-ghost"
                onClick={() => {
                  setSearch("");
                  setDepartmentFilter("ALL");
                  setStatusFilter("ALL");
                }}
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Employees Table */}
        {loading ? (
          <LoadingScreen />
        ) : (
          <div className="plastic-table-container">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Employee Name</th>
                  <th>Department & Role</th>
                  <th>Contact</th>
                  <th>Wage Structure</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: "1.05rem", margin: 0 }}>
                        No employees found matching your criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <span className="plastic-code-badge">{emp.employee_code}</span>
                      </td>
                      <td>
                        <strong>{emp.full_name}</strong>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Joined: {emp.joining_date ? new Date(emp.joining_date).toLocaleDateString("en-IN") : "-"}
                        </div>
                      </td>
                      <td>
                        <span className="plastic-chip">{emp.department}</span>
                        <div style={{ fontSize: "0.85rem", marginTop: "2px", fontWeight: "500" }}>
                          {emp.designation}
                        </div>
                      </td>
                      <td>
                        <div>📞 {emp.mobile}</div>
                        {emp.email && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>✉️ {emp.email}</div>}
                      </td>
                      <td>
                        <div>
                          <strong>₹{Number(emp.base_salary || 0).toLocaleString("en-IN")}</strong>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}> / {emp.salary_type || "MONTHLY"}</span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#059669" }}>
                          OT: ₹{Number(emp.overtime_rate_per_hour || 0)}/hr
                        </div>
                      </td>
                      <td>
                        <span className={`plastic-status-tag tag-${(emp.status || "").toLowerCase()}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="plastic-table-actions">
                          <button
                            type="button"
                            className="btn-action btn-view"
                            title="View Full Profile"
                            onClick={() => handleViewEmployee(emp)}
                          >
                            👁️
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-salary"
                            title="Configure Salary Structure"
                            onClick={() => handleOpenSalaryModal(emp)}
                          >
                            💵
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-edit"
                            title="Edit Employee"
                            onClick={() => handleOpenEditModal(emp)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-delete"
                            title="Delete Employee"
                            onClick={() => handleDeleteEmployee(emp)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Add/Edit Employee */}
        {empModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setEmpModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>{selectedEmp ? "✏️ Edit Employee Master" : "➕ Register New Plant Employee"}</h3>
                <button type="button" className="btn-close" onClick={() => setEmpModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveEmployee}>
                <div className="plastic-modal-body">
                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Employee Code *</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.employee_code}
                        onChange={(e) => setEmpForm({ ...empForm, employee_code: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.full_name}
                        onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })}
                        placeholder="e.g. Ramesh Patel"
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Mobile Number *</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.mobile}
                        onChange={(e) => setEmpForm({ ...empForm, mobile: e.target.value })}
                        placeholder="10-digit mobile"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Department *</label>
                      <select
                        className="plastic-select"
                        value={empForm.department}
                        onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                      >
                        <option value="PRODUCTION">Production</option>
                        <option value="QUALITY">Quality Control</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="LOGISTICS">Logistics & Yard</option>
                        <option value="PURCHASE">Procurement</option>
                        <option value="SALES">Sales & Dispatch</option>
                        <option value="ACCOUNTS">Finance & Admin</option>
                        <option value="MANAGEMENT">Management</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Designation *</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.designation}
                        onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                        placeholder="e.g. Extruder Operator"
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Date of Joining *</label>
                      <input
                        type="date"
                        className="plastic-input"
                        value={empForm.joining_date}
                        onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Employment Type</label>
                      <select
                        className="plastic-select"
                        value={empForm.employment_type}
                        onChange={(e) => setEmpForm({ ...empForm, employment_type: e.target.value })}
                      >
                        <option value="FULL_TIME">Full Time</option>
                        <option value="PART_TIME">Part Time</option>
                        <option value="CONTRACT">Contract Worker</option>
                        <option value="DAILY_WAGE">Daily Wage</option>
                        <option value="TRAINEE">Trainee / Apprentice</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Gender</label>
                      <select
                        className="plastic-select"
                        value={empForm.gender}
                        onChange={(e) => setEmpForm({ ...empForm, gender: e.target.value })}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Email Address</label>
                      <input
                        type="email"
                        className="plastic-input"
                        value={empForm.email}
                        onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                        placeholder="employee@company.com"
                      />
                    </div>
                  </div>

                  <h4 className="modal-subheading">🏛️ Statutory & Banking Details</h4>
                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Aadhaar Number</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.aadhaar_number}
                        onChange={(e) => setEmpForm({ ...empForm, aadhaar_number: e.target.value })}
                        placeholder="12-digit UID"
                      />
                    </div>
                    <div className="form-field">
                      <label>PAN Number</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.pan_number}
                        onChange={(e) => setEmpForm({ ...empForm, pan_number: e.target.value.toUpperCase() })}
                        placeholder="e.g. ABCDE1234F"
                      />
                    </div>
                    <div className="form-field">
                      <label>Bank Name</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.bank_name}
                        onChange={(e) => setEmpForm({ ...empForm, bank_name: e.target.value })}
                        placeholder="e.g. SBI, HDFC"
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Bank Account Number</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.account_number}
                        onChange={(e) => setEmpForm({ ...empForm, account_number: e.target.value })}
                        placeholder="Account Number"
                      />
                    </div>
                    <div className="form-field">
                      <label>IFSC Code</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={empForm.ifsc_code}
                        onChange={(e) => setEmpForm({ ...empForm, ifsc_code: e.target.value.toUpperCase() })}
                        placeholder="e.g. SBIN0001234"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Residential Address</label>
                    <textarea
                      className="plastic-textarea"
                      rows="2"
                      value={empForm.address}
                      onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })}
                      placeholder="Street, Area, City, Pin"
                    />
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setEmpModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : selectedEmp ? "Update Employee" : "Register Employee"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Configure Salary Structure */}
        {salaryModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setSalaryModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>💰 Configure Salary Structure — {selectedEmp?.full_name} ({selectedEmp?.employee_code})</h3>
                <button type="button" className="btn-close" onClick={() => setSalaryModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveSalary}>
                <div className="plastic-modal-body">
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Salary Frequency / Type *</label>
                      <select
                        className="plastic-select"
                        value={salaryForm.salary_type}
                        onChange={(e) => setSalaryForm({ ...salaryForm, salary_type: e.target.value })}
                      >
                        <option value="MONTHLY">Monthly Fixed</option>
                        <option value="DAILY">Daily Wage</option>
                        <option value="HOURLY">Hourly Rate</option>
                        <option value="PIECE_RATE">Piece / Output Rate</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Base / Basic Wage (₹) *</label>
                      <input
                        type="number"
                        className="plastic-input"
                        value={salaryForm.base_salary}
                        onChange={(e) => setSalaryForm({ ...salaryForm, base_salary: e.target.value })}
                        min="1"
                        step="1"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>HRA Allowance (₹)</label>
                      <input
                        type="number"
                        className="plastic-input"
                        value={salaryForm.hra}
                        onChange={(e) => setSalaryForm({ ...salaryForm, hra: e.target.value })}
                        min="0"
                      />
                    </div>
                    <div className="form-field">
                      <label>Conveyance Allowance (₹)</label>
                      <input
                        type="number"
                        className="plastic-input"
                        value={salaryForm.conveyance_allowance}
                        onChange={(e) => setSalaryForm({ ...salaryForm, conveyance_allowance: e.target.value })}
                        min="0"
                      />
                    </div>
                    <div className="form-field">
                      <label>Overtime Rate (₹ / Hour)</label>
                      <input
                        type="number"
                        className="plastic-input"
                        value={salaryForm.overtime_rate_per_hour}
                        onChange={(e) => setSalaryForm({ ...salaryForm, overtime_rate_per_hour: e.target.value })}
                        min="0"
                      />
                    </div>
                  </div>

                  <h4 className="modal-subheading">⚖️ Statutory Deductions</h4>
                  <div className="form-grid-3">
                    <div className="form-field checkbox-field">
                      <label>
                        <input
                          type="checkbox"
                          checked={salaryForm.pf_applicable}
                          onChange={(e) => setSalaryForm({ ...salaryForm, pf_applicable: e.target.checked })}
                        />
                        <span>PF Applicable (12%)</span>
                      </label>
                    </div>
                    <div className="form-field checkbox-field">
                      <label>
                        <input
                          type="checkbox"
                          checked={salaryForm.esic_applicable}
                          onChange={(e) => setSalaryForm({ ...salaryForm, esic_applicable: e.target.checked })}
                        />
                        <span>ESIC Applicable (0.75%)</span>
                      </label>
                    </div>
                    <div className="form-field checkbox-field">
                      <label>
                        <input
                          type="checkbox"
                          checked={salaryForm.pt_applicable}
                          onChange={(e) => setSalaryForm({ ...salaryForm, pt_applicable: e.target.checked })}
                        />
                        <span>PT Applicable (₹200)</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Effective Date *</label>
                    <input
                      type="date"
                      className="plastic-input"
                      value={salaryForm.effective_date}
                      onChange={(e) => setSalaryForm({ ...salaryForm, effective_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setSalaryModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "Save Salary Structure"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Full Employee Profile */}
        {viewModalOpen && selectedEmp && (
          <div className="plastic-modal-backdrop" onClick={() => setViewModalOpen(false)}>
            <div className="plastic-modal modal-detail" onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>👤 Employee Profile — {selectedEmp.full_name}</h3>
                <button type="button" className="btn-close" onClick={() => setViewModalOpen(false)}>✕</button>
              </div>
              <div className="plastic-modal-body">
                <div className="profile-summary-card">
                  <div className="profile-avatar">
                    {selectedEmp.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{selectedEmp.full_name}</h2>
                    <span className="plastic-chip">{selectedEmp.department}</span>
                    <span style={{ marginLeft: "8px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      {selectedEmp.designation} • {selectedEmp.employee_code}
                    </span>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <span className={`plastic-status-tag tag-${(selectedEmp.status || "").toLowerCase()}`}>
                      {selectedEmp.status}
                    </span>
                  </div>
                </div>

                <div className="detail-sections-grid">
                  <div className="detail-section">
                    <h4>Employment Details</h4>
                    <p><strong>Joining Date:</strong> {selectedEmp.joining_date ? new Date(selectedEmp.joining_date).toLocaleDateString("en-IN") : "-"}</p>
                    <p><strong>Type:</strong> {selectedEmp.employment_type || "FULL_TIME"}</p>
                    <p><strong>Gender:</strong> {selectedEmp.gender || "MALE"}</p>
                    <p><strong>Mobile:</strong> {selectedEmp.mobile}</p>
                    <p><strong>Email:</strong> {selectedEmp.email || "N/A"}</p>
                  </div>

                  <div className="detail-section">
                    <h4>Salary & Overtime</h4>
                    <p><strong>Salary Type:</strong> {selectedEmp.salary_type || "MONTHLY"}</p>
                    <p><strong>Base Wage:</strong> ₹{Number(selectedEmp.base_salary || 0).toLocaleString("en-IN")}</p>
                    <p><strong>Overtime Rate:</strong> ₹{Number(selectedEmp.overtime_rate_per_hour || 0)}/hr</p>
                    <p><strong>PF:</strong> {selectedEmp.pf_applicable ? "Yes (12%)" : "No"}</p>
                    <p><strong>ESIC:</strong> {selectedEmp.esic_applicable ? "Yes (0.75%)" : "No"}</p>
                  </div>

                  <div className="detail-section">
                    <h4>Bank & Identification</h4>
                    <p><strong>Bank:</strong> {selectedEmp.bank_name || "N/A"}</p>
                    <p><strong>Account:</strong> {selectedEmp.account_number || "N/A"}</p>
                    <p><strong>IFSC:</strong> {selectedEmp.ifsc_code || "N/A"}</p>
                    <p><strong>PAN:</strong> {selectedEmp.pan_number || "N/A"}</p>
                    <p><strong>Aadhaar:</strong> {selectedEmp.aadhaar_number || "N/A"}</p>
                  </div>

                  <div className="detail-section">
                    <h4>Contact & Address</h4>
                    <p><strong>Address:</strong> {selectedEmp.address || "N/A"}</p>
                    <p><strong>Emergency:</strong> {selectedEmp.emergency_contact_name || "N/A"} ({selectedEmp.emergency_contact_phone || "N/A"})</p>
                    <p><strong>Notes:</strong> {selectedEmp.notes || "None"}</p>
                  </div>
                </div>
              </div>
              <div className="plastic-modal-footer">
                <button
                  type="button"
                  className="plastic-btn plastic-btn-secondary"
                  onClick={() => {
                    setViewModalOpen(false);
                    handleOpenSalaryModal(selectedEmp);
                  }}
                >
                  Configure Salary
                </button>
                <button
                  type="button"
                  className="plastic-btn plastic-btn-primary"
                  onClick={() => setViewModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticEmployees;
