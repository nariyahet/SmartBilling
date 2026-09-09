const db = require("../config/db");
const { generateNextJournalNo, postJournalEntry } = require("../utils/accountingHelper");

exports.getNextJournalNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextJournalNo(db.promise(), companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Journal No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate next journal number" });
  }
};

exports.getJournalEntries = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, reference_type, search } = req.query;

    let sql = `
      SELECT
        je.*,
        a_dr.account_name AS debit_account_name,
        a_dr.account_code AS debit_account_code,
        a_cr.account_name AS credit_account_name,
        a_cr.account_code AS credit_account_code,
        adm.name AS created_by_name,
        (SELECT COUNT(ji.id) FROM plastic_journal_items ji WHERE ji.journal_entry_id = je.id AND ji.company_id = je.company_id) AS items_count
      FROM plastic_journal_entries je
      LEFT JOIN plastic_accounts a_dr ON je.debit_account_id = a_dr.id AND je.company_id = a_dr.company_id
      LEFT JOIN plastic_accounts a_cr ON je.credit_account_id = a_cr.id AND je.company_id = a_cr.company_id
      LEFT JOIN admins adm ON je.created_by = adm.id
      WHERE je.company_id = ?
    `;
    const params = [companyId];

    if (from_date && to_date) {
      sql += ` AND je.entry_date >= ? AND je.entry_date <= ?`;
      params.push(from_date, to_date);
    } else if (from_date) {
      sql += ` AND je.entry_date >= ?`;
      params.push(from_date);
    } else if (to_date) {
      sql += ` AND je.entry_date <= ?`;
      params.push(to_date);
    }

    if (reference_type && reference_type !== "ALL") {
      sql += ` AND je.reference_type = ?`;
      params.push(reference_type);
    }

    if (search && search.trim()) {
      sql += ` AND (je.journal_no LIKE ? OR je.narration LIKE ? OR je.reference_no LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY je.entry_date DESC, je.id DESC`;

    const [entries] = await db.promise().query(sql, params);

    const totalVolume = entries.reduce((acc, e) => acc + Number(e.total_amount || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalEntries: entries.length,
        totalVolume,
      },
      entries,
    });
  } catch (error) {
    console.error("Get Journal Entries Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch journal entries" });
  }
};

exports.getJournalEntryById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [entries] = await db.promise().query(
      `SELECT je.*, adm.name AS created_by_name
       FROM plastic_journal_entries je
       LEFT JOIN admins adm ON je.created_by = adm.id
       WHERE je.id = ? AND je.company_id = ? LIMIT 1`,
      [id, companyId]
    );

    if (entries.length === 0) {
      return res.status(404).json({ success: false, message: "Journal entry not found" });
    }

    const [items] = await db.promise().query(
      `SELECT ji.*, a.account_name, a.account_code, a.account_type, a.debit_credit_nature
       FROM plastic_journal_items ji
       JOIN plastic_accounts a ON ji.account_id = a.id AND ji.company_id = a.company_id
       WHERE ji.journal_entry_id = ? AND ji.company_id = ?
       ORDER BY ji.entry_type DESC, ji.id ASC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      entry: entries[0],
      items,
    });
  } catch (error) {
    console.error("Get Journal Entry By ID Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch journal entry" });
  }
};

exports.createJournalEntry = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      journal_no,
      entry_date,
      reference_type = "MANUAL",
      reference_no,
      narration,
      items,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Journal voucher requires at least two line items (Debit and Credit)",
      });
    }

    await conn.beginTransaction();

    try {
      const result = await postJournalEntry(conn, {
        companyId,
        journalNo: journal_no,
        entryDate: entry_date || new Date(),
        referenceType: reference_type || "MANUAL",
        referenceNo: reference_no,
        narration: narration || "Manual Journal Voucher",
        items,
        createdBy: adminId,
      });

      await conn.commit();

      res.status(201).json({
        success: true,
        message: `Journal voucher ${result.journalNo} posted successfully`,
        journalEntryId: result.journalEntryId,
        journalNo: result.journalNo,
        totalAmount: result.totalAmount,
      });
    } catch (txnErr) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: txnErr.message || "Failed to post journal entry",
      });
    }
  } catch (error) {
    console.error("Create Journal Entry Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create journal entry",
    });
  }
};
