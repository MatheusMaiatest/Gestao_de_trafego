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
  
  console.log('\n🔍 Verificando formato dos dados de localização\n');
  console.log('='.repeat(80));
  
  // Verificar clientes Tray da Bahia
  console.log('\n1️⃣ Clientes Tray da Bahia (buscando por "BA"):');
  const [trayClients] = await pool.execute(`
    SELECT 
      state,
      city,
      COUNT(*) as total
    FROM clientes_tray_ecommerce
    WHERE UPPER(state) = 'BA'
    GROUP BY state, city
    ORDER BY total DESC
    LIMIT 10
  `);
  console.table(trayClients);
  
  // Verificar valores únicos de estado
  console.log('\n2️⃣ Valores únicos de estado (top 30):');
  const [uniqueStates] = await pool.execute(`
    SELECT state, COUNT(*) as count
    FROM clientes_tray_ecommerce
    WHERE state IS NOT NULL AND state != ''
    GROUP BY state
    ORDER BY count DESC
    LIMIT 30
  `);
  console.table(uniqueStates);
  
  // Ver alguns exemplos de clientes da Bahia
  console.log('\n3️⃣ Exemplos de clientes (qualquer estado):');
  const [examples] = await pool.execute(`
    SELECT id, name, city, state
    FROM clientes_tray_ecommerce
    WHERE state IS NOT NULL AND state != ''
    LIMIT 5
  `);
  console.table(examples);
  
  console.log('\n' + '='.repeat(80));
  
  await pool.end();
})();
