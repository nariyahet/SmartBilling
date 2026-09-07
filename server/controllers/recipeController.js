const db = require("../config/db");

exports.getRecipes = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, search } = req.query;

    let sql = `
      SELECT
        r.*,
        COUNT(ri.id) AS total_components,
        COALESCE(SUM(CASE WHEN ri.is_recycled = 1 THEN ri.percentage ELSE 0 END), 0) AS total_recycled_percent,
        COALESCE(SUM(CASE WHEN ri.is_regrind = 1 THEN ri.percentage ELSE 0 END), 0) AS total_regrind_percent
      FROM plastic_recipes r
      LEFT JOIN plastic_recipe_items ri ON r.id = ri.recipe_id AND r.company_id = ri.company_id
      WHERE r.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND r.status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (r.recipe_name LIKE ? OR r.recipe_code LIKE ? OR r.target_product_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` GROUP BY r.id ORDER BY r.recipe_name ASC`;

    const [recipes] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      recipes,
    });
  } catch (error) {
    console.error("Get Recipes Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recipes",
    });
  }
};

exports.getRecipeById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [recipeRows] = await db.promise().query(
      `SELECT * FROM plastic_recipes WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (recipeRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Recipe not found",
      });
    }

    const [items] = await db.promise().query(
      `SELECT
        ri.*,
        rm.material_code,
        rm.plastic_type,
        rm.unit AS material_unit
       FROM plastic_recipe_items ri
       LEFT JOIN raw_materials rm ON ri.raw_material_id = rm.id AND ri.company_id = rm.company_id
       WHERE ri.recipe_id = ? AND ri.company_id = ?
       ORDER BY ri.percentage DESC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      recipe: {
        ...recipeRows[0],
        items,
      },
    });
  } catch (error) {
    console.error("Get Recipe Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recipe details",
    });
  }
};

exports.createRecipe = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const {
      recipe_code,
      recipe_name,
      target_product_name,
      product_id,
      version = "v1.0",
      effective_date,
      status = "ACTIVE",
      description,
      items = [],
    } = req.body;

    if (!recipe_name || !target_product_name) {
      return res.status(400).json({
        success: false,
        message: "Recipe name and target product name are required",
      });
    }

    let code = recipe_code;
    if (!code) {
      const [countRows] = await conn.query(
        `SELECT COUNT(id) AS count FROM plastic_recipes WHERE company_id = ?`,
        [companyId]
      );
      code = `RCP-${1000 + (countRows[0]?.count || 0) + 1}`;
    }

    await conn.beginTransaction();

    const [recipeResult] = await conn.query(
      `INSERT INTO plastic_recipes
        (company_id, recipe_code, recipe_name, target_product_name, product_id, version, effective_date, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        code.trim().toUpperCase(),
        recipe_name.trim(),
        target_product_name.trim(),
        product_id || null,
        version || "v1.0",
        effective_date || null,
        status || "ACTIVE",
        description || null,
      ]
    );

    const recipeId = recipeResult.insertId;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.material_name) continue;
        await conn.query(
          `INSERT INTO plastic_recipe_items
            (company_id, recipe_id, raw_material_id, material_name, percentage, standard_consumption_per_unit, is_recycled, is_regrind, is_additive, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            recipeId,
            item.raw_material_id || null,
            item.material_name.trim(),
            Number(item.percentage) || 0,
            Number(item.standard_consumption_per_unit) || 0,
            item.is_recycled !== undefined ? (item.is_recycled ? 1 : 0) : 1,
            item.is_regrind ? 1 : 0,
            item.is_additive ? 1 : 0,
            item.notes || null,
          ]
        );
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Recipe created successfully",
      recipeId,
      recipeCode: code,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Create Recipe Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A recipe with this code and version already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create recipe",
    });
  }
};

exports.updateRecipe = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      recipe_name,
      target_product_name,
      product_id,
      version,
      effective_date,
      status,
      description,
      items,
    } = req.body;

    const [existing] = await conn.query(
      `SELECT id FROM plastic_recipes WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Recipe not found",
      });
    }

    await conn.beginTransaction();

    await conn.query(
      `UPDATE plastic_recipes
       SET recipe_name = COALESCE(?, recipe_name),
           target_product_name = COALESCE(?, target_product_name),
           product_id = COALESCE(?, product_id),
           version = COALESCE(?, version),
           effective_date = COALESCE(?, effective_date),
           status = COALESCE(?, status),
           description = COALESCE(?, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [
        recipe_name,
        target_product_name,
        product_id,
        version,
        effective_date,
        status,
        description,
        id,
        companyId,
      ]
    );

    if (Array.isArray(items)) {
      await conn.query(
        `DELETE FROM plastic_recipe_items WHERE recipe_id = ? AND company_id = ?`,
        [id, companyId]
      );

      for (const item of items) {
        if (!item.material_name) continue;
        await conn.query(
          `INSERT INTO plastic_recipe_items
            (company_id, recipe_id, raw_material_id, material_name, percentage, standard_consumption_per_unit, is_recycled, is_regrind, is_additive, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            id,
            item.raw_material_id || null,
            item.material_name.trim(),
            Number(item.percentage) || 0,
            Number(item.standard_consumption_per_unit) || 0,
            item.is_recycled !== undefined ? (item.is_recycled ? 1 : 0) : 1,
            item.is_regrind ? 1 : 0,
            item.is_additive ? 1 : 0,
            item.notes || null,
          ]
        );
      }
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: "Recipe updated successfully",
    });
  } catch (error) {
    await conn.rollback();
    console.error("Update Recipe Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update recipe",
    });
  }
};
