import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button } from "../components";
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
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <PageHeader
          title="Plant Attendance & Shift Rosters"
          subtitle="Record biometric, manual shift roll calls, and overtime logs with automated wage rate calculation."
          badge="HR & ATTENDANCE"
          actions={
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
          }
        />

        {/* Daily Roll Call View */}
        {activeTab === "DAILY" && (
          <>
            {/* KPI Cards */}
            <div className="patt-kpis">
              <KpiCard
                title="Roster Count"
                value={totalEmployees}
                subtitle="Assigned workforce"
                variant="default"
              />
              <KpiCard
                title="Present"
                value={presentCount + (halfDayCount ? ` (${halfDayCount} HD)` : "")}
                subtitle="On plant premises"
                variant="success"
              />
              <KpiCard
                title="Absent / Leave"
                value={absentCount + leaveCount}
                subtitle="Unscheduled & planned leaves"
                variant="danger"
              />
              <KpiCard
                title="Total Overtime"
                value={`${totalOvertime} hrs`}
                subtitle="Approved extra hours"
                variant="primary"
              />
            </div>

            {/* Date & Shift Controls */}
            <Card className="patt-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="att-date">Attendance Date</label>
                  <input
                    id="att-date"
                    type="date"
                    className="sb-input"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="att-shift">Plant Shift</label>
                  <select
                    id="att-shift"
                    className="sb-select"
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
                    className="sb-select"
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleMarkAllPresent}
                  >
                    ✨ Mark All Present
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveBulkAttendance}
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "💾 Save Attendance Roster"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Roster Table */}
            <Card title={`Roll Call Roster (${filteredRoster.length} Workers)`}>
              {loading ? (
                <LoadingScreen message="Loading daily attendance roster..." />
              ) : filteredRoster.length === 0 ? (
                <div className="patt-empty">
                  No active employees found for the selected date and filters.
                </div>
              ) : (
                <div className="patt-table-wrap">
                  <table className="patt-table">
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
                      {filteredRoster.map((r, idx) => (
                        <tr key={r.employee_id}>
                          <td>
                            <span className="patt-code-badge">{r.employee_code}</span>
                          </td>
                          <td>
                            <strong>{r.full_name}</strong>
                          </td>
                          <td>
                            <span className="patt-chip">{r.department}</span>
                            <div className="text-muted text-sm">{r.designation}</div>
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
                              className="sb-input table-num-input"
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
                              className="sb-input table-num-input ot-input"
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
                              className="sb-input table-text-input"
                              placeholder="Notes / machine / reason..."
                              value={r.remarks || ""}
                              onChange={(e) => handleRowChange(idx, "remarks", e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Attendance Summary History View */}
        {activeTab === "HISTORY" && (
          <div className="attendance-history-view">
            <Card className="patt-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="from-date">From Date</label>
                  <input
                    id="from-date"
                    type="date"
                    className="sb-input"
                    value={historyFrom}
                    onChange={(e) => setHistoryFrom(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="to-date">To Date</label>
                  <input
                    id="to-date"
                    type="date"
                    className="sb-input"
                    value={historyTo}
                    onChange={(e) => setHistoryTo(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="hist-dept">Department</label>
                  <select
                    id="hist-dept"
                    className="sb-select"
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
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={fetchHistory}
                  >
                    🔍 Generate Summary
                  </Button>
                </div>
              </div>
            </Card>

            <Card title={`Attendance Summary (${historyRecords.length} Staff Members)`}>
              {loading ? (
                <LoadingScreen message="Loading attendance history summary..." />
              ) : historyRecords.length === 0 ? (
                <div className="patt-empty">
                  No attendance records found for this period.
                </div>
              ) : (
                <div className="patt-table-wrap">
                  <table className="patt-table">
                    <thead>
                      <tr>
                        <th>Emp Code</th>
                        <th>Employee Name</th>
                        <th>Department</th>
                        <th className="text-right">Total Days</th>
                        <th className="text-right">Present</th>
                        <th className="text-right">Half Days</th>
                        <th className="text-right">Absent</th>
                        <th className="text-right">Leaves</th>
                        <th className="text-right">Total OT Hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRecords.map((h) => (
                        <tr key={h.employee_id}>
                          <td>
                            <span className="patt-code-badge">{h.employee_code}</span>
                          </td>
                          <td><strong>{h.full_name}</strong></td>
                          <td><span className="patt-chip">{h.department}</span></td>
                          <td className="text-right">{h.total_logged_days}</td>
                          <td className="text-right font-bold text-success">{h.present_days}</td>
                          <td className="text-right text-warning">{h.half_days}</td>
                          <td className="text-right font-bold text-danger">{h.absent_days}</td>
                          <td className="text-right">{h.leave_days}</td>
                          <td className="text-right"><strong>{h.total_overtime_hours} hrs</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlasticAttendance;
