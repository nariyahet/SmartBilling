const db = require("../config/db");

exports.getAllBatchCosts = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const sql = `
      SELECT
        c.*,
        b.batch_no,
        b.product_name,
        b.batch_date,
        b.status AS batch_status
      FROM plastic_production_costs c
      JOIN plastic_production_batches b ON c.batch_id = b.id AND c.company_id = b.company_id
      WHERE c.company_id = ?
      ORDER BY c.calculated_at DESC
    `;

    const [costs] = await db.promise().query(sql, [companyId]);

    let totalProductionExpense = 0;
    let totalOutputKg = 0;

    for (const item of costs) {
      totalProductionExpense += Number(item.total_cost) || 0;
      totalOutputKg += Number(item.output_quantity) || 0;
    }

    const avgCostPerKg = totalOutputKg > 0 ? (totalProductionExpense / totalOutputKg).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      costs,
      summary: {
        totalBatchesCosted: costs.length,
        totalProductionExpense,
        totalOutputKg,
        avgCostPerKg: Number(avgCostPerKg),
      },
    });
  } catch (error) {
    console.error("Get All Batch Costs Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch production costs",
    });
  }
};

exports.calculateBatchCost = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { batch_id } = req.params;
    const {
      labour_rate_per_hour = 150,
      machine_rate_per_hour = 350,
      overhead_percent = 10,
      standard_cost_per_kg = 45,
    } = req.body;

    // 1. Fetch batch info
    const [batches] = await db.promise().query(
      `SELECT * FROM plastic_production_batches WHERE id = ? AND company_id = ?`,
      [batch_id, companyId]
    );

    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const batch = batches[0];
    const outputQty = Number(batch.actual_quantity) || Number(batch.planned_quantity) || 1;

    // 2. Sum raw material consumption cost
    const [consumptionCosts] = await db.promise().query(
      `SELECT COALESCE(SUM(total_cost), 0) AS raw_material_cost
       FROM plastic_material_consumptions
       WHERE batch_id = ? AND company_id = ?`,
      [batch_id, companyId]
    );
    const rawMaterialCost = Number(consumptionCosts[0]?.raw_material_cost) || 0;

    // 3. Regrind cost
    const [regrindCosts] = await db.promise().query(
      `SELECT COALESCE(SUM(quantity * 25), 0) AS regrind_cost
       FROM plastic_regrind_transactions
       WHERE target_batch_id = ? AND transaction_type = 'CONSUMPTION' AND company_id = ?`,
      [batch_id, companyId]
    );
    const regrindCost = Number(regrindCosts[0]?.regrind_cost) || 0;

    // 4. Runtime calculation (in hours)
    let runtimeHours = 2.0; // Default estimate
    if (batch.start_time && batch.end_time) {
      const diffMs = new Date(batch.end_time).getTime() - new Date(batch.start_time).getTime();
      runtimeHours = Math.max(0.5, diffMs / (1000 * 60 * 60));
    }

    const labourCost = runtimeHours * Number(labour_rate_per_hour);
    const machineCost = runtimeHours * Number(machine_rate_per_hour);
    const maintenanceCost = (machineCost * 0.05); // 5% maintenance factor
    const overheadCost = ((labourCost + machineCost) * (Number(overhead_percent) / 100));
    const scrapReworkCost = (Number(batch.scrap_quantity) || 0) * 5.0; // ₹5 per kg reprocessing

    const totalCost =
      rawMaterialCost +
      regrindCost +
      labourCost +
      machineCost +
      maintenanceCost +
      overheadCost +
      scrapReworkCost;

    const costPerKg = outputQty > 0 ? (totalCost / outputQty).toFixed(2) : 0;
    const costPerTon = (costPerKg * 1000).toFixed(2);
    const standardCost = outputQty * Number(standard_cost_per_kg);
    const varianceCost = (totalCost - standardCost).toFixed(2);

    // 5. Upsert into plastic_production_costs
    await db.promise().query(
      `INSERT INTO plastic_production_costs
        (company_id, batch_id, raw_material_cost, regrind_cost, labour_cost, machine_cost, maintenance_cost, overhead_cost, scrap_rework_cost, total_cost, output_quantity, cost_per_kg, cost_per_ton, standard_cost, variance_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         raw_material_cost = VALUES(raw_material_cost),
         regrind_cost = VALUES(regrind_cost),
         labour_cost = VALUES(labour_cost),
         machine_cost = VALUES(machine_cost),
         maintenance_cost = VALUES(maintenance_cost),
         overhead_cost = VALUES(overhead_cost),
         scrap_rework_cost = VALUES(scrap_rework_cost),
         total_cost = VALUES(total_cost),
         output_quantity = VALUES(output_quantity),
         cost_per_kg = VALUES(cost_per_kg),
         cost_per_ton = VALUES(cost_per_ton),
         standard_cost = VALUES(standard_cost),
         variance_cost = VALUES(variance_cost),
         calculated_at = CURRENT_TIMESTAMP`,
      [
        companyId,
        batch_id,
        rawMaterialCost,
        regrindCost,
        labourCost,
        machineCost,
        maintenanceCost,
        overheadCost,
        scrapReworkCost,
        totalCost,
        outputQty,
        costPerKg,
        costPerTon,
        standardCost,
        varianceCost,
      ]
    );

    res.status(200).json({
      success: true,
      message: "Batch cost calculated successfully",
      costing: {
        batch_id,
        batch_no: batch.batch_no,
        raw_material_cost: rawMaterialCost,
        regrind_cost: regrindCost,
        labour_cost: labourCost,
        machine_cost: machineCost,
        maintenance_cost: maintenanceCost,
        overhead_cost: overheadCost,
        scrap_rework_cost: scrapReworkCost,
        total_cost: totalCost,
        output_quantity: outputQty,
        cost_per_kg: Number(costPerKg),
        cost_per_ton: Number(costPerTon),
        standard_cost: standardCost,
        variance_cost: Number(varianceCost),
      },
    });
  } catch (error) {
    console.error("Calculate Batch Cost Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate batch cost",
    });
  }
};
