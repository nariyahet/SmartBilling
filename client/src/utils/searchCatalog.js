/**
 * Global Search Catalog & Deterministic Matcher for SmartBilling 2.0
 * Provides intentional page and module destination matching across the ERP.
 */

export const SEARCH_DESTINATIONS = [
  // 1. Primary Pages & Frequently Accessed Navigation Targets
  {
    id: "payments",
    label: "Payments",
    module: "Sales & Dispatch",
    path: "/plastic-erp/payments",
    icon: "💵",
    keywords: ["payments", "payment", "customer payment", "receipt", "receipts", "collections", "pay"],
    priority: 50,
  },
  {
    id: "products",
    label: "Products",
    module: "Sales & Dispatch",
    path: "/products",
    icon: "📦",
    keywords: ["products", "product", "items", "item", "catalog", "goods catalog"],
    priority: 45,
  },
  {
    id: "finished-goods",
    label: "WIP & Finished Goods",
    module: "Production",
    path: "/plastic-erp/wip-fg",
    icon: "📦",
    keywords: ["finished goods", "finished", "finished good", "wip", "work in progress", "fg", "semi finished goods", "wip & finished goods"],
    priority: 45,
  },
  {
    id: "procurement",
    label: "Procurement Dashboard",
    module: "Procurement",
    path: "/plastic-erp/procurement-dashboard",
    icon: "📈",
    keywords: ["procurement", "procurement dashboard", "purchase", "purchasing", "procure", "vendors"],
    priority: 40,
  },
  {
    id: "production",
    label: "Production Management",
    module: "Production",
    path: "/plastic-erp/production",
    icon: "🏭",
    keywords: ["production", "production management", "manufacturing", "shopfloor", "batches", "plant"],
    priority: 40,
  },
  {
    id: "sales",
    label: "Sales Orders",
    module: "Sales & Dispatch",
    path: "/plastic-erp/sales-orders",
    icon: "📋",
    keywords: ["sales", "sales orders", "sales & dispatch", "so", "orders", "customer orders"],
    priority: 40,
  },
  {
    id: "dispatch",
    label: "Dispatch",
    module: "Sales & Dispatch",
    path: "/plastic-erp/dispatch",
    icon: "🚚",
    keywords: ["dispatch", "dispatches", "shipping", "deliveries", "dispatch management"],
    priority: 40,
  },
  {
    id: "customers",
    label: "Customers",
    module: "Sales & Dispatch",
    path: "/customers",
    icon: "👥",
    keywords: ["customers", "customer", "clients", "client", "buyer", "parties", "party list"],
    priority: 40,
  },
  {
    id: "invoices",
    label: "Invoice History",
    module: "Sales & Dispatch",
    path: "/invoices/history",
    icon: "📋",
    keywords: ["invoices", "invoice", "invoice history", "bills", "billing", "tax invoices", "invoicing"],
    priority: 40,
  },
  {
    id: "create-invoice",
    label: "Create Invoice",
    module: "Sales & Dispatch",
    path: "/invoices/create",
    icon: "🧾",
    keywords: ["create invoice", "new invoice", "generate invoice", "make bill"],
    priority: 25,
  },
  {
    id: "accounting",
    label: "Accounting Dashboard",
    module: "Accounting & GST",
    path: "/plastic-erp/accounting-dashboard",
    icon: "📈",
    keywords: ["accounting", "accounting dashboard", "finance", "books", "accounts", "financials"],
    priority: 40,
  },
  {
    id: "gst",
    label: "GST Management",
    module: "Accounting & GST",
    path: "/plastic-erp/gst-management",
    icon: "⚖️",
    keywords: ["gst", "gst management", "taxes", "tax", "gstr", "gstr-1", "gstr-3b", "gstr1", "gstr3b"],
    priority: 40,
  },
  {
    id: "eway-bills",
    label: "Internal E-Way Bills",
    module: "Sales & Dispatch",
    path: "/plastic-erp/eway-bills",
    icon: "🚚",
    keywords: ["eway", "e-way", "eway bill", "e-way bill", "internal eway bill", "transport document", "waybill", "challan eway", "road permit", "ewb"],
    priority: 42,
  },
  {
    id: "gst-reconciliation",
    label: "GST Reconciliation",
    module: "Accounting & GST",
    path: "/plastic-erp/gst-reconciliation",
    icon: "🔍",
    keywords: ["gst reconciliation", "gstr2b", "2b reconciliation", "tax reconciliation", "reconciliation"],
    priority: 30,
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    module: "Reports & Analytics",
    path: "/plastic-erp/reports",
    icon: "📊",
    keywords: ["reports", "reports & analytics", "analytics", "production reports", "mis reports"],
    priority: 40,
  },
  {
    id: "settings",
    label: "Business Settings",
    module: "Administration",
    path: "/settings",
    icon: "⚙️",
    keywords: ["settings", "business settings", "configuration", "company settings", "admin settings", "setup"],
    priority: 40,
  },

  // 2. Dashboard / Overview
  {
    id: "dashboard",
    label: "Executive Dashboard",
    module: "Overview",
    path: "/dashboard",
    icon: "🏠",
    keywords: ["dashboard", "executive dashboard", "overview", "home", "main"],
    priority: 30,
  },

  // 3. Procurement Sub-Modules
  {
    id: "suppliers",
    label: "Scrap Suppliers Master",
    module: "Procurement",
    path: "/plastic-erp/suppliers",
    icon: "🏢",
    keywords: ["suppliers", "supplier", "vendors", "vendor master", "scrap suppliers"],
    priority: 25,
  },
  {
    id: "raw-materials",
    label: "Raw Materials",
    module: "Procurement",
    path: "/plastic-erp/raw-materials",
    icon: "♻️",
    keywords: ["raw materials", "materials", "raw material", "feedstock", "recycled plastic"],
    priority: 25,
  },
  {
    id: "purchase-requisitions",
    label: "Purchase Requisitions",
    module: "Procurement",
    path: "/plastic-erp/purchase-requisitions",
    icon: "📋",
    keywords: ["purchase requisitions", "requisitions", "indent", "material requests"],
    priority: 25,
  },
  {
    id: "supplier-quotations",
    label: "Supplier Quotations",
    module: "Procurement",
    path: "/plastic-erp/supplier-quotations",
    icon: "🏷️",
    keywords: ["supplier quotations", "quotations", "quotes", "bids"],
    priority: 25,
  },
  {
    id: "purchase-comparison",
    label: "Purchase Comparison",
    module: "Procurement",
    path: "/plastic-erp/purchase-comparison",
    icon: "⚖️",
    keywords: ["purchase comparison", "quotation comparison", "rate comparison"],
    priority: 25,
  },
  {
    id: "purchase-orders",
    label: "Purchase Orders",
    module: "Procurement",
    path: "/plastic-erp/purchase-orders",
    icon: "📦",
    keywords: ["purchase orders", "po", "procurement orders"],
    priority: 30,
  },
  {
    id: "purchase-deliveries",
    label: "Purchase Deliveries",
    module: "Procurement",
    path: "/plastic-erp/purchase-deliveries",
    icon: "🚚",
    keywords: ["purchase deliveries", "inward deliveries", "vendor deliveries"],
    priority: 25,
  },
  {
    id: "supplier-performance",
    label: "Supplier Performance",
    module: "Procurement",
    path: "/plastic-erp/supplier-performance",
    icon: "⭐",
    keywords: ["supplier performance", "vendor rating", "supplier score"],
    priority: 25,
  },
  {
    id: "procurement-reports",
    label: "Procurement Reports",
    module: "Reports & Analytics",
    path: "/plastic-erp/procurement-reports",
    icon: "📦",
    keywords: ["procurement reports", "purchase reports", "vendor reports"],
    priority: 25,
  },
  {
    id: "truck-inward",
    label: "Truck Inward",
    module: "Procurement",
    path: "/plastic-erp/truck-inward",
    icon: "🚚",
    keywords: ["truck inward", "inward", "gate entry", "lorry inward"],
    priority: 25,
  },
  {
    id: "weighment",
    label: "Gross/Tare Weighment",
    module: "Procurement",
    path: "/plastic-erp/weighment",
    icon: "⚖️",
    keywords: ["weighment", "weight", "weighbridge", "scale", "gross weight", "tare weight"],
    priority: 25,
  },
  {
    id: "purchase-bills",
    label: "Purchase Bills",
    module: "Procurement",
    path: "/plastic-erp/purchase-bills",
    icon: "🧾",
    keywords: ["purchase bills", "vendor bills", "purchase invoices"],
    priority: 25,
  },
  {
    id: "stock",
    label: "Stock & Inventory",
    module: "Procurement",
    path: "/plastic-erp/stock",
    icon: "📦",
    keywords: ["stock", "inventory", "godown", "warehouse stock"],
    priority: 25,
  },

  // 4. Production Sub-Modules
  {
    id: "recipes",
    label: "Recipes / BOM",
    module: "Production",
    path: "/plastic-erp/recipes",
    icon: "🧪",
    keywords: ["recipes", "bom", "bill of materials", "formulas", "formulation"],
    priority: 25,
  },
  {
    id: "quality",
    label: "Quality Control",
    module: "Production",
    path: "/plastic-erp/quality",
    icon: "🔬",
    keywords: ["quality", "quality control", "qc", "inspection", "testing"],
    priority: 25,
  },
  {
    id: "scrap-regrind",
    label: "Scrap & Regrind",
    module: "Production",
    path: "/plastic-erp/scrap-regrind",
    icon: "♻️",
    keywords: ["scrap", "regrind", "scrap & regrind", "process scrap", "recycling"],
    priority: 25,
  },
  {
    id: "machines",
    label: "Machines",
    module: "Production",
    path: "/plastic-erp/machines",
    icon: "⚙️",
    keywords: ["machines", "equipment", "extruders", "machinery"],
    priority: 25,
  },
  {
    id: "operations",
    label: "Operations",
    module: "Production",
    path: "/plastic-erp/operations",
    icon: "👥",
    keywords: ["operations", "shifts", "operators", "plant shifts"],
    priority: 25,
  },
  {
    id: "traceability",
    label: "Batch Traceability",
    module: "Production",
    path: "/plastic-erp/traceability",
    icon: "🔍",
    keywords: ["traceability", "batch traceability", "trace", "batch history"],
    priority: 25,
  },
  {
    id: "costing",
    label: "Production Costing",
    module: "Production",
    path: "/plastic-erp/costing",
    icon: "💰",
    keywords: ["costing", "production costing", "unit cost", "batch costing"],
    priority: 25,
  },

  // 5. Sales & Dispatch Sub-Modules
  {
    id: "delivery-challans",
    label: "Delivery Challans",
    module: "Sales & Dispatch",
    path: "/plastic-erp/delivery-challans",
    icon: "📄",
    keywords: ["delivery challans", "challan", "challans", "dc"],
    priority: 25,
  },
  {
    id: "transport",
    label: "Transport & Logistics",
    module: "Sales & Dispatch",
    path: "/plastic-erp/transport",
    icon: "🚛",
    keywords: ["transport", "logistics", "vehicles", "fleet", "trucks", "transporter"],
    priority: 25,
  },
  {
    id: "internal-eway-bills",
    label: "Internal E-Way Bills",
    module: "Sales & Dispatch",
    path: "/plastic-erp/eway-bills",
    icon: "🚚",
    keywords: ["internal eway bills", "eway bills", "transport bill", "dispatch eway bill", "consignment note"],
    priority: 25,
  },
  {
    id: "receivables",
    label: "Receivables",
    module: "Sales & Dispatch",
    path: "/plastic-erp/receivables",
    icon: "⏳",
    keywords: ["receivables", "dues", "outstanding", "aging", "debtors"],
    priority: 25,
  },
  {
    id: "customer-ledger",
    label: "Customer Ledger",
    module: "Sales & Dispatch",
    path: "/plastic-erp/customer-ledger",
    icon: "📑",
    keywords: ["customer ledger", "party statement", "customer account statement"],
    priority: 25,
  },
  {
    id: "sales-returns",
    label: "Sales Returns",
    module: "Sales & Dispatch",
    path: "/plastic-erp/sales-returns",
    icon: "🔄",
    keywords: ["sales returns", "returns", "rejected goods", "credit memo"],
    priority: 25,
  },
  {
    id: "credit-notes",
    label: "Credit Notes",
    module: "Sales & Dispatch",
    path: "/plastic-erp/credit-notes",
    icon: "📉",
    keywords: ["credit notes", "credit note", "cn"],
    priority: 25,
  },
  {
    id: "debit-notes",
    label: "Debit Notes",
    module: "Sales & Dispatch",
    path: "/plastic-erp/debit-notes",
    icon: "📈",
    keywords: ["debit notes", "debit note", "dn"],
    priority: 25,
  },

  // 6. HR & Workforce Sub-Modules
  {
    id: "employees",
    label: "Employees",
    module: "HR & Workforce",
    path: "/plastic-erp/employees",
    icon: "👥",
    keywords: ["employees", "employee", "staff", "workers", "personnel", "hr"],
    priority: 25,
  },
  {
    id: "attendance",
    label: "Attendance",
    module: "HR & Workforce",
    path: "/plastic-erp/attendance",
    icon: "⏱️",
    keywords: ["attendance", "biometric", "clock in", "present", "absent"],
    priority: 25,
  },
  {
    id: "leaves",
    label: "Leave Management",
    module: "HR & Workforce",
    path: "/plastic-erp/leaves",
    icon: "🏖️",
    keywords: ["leaves", "leave", "leave management", "vacation", "holiday"],
    priority: 25,
  },
  {
    id: "workforce",
    label: "Workforce",
    module: "HR & Workforce",
    path: "/plastic-erp/workforce",
    icon: "🏭",
    keywords: ["workforce", "manpower", "labor", "labour", "plant workers"],
    priority: 25,
  },
  {
    id: "payroll",
    label: "Payroll",
    module: "HR & Workforce",
    path: "/plastic-erp/payroll",
    icon: "💵",
    keywords: ["payroll", "salary", "salaries", "wages", "payslips"],
    priority: 25,
  },
  {
    id: "advances",
    label: "Employee Advances",
    module: "HR & Workforce",
    path: "/plastic-erp/advances",
    icon: "🤝",
    keywords: ["advances", "employee advances", "loans", "advance salary"],
    priority: 25,
  },
  {
    id: "expenses",
    label: "Expenses",
    module: "HR & Workforce",
    path: "/plastic-erp/expenses",
    icon: "💸",
    keywords: ["expenses", "expense", "petty cash", "expenditure", "spend"],
    priority: 25,
  },
  {
    id: "hr-reports",
    label: "HR & Expense Reports",
    module: "Reports & Analytics",
    path: "/plastic-erp/hr-reports",
    icon: "👥",
    keywords: ["hr reports", "expense reports", "payroll reports", "attendance reports"],
    priority: 25,
  },

  // 7. Accounting & GST Sub-Modules
  {
    id: "chart-of-accounts",
    label: "Chart of Accounts",
    module: "Accounting & GST",
    path: "/plastic-erp/chart-of-accounts",
    icon: "📑",
    keywords: ["chart of accounts", "coa", "general ledger", "accounts list"],
    priority: 25,
  },
  {
    id: "journal-entries",
    label: "Journal Entries",
    module: "Accounting & GST",
    path: "/plastic-erp/journal-entries",
    icon: "✍️",
    keywords: ["journal entries", "journals", "vouchers", "journal voucher"],
    priority: 25,
  },
  {
    id: "cash-bank",
    label: "Cash & Bank",
    module: "Accounting & GST",
    path: "/plastic-erp/cash-bank",
    icon: "💵",
    keywords: ["cash & bank", "cash", "bank", "bank balance", "cash account"],
    priority: 25,
  },
  {
    id: "bank-reconciliation",
    label: "Bank Reconciliation",
    module: "Accounting & GST",
    path: "/plastic-erp/bank-reconciliation",
    icon: "🏛️",
    keywords: ["bank reconciliation", "brs", "bank statement reconciliation"],
    priority: 25,
  },
  {
    id: "supplier-ledger",
    label: "Supplier Ledger",
    module: "Accounting & GST",
    path: "/plastic-erp/supplier-ledger",
    icon: "🚛",
    keywords: ["supplier ledger", "vendor ledger", "supplier statement"],
    priority: 25,
  },
  {
    id: "financial-reports",
    label: "Financial Reports",
    module: "Reports & Analytics",
    path: "/plastic-erp/financial-reports",
    icon: "📈",
    keywords: ["financial reports", "p&l", "profit and loss", "balance sheet", "trial balance"],
    priority: 30,
  },

  // 8. Reports & Analytics Sub-Modules
  {
    id: "sales-reports",
    label: "Sales Reports",
    module: "Reports & Analytics",
    path: "/plastic-erp/sales-reports",
    icon: "📊",
    keywords: ["sales reports", "sales analysis", "revenue report"],
    priority: 25,
  },
  {
    id: "dispatch-reports",
    label: "Dispatch Reports",
    module: "Reports & Analytics",
    path: "/plastic-erp/dispatch-reports",
    icon: "🚚",
    keywords: ["dispatch reports", "delivery reports"],
    priority: 25,
  },
  {
    id: "payment-reports",
    label: "Payment Reports",
    module: "Reports & Analytics",
    path: "/plastic-erp/payment-reports",
    icon: "💵",
    keywords: ["payment reports", "collection reports", "receipts report"],
    priority: 30,
  },
  {
    id: "customer-ledger-reports",
    label: "Customer Ledger Reports",
    module: "Reports & Analytics",
    path: "/plastic-erp/customer-ledger-reports",
    icon: "📑",
    keywords: ["customer ledger reports", "ledger report"],
    priority: 25,
  },
  {
    id: "executive-analytics",
    label: "Executive Analytics",
    module: "Reports & Analytics",
    path: "/plastic-erp/executive-analytics",
    icon: "⚡",
    keywords: ["executive analytics", "bi analytics", "kpi metrics"],
    priority: 25,
  },
];

/**
 * Searches destinations with prioritized, deterministic scoring.
 * 
 * Score hierarchy:
 * 1. Exact match on primary keyword or title: 1000 pts
 * 2. Word in keyword/title exactly equals query: 600 pts
 * 3. Keyword or title starts with query: 400 pts
 * 4. Word in keyword/title starts with query: 250 pts
 * 5. Keyword or title contains query (length >= 3): 100 pts
 * 6. Module matches query: 50 pts
 * + Priority bonus for tie-breaking
 *
 * @param {string} rawQuery
 * @param {number} maxResults
 * @returns {Array<typeof SEARCH_DESTINATIONS[0]>}
 */
export function searchDestinations(rawQuery, maxResults = 8) {
  if (!rawQuery || typeof rawQuery !== "string") return [];
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const scored = [];

  for (const item of SEARCH_DESTINATIONS) {
    let score = 0;
    const labelLower = item.label.toLowerCase();
    const moduleLower = item.module.toLowerCase();
    const keywords = item.keywords || [];

    // 1. Exact match on keyword or title
    if (keywords.includes(query) || labelLower === query) {
      score += 1000;
    }
    // 2. Exact word match in title or keyword
    else if (
      keywords.some((kw) => kw.split(/\s+/).includes(query)) ||
      labelLower.split(/\s+/).includes(query)
    ) {
      score += 600;
    }
    // 3. Keyword or title starts with query
    else if (
      keywords.some((kw) => kw.startsWith(query)) ||
      labelLower.startsWith(query)
    ) {
      score += 400;
    }
    // 4. Word in keyword or title starts with query
    else if (
      keywords.some((kw) => kw.split(/\s+/).some((w) => w.startsWith(query))) ||
      labelLower.split(/\s+/).some((w) => w.startsWith(query))
    ) {
      score += 250;
    }
    // 5. Contains query (only if query length >= 3 to avoid noise)
    else if (
      query.length >= 3 &&
      (keywords.some((kw) => kw.includes(query)) || labelLower.includes(query))
    ) {
      score += 100;
    }
    // 6. Module match
    else if (moduleLower === query || moduleLower.split(/\s+/).includes(query)) {
      score += 50;
    } else if (query.length >= 3 && moduleLower.includes(query)) {
      score += 20;
    }

    if (score > 0) {
      // Add tie-breaking priority bonus
      if (item.priority) {
        score += item.priority;
      }
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map((s) => s.item);
}
