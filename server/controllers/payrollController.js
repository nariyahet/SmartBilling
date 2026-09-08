const db = require("../config/db");

const generatePayslipNo = (year, month, index) => {
  const mStr = String(month).padStart(2, "0");
  const iStr = String(index).padStart(4, "0");
  return `PS-${year}${mStr}-${iStr}`;
};

exports.getPayrolls = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { year } = req.query;

    let sql = `
      SELECT p.*, adm.name AS processed_by_name
      FROM plastic_payrolls p
      LEFT JOIN admins adm ON p.processed_by = adm.id
      WHERE p.company_id = ?
    `;
    const params = [companyId];

    if (year) {
      sql += " AND p.year = ?";
      params.push(year);
    }

    sql += " ORDER BY p.year DESC, p.month DESC";

    const [payrolls] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, count: payrolls.length, payrolls });
  } catch (error) {
    console.error("Get Payrolls Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve payroll runs" });
  }
};

exports.getPayrollById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [payrolls] = await db.promise().query(
      `SELECT p.*, adm.name AS processed_by_name
       FROM plastic_payrolls p
       LEFT JOIN admins adm ON p.processed_by = adm.id
       WHERE p.id = ? AND p.company_id = ? LIMIT 1`,
      [id, companyId]
    );

    if (payrolls.length === 0) {
      return res.status(404).json({ success: false, message: "Payroll batch not found" });
    }

    const payroll = payrolls[0];

    const [items] = await db.promise().query(
      `SELECT pi.*, e.employee_code, e.full_name AS employee_name, e.department, e.designation,
              e.bank_name, e.bank_account_no, e.bank_ifsc, e.pan_number
       FROM plastic_payroll_items pi
       JOIN plastic_employees e ON pi.employee_id = e.id AND pi.company_id = e.company_id
       WHERE pi.payroll_id = ? AND pi.company_id = ?
       ORDER BY e.department ASC, e.full_name ASC`,
      [id, companyId]
    );

    res.status(200).json({ success: true, payroll, items });
  } catch (error) {
    console.error("Get Payroll By ID Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve payroll details" });
  }
};

exports.processMonthlyPayroll = async (req, res) => {
  const pdb = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { month, year, payment_date, notes } = req.body;

    const m = Number(month);
    const y = Number(year);

    if (!m || !y || m < 1 || m > 12) {
      return res.status(400).json({ success: false, message: "Valid month (1-12) and year are required" });
    }

    // Check if payroll for this month and year already exists
    const [existing] = await pdb.query(
      "SELECT id, status FROM plastic_payrolls WHERE company_id = ? AND year = ? AND month = ? LIMIT 1",
      [companyId, y, m]
    );

    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const batchNo = `PAYROLL-${y}-${String(m).padStart(2, "0")}`;

    await pdb.beginTransaction();

    // 1. Fetch all ACTIVE employees with their salary structures
    const [employees] = await pdb.query(
      `SELECT e.*, s.salary_type, s.base_salary, s.hra, s.conveyance_allowance,
              s.medical_allowance, s.special_allowance, s.overtime_rate_per_hour,
              s.pf_deduction, s.esic_deduction, s.professional_tax, s.other_deductions
       FROM plastic_employees e
       LEFT JOIN (
         SELECT * FROM plastic_employee_salaries
         WHERE status = 'ACTIVE'
       ) s ON e.id = s.employee_id AND e.company_id = s.company_id
       WHERE e.company_id = ? AND e.status = 'ACTIVE'`,
      [companyId]
    );

    if (employees.length === 0) {
      await pdb.rollback();
      return res.status(400).json({ success: false, message: "No active employees found to process payroll" });
    }

    // 2. Fetch monthly attendance metrics per employee
    const [attendanceRows] = await pdb.query(
      `SELECT
         employee_id,
         COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) AS present_days,
         COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) AS absent_days,
         COUNT(CASE WHEN status = 'HALF_DAY' THEN 1 END) AS half_days,
         COUNT(CASE WHEN status = 'ON_LEAVE' THEN 1 END) AS leave_days,
         COUNT(CASE WHEN status = 'HOLIDAY' OR status = 'WEEK_OFF' THEN 1 END) AS holiday_days,
         COALESCE(SUM(overtime_hours), 0) AS total_overtime_hours
       FROM plastic_attendance
       WHERE company_id = ? AND YEAR(attendance_date) = ? AND MONTH(attendance_date) = ?
       GROUP BY employee_id`,
      [companyId, y, m]
    );

    const attMap = {};
    attendanceRows.forEach((r) => {
      attMap[r.employee_id] = r;
    });

    // 3. Fetch active advances per employee
    const [advancesRows] = await pdb.query(
      `SELECT id, employee_id, outstanding_amount, monthly_installment
       FROM plastic_employee_advances
       WHERE company_id = ? AND status = 'ACTIVE' AND outstanding_amount > 0`,
      [companyId]
    );

    const advMap = {};
    advancesRows.forEach((a) => {
      if (!advMap[a.employee_id]) advMap[a.employee_id] = [];
      advMap[a.employee_id].push(a);
    });

    // Create or re-create payroll master
    let payrollId;
    if (existing.length > 0) {
      payrollId = existing[0].id;
      // Delete old items before recomputing
      await pdb.query("DELETE FROM plastic_payroll_items WHERE payroll_id = ? AND company_id = ?", [payrollId, companyId]);
    } else {
      const [pRes] = await pdb.query(
        `INSERT INTO plastic_payrolls (
          company_id, payroll_batch_no, month, year, start_date, end_date,
          total_employees, status, notes, processed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PROCESSED', ?, ?)`,
        [companyId, batchNo, m, y, startDate, endDate, employees.length, notes || null, adminId]
      );
      payrollId = pRes.insertId;
    }

    let totalGross = 0;
    let totalDeductions = 0;
    let totalAdvancesRecovered = 0;
    let totalNet = 0;
    let totalOvertimePay = 0;

    // 4. Calculate for each employee
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const payslipNo = generatePayslipNo(y, m, i + 1);

      const baseSalary = Number(emp.base_salary || 0);
      const hra = Number(emp.hra || 0);
      const allowances = Number(emp.conveyance_allowance || 0) + Number(emp.medical_allowance || 0) + Number(emp.special_allowance || 0) + hra;
      const otRate = Number(emp.overtime_rate_per_hour || 0);

      const att = attMap[emp.id] || {
        present_days: 0,
        absent_days: 0,
        half_days: 0,
        leave_days: 0,
        holiday_days: 0,
        total_overtime_hours: 0,
      };

      const presentDays = Number(att.present_days || 0);
      const halfDays = Number(att.half_days || 0);
      const paidLeaves = Number(att.leave_days || 0) + Number(att.holiday_days || 0);
      const absentDays = Number(att.absent_days || 0);
      const otHours = Number(att.total_overtime_hours || 0);

      // If attendance was recorded, use actual; if none recorded at all (unmarked month), assume full working month
      const totalRecorded = presentDays + halfDays + paidLeaves + absentDays;
      const payableDays = totalRecorded > 0 ? (presentDays + (halfDays * 0.5) + paidLeaves) : lastDay;

      // Earned basic & allowances
      let earnedBasic = 0;
      let earnedAllowances = 0;
      if (emp.salary_type === "DAILY") {
        earnedBasic = baseSalary * payableDays;
        earnedAllowances = allowances;
      } else {
        // Monthly
        const dailyRate = baseSalary / lastDay;
        earnedBasic = Math.round(dailyRate * payableDays);
        earnedAllowances = Math.round((allowances / lastDay) * payableDays);
      }

      // Overtime Pay
      const overtimeAmount = Math.round(otHours * otRate);

      // Gross Salary
      const grossSalary = earnedBasic + earnedAllowances + overtimeAmount;

      // Advance Recovery
      let advanceRecovery = 0;
      const empAdvances = advMap[emp.id] || [];
      for (const adv of empAdvances) {
        const targetInstallment = Number(adv.monthly_installment) > 0
          ? Math.min(Number(adv.monthly_installment), Number(adv.outstanding_amount))
          : Math.min(2000, Number(adv.outstanding_amount));

        advanceRecovery += Math.min(targetInstallment, Math.max(0, grossSalary * 0.4));
      }
      advanceRecovery = Math.round(advanceRecovery);

      // Statutory deductions
      const pf = Number(emp.pf_deduction || 0);
      const esic = Number(emp.esic_deduction || 0);
      const pt = Number(emp.professional_tax || 0);
      const other = Number(emp.other_deductions || 0);

      const empTotalDeductions = pf + esic + pt + advanceRecovery + other;
      const netSalary = Math.max(0, grossSalary - empTotalDeductions);

      totalGross += grossSalary;
      totalDeductions += empTotalDeductions;
      totalAdvancesRecovered += advanceRecovery;
      totalNet += netSalary;
      totalOvertimePay += overtimeAmount;

      await pdb.query(
        `INSERT INTO plastic_payroll_items (
          company_id, payroll_id, employee_id, payslip_no, base_salary,
          present_days, absent_days, half_days, paid_leaves, overtime_hours,
          earned_basic, allowances, overtime_amount, bonus_incentive,
          gross_salary, pf_deduction, esic_deduction, pt_deduction,
          advance_recovery, other_deductions, total_deductions, net_salary,
          payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          companyId,
          payrollId,
          emp.id,
          payslipNo,
          baseSalary,
          presentDays,
          absentDays,
          halfDays,
          paidLeaves,
          otHours,
          earnedBasic,
          earnedAllowances,
          overtimeAmount,
          grossSalary,
          pf,
          esic,
          pt,
          advanceRecovery,
          other,
          empTotalDeductions,
          netSalary,
        ]
      );
    }

    // Update payroll totals
    await pdb.query(
      `UPDATE plastic_payrolls SET
        total_employees = ?,
        total_gross_salary = ?,
        total_deductions = ?,
        total_advances_recovered = ?,
        total_net_salary = ?,
        total_overtime_pay = ?,
        payment_date = ?,
        status = 'PROCESSED'
      WHERE id = ? AND company_id = ?`,
      [
        employees.length,
        totalGross,
        totalDeductions,
        totalAdvancesRecovered,
        totalNet,
        totalOvertimePay,
        payment_date || null,
        payrollId,
        companyId,
      ]
    );

    await pdb.commit();

    res.status(201).json({
      success: true,
      message: `Payroll processed successfully for ${m}/${y} (${employees.length} employees)`,
      payrollId,
      batch_no: batchNo,
      total_net_salary: totalNet,
      payroll: {
        id: payrollId,
        payroll_batch_no: batchNo,
        batch_no: batchNo,
        total_employees: employees.length,
        total_gross_salary: totalGross,
        total_net_salary: totalNet,
        total_advances_recovered: totalAdvancesRecovered,
      },
    });
  } catch (error) {
    await pdb.rollback();
    console.error("Process Monthly Payroll Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process payroll" });
  }
};

exports.updatePayrollStatus = async (req, res) => {
  const pdb = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { status, payment_date, payment_mode } = req.body;

    const [payrolls] = await pdb.query(
      "SELECT * FROM plastic_payrolls WHERE id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (payrolls.length === 0) {
      return res.status(404).json({ success: false, message: "Payroll batch not found" });
    }

    const payroll = payrolls[0];

    await pdb.beginTransaction();

    await pdb.query(
      "UPDATE plastic_payrolls SET status = ?, payment_date = COALESCE(?, payment_date) WHERE id = ? AND company_id = ?",
      [status, payment_date || null, id, companyId]
    );

    // If marked PAID, update all payroll items and recover advances
    if (status === "PAID") {
      await pdb.query(
        "UPDATE plastic_payroll_items SET payment_status = 'PAID', payment_mode = ? WHERE payroll_id = ? AND company_id = ?",
        [payment_mode || "BANK_TRANSFER", id, companyId]
      );

      // Deduct advance recoveries from employee advances
      const [itemsWithAdvances] = await pdb.query(
        "SELECT employee_id, advance_recovery FROM plastic_payroll_items WHERE payroll_id = ? AND company_id = ? AND advance_recovery > 0",
        [id, companyId]
      );

      for (const itm of itemsWithAdvances) {
        let remainingToDeduct = Number(itm.advance_recovery);

        const [activeAdv] = await pdb.query(
          "SELECT id, recovery_amount, outstanding_amount FROM plastic_employee_advances WHERE employee_id = ? AND company_id = ? AND status = 'ACTIVE' ORDER BY advance_date ASC",
          [itm.employee_id, companyId]
        );

        for (const adv of activeAdv) {
          if (remainingToDeduct <= 0) break;
          const deductAmount = Math.min(remainingToDeduct, Number(adv.outstanding_amount));
          const newRecovered = Number(adv.recovery_amount) + deductAmount;
          const newOutstanding = Number(adv.outstanding_amount) - deductAmount;
          const advStatus = newOutstanding === 0 ? "RECOVERED" : "ACTIVE";

          await pdb.query(
            "UPDATE plastic_employee_advances SET recovery_amount = ?, outstanding_amount = ?, status = ? WHERE id = ?",
            [newRecovered, newOutstanding, advStatus, adv.id]
          );

          remainingToDeduct -= deductAmount;
        }
      }
    }

    await pdb.commit();

    res.status(200).json({ success: true, message: `Payroll status updated to ${status}` });
  } catch (error) {
    await pdb.rollback();
    console.error("Update Payroll Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to update payroll status" });
  }
};

exports.getPayslip = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { payslipNo } = req.params;

    const [items] = await db.promise().query(
      `SELECT
        pi.*,
        p.month,
        p.year,
        p.start_date,
        p.end_date,
        e.employee_code,
        e.full_name AS employee_name,
        e.department,
        e.designation,
        e.joining_date,
        e.bank_name,
        e.bank_account_no,
        e.bank_ifsc,
        e.pan_number,
        bs.business_name,
        bs.address AS company_address,
        bs.mobile AS company_mobile,
        bs.email AS company_email
       FROM plastic_payroll_items pi
       JOIN plastic_payrolls p ON pi.payroll_id = p.id AND pi.company_id = p.company_id
       JOIN plastic_employees e ON pi.employee_id = e.id AND pi.company_id = e.company_id
       LEFT JOIN business_settings bs ON bs.company_id = pi.company_id
       WHERE pi.payslip_no = ? AND pi.company_id = ? LIMIT 1`,
      [payslipNo, companyId]
    );

    if (items.length === 0) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }

    res.status(200).json({ success: true, payslip: items[0] });
  } catch (error) {
    console.error("Get Payslip Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve payslip" });
  }
};
