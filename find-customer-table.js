require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
  
  console.log('Tabelas com "client":');
  const [tables1] = await pool.execute("SHOW TABLES LIKE '%client%'");
  tables1.forEach(t => console.log('  -', Object.values(t)[0]));
  
  console.log('\nTabelas com "customer":');
  const [tables2] = await pool.execute("SHOW TABLES LIKE '%customer%'");
  tables2.forEach(t => console.log('  -', Object.values(t)[0]));
  
  console.log('\nTabelas com "pedido":');
  const [tables3] = await pool.execute("SHOW TABLES LIKE '%pedido%'");
  tables3.forEach(t => console.log('  -', Object.values(t)[0]));
  
  // Verificar customer_id em pedidos
  console.log('\n\nEstrutura de pedidos_ecommerce_tray:');
  const [cols] = await pool.execute("DESCRIBE pedidos_ecommerce_tray");
  cols.forEach(col => console.log(`  ${col.Field} (${col.Type})`));
  
  await pool.end();
})();
