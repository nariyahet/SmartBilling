const db = require("../config/db");

/**
 * Record a transaction entry into plastic_customer_ledger with running balance
 * @param {Object} conn - MySQL connection (supports transaction)
 * @param {Object} entry - Ledger entry details
 */
const recordLedgerEntry = async (conn, {
  companyId,
  customerId,
  transactionDate = new Date(),
  referenceType,
  referenceId = null,
  referenceNo,
  debit = 0.00,
  credit = 0.00,
  notes = null,
  createdBy = null,
}) => {
  const debitAmount = Number(debit) || 0;
  const creditAmount = Number(credit) || 0;

  // 1. Fetch latest balance with FOR UPDATE lock
  const [lastRows] = await conn.query(
    `SELECT balance
     FROM plastic_customer_ledger
     WHERE company_id = ? AND customer_id = ?
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    [companyId, customerId]
  );

  const previousBalance = lastRows.length > 0 ? Number(lastRows[0].balance) || 0 : 0;
  const newBalance = previousBalance + debitAmount - creditAmount;

  // 2. Insert ledger record
  const [result] = await conn.query(
    `INSERT INTO plastic_customer_ledger
      (company_id, customer_id, transaction_date, reference_type, reference_id, reference_no, debit, credit, balance, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      customerId,
      transactionDate,
      referenceType,
      referenceId,
      referenceNo,
      debitAmount,
      creditAmount,
      newBalance,
      notes,
      createdBy,
    ]
  );

  return {
    ledgerId: result.insertId,
    previousBalance,
    newBalance,
  };
};

module.exports = {
  recordLedgerEntry,
};
