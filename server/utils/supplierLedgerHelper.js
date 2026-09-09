const db = require("../config/db");

/**
 * Record a transaction entry into plastic_supplier_ledger with running balance
 * @param {Object} conn - MySQL connection (supports transaction)
 * @param {Object} entry - Ledger entry details
 */
const recordSupplierLedgerEntry = async (conn, {
  companyId,
  supplierId,
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

  // In supplier accounting (Creditor):
  // Credit increases what we owe the supplier (e.g. Purchase Bills)
  // Debit decreases what we owe the supplier (e.g. Payments, Debit Notes, Returns)
  // Running Balance = previousBalance + credit - debit

  const [lastRows] = await conn.query(
    `SELECT balance
     FROM plastic_supplier_ledger
     WHERE company_id = ? AND supplier_id = ?
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    [companyId, supplierId]
  );

  const previousBalance = lastRows.length > 0 ? Number(lastRows[0].balance) || 0 : 0;
  const newBalance = previousBalance + creditAmount - debitAmount;

  const [result] = await conn.query(
    `INSERT INTO plastic_supplier_ledger
      (company_id, supplier_id, transaction_date, reference_type, reference_id, reference_no, debit, credit, balance, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      supplierId,
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
  recordSupplierLedgerEntry,
};
