require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
require("dotenv").config();

const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ MySQL Connection Pool Failed");
    console.error(err.message);
    return;
  }

  console.log("✅ MySQL Pool Connected Successfully");
  connection.query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))", (modeErr) => {
    if (modeErr) console.warn("Could not set session sql_mode:", modeErr.message);
    connection.release();
  });
});

module.exports = pool;