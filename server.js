require('dotenv').config();
const express     = require('express');
const mysql       = require('mysql2/promise');
const path        = require('path');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const winston     = require('winston');

// ── Logger ────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// ── Validação de variáveis de ambiente ────────────────────────
const REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  logger.error('Variáveis de ambiente obrigatórias não definidas: ' + missing.join(', '));
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Pool de conexões MySQL ────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASS,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  connectTimeout:     30000,
  acquireTimeout:     30000,
  queueLimit:         20
});

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Frontend estático ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ── DIAGNÓSTICO: listar tabelas do banco ──────────────────────
app.get('/api/debug/tables', async (_req, res) => {
  try {
    const conn = await pool.getConnection();
    const [tables] = await conn.execute('SHOW TABLES');
    conn.release();
    res.json({ tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DIAGNÓSTICO: ver colunas de uma tabela ────────────────────
app.get('/api/debug/columns/:table', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [cols] = await conn.execute(`DESCRIBE \`${req.params.table}\``);
    conn.release();
    res.json({ table: req.params.table, columns: cols });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────
function buildUnitFilter(businessUnit) {
  if (!businessUnit || businessUnit === 'all') return ['ecommerce', 'distributor'];
  return [businessUnit];
}

// ── DASHBOARD ─────────────────────────────────────────────────
app.get('/api/dashboard/kpis', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const units = buildUnitFilter(businessUnit);
  const ph    = units.map(() => '?').join(',');

  try {
    const conn = await pool.getConnection();

    const [[revenue]] = await conn.execute(
      `SELECT COALESCE(SUM(valor_total),0) AS totalRevenue,
              COUNT(*) AS totalOrders,
              COALESCE(AVG(valor_total),0) AS averageTicket
       FROM pedidos WHERE data_pedido BETWEEN ? AND ? AND unidade_negocio IN (${ph})`,
      [startDate, endDate, ...units]
    );

    const [[active]] = await conn.execute(
      `SELECT COUNT(DISTINCT cliente_id) AS total
       FROM pedidos WHERE data_pedido BETWEEN ? AND ? AND unidade_negocio IN (${ph})`,
      [startDate, endDate, ...units]
    );

    const [[inactive]] = await conn.execute(
      `SELECT COUNT(DISTINCT c.id) AS total FROM clientes c
       LEFT JOIN pedidos p ON c.id = p.cliente_id AND p.data_pedido >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
       WHERE p.id IS NULL AND c.unidade_negocio IN (${ph})`,
      [...units]
    );

    const [[newClients]] = await conn.execute(
      `SELECT COUNT(DISTINCT cliente_id) AS total FROM pedidos
       WHERE data_pedido BETWEEN ? AND ? AND unidade_negocio IN (${ph})
         AND cliente_id NOT IN (
           SELECT DISTINCT cliente_id FROM pedidos WHERE data_pedido < ?
         )`,
      [startDate, endDate, ...units, startDate]
    );

    conn.release();

    const totalOrders  = revenue.totalOrders || 0;
    const activeTotal  = active.total || 0;

    res.json({
      period: { startDate, endDate },
      businessUnit,
      totalClients:            activeTotal,
      activeClients:           activeTotal,
      inactiveClients:         inactive.total || 0,
      newClients:              newClients.total || 0,
      totalRevenue:            parseFloat(revenue.totalRevenue) || 0,
      averageTicket:           parseFloat(revenue.averageTicket) || 0,
      totalOrders,
      averagePurchaseFrequency: activeTotal > 0 ? parseFloat((totalOrders / activeTotal).toFixed(2)) : 0
    });
  } catch (err) {
    logger.error('Erro /api/dashboard/kpis', { error: err.message });
    res.status(500).json({ error: 'Erro ao calcular KPIs.', details: err.message });
  }
});

// ── CLIENTES ──────────────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all', page = 1, limit = 50, search } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const units  = buildUnitFilter(businessUnit);
  const ph     = units.map(() => '?').join(',');
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const conn = await pool.getConnection();

    let whereSearch = '';
    const searchParams = [];
    if (search) {
      whereSearch = ' AND (c.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ? OR c.cpf LIKE ?)';
      const s = `%${search}%`;
      searchParams.push(s, s, s, s);
    }

    const [clients] = await conn.execute(
      `SELECT c.id, c.nome AS name, c.cpf, c.email,
              c.telefone AS phone, c.whatsapp,
              c.cidade AS city, c.estado AS state,
              c.unidade_negocio AS businessUnit,
              MIN(p.data_pedido) AS firstPurchaseDate,
              MAX(p.data_pedido) AS lastPurchaseDate,
              COUNT(DISTINCT p.id) AS totalOrders,
              COALESCE(SUM(p.valor_total),0) AS totalSpent,
              COALESCE(AVG(p.valor_total),0) AS averageTicket
       FROM clientes c
       INNER JOIN pedidos p ON c.id = p.cliente_id AND p.data_pedido BETWEEN ? AND ?
       WHERE c.unidade_negocio IN (${ph})${whereSearch}
       GROUP BY c.id
       ORDER BY totalSpent DESC
       LIMIT ? OFFSET ?`,
      [startDate, endDate, ...units, ...searchParams, parseInt(limit), offset]
    );

    const [[countRow]] = await conn.execute(
      `SELECT COUNT(DISTINCT c.id) AS total
       FROM clientes c
       INNER JOIN pedidos p ON c.id = p.cliente_id AND p.data_pedido BETWEEN ? AND ?
       WHERE c.unidade_negocio IN (${ph})${whereSearch}`,
      [startDate, endDate, ...units, ...searchParams]
    );

    conn.release();

    res.json({
      clients,
      total:  countRow.total,
      page:   parseInt(page),
      pages:  Math.ceil(countRow.total / parseInt(limit))
    });
  } catch (err) {
    logger.error('Erro /api/clients', { error: err.message });
    res.status(500).json({ error: 'Erro ao buscar clientes.', details: err.message });
  }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [[client]] = await conn.execute(
      `SELECT c.id, c.nome AS name, c.cpf, c.email,
              c.telefone AS phone, c.whatsapp,
              c.cidade AS city, c.estado AS state,
              c.unidade_negocio AS businessUnit,
              MIN(p.data_pedido) AS firstPurchaseDate,
              MAX(p.data_pedido) AS lastPurchaseDate,
              COUNT(DISTINCT p.id) AS totalOrders,
              COALESCE(SUM(p.valor_total),0) AS totalSpent,
              COALESCE(AVG(p.valor_total),0) AS averageTicket
       FROM clientes c
       LEFT JOIN pedidos p ON c.id = p.cliente_id
       WHERE c.id = ?
       GROUP BY c.id`,
      [req.params.id]
    );
    conn.release();
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
    res.json(client);
  } catch (err) {
    logger.error('Erro /api/clients/:id', { error: err.message });
    res.status(500).json({ error: 'Erro ao buscar cliente.', details: err.message });
  }
});

// ── SEGMENTOS ─────────────────────────────────────────────────
app.get('/api/segments', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const units = buildUnitFilter(businessUnit);
  const ph    = units.map(() => '?').join(',');

  try {
    const conn = await pool.getConnection();

    // VIP: top 10%
    const [[countAll]] = await conn.execute(
      `SELECT COUNT(DISTINCT cliente_id) AS total FROM pedidos
       WHERE data_pedido BETWEEN ? AND ? AND unidade_negocio IN (${ph})`,
      [startDate, endDate, ...units]
    );
    const vipLimit = Math.ceil((countAll.total || 0) * 0.1);

    const [vip] = await conn.execute(
      `SELECT c.id FROM clientes c INNER JOIN pedidos p ON c.id = p.cliente_id
       WHERE p.data_pedido BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
       GROUP BY c.id ORDER BY SUM(p.valor_total) DESC LIMIT ?`,
      [startDate, endDate, ...units, vipLimit || 1]
    );

    const [recorrente] = await conn.execute(
      `SELECT c.id FROM clientes c INNER JOIN pedidos p ON c.id = p.cliente_id
       WHERE p.data_pedido BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
       GROUP BY c.id HAVING COUNT(DISTINCT p.id) >= 3`,
      [startDate, endDate, ...units]
    );

    const [novo] = await conn.execute(
      `SELECT c.id FROM clientes c
       INNER JOIN (SELECT cliente_id, MIN(data_pedido) AS fp FROM pedidos GROUP BY cliente_id) fp ON c.id = fp.cliente_id
       INNER JOIN pedidos p ON c.id = p.cliente_id
       WHERE fp.fp BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
       GROUP BY c.id`,
      [startDate, endDate, ...units]
    );

    const [inativo] = await conn.execute(
      `SELECT DISTINCT c.id FROM clientes c
       INNER JOIN pedidos p ON c.id = p.cliente_id
       WHERE p.unidade_negocio IN (${ph})
         AND c.id NOT IN (
           SELECT DISTINCT cliente_id FROM pedidos
           WHERE data_pedido >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
         )`,
      [...units]
    );

    conn.release();

    res.json({
      period: { startDate, endDate },
      businessUnit,
      segments: [
        { segment: 'vip',        customerCount: vip.length },
        { segment: 'recorrente', customerCount: recorrente.length },
        { segment: 'novo',       customerCount: novo.length },
        { segment: 'inativo',    customerCount: inativo.length }
      ]
    });
  } catch (err) {
    logger.error('Erro /api/segments', { error: err.message });
    res.status(500).json({ error: 'Erro ao buscar segmentos.', details: err.message });
  }
});

app.get('/api/segments/:type/customers', async (req, res) => {
  const { type } = req.params;
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const validTypes = ['vip', 'recorrente', 'novo', 'inativo', 'em_risco'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Tipo de segmento inválido.' });

  const units = buildUnitFilter(businessUnit);
  const ph    = units.map(() => '?').join(',');

  try {
    const conn = await pool.getConnection();
    let ids = [];

    if (type === 'vip') {
      const [[countAll]] = await conn.execute(
        `SELECT COUNT(DISTINCT cliente_id) AS total FROM pedidos
         WHERE data_pedido BETWEEN ? AND ? AND unidade_negocio IN (${ph})`,
        [startDate, endDate, ...units]
      );
      const vipLimit = Math.ceil((countAll.total || 0) * 0.1);
      const [rows] = await conn.execute(
        `SELECT c.id FROM clientes c INNER JOIN pedidos p ON c.id = p.cliente_id
         WHERE p.data_pedido BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
         GROUP BY c.id ORDER BY SUM(p.valor_total) DESC LIMIT ?`,
        [startDate, endDate, ...units, vipLimit || 1]
      );
      ids = rows.map(r => r.id);
    } else if (type === 'recorrente') {
      const [rows] = await conn.execute(
        `SELECT c.id FROM clientes c INNER JOIN pedidos p ON c.id = p.cliente_id
         WHERE p.data_pedido BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
         GROUP BY c.id HAVING COUNT(DISTINCT p.id) >= 3`,
        [startDate, endDate, ...units]
      );
      ids = rows.map(r => r.id);
    } else if (type === 'novo') {
      const [rows] = await conn.execute(
        `SELECT c.id FROM clientes c
         INNER JOIN (SELECT cliente_id, MIN(data_pedido) AS fp FROM pedidos GROUP BY cliente_id) fp ON c.id = fp.cliente_id
         INNER JOIN pedidos p ON c.id = p.cliente_id
         WHERE fp.fp BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
         GROUP BY c.id`,
        [startDate, endDate, ...units]
      );
      ids = rows.map(r => r.id);
    } else if (type === 'inativo') {
      const [rows] = await conn.execute(
        `SELECT DISTINCT c.id FROM clientes c
         INNER JOIN pedidos p ON c.id = p.cliente_id
         WHERE p.unidade_negocio IN (${ph})
           AND c.id NOT IN (SELECT DISTINCT cliente_id FROM pedidos WHERE data_pedido >= DATE_SUB(CURDATE(), INTERVAL 90 DAY))`,
        [...units]
      );
      ids = rows.map(r => r.id);
    } else if (type === 'em_risco') {
      const [rows] = await conn.execute(
        `SELECT c.id FROM clientes c
         INNER JOIN pedidos p ON c.id = p.cliente_id AND p.data_pedido BETWEEN ? AND ?
         LEFT JOIN pedidos prev ON c.id = prev.cliente_id AND prev.data_pedido < ?
         WHERE p.unidade_negocio IN (${ph})
         GROUP BY c.id
         HAVING COUNT(DISTINCT p.id) < COUNT(DISTINCT prev.id) * 0.5 AND COUNT(DISTINCT prev.id) > 0`,
        [startDate, endDate, startDate, ...units]
      );
      ids = rows.map(r => r.id);
    }

    if (ids.length === 0) {
      conn.release();
      return res.json({ segment: type, customerCount: 0, customers: [] });
    }

    const phIds = ids.map(() => '?').join(',');
    const [customers] = await conn.execute(
      `SELECT c.id, c.nome AS name, c.email, c.telefone AS phone, c.whatsapp,
              c.cidade AS city, c.estado AS state,
              COUNT(DISTINCT p.id) AS orderCount,
              COALESCE(SUM(p.valor_total),0) AS totalSpent,
              MAX(p.data_pedido) AS lastPurchaseDate,
              DATEDIFF(CURDATE(), MAX(p.data_pedido)) AS daysSinceLastPurchase
       FROM clientes c LEFT JOIN pedidos p ON c.id = p.cliente_id
       WHERE c.id IN (${phIds})
       GROUP BY c.id ORDER BY totalSpent DESC`,
      ids
    );

    conn.release();
    res.json({ segment: type, customerCount: customers.length, customers });
  } catch (err) {
    logger.error('Erro /api/segments/:type/customers', { error: err.message });
    res.status(500).json({ error: 'Erro ao buscar clientes do segmento.', details: err.message });
  }
});

// ── RFM ───────────────────────────────────────────────────────
app.get('/api/rfm/distribution', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const units = buildUnitFilter(businessUnit);
  const ph    = units.map(() => '?').join(',');

  try {
    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      `SELECT c.id,
              DATEDIFF(CURDATE(), MAX(p.data_pedido)) AS recency,
              COUNT(DISTINCT p.id) AS frequency,
              COALESCE(SUM(p.valor_total),0) AS monetary
       FROM clientes c INNER JOIN pedidos p ON c.id = p.cliente_id
       WHERE p.data_pedido BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
       GROUP BY c.id`,
      [startDate, endDate, ...units]
    );

    conn.release();

    if (!rows.length) return res.json({ distribution: [] });

    // Quintis
    const calcQ = arr => {
      const s = [...arr].sort((a, b) => a - b);
      return [1, 2, 3, 4, 5].map(i => s[Math.ceil((i / 5) * s.length) - 1]);
    };
    const getScore = (v, q) => { for (let i = 0; i < q.length; i++) if (v <= q[i]) return i + 1; return 5; };

    const qR = calcQ(rows.map(r => r.recency));
    const qF = calcQ(rows.map(r => r.frequency));
    const qM = calcQ(rows.map(r => r.monetary));

    const segCount = {};
    rows.forEach(r => {
      const R = 6 - getScore(r.recency, qR);
      const F = getScore(r.frequency, qF);
      const M = getScore(r.monetary, qM);
      let seg;
      if (R === 5 && F === 5 && M === 5)       seg = 'champions';
      else if (R >= 4 && F >= 4)               seg = 'loyal';
      else if (R >= 3 && F >= 3 && M >= 3)     seg = 'potential_loyal';
      else if (R >= 4 && F <= 2)               seg = 'promising';
      else if (R <= 2 && F >= 3)               seg = 'at_risk';
      else if (R <= 2 && F === 2)              seg = 'hibernating';
      else                                      seg = 'lost';
      segCount[seg] = (segCount[seg] || 0) + 1;
    });

    const total = rows.length;
    const distribution = Object.entries(segCount).map(([segment, count]) => ({
      segment,
      customerCount: count,
      percentage: parseFloat(((count / total) * 100).toFixed(2))
    })).sort((a, b) => b.customerCount - a.customerCount);

    res.json({ period: { startDate, endDate }, businessUnit, totalCustomers: total, distribution });
  } catch (err) {
    logger.error('Erro /api/rfm/distribution', { error: err.message });
    res.status(500).json({ error: 'Erro ao calcular RFM.', details: err.message });
  }
});

// ── PRODUTOS ──────────────────────────────────────────────────
app.get('/api/products/top-selling', async (req, res) => {
  const { orderBy = 'quantity', limit = 20, businessUnit = 'all', startDate, endDate } = req.query;
  const units = buildUnitFilter(businessUnit);
  const ph    = units.map(() => '?').join(',');

  try {
    const conn  = await pool.getConnection();
    const params = [];
    let where   = `WHERE p.unidade_negocio IN (${ph})`;
    params.push(...units);

    if (startDate && endDate) {
      where += ' AND p.data_pedido BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const orderCol = orderBy === 'revenue' ? 'totalRevenue' : 'totalQty';
    const [rows] = await conn.execute(
      `SELECT pr.id, pr.codigo AS code, pr.nome AS name,
              SUM(ip.quantidade) AS totalQty,
              SUM(ip.preco_total) AS totalRevenue,
              COUNT(DISTINCT p.id) AS orderCount
       FROM produtos pr
       INNER JOIN itens_pedido ip ON pr.id = ip.produto_id
       INNER JOIN pedidos p ON ip.pedido_id = p.id
       ${where}
       GROUP BY pr.id ORDER BY ${orderCol} DESC LIMIT ?`,
      [...params, parseInt(limit)]
    );
    conn.release();
    res.json({ products: rows });
  } catch (err) {
    logger.error('Erro /api/products/top-selling', { error: err.message });
    res.status(500).json({ error: 'Erro ao buscar produtos.', details: err.message });
  }
});

app.get('/api/products/co-occurrence', async (req, res) => {
  const { minFrequency = 2, businessUnit = 'all', startDate, endDate, limit = 20 } = req.query;
  const units = buildUnitFilter(businessUnit);
  const ph    = units.map(() => '?').join(',');

  try {
    const conn   = await pool.getConnection();
    const params = [...units];
    let where    = `WHERE ped.unidade_negocio IN (${ph})`;

    if (startDate && endDate) {
      where += ' AND ped.data_pedido BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const [rows] = await conn.execute(
      `SELECT i1.produto_id AS product1Id, p1.nome AS product1Name,
              i2.produto_id AS product2Id, p2.nome AS product2Name,
              COUNT(DISTINCT i1.pedido_id) AS coOccurrenceCount
       FROM itens_pedido i1
       INNER JOIN itens_pedido i2 ON i1.pedido_id = i2.pedido_id AND i1.produto_id < i2.produto_id
       INNER JOIN produtos p1 ON i1.produto_id = p1.id
       INNER JOIN produtos p2 ON i2.produto_id = p2.id
       INNER JOIN pedidos ped ON i1.pedido_id = ped.id
       ${where}
       GROUP BY i1.produto_id, i2.produto_id
       HAVING coOccurrenceCount >= ?
       ORDER BY coOccurrenceCount DESC
       LIMIT ?`,
      [...params, parseInt(minFrequency), parseInt(limit)]
    );
    conn.release();
    res.json({ productPairs: rows });
  } catch (err) {
    logger.error('Erro /api/products/co-occurrence', { error: err.message });
    res.status(500).json({ error: 'Erro ao buscar co-ocorrência.', details: err.message });
  }
});

// ── GEOLOCALIZAÇÃO ────────────────────────────────────────────
app.get('/api/geolocation/states', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const units = buildUnitFilter(businessUnit);
  const ph    = units.map(() => '?').join(',');

  try {
    const conn  = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT c.estado AS location,
              COUNT(DISTINCT c.id) AS customerCount,
              COALESCE(SUM(p.valor_total),0) AS totalRevenue,
              COALESCE(AVG(p.valor_total),0) AS averageTicket,
              COUNT(DISTINCT p.id) AS orderCount
       FROM clientes c INNER JOIN pedidos p ON c.id = p.cliente_id
       WHERE p.data_pedido BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
         AND c.estado IS NOT NULL AND c.estado != ''
       GROUP BY c.estado ORDER BY customerCount DESC`,
      [startDate, endDate, ...units]
    );
    conn.release();
    res.json({ states: rows });
  } catch (err) {
    logger.error('Erro /api/geolocation/states', { error: err.message });
    res.status(500).json({ error: 'Erro ao buscar estados.', details: err.message });
  }
});

app.get('/api/geolocation/cities', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all', states } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const units   = buildUnitFilter(businessUnit);
  const ph      = units.map(() => '?').join(',');
  const params  = [startDate, endDate, ...units];
  let stateWhere = '';

  if (states) {
    const stArr = states.split(',').map(s => s.trim());
    stateWhere  = ` AND c.estado IN (${stArr.map(() => '?').join(',')})`;
    params.push(...stArr);
  }

  try {
    const conn  = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT CONCAT(c.cidade, '/', c.estado) AS location,
              c.cidade AS city, c.estado AS state,
              COUNT(DISTINCT c.id) AS customerCount,
              COALESCE(SUM(p.valor_total),0) AS totalRevenue,
              COALESCE(AVG(p.valor_total),0) AS averageTicket,
              COUNT(DISTINCT p.id) AS orderCount
       FROM clientes c INNER JOIN pedidos p ON c.id = p.cliente_id
       WHERE p.data_pedido BETWEEN ? AND ? AND p.unidade_negocio IN (${ph})
         AND c.cidade IS NOT NULL AND c.cidade != ''${stateWhere}
       GROUP BY c.cidade, c.estado ORDER BY customerCount DESC`,
      params
    );
    conn.release();
    res.json({ cities: rows });
  } catch (err) {
    logger.error('Erro /api/geolocation/cities', { error: err.message });
    res.status(500).json({ error: 'Erro ao buscar cidades.', details: err.message });
  }
});

// ── CAMPANHAS ─────────────────────────────────────────────────
app.get('/api/campaign/metrics', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const units = buildUnitFilter(businessUnit);
  const ph    = units.map(() => '?').join(',');

  try {
    const conn = await pool.getConnection();

    const [[all]] = await conn.execute(
      `SELECT COUNT(*) AS total, COALESCE(AVG(valor_total),0) AS avgAll, COALESCE(SUM(valor_total),0) AS sumAll
       FROM pedidos WHERE data_pedido BETWEEN ? AND ? AND unidade_negocio IN (${ph})`,
      [startDate, endDate, ...units]
    );

    const [[coup]] = await conn.execute(
      `SELECT COUNT(*) AS total, COALESCE(AVG(valor_total),0) AS avgCoup, COALESCE(SUM(valor_total),0) AS sumCoup
       FROM pedidos WHERE data_pedido BETWEEN ? AND ? AND unidade_negocio IN (${ph})
         AND cupom_desconto IS NOT NULL AND cupom_desconto != ''`,
      [startDate, endDate, ...units]
    );

    conn.release();

    const totalOrders     = all.total || 0;
    const ordersWithCoupon = coup.total || 0;

    res.json({
      metrics: {
        totalOrders,
        ordersWithCoupon,
        ordersWithoutCoupon:        totalOrders - ordersWithCoupon,
        averageTicketWithCoupon:    parseFloat(coup.avgCoup)  || 0,
        averageTicketWithoutCoupon: parseFloat(all.avgAll)    || 0,
        couponConversionRate:       totalOrders > 0 ? parseFloat(((ordersWithCoupon / totalOrders) * 100).toFixed(2)) : 0,
        totalRevenueWithCoupon:     parseFloat(coup.sumCoup)  || 0,
        totalRevenueWithoutCoupon:  parseFloat(all.sumAll) - parseFloat(coup.sumCoup) || 0
      }
    });
  } catch (err) {
    logger.error('Erro /api/campaign/metrics', { error: err.message });
    res.status(500).json({ error: 'Erro ao calcular métricas de campanha.', details: err.message });
  }
});

// ── 404 e Error Handler ───────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  logger.error('Erro não tratado', { error: err.message });
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ── Start ─────────────────────────────────────────────────────
pool.getConnection()
  .then(conn => {
    conn.release();
    logger.info('Banco de dados conectado com sucesso.');
    app.listen(PORT, () => {
      logger.info(`Servidor rodando na porta ${PORT}`);
      console.log(`🚀 Servidor pronto em http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch(err => {
    logger.error('Falha ao conectar ao banco de dados: ' + err.message);
    process.exit(1);
  });
