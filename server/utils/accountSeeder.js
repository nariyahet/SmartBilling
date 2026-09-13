const DEFAULT_ACCOUNT_GROUPS = [
  { name: "Current Assets", code: "ASSET_CA", type: "ASSET", description: "Cash, bank, debtors, inventories, advances" },
  { name: "Fixed & Non-Current Assets", code: "ASSET_FA", type: "ASSET", description: "Plant, machinery, land & buildings" },
  { name: "Current Liabilities", code: "LIAB_CL", type: "LIABILITY", description: "Creditors, short-term payables, taxes payable" },
  { name: "Non-Current Liabilities", code: "LIAB_NCL", type: "LIABILITY", description: "Long term term-loans, vehicle/machinery loans" },
  { name: "Capital & Equity", code: "EQ_CAP", type: "EQUITY", description: "Owner equity, share capital, reserves & surplus" },
  { name: "Direct Plant Revenue & Sales", code: "INC_DIR", type: "INCOME", description: "Sales of recycled granules, agglomerates & regrind" },
  { name: "Indirect & Other Income", code: "INC_IND", type: "INCOME", description: "Discounts received, scrap disposal, interest" },
  { name: "Direct Cost of Goods Sold", code: "EXP_DIR", type: "EXPENSE", description: "Raw scrap purchases, freight, plant electricity & labour" },
  { name: "Indirect & Administrative Expenses", code: "EXP_IND", type: "EXPENSE", description: "Admin payroll, office expenses, repairs, rent" },
];

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash on Hand", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "CASH" },
  { code: "1010", name: "Main Operating Bank", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "BANK" },
  { code: "1100", name: "Sundry Debtors (Customers Control)", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "CUSTOMER" },
  { code: "1200", name: "Raw Material Scrap Inventory", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "INVENTORY" },
  { code: "1210", name: "Finished Goods Inventory (Granules)", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "INVENTORY" },
  { code: "1300", name: "Input CGST", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "TAX_INPUT" },
  { code: "1310", name: "Input SGST", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "TAX_INPUT" },
  { code: "1320", name: "Input IGST", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "TAX_INPUT" },
  { code: "1400", name: "Employee Advances Receivable", groupCode: "ASSET_CA", type: "ASSET", nature: "DEBIT", refType: "ADVANCE" },
  { code: "1500", name: "Plant & Extruder Machinery", groupCode: "ASSET_FA", type: "ASSET", nature: "DEBIT", refType: "FIXED_ASSET" },
  { code: "2000", name: "Sundry Creditors (Suppliers Control)", groupCode: "LIAB_CL", type: "LIABILITY", nature: "CREDIT", refType: "SUPPLIER" },
  { code: "2100", name: "Output CGST", groupCode: "LIAB_CL", type: "LIABILITY", nature: "CREDIT", refType: "TAX_OUTPUT" },
  { code: "2110", name: "Output SGST", groupCode: "LIAB_CL", type: "LIABILITY", nature: "CREDIT", refType: "TAX_OUTPUT" },
  { code: "2120", name: "Output IGST", groupCode: "LIAB_CL", type: "LIABILITY", nature: "CREDIT", refType: "TAX_OUTPUT" },
  { code: "2200", name: "Salary & Wages Payable", groupCode: "LIAB_CL", type: "LIABILITY", nature: "CREDIT", refType: "PAYROLL" },
  { code: "2300", name: "Statutory Payables (PF / ESIC / PT)", groupCode: "LIAB_CL", type: "LIABILITY", nature: "CREDIT", refType: "STATUTORY" },
  { code: "2500", name: "Working Capital Bank OD / Loan", groupCode: "LIAB_CL", type: "LIABILITY", nature: "CREDIT", refType: "LOAN" },
  { code: "3000", name: "Owner's Capital Account", groupCode: "EQ_CAP", type: "EQUITY", nature: "CREDIT", refType: "CAPITAL" },
  { code: "3100", name: "Retained Earnings / Surplus", groupCode: "EQ_CAP", type: "EQUITY", nature: "CREDIT", refType: "RESERVES" },
  { code: "4000", name: "Recycled Plastic Sales", groupCode: "INC_DIR", type: "INCOME", nature: "CREDIT", refType: "SALES" },
  { code: "4050", name: "Scrap & Regrind Sales", groupCode: "INC_DIR", type: "INCOME", nature: "CREDIT", refType: "SALES" },
  { code: "4100", name: "Sales Returns (Contra)", groupCode: "INC_DIR", type: "INCOME", nature: "DEBIT", refType: "SALES_RETURN" },
  { code: "4200", name: "Discounts Received", groupCode: "INC_IND", type: "INCOME", nature: "CREDIT", refType: "OTHER_INCOME" },
  { code: "4300", name: "Miscellaneous Plant Income", groupCode: "INC_IND", type: "INCOME", nature: "CREDIT", refType: "OTHER_INCOME" },
  { code: "5000", name: "Raw Scrap Purchases", groupCode: "EXP_DIR", type: "EXPENSE", nature: "DEBIT", refType: "PURCHASES" },
  { code: "5050", name: "Inward Freight & Cartage", groupCode: "EXP_DIR", type: "EXPENSE", nature: "DEBIT", refType: "FREIGHT" },
  { code: "5100", name: "Direct Plant Labour & Overtime", groupCode: "EXP_DIR", type: "EXPENSE", nature: "DEBIT", refType: "LABOUR" },
  { code: "5200", name: "Factory Electricity & High-Tension Power", groupCode: "EXP_DIR", type: "EXPENSE", nature: "DEBIT", refType: "POWER" },
  { code: "5300", name: "Machine Maintenance & Spares", groupCode: "EXP_DIR", type: "EXPENSE", nature: "DEBIT", refType: "MAINTENANCE" },
  { code: "5400", name: "Factory Consumables & Packing Materials", groupCode: "EXP_DIR", type: "EXPENSE", nature: "DEBIT", refType: "CONSUMABLES" },
  { code: "6000", name: "Administrative Salaries & Staff Payroll", groupCode: "EXP_IND", type: "EXPENSE", nature: "DEBIT", refType: "PAYROLL" },
  { code: "6100", name: "Office & Administrative Expenses", groupCode: "EXP_IND", type: "EXPENSE", nature: "DEBIT", refType: "ADMIN" },
  { code: "6200", name: "Factory Shed Rent & Municipal Rates", groupCode: "EXP_IND", type: "EXPENSE", nature: "DEBIT", refType: "RENT" },
  { code: "6300", name: "Discounts Allowed", groupCode: "EXP_IND", type: "EXPENSE", nature: "DEBIT", refType: "DISCOUNT" },
  { code: "6400", name: "Miscellaneous & Sundry Factory Expenses", groupCode: "EXP_IND", type: "EXPENSE", nature: "DEBIT", refType: "MISC" },
];

/**
 * Seed default account groups, chart of accounts, and default bank/cash accounts for a company.
 * @param {Object} conn - MySQL connection or db.promise()
 * @param {number} companyId - Target company ID
 */
async function seedCompanyAccounts(conn, companyId) {
  if (!companyId) return;

  // 1. Seed Groups
  for (const grp of DEFAULT_ACCOUNT_GROUPS) {
    await conn.query(
      `INSERT INTO plastic_account_groups (company_id, name, code, type, description, is_system)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
      [companyId, grp.name, grp.code, grp.type, grp.description]
    );
  }

  // Fetch group IDs
  const [groups] = await conn.query(
    "SELECT id, code FROM plastic_account_groups WHERE company_id = ?",
    [companyId]
  );
  const groupMap = {};
  groups.forEach((g) => {
    groupMap[g.code] = g.id;
  });

  // 2. Seed Accounts
  for (const acc of DEFAULT_ACCOUNTS) {
    const groupId = groupMap[acc.groupCode];
    if (groupId) {
      await conn.query(
        `INSERT INTO plastic_accounts (company_id, group_id, account_code, account_name, account_type, debit_credit_nature, reference_type, is_system, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE')
         ON DUPLICATE KEY UPDATE account_name = VALUES(account_name), group_id = VALUES(group_id), reference_type = VALUES(reference_type)`,
        [companyId, groupId, acc.code, acc.name, acc.type, acc.nature, acc.refType]
      );
    }
  }

  // 3. Link Default Bank & Cash Masters
  const [cashAccRows] = await conn.query(
    "SELECT id FROM plastic_accounts WHERE company_id = ? AND account_code = '1000' LIMIT 1",
    [companyId]
  );
  const [bankAccRows] = await conn.query(
    "SELECT id FROM plastic_accounts WHERE company_id = ? AND account_code = '1010' LIMIT 1",
    [companyId]
  );

  const cashAccId = cashAccRows[0]?.id || null;
  const bankAccId = bankAccRows[0]?.id || null;

  await conn.query(
    `INSERT INTO plastic_bank_accounts (company_id, account_id, account_type, bank_name, account_name, account_number, branch, opening_balance, current_balance, status)
     VALUES (?, ?, 'CASH', 'Cash Counter', 'Primary Plant Cash Register', 'CASH-PRIMARY', 'Plant', 0.00, 0.00, 'ACTIVE')
     ON DUPLICATE KEY UPDATE account_name = VALUES(account_name)`,
    [companyId, cashAccId]
  );

  await conn.query(
    `INSERT INTO plastic_bank_accounts (company_id, account_id, account_type, bank_name, account_name, account_number, ifsc_code, branch, opening_balance, current_balance, status)
     VALUES (?, ?, 'CURRENT', 'Primary Bank', 'Operating Current Account', 'OPERATING-CURRENT', 'BANK000001', 'Main Branch', 0.00, 0.00, 'ACTIVE')
     ON DUPLICATE KEY UPDATE account_name = VALUES(account_name)`,
    [companyId, bankAccId]
  );
}

module.exports = {
  seedCompanyAccounts,
  DEFAULT_ACCOUNT_GROUPS,
  DEFAULT_ACCOUNTS,
};
