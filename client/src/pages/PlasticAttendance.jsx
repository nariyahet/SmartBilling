import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticAttendance.css";

function PlasticAttendance() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roster, setRoster] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Tab: 'DAILY' or 'HISTORY'
  const [activeTab, setActiveTab] = useState("DAILY");
  const [historyFrom, setHistoryFrom] = useState(() =>
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [historyTo, setHistoryTo] = useState(new Date().toISOString().slice(0, 10));
  const [historyRecords, setHistoryRecords] = useState([]);

  // Fetch shifts & departments once
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [shiftRes, metaRes] = await Promise.all([
          API.get("/plastic-erp/plant/shifts"),
          API.get("/plastic-erp/employees/meta"),
        ]);
        if (shiftRes.data?.shifts) {
          setShifts(shiftRes.data.shifts);
          if (shiftRes.data.shifts.length > 0) {
            setSelectedShift(String(shiftRes.data.shifts[0].id));
          }
        }
        if (metaRes.data?.departments) {
          setDepartments(metaRes.data.departments);
        }
      } catch (err) {
        console.error("Failed to fetch attendance metadata:", err);
      }
    };
    fetchMetadata();
  }, []);

  const fetchDailyRoster = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/attendance/daily-roster", {
        params: {
          attendance_date: selectedDate,
          shift_id: selectedShift || undefined,
        },
      });
      if (res.data?.success) {
        setRoster(res.data.roster || []);
      }
    } catch (err) {
      console.error("Failed to load daily roster:", err);
      alert("Failed to load daily attendance roster");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedShift]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/attendance/summary", {
        params: {
          from_date: historyFrom,
          to_date: historyTo,
          department: selectedDept !== "ALL" ? selectedDept : undefined,
        },
      });
      if (res.data?.success) {
        setHistoryRecords(res.data.summary || []);
      }
    } catch (err) {
      console.error("Failed to load history summary:", err);
    } finally {
      setLoading(false);
    }
  }, [historyFrom, historyTo, selectedDept]);

  const loadAttendanceData = useCallback(() => {
    if (activeTab === "DAILY") {
      fetchDailyRoster();
    } else {
      fetchHistory();
    }
  }, [activeTab, fetchDailyRoster, fetchHistory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAttendanceData();
  }, [loadAttendanceData]);


  const handleRowChange = (index, field, value) => {
    const updated = [...roster];
    updated[index] = { ...updated[index], [field]: value };
    // Auto adjust working hours if in/out times change
    if (field === "status") {
      if (value === "PRESENT") {
        updated[index].working_hours = 8;
      } else if (value === "HALF_DAY") {
        updated[index].working_hours = 4;
      } else {
        updated[index].working_hours = 0;
        updated[index].overtime_hours = 0;
      }
    }
    setRoster(updated);
  };

  const handleMarkAllPresent = () => {
    const updated = roster.map((item) => ({
      ...item,
      status: "PRESENT",
      working_hours: 8,
    }));
    setRoster(updated);
  };

  const handleSaveBulkAttendance = async () => {
    try {
      setSubmitting(true);
      const payload = {
        attendance_date: selectedDate,
        shift_id: selectedShift ? Number(selectedShift) : null,
        records: roster.map((r) => ({
          employee_id: r.employee_id,
          status: r.status || "PRESENT",
          in_time: r.in_time || null,
          out_time: r.out_time || null,
          working_hours: Number(r.working_hours) || (r.status === "PRESENT" ? 8 : 0),
          overtime_hours: Number(r.overtime_hours) || 0,
          remarks: r.remarks || null,
        })),
      };

      const res = await API.post("/plastic-erp/attendance/bulk", payload);
      alert(res.data?.message || "Attendance saved successfully");
      fetchDailyRoster();
    } catch (err) {
      console.error("Failed to save attendance:", err);
      alert(err.response?.data?.message || "Failed to record bulk attendance");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs for Daily view
  const totalEmployees = roster.length;
  const presentCount = roster.filter((r) => r.status === "PRESENT").length;
  const halfDayCount = roster.filter((r) => r.status === "HALF_DAY").length;
  const absentCount = roster.filter((r) => r.status === "ABSENT").length;
  const leaveCount = roster.filter((r) => r.status === "LEAVE").length;
  const totalOvertime = roster.reduce((s, r) => s + Number(r.overtime_hours || 0), 0);

  const filteredRoster = roster.filter((r) => {
    if (selectedDept !== "ALL" && r.department !== selectedDept) return false;
    return true;
  });

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / HR & Payroll</span>
            <h1 className="plastic-title">⏱️ Plant Attendance & Shift Rosters</h1>
            <p className="plastic-subtitle">
              Record biometric, manual shift roll calls, and overtime logs with automated wage rate calculation.
            </p>
          </div>
          <div className="tab-pills">
            <button
              type="button"
              className={`pill-btn ${activeTab === "DAILY" ? "active" : ""}`}
              onClick={() => setActiveTab("DAILY")}
            >
              📅 Daily Roll Call
            </button>
            <button
              type="button"
              className={`pill-btn ${activeTab === "HISTORY" ? "active" : ""}`}
              onClick={() => setActiveTab("HISTORY")}
            >
              📊 Attendance Summary
            </button>
          </div>
        </div>

        {/* Daily Roll Call View */}
        {activeTab === "DAILY" && (
          <>
            {/* KPI Cards */}
            <div className="plastic-kpi-grid">
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon">📋</span>
                <div>
                  <span className="plastic-kpi-label">Roster Count</span>
                  <h3 className="plastic-kpi-val">{totalEmployees}</h3>
                  <small className="plastic-kpi-sub">Assigned workforce</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>✅</span>
                <div>
                  <span className="plastic-kpi-label">Present</span>
                  <h3 className="plastic-kpi-val">{presentCount + (halfDayCount ? ` (${halfDayCount} HD)` : "")}</h3>
                  <small className="plastic-kpi-sub">On plant premises</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>❌</span>
                <div>
                  <span className="plastic-kpi-label">Absent / Leave</span>
                  <h3 className="plastic-kpi-val">{absentCount + leaveCount}</h3>
                  <small className="plastic-kpi-sub">Unscheduled & planned leaves</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>⚡</span>
                <div>
                  <span className="plastic-kpi-label">Total Overtime</span>
                  <h3 className="plastic-kpi-val">{totalOvertime} hrs</h3>
                  <small className="plastic-kpi-sub">Approved extra hours</small>
                </div>
              </div>
            </div>

            {/* Date & Shift Controls */}
            <div className="plastic-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="att-date">Attendance Date</label>
                  <input
                    id="att-date"
                    type="date"
                    className="plastic-input"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="att-shift">Plant Shift</label>
                  <select
                    id="att-shift"
                    className="plastic-select"
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                  >
                    <option value="">Default Plant Shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shift_name} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="att-dept">Filter Department</label>
                  <select
                    id="att-dept"
                    className="plastic-select"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="attendance-actions-right">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-secondary"
                    onClick={handleMarkAllPresent}
                  >
                    ✨ Mark All Present
                  </button>
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-primary"
                    onClick={handleSaveBulkAttendance}
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "💾 Save Attendance Roster"}
                  </button>
                </div>
              </div>
            </div>

            {/* Roster Table */}
            {loading ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Emp Code</th>
                      <th>Worker Name</th>
                      <th>Dept & Role</th>
                      <th>Status</th>
                      <th>Working Hrs</th>
                      <th>OT Hrs</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoster.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "2rem" }}>
                          No active employees found for the selected date and filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRoster.map((r, idx) => (
                        <tr key={r.employee_id}>
                          <td>
                            <span className="plastic-code-badge">{r.employee_code}</span>
                          </td>
                          <td>
                            <strong>{r.full_name}</strong>
                          </td>
                          <td>
                            <span className="plastic-chip">{r.department}</span>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.designation}</div>
                          </td>
                          <td>
                            <select
                              className={`status-select status-${(r.status || "PRESENT").toLowerCase()}`}
                              value={r.status || "PRESENT"}
                              onChange={(e) => handleRowChange(idx, "status", e.target.value)}
                            >
                              <option value="PRESENT">Present</option>
                              <option value="HALF_DAY">Half Day</option>
                              <option value="ABSENT">Absent</option>
                              <option value="LEAVE">Paid Leave</option>
                              <option value="WEEKLY_OFF">Weekly Off</option>
                              <option value="HOLIDAY">Holiday</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="table-num-input"
                              min="0"
                              max="24"
                              step="0.5"
                              value={r.working_hours ?? 8}
                              onChange={(e) => handleRowChange(idx, "working_hours", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="table-num-input ot-input"
                              min="0"
                              max="12"
                              step="0.5"
                              value={r.overtime_hours ?? 0}
                              onChange={(e) => handleRowChange(idx, "overtime_hours", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="table-text-input"
                              placeholder="Notes / machine / reason..."
                              value={r.remarks || ""}
                              onChange={(e) => handleRowChange(idx, "remarks", e.target.value)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Attendance Summary History View */}
        {activeTab === "HISTORY" && (
          <div className="attendance-history-view">
            <div className="plastic-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="from-date">From Date</label>
                  <input
                    id="from-date"
                    type="date"
                    className="plastic-input"
                    value={historyFrom}
                    onChange={(e) => setHistoryFrom(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="to-date">To Date</label>
                  <input
                    id="to-date"
                    type="date"
                    className="plastic-input"
                    value={historyTo}
                    onChange={(e) => setHistoryTo(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="hist-dept">Department</label>
                  <select
                    id="hist-dept"
                    className="plastic-select"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="attendance-actions-right">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-primary"
                    onClick={fetchHistory}
                  >
                    🔍 Generate Summary
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Emp Code</th>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Total Days</th>
                      <th>Present</th>
                      <th>Half Days</th>
                      <th>Absent</th>
                      <th>Leaves</th>
                      <th>Total OT Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>
                          No attendance records found for this period.
                        </td>
                      </tr>
                    ) : (
                      historyRecords.map((h) => (
                        <tr key={h.employee_id}>
                          <td>
                            <span className="plastic-code-badge">{h.employee_code}</span>
                          </td>
                          <td><strong>{h.full_name}</strong></td>
                          <td><span className="plastic-chip">{h.department}</span></td>
                          <td>{h.total_logged_days}</td>
                          <td style={{ color: "#15803d", fontWeight: "700" }}>{h.present_days}</td>
                          <td style={{ color: "#b45309" }}>{h.half_days}</td>
                          <td style={{ color: "#b91c1c", fontWeight: "700" }}>{h.absent_days}</td>
                          <td>{h.leave_days}</td>
                          <td><strong>{h.total_overtime_hours} hrs</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticAttendance;
