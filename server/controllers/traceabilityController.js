const db = require("../config/db");

exports.traceBatch = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { identifier } = req.params;

    // Search by batch_no or ID
    const isNumeric = /^\d+$/.test(identifier);
    let condition = "b.batch_no = ?";
    let params = [identifier, companyId];

    if (isNumeric) {
      condition = "(b.id = ? OR b.batch_no = ?)";
      params = [identifier, identifier, companyId];
    }

    const [batches] = await db.promise().query(
      `SELECT
        b.*,
        po.production_order_no,
        po.priority AS order_priority,
        po.target_date AS order_target_date,
        m.machine_name,
        m.machine_code,
        s.shift_name,
        o.name AS operator_name,
        r.recipe_name,
        r.recipe_code
       FROM plastic_production_batches b
       LEFT JOIN plastic_production_orders po ON b.production_order_id = po.id AND b.company_id = po.company_id
       LEFT JOIN plastic_machines m ON b.machine_id = m.id AND b.company_id = m.company_id
       LEFT JOIN plastic_shifts s ON b.shift_id = s.id AND b.company_id = s.company_id
       LEFT JOIN plastic_operators o ON b.operator_id = o.id AND b.company_id = o.company_id
       LEFT JOIN plastic_recipes r ON b.recipe_id = r.id AND b.company_id = r.company_id
       WHERE ${condition} AND b.company_id = ?`,
      params
    );

    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found for traceability",
      });
    }

    const batch = batches[0];
    const batchId = batch.id;

    // 1. Consumed Materials & Suppliers (Backward Trace)
    const [consumptions] = await db.promise().query(
      `SELECT
        mc.*,
        rm.material_code,
        rm.plastic_type,
        rm.color,
        ti.inward_no,
        ti.truck_number,
        ti.gross_weight,
        ti.tare_weight,
        ti.net_weight AS truck_net_weight,
        sup.supplier_name,
        sup.supplier_code,
        sup.city AS supplier_city,
        w.weighment_no,
        w.first_weight,
        w.second_weight
       FROM plastic_material_consumptions mc
       JOIN raw_materials rm ON mc.raw_material_id = rm.id AND mc.company_id = rm.company_id
       LEFT JOIN truck_inwards ti ON mc.truck_inward_id = ti.id AND mc.company_id = ti.company_id
       LEFT JOIN suppliers sup ON ti.supplier_id = sup.id AND ti.company_id = sup.company_id
       LEFT JOIN weighments w ON ti.id = w.truck_inward_id AND ti.company_id = w.company_id
       WHERE mc.batch_id = ? AND mc.company_id = ?
       ORDER BY mc.consumed_at ASC`,
      [batchId, companyId]
    );

    // 2. Finished Goods Lots Produced (Forward Trace)
    const [fgLots] = await db.promise().query(
      `SELECT
        fgl.*,
        fg.fg_name,
        fg.fg_code,
        fg.plastic_type,
        fg.warehouse_location,
        fg.packing_type
       FROM plastic_finished_goods_lots fgl
       JOIN plastic_finished_goods fg ON fgl.finished_goods_id = fg.id AND fgl.company_id = fg.company_id
       WHERE fgl.batch_id = ? AND fgl.company_id = ?`,
      [batchId, companyId]
    );

    // 2b. Downstream Dispatches, Orders & Invoices for this batch's FG lots
    const lotIds = fgLots.map((l) => l.id);
    let downstreamSales = [];
    if (lotIds.length > 0) {
      const [salesRows] = await db.promise().query(
        `SELECT
          di.id AS dispatch_item_id,
          di.quantity AS dispatched_quantity,
          di.rate,
          di.lot_id,
          fgl.lot_number,
          d.id AS dispatch_id,
          d.dispatch_no,
          d.dispatch_date,
          d.status AS dispatch_status,
          c.id AS customer_id,
          c.name AS customer_name,
          c.mobile AS customer_mobile,
          so.id AS sales_order_id,
          so.sales_order_no,
          inv.id AS invoice_id,
          inv.invoice_no,
          inv.grand_total AS invoice_amount,
          inv.payment_status AS invoice_payment_status,
          dc.id AS challan_id,
          dc.challan_no
         FROM plastic_dispatch_items di
         JOIN plastic_dispatches d ON di.dispatch_id = d.id AND di.company_id = d.company_id
         JOIN customers c ON d.customer_id = c.id AND d.company_id = c.company_id
         LEFT JOIN plastic_finished_goods_lots fgl ON di.lot_id = fgl.id AND di.company_id = fgl.company_id
         LEFT JOIN plastic_sales_orders so ON d.sales_order_id = so.id AND d.company_id = so.company_id
         LEFT JOIN invoices inv ON d.id = inv.dispatch_id AND d.company_id = inv.company_id
         LEFT JOIN plastic_delivery_challans dc ON d.id = dc.dispatch_id AND d.company_id = dc.company_id
         WHERE di.company_id = ? AND di.lot_id IN (${lotIds.map(() => "?").join(",")})
         ORDER BY d.dispatch_date DESC`,
        [companyId, ...lotIds]
      );
      downstreamSales = salesRows;
    }

    // 3. Quality Inspections
    const [qcInspections] = await db.promise().query(
      `SELECT * FROM plastic_quality_inspections WHERE batch_id = ? AND company_id = ? ORDER BY inspection_date ASC`,
      [batchId, companyId]
    );

    // 4. Scrap & Regrind Records
    const [scrapRecords] = await db.promise().query(
      `SELECT * FROM plastic_scrap_records WHERE batch_id = ? AND company_id = ? ORDER BY recorded_at ASC`,
      [batchId, companyId]
    );

    const [regrindTransactions] = await db.promise().query(
      `SELECT * FROM plastic_regrind_transactions WHERE source_batch_id = ? AND company_id = ? ORDER BY transaction_date ASC`,
      [batchId, companyId]
    );

    // 5. Complete Event Timeline
    const [timeline] = await db.promise().query(
      `SELECT * FROM plastic_batch_traceability WHERE batch_id = ? AND company_id = ? ORDER BY created_at ASC`,
      [batchId, companyId]
    );

    res.status(200).json({
      success: true,
      traceability: {
        batch,
        backward: {
          consumptions,
          suppliersCount: new Set(consumptions.map((c) => c.supplier_name).filter(Boolean)).size,
          truckInwardsCount: new Set(consumptions.map((c) => c.inward_no).filter(Boolean)).size,
        },
        forward: {
          finishedGoodsLots: fgLots,
          scrapRecords,
          regrindTransactions,
          downstreamSales,
        },
        quality: qcInspections,
        timeline,
      },
    });
  } catch (error) {
    console.error("Trace Batch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform batch traceability",
    });
  }
};
