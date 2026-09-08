const db = require("../config/db");

const generateNextEmployeeCode = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT employee_code
     FROM plastic_employees
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.employee_code) {
      const match = String(row.employee_code).match(/^EMP-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `EMP-${maxNum + 1}`;
};

exports.getNextEmployeeCode = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextCode = await generateNextEmployeeCode(companyId);
    res.status(200).json({ success: true, nextCode });
  } catch (error) {
    console.error("Get Next Emp Code Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate employee code" });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, department, search } = req.query;

    let sql = `
      SELECT
        e.*,
        s.salary_type,
        s.base_salary,
        s.hra,
        s.conveyance_allowance,
        s.medical_allowance,
        s.special_allowance,
        s.overtime_rate_per_hour,
        s.pf_deduction,
        s.esic_deduction,
        s.professional_tax,
        s.other_deductions,
        op.id AS linked_operator_id,
        op.operator_code AS linked_operator_code
      FROM plastic_employees e
      LEFT JOIN (
        SELECT * FROM plastic_employee_salaries
        WHERE status = 'ACTIVE'
      ) s ON e.id = s.employee_id AND e.company_id = s.company_id
      LEFT JOIN plastic_operators op ON e.id = op.employee_id AND e.company_id = op.company_id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    if (status && status !== "ALL") {
      sql += " AND e.status = ?";
      params.push(status);
    }

    if (department && department !== "ALL") {
      sql += " AND e.department = ?";
      params.push(department);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += " AND (e.full_name LIKE ? OR e.employee_code LIKE ? OR e.mobile LIKE ? OR e.designation LIKE ?)";
      params.push(term, term, term, term);
    }

    sql += " ORDER BY e.id DESC";

    const [employees] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, count: employees.length, employees });
  } catch (error) {
    console.error("Get Employees Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve employees" });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [employees] = await db.promise().query(
      `SELECT e.*, op.id AS linked_operator_id, op.operator_code AS linked_operator_code
       FROM plastic_employees e
       LEFT JOIN plastic_operators op ON e.id = op.employee_id AND e.company_id = op.company_id
       WHERE e.id = ? AND e.company_id = ? LIMIT 1`,
      [id, companyId]
    );

    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const employee = employees[0];

    // Fetch salary structure
    const [salaries] = await db.promise().query(
      `SELECT * FROM plastic_employee_salaries
       WHERE employee_id = ? AND company_id = ?
       ORDER BY effective_from DESC`,
      [id, companyId]
    );

    // Fetch leave balances for current year
    const currentYear = new Date().getFullYear();
    const [leaveBalances] = await db.promise().query(
      `SELECT lb.*, lt.name AS leave_type_name, lt.code AS leave_type_code, lt.is_paid
       FROM plastic_leave_balances lb
       JOIN plastic_leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.employee_id = ? AND lb.company_id = ? AND lb.year = ?`,
      [id, companyId, currentYear]
    );

    // Fetch recent attendance (last 30 days)
    const [recentAttendance] = await db.promise().query(
      `SELECT * FROM plastic_attendance
       WHERE employee_id = ? AND company_id = ?
       ORDER BY attendance_date DESC LIMIT 30`,
      [id, companyId]
    );

    // Fetch active advance if any
    const [advances] = await db.promise().query(
      `SELECT * FROM plastic_employee_advances
       WHERE employee_id = ? AND company_id = ? AND status = 'ACTIVE'
       ORDER BY advance_date DESC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      employee,
      salaries,
      activeSalary: salaries.find((s) => s.status === "ACTIVE") || null,
      leaveBalances,
      recentAttendance,
      advances,
    });
  } catch (error) {
    console.error("Get Employee By ID Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve employee details" });
  }
};

exports.createEmployee = async (req, res) => {
  const pdb = db.promise();
  try {
    const companyId = req.user.company_id;
    const {
      first_name,
      last_name,
      mobile,
      email,
      department,
      designation,
      joining_date,
      employment_type = "FULL_TIME",
      status = "ACTIVE",
      emergency_contact_name,
      emergency_contact_phone,
      bank_name,
      bank_account_no,
      bank_ifsc,
      pan_number,
      aadhaar_number,
      address,
      notes,
      salary, // optional object: { salary_type, base_salary, hra, ... }
      operator_id, // optional link to Phase 2 operator
    } = req.body;

    let firstName = first_name;
    let lastName = last_name;
    let fullName = req.body.full_name;

    if (!firstName && fullName) {
      const parts = fullName.trim().split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ") || null;
    } else if (firstName) {
      fullName = lastName ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim();
    }

    if (!firstName || !mobile || !joining_date) {
      return res.status(400).json({
        success: false,
        message: "Full name (or first name), mobile, and joining date are required",
      });
    }

    const employeeCode = req.body.employee_code || (await generateNextEmployeeCode(companyId));
    const bankAccount = bank_account_no || req.body.account_number || null;
    const bankIfsc = bank_ifsc || req.body.ifsc_code || null;

    await pdb.beginTransaction();

    const [empRes] = await pdb.query(
      `INSERT INTO plastic_employees (
        company_id, employee_code, first_name, last_name, full_name,
        mobile, email, department, designation, joining_date,
        employment_type, status, emergency_contact_name, emergency_contact_phone,
        bank_name, bank_account_no, bank_ifsc, pan_number, aadhaar_number,
        address, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        employeeCode,
        firstName.trim(),
        lastName ? lastName.trim() : null,
        fullName,
        mobile.trim(),
        email ? email.trim() : null,
        department || "Production",
        designation || "Worker",
        joining_date,
        employment_type,
        status,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        bank_name || null,
        bankAccount,
        bankIfsc,
        pan_number || null,
        aadhaar_number || null,
        address || null,
        notes || null,
      ]
    );

    const employeeId = empRes.insertId;

    // Create salary structure if provided
    if (salary) {
      await pdb.query(
        `INSERT INTO plastic_employee_salaries (
          company_id, employee_id, salary_type, base_salary, hra,
          conveyance_allowance, medical_allowance, special_allowance,
          overtime_rate_per_hour, pf_deduction, esic_deduction,
          professional_tax, other_deductions, effective_from, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [
          companyId,
          employeeId,
          salary.salary_type || "MONTHLY",
          Number(salary.base_salary || 0),
          Number(salary.hra || 0),
          Number(salary.conveyance_allowance || 0),
          Number(salary.medical_allowance || 0),
          Number(salary.special_allowance || 0),
          Number(salary.overtime_rate_per_hour || 0),
          Number(salary.pf_deduction || 0),
          Number(salary.esic_deduction || 0),
          Number(salary.professional_tax || 0),
          Number(salary.other_deductions || 0),
          salary.effective_from || joining_date,
        ]
      );
    }

    // Initialize annual leave balances for current year
    const currentYear = new Date().getFullYear();
    const [leaveTypes] = await pdb.query(
      "SELECT id, annual_quota FROM plastic_leave_types WHERE company_id = ? AND status = 'ACTIVE'",
      [companyId]
    );

    for (const lt of leaveTypes) {
      await pdb.query(
        `INSERT IGNORE INTO plastic_leave_balances (
          company_id, employee_id, leave_type_id, year, total_allocated, used, balance
        ) VALUES (?, ?, ?, ?, ?, 0.00, ?)`,
        [companyId, employeeId, lt.id, currentYear, lt.annual_quota, lt.annual_quota]
      );
    }

    // Link to Phase 2 operator if specified
    if (operator_id) {
      await pdb.query(
        "UPDATE plastic_operators SET employee_id = ? WHERE id = ? AND company_id = ?",
        [employeeId, operator_id, companyId]
      );
    }

    await pdb.commit();

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      employeeId,
      employee: {
        id: employeeId,
        employee_code: employeeCode,
        full_name: fullName,
        department,
        designation,
      },
    });

  } catch (error) {
    await pdb.rollback();
    console.error("Create Employee Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create employee" });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      first_name,
      last_name,
      mobile,
      email,
      department,
      designation,
      joining_date,
      employment_type,
      status,
      emergency_contact_name,
      emergency_contact_phone,
      bank_name,
      bank_account_no,
      bank_ifsc,
      pan_number,
      aadhaar_number,
      address,
      notes,
      operator_id,
    } = req.body;

    const [existing] = await db.promise().query(
      "SELECT id, first_name, last_name FROM plastic_employees WHERE id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const fName = first_name ? first_name.trim() : existing[0].first_name;
    const lName = last_name !== undefined ? (last_name ? last_name.trim() : null) : existing[0].last_name;
    const fullName = lName ? `${fName} ${lName}` : fName;

    await db.promise().query(
      `UPDATE plastic_employees SET
        first_name = ?, last_name = ?, full_name = ?,
        mobile = COALESCE(?, mobile),
        email = ?,
        department = COALESCE(?, department),
        designation = COALESCE(?, designation),
        joining_date = COALESCE(?, joining_date),
        employment_type = COALESCE(?, employment_type),
        status = COALESCE(?, status),
        emergency_contact_name = ?,
        emergency_contact_phone = ?,
        bank_name = ?,
        bank_account_no = ?,
        bank_ifsc = ?,
        pan_number = ?,
        aadhaar_number = ?,
        address = ?,
        notes = ?
      WHERE id = ? AND company_id = ?`,
      [
        fName,
        lName,
        fullName,
        mobile ? mobile.trim() : null,
        email ? email.trim() : null,
        department,
        designation,
        joining_date,
        employment_type,
        status,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        bank_name || null,
        bank_account_no || null,
        bank_ifsc || null,
        pan_number || null,
        aadhaar_number || null,
        address || null,
        notes || null,
        id,
        companyId,
      ]
    );

    // Operator linkage
    if (operator_id !== undefined) {
      // Clear previous mapping
      await db.promise().query(
        "UPDATE plastic_operators SET employee_id = NULL WHERE employee_id = ? AND company_id = ?",
        [id, companyId]
      );
      if (operator_id) {
        await db.promise().query(
          "UPDATE plastic_operators SET employee_id = ? WHERE id = ? AND company_id = ?",
          [id, operator_id, companyId]
        );
      }
    }

    res.status(200).json({ success: true, message: "Employee updated successfully" });
  } catch (error) {
    console.error("Update Employee Error:", error);
    res.status(500).json({ success: false, message: "Failed to update employee" });
  }
};

exports.updateSalaryStructure = async (req, res) => {
  const pdb = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      salary_type = "MONTHLY",
      base_salary = 0,
      hra = 0,
      conveyance_allowance = 0,
      medical_allowance = 0,
      special_allowance = 0,
      overtime_rate_per_hour = 0,
      pf_deduction = 0,
      esic_deduction = 0,
      professional_tax = 0,
      other_deductions = 0,
      effective_from,
      effective_date,
      pf_applicable,
      esic_applicable,
      pt_applicable,
      pt_amount,
    } = req.body;

    const finalEffectiveFrom = effective_from || effective_date || new Date().toISOString().slice(0, 10);
    const finalPf = pf_deduction || (pf_applicable ? Number(base_salary) * 0.12 : 0);
    const finalEsic = esic_deduction || (esic_applicable ? Number(base_salary) * 0.0075 : 0);
    const finalPt = professional_tax || (pt_applicable ? Number(pt_amount || 200) : 0);

    const [emp] = await pdb.query(
      "SELECT id FROM plastic_employees WHERE id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (emp.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    await pdb.beginTransaction();

    // Mark previous active salaries as INACTIVE
    await pdb.query(
      "UPDATE plastic_employee_salaries SET status = 'INACTIVE' WHERE employee_id = ? AND company_id = ?",
      [id, companyId]
    );

    // Insert new active salary structure
    await pdb.query(
      `INSERT INTO plastic_employee_salaries (
        company_id, employee_id, salary_type, base_salary, hra,
        conveyance_allowance, medical_allowance, special_allowance,
        overtime_rate_per_hour, pf_deduction, esic_deduction,
        professional_tax, other_deductions, effective_from, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        companyId,
        id,
        salary_type,
        Number(base_salary || 0),
        Number(hra || 0),
        Number(conveyance_allowance || 0),
        Number(medical_allowance || 0),
        Number(special_allowance || 0),
        Number(overtime_rate_per_hour || 0),
        Number(finalPf || 0),
        Number(finalEsic || 0),
        Number(finalPt || 0),
        Number(other_deductions || 0),
        finalEffectiveFrom,
      ]
    );

    await pdb.commit();

    res.status(200).json({ success: true, message: "Salary structure updated successfully" });
  } catch (error) {
    await pdb.rollback();
    console.error("Update Salary Structure Error:", error);
    res.status(500).json({ success: false, message: "Failed to update salary structure" });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    // Check if employee has processed payroll records
    const [payrolls] = await db.promise().query(
      "SELECT id FROM plastic_payroll_items WHERE employee_id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (payrolls.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete employee with existing payroll records. Set status to INACTIVE instead.",
      });
    }

    // Unlink operator
    await db.promise().query(
      "UPDATE plastic_operators SET employee_id = NULL WHERE employee_id = ? AND company_id = ?",
      [id, companyId]
    );

    await db.promise().query(
      "DELETE FROM plastic_employees WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    res.status(200).json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Delete Employee Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete employee" });
  }
};

exports.getDepartmentsAndDesignations = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const defaultDepartments = [
      "Production",
      "Maintenance",
      "Quality Control",
      "Procurement & Inward",
      "Sales & Dispatch",
      "Finance & Accounts",
      "HR & Admin",
      "Logistics & Yard",
    ];

    const defaultDesignations = [
      "Plant Manager",
      "Production Supervisor",
      "Extruder Operator",
      "Washing Line Operator",
      "Crusher Operator",
      "QC Inspector",
      "Maintenance Technician",
      "Electrician",
      "Forklift Driver",
      "Loader / Helper",
      "Accountant",
      "Store Keeper",
      "Security Guard",
    ];

    const [deptRows] = await db.promise().query(
      "SELECT DISTINCT department FROM plastic_employees WHERE company_id = ? AND department IS NOT NULL",
      [companyId]
    );
    const [desigRows] = await db.promise().query(
      "SELECT DISTINCT designation FROM plastic_employees WHERE company_id = ? AND designation IS NOT NULL",
      [companyId]
    );

    const customDepts = deptRows.map((r) => r.department);
    const customDesigs = desigRows.map((r) => r.designation);

    const allDepartments = Array.from(new Set([...defaultDepartments, ...customDepts]));
    const allDesignations = Array.from(new Set([...defaultDesignations, ...customDesigs]));

    res.status(200).json({
      success: true,
      departments: allDepartments,
      designations: allDesignations,
    });
  } catch (error) {
    console.error("Get Departments Error:", error);
    res.status(500).json({ success: false, message: "Failed to load departments" });
  }
};
