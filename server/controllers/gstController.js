const db = require("../config/db");

exports.getGstRecords = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { gst_type, from_date, to_date, search } = req.query;

    let sql = `
      SELECT * FROM plastic_gst_records
      WHERE company_id = ?
    `;
    const params = [companyId];

    if (gst_type && gst_type !== "ALL") {
      sql += ` AND gst_type = ?`;
      params.push(gst_type.toUpperCase());
    }

    if (from_date && to_date) {
      sql += ` AND invoice_date >= ? AND invoice_date <= ?`;
      params.push(from_date, to_date);
    }

    if (search && search.trim()) {
      sql += ` AND (invoice_no LIKE ? OR party_name LIKE ? OR party_gstin LIKE ? OR hsn_code LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY invoice_date DESC, id DESC`;

    const [records] = await db.promise().query(sql, params);

    const totalTaxable = records.reduce((acc, r) => acc + Number(r.taxable_amount || 0), 0);
    const totalCGST = records.reduce((acc, r) => acc + Number(r.cgst_amount || 0), 0);
    const totalSGST = records.reduce((acc, r) => acc + Number(r.sgst_amount || 0), 0);
    const totalIGST = records.reduce((acc, r) => acc + Number(r.igst_amount || 0), 0);
    const totalTax = records.reduce((acc, r) => acc + Number(r.total_tax || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalRecords: records.length,
        totalTaxable,
        totalCGST,
        totalSGST,
        totalIGST,
        totalTax,
      },
      records,
    });
  } catch (error) {
    console.error("Get GST Records Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch GST records" });
  }
};

exports.getGstr1Report = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { month, year, from_date, to_date } = req.query;

    let dateClause = "";
    const params = [companyId];

    if (from_date && to_date) {
      dateClause = " AND invoice_date >= ? AND invoice_date <= ?";
      params.push(from_date, to_date);
    } else if (month && year) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      dateClause = " AND invoice_date >= ? AND invoice_date <= ?";
      params.push(start, end);
    }

    // Fetch Outward supplies (OUTPUT)
    const [outwardRows] = await db.promise().query(
      `SELECT * FROM plastic_gst_records
       WHERE company_id = ? AND gst_type = 'OUTPUT' ${dateClause}
       ORDER BY invoice_date ASC`,
      params
    );

    // 1. B2B Supplies (Customer has valid GSTIN)
    const b2bSupplies = outwardRows.filter((r) => r.transaction_type === "SALE" && r.party_gstin && r.party_gstin.trim().length >= 15);

    // 2. B2C Supplies (Unregistered or no GSTIN)
    const b2cSupplies = outwardRows.filter((r) => r.transaction_type === "SALE" && (!r.party_gstin || r.party_gstin.trim().length < 15));

    // 3. Credit / Debit Notes (CDNR / CDNUR)
    const creditDebitNotes = outwardRows.filter((r) => ["CREDIT_NOTE", "DEBIT_NOTE"].includes(r.transaction_type));

    // 4. HSN Summary
    const hsnMap = {};
    for (const row of outwardRows) {
      const code = row.hsn_code || "3915";
      if (!hsnMap[code]) {
        hsnMap[code] = {
          hsn_code: code,
          description: code === "3915" ? "Waste, Parings and Scrap of Plastics" : "Plastic Granules / Products",
          uqc: "KGS",
          total_taxable_value: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
          total_tax_amount: 0,
        };
      }
      hsnMap[code].total_taxable_value += Number(row.taxable_amount || 0);
      hsnMap[code].cgst_amount += Number(row.cgst_amount || 0);
      hsnMap[code].sgst_amount += Number(row.sgst_amount || 0);
      hsnMap[code].igst_amount += Number(row.igst_amount || 0);
      hsnMap[code].total_tax_amount += Number(row.total_tax || 0);
    }

    const hsnSummary = Object.values(hsnMap);

    const summary = {
      b2bCount: b2bSupplies.length,
      b2bTaxable: b2bSupplies.reduce((acc, r) => acc + Number(r.taxable_amount || 0), 0),
      b2bTax: b2bSupplies.reduce((acc, r) => acc + Number(r.total_tax || 0), 0),
      b2cCount: b2cSupplies.length,
      b2cTaxable: b2cSupplies.reduce((acc, r) => acc + Number(r.taxable_amount || 0), 0),
      b2cTax: b2cSupplies.reduce((acc, r) => acc + Number(r.total_tax || 0), 0),
      cdnCount: creditDebitNotes.length,
      cdnTaxable: creditDebitNotes.reduce((acc, r) => acc + Number(r.taxable_amount || 0), 0),
      cdnTax: creditDebitNotes.reduce((acc, r) => acc + Number(r.total_tax || 0), 0),
      totalTaxableValue: outwardRows.reduce((acc, r) => acc + Number(r.taxable_amount || 0), 0),
      totalOutputCGST: outwardRows.reduce((acc, r) => acc + Number(r.cgst_amount || 0), 0),
      totalOutputSGST: outwardRows.reduce((acc, r) => acc + Number(r.sgst_amount || 0), 0),
      totalOutputIGST: outwardRows.reduce((acc, r) => acc + Number(r.igst_amount || 0), 0),
      totalOutputTax: outwardRows.reduce((acc, r) => acc + Number(r.total_tax || 0), 0),
    };

    res.status(200).json({
      success: true,
      reportName: "GSTR-1 Return Preparation",
      isOfficialFiling: false,
      disclaimer: "This report is an internal audit and filing preparation tool. Review with your tax consultant before filing on the GST portal.",
      summary,
      b2bSupplies,
      b2cSupplies,
      creditDebitNotes,
      hsnSummary,
    });
  } catch (error) {
    console.error("Get GSTR-1 Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate GSTR-1 report" });
  }
};

exports.getGstr3bReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { month, year, from_date, to_date } = req.query;

    let dateClause = "";
    const params = [companyId];

    if (from_date && to_date) {
      dateClause = " AND invoice_date >= ? AND invoice_date <= ?";
      params.push(from_date, to_date);
    } else if (month && year) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      dateClause = " AND invoice_date >= ? AND invoice_date <= ?";
      params.push(start, end);
    }

    // 1. Table 3.1: Outward taxable supplies
    const [outwardRows] = await db.promise().query(
      `SELECT
        COALESCE(SUM(taxable_amount), 0) AS total_taxable,
        COALESCE(SUM(cgst_amount), 0) AS total_cgst,
        COALESCE(SUM(sgst_amount), 0) AS total_sgst,
        COALESCE(SUM(igst_amount), 0) AS total_igst,
        COALESCE(SUM(total_tax), 0) AS total_tax
       FROM plastic_gst_records
       WHERE company_id = ? AND gst_type = 'OUTPUT' ${dateClause}`,
      params
    );

    // 2. Table 4: Eligible Input Tax Credit (ITC)
    const [itcRows] = await db.promise().query(
      `SELECT
        COALESCE(SUM(taxable_amount), 0) AS total_taxable,
        COALESCE(SUM(cgst_amount), 0) AS itc_cgst,
        COALESCE(SUM(sgst_amount), 0) AS itc_sgst,
        COALESCE(SUM(igst_amount), 0) AS itc_igst,
        COALESCE(SUM(total_tax), 0) AS total_itc
       FROM plastic_gst_records
       WHERE company_id = ? AND gst_type = 'INPUT' AND itc_eligibility = 'ELIGIBLE' ${dateClause}`,
      params
    );

    const outCGST = Number(outwardRows[0]?.total_cgst || 0);
    const outSGST = Number(outwardRows[0]?.total_sgst || 0);
    const outIGST = Number(outwardRows[0]?.total_igst || 0);

    const itcCGST = Number(itcRows[0]?.itc_cgst || 0);
    const itcSGST = Number(itcRows[0]?.itc_sgst || 0);
    const itcIGST = Number(itcRows[0]?.itc_igst || 0);

    // Net GST Payable = Output GST - Input GST
    const netCGSTPayable = Math.max(0, outCGST - itcCGST);
    const netSGSTPayable = Math.max(0, outSGST - itcSGST);
    const netIGSTPayable = Math.max(0, outIGST - itcIGST);
    const totalNetPayable = netCGSTPayable + netSGSTPayable + netIGSTPayable;

    // Excess ITC Carried Forward
    const itcCarriedForward = {
      cgst: Math.max(0, itcCGST - outCGST),
      sgst: Math.max(0, itcSGST - outSGST),
      igst: Math.max(0, itcIGST - outIGST),
      total: Math.max(0, (itcCGST + itcSGST + itcIGST) - (outCGST + outSGST + outIGST)),
    };

    res.status(200).json({
      success: true,
      reportName: "GSTR-3B Return Summary",
      isOfficialFiling: false,
      disclaimer: "This report is an internal preparation summary. Review with your tax professional before submitting to the GST portal.",
      table31OutwardSupplies: {
        taxableValue: Number(outwardRows[0]?.total_taxable || 0),
        cgst: outCGST,
        sgst: outSGST,
        igst: outIGST,
        totalTax: Number(outwardRows[0]?.total_tax || 0),
      },
      table4EligibleITC: {
        taxableValue: Number(itcRows[0]?.total_taxable || 0),
        cgst: itcCGST,
        sgst: itcSGST,
        igst: itcIGST,
        totalITC: Number(itcRows[0]?.total_itc || 0),
      },
      table6PaymentOfTax: {
        netCGSTPayable,
        netSGSTPayable,
        netIGSTPayable,
        totalNetPayable,
        itcCarriedForward,
      },
    });
  } catch (error) {
    console.error("Get GSTR-3B Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate GSTR-3B summary" });
  }
};

exports.getItcRegister = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { reconciliation_status, from_date, to_date } = req.query;

    let sql = `
      SELECT * FROM plastic_gst_records
      WHERE company_id = ? AND gst_type = 'INPUT'
    `;
    const params = [companyId];

    if (reconciliation_status && reconciliation_status !== "ALL") {
      sql += ` AND itc_reconciliation_status = ?`;
      params.push(reconciliation_status.toUpperCase());
    }

    if (from_date && to_date) {
      sql += ` AND invoice_date >= ? AND invoice_date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` ORDER BY invoice_date DESC, id DESC`;

    const [rows] = await db.promise().query(sql, params);

    const totalEligible = rows.filter((r) => r.itc_eligibility === "ELIGIBLE").reduce((acc, r) => acc + Number(r.total_tax || 0), 0);
    const matchedCount = rows.filter((r) => r.itc_reconciliation_status === "MATCHED").length;
    const unmatchedCount = rows.filter((r) => r.itc_reconciliation_status === "UNMATCHED").length;

    res.status(200).json({
      success: true,
      summary: {
        totalRecords: rows.length,
        totalEligibleTax: totalEligible,
        matchedCount,
        unmatchedCount,
      },
      itcRecords: rows,
    });
  } catch (error) {
    console.error("Get ITC Register Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch ITC register" });
  }
};

exports.updateItcStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["MATCHED", "UNMATCHED", "REVIEW_REQUIRED"];
    if (!validStatuses.includes(String(status).toUpperCase())) {
      return res.status(400).json({ success: false, message: "Invalid ITC reconciliation status" });
    }

    const [result] = await db.promise().query(
      `UPDATE plastic_gst_records SET itc_reconciliation_status = ? WHERE id = ? AND company_id = ?`,
      [status.toUpperCase(), id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "GST record not found" });
    }

    res.status(200).json({ success: true, message: `ITC status updated to ${status}` });
  } catch (error) {
    console.error("Update ITC Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to update ITC status" });
  }
};
