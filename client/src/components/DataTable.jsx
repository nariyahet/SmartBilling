import "./DataTable.css";

/**
 * Standardized SmartBilling 2.0 ERP DataTable
 */
function DataTable({
  columns = [],
  data = [],
  children = null,
  loading = false,
  emptyMessage = "No records found.",
  density = "normal",
  className = "",
}) {
  return (
    <div className={`sb-table-container ${className}`}>
      <div className="sb-table-wrapper">
        <table className={`sb-data-table density-${density}`}>
          {children ? (
            children
          ) : (
            <>
              <thead>
                <tr>
                  {columns.map((col, idx) => (
                    <th
                      key={col.key || idx}
                      style={col.width ? { width: col.width } : undefined}
                      className={col.headerClassName || ""}
                    >
                      {col.title || col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <div className="sb-table-loading-box">
                        <div className="sb-table-loading-spinner" aria-hidden="true" />
                        <span>Loading table data...</span>
                      </div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <div className="sb-table-empty-box">
                        <span>📦</span>
                        <span>{emptyMessage}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map((row, rowIdx) => (
                    <tr key={row.id || rowIdx}>
                      {columns.map((col, colIdx) => (
                        <td key={col.key || colIdx} className={col.className || ""}>
                          {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}

export default DataTable;
