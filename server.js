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

// ── DIAGNÓSTICO ───────────────────────────────────────────────
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

// ── HELPER: tabelas por unidade de negócio ────────────────────
// Tabelas reais do banco:
//   bling_pedidos_venda_detalhes_ecommerce       (eco)
//   bling_pedidos_venda_detalhes_distribuicao    (dist)
//   bling_pedidos_venda_detalhes_itens_ecommerce
//   bling_pedidos_venda_detalhes_itens_distribuicao
//   bling_produtos_detalhes_ecommerce
//   bling_produtos_detalhes_distribuicao
//
// Colunas pedidos: id, contato_id, contato_nome, contato_numerodocumento,
//   data, total, situacao_nome, transporte_etiqueta_municipio,
//   transporte_etiqueta_uf, kdd_cliente_estado, numero, numeroloja, notafiscal_id
//
// Colunas itens: pedido_venda_id, pedido_data, itens_codigo, itens_produto_id,
//   itens_quantidade, itens_valor, kdd_cliente_estado, situacao_nome

function getTables(businessUnit) {
  if (businessUnit === 'ecommerce') {
    return [{ pedidos: 'bling_pedidos_venda_detalhes_ecommerce', origem: 'ecommerce' }];
  }
  if (businessUnit === 'distributor' || businessUnit === 'distribuidor') {
    return [{ pedidos: 'bling_pedidos_venda_detalhes_distribuicao', origem: 'distribuicao' }];
  }
  // all
  return [
    { pedidos: 'bling_pedidos_venda_detalhes_ecommerce',    origem: 'ecommerce'   },
    { pedidos: 'bling_pedidos_venda_detalhes_distribuicao', origem: 'distribuicao' }
  ];
}

// Executa query em todas as tabelas e combina resultados
async function queryAllTables(conn, businessUnit, sqlFn) {
  const tables  = getTables(businessUnit);
  const results = [];
  for (const t of tables) {
    const [rows] = await conn.execute(sqlFn(t.pedidos), );
    rows.forEach(r => { r._origem = t.origem; results.push(r); });
  }
  return results;
}

// ── DASHBOARD KPIs ────────────────────────────────────────────
app.get('/api/dashboard/kpis', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const tables = getTables(businessUnit);

  try {
    const conn = await pool.getConnection();

    let totalRevenue = 0, totalOrders = 0, avgTicket = 0;
    let activeSet = new Set(), newSet = new Set(), allContactIds = new Set();

    for (const t of tables) {
      // Receita, pedidos e clientes ativos no período
      const [rev] = await conn.execute(
        `SELECT COALESCE(SUM(total),0) AS rev,
                COUNT(*) AS orders,
                COALESCE(AVG(total),0) AS avg
         FROM \`${t.pedidos}\`
         WHERE data BETWEEN ? AND ?`,
        [startDate, endDate]
      );
      totalRevenue += parseFloat(rev[0].rev) || 0;
      totalOrders  += parseInt(rev[0].orders) || 0;

      // Clientes únicos no período
      const [actv] = await conn.execute(
        `SELECT DISTINCT contato_id FROM \`${t.pedidos}\`
         WHERE data BETWEEN ? AND ?`,
        [startDate, endDate]
      );
      actv.forEach(r => r.contato_id && activeSet.add(r.contato_id));

      // Novos clientes (primeira compra no período)
      const [novos] = await conn.execute(
        `SELECT contato_id,
                MIN(data) AS primeira
         FROM \`${t.pedidos}\`
         GROUP BY contato_id
         HAVING primeira BETWEEN ? AND ?`,
        [startDate, endDate]
      );
      novos.forEach(r => r.contato_id && newSet.add(r.contato_id));

      // Todos os contatos (para calcular inativos)
      const [todos] = await conn.execute(
        `SELECT DISTINCT contato_id FROM \`${t.pedidos}\``
      );
      todos.forEach(r => r.contato_id && allContactIds.add(r.contato_id));

      // Clientes ativos nos últimos 90 dias
      const [ativos90] = await conn.execute(
        `SELECT DISTINCT contato_id FROM \`${t.pedidos}\`
         WHERE data >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`
      );
      ativos90.forEach(r => r.contato_id && activeSet.add('_90_' + r.contato_id));
    }

    conn.release();

    // Inativos = todos que nunca compraram nos últimos 90 dias
    const ativos90Set = new Set([...activeSet].filter(k => k.startsWith('_90_')));
    const cleanActiveSet = new Set([...activeSet].filter(k => !k.startsWith('_90_')));
    const inactiveCount = allContactIds.size - ativos90Set.size;

    const activeCount = cleanActiveSet.size;
    avgTicket = activeCount > 0 ? totalRevenue / totalOrders : 0;

    res.json({
      period: { startDate, endDate },
      businessUnit,
      totalClients:             activeCount,
      activeClients:            activeCount,
      inactiveClients:          Math.max(0, inactiveCount),
      newClients:               newSet.size,
      totalRevenue:             parseFloat(totalRevenue.toFixed(2)),
      averageTicket:            parseFloat(avgTicket.toFixed(2)),
      totalOrders,
      averagePurchaseFrequency: activeCount > 0
        ? parseFloat((totalOrders / activeCount).toFixed(2)) : 0
    });
  } catch (err) {
    logger.error('Erro /api/dashboard/kpis: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENTES ──────────────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all',
          page = 1, limit = 50, search } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const tables = getTables(businessUnit);
  const lim    = parseInt(limit);
  const off    = (parseInt(page) - 1) * lim;

  try {
    const conn = await pool.getConnection();
    const allClients = [];

    for (const t of tables) {
      let sql = `SELECT contato_id AS id,
                        contato_nome AS name,
                        contato_numerodocumento AS cpf,
                        transporte_etiqueta_municipio AS city,
                        kdd_cliente_estado AS state,
                        '${t.origem}' AS businessUnit,
                        MIN(data) AS firstPurchaseDate,
                        MAX(data) AS lastPurchaseDate,
                        COUNT(*) AS totalOrders,
                        COALESCE(SUM(total),0) AS totalSpent,
                        COALESCE(AVG(total),0) AS averageTicket
                 FROM \`${t.pedidos}\`
                 WHERE data BETWEEN ? AND ?`;
      const params = [startDate, endDate];

      if (search) {
        sql += ` AND (contato_nome LIKE ? OR contato_numerodocumento LIKE ? OR numero LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      sql += ` GROUP BY contato_id ORDER BY totalSpent DESC`;

      const [rows] = await conn.execute(sql, params);
      allClients.push(...rows);
    }

    conn.release();

    // Deduplicar por contato_id e combinar origens
    const map = new Map();
    allClients.forEach(c => {
      if (!c.id) return;
      if (map.has(c.id)) {
        const ex = map.get(c.id);
        ex.totalOrders += c.totalOrders;
        ex.totalSpent  += parseFloat(c.totalSpent);
      } else {
        map.set(c.id, { ...c, totalSpent: parseFloat(c.totalSpent) });
      }
    });

    const sorted = [...map.values()]
      .sort((a, b) => b.totalSpent - a.totalSpent);
    const total   = sorted.length;
    const clients = sorted.slice(off, off + lim);

    res.json({ clients, total, page: parseInt(page), pages: Math.ceil(total / lim) });
  } catch (err) {
    logger.error('Erro /api/clients: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  const tables = getTables('all');

  try {
    const conn = await pool.getConnection();
    let found = null;

    for (const t of tables) {
      const [rows] = await conn.execute(
        `SELECT contato_id AS id,
                contato_nome AS name,
                contato_numerodocumento AS cpf,
                transporte_etiqueta_municipio AS city,
                kdd_cliente_estado AS state,
                '${t.origem}' AS businessUnit,
                MIN(data) AS firstPurchaseDate,
                MAX(data) AS lastPurchaseDate,
                COUNT(*) AS totalOrders,
                COALESCE(SUM(total),0) AS totalSpent,
                COALESCE(AVG(total),0) AS averageTicket
         FROM \`${t.pedidos}\`
         WHERE contato_id = ?
         GROUP BY contato_id`,
        [id]
      );
      if (rows.length > 0 && !found) found = rows[0];
    }

    conn.release();
    if (!found) return res.status(404).json({ error: 'Cliente não encontrado.' });
    res.json(found);
  } catch (err) {
    logger.error('Erro /api/clients/:id: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SEGMENTOS ─────────────────────────────────────────────────
app.get('/api/segments', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const tables = getTables(businessUnit);

  try {
    const conn = await pool.getConnection();

    // Agregar dados de todas as tabelas por contato
    const clientMap = new Map();

    for (const t of tables) {
      const [rows] = await conn.execute(
        `SELECT contato_id,
                COUNT(*) AS orders,
                SUM(total) AS spent,
                MAX(data) AS lastDate,
                MIN(data) AS firstDate,
                DATEDIFF(CURDATE(), MAX(data)) AS daysSince
         FROM \`${t.pedidos}\`
         WHERE data BETWEEN ? AND ?
         GROUP BY contato_id`,
        [startDate, endDate]
      );
      rows.forEach(r => {
        if (!r.contato_id) return;
        if (clientMap.has(r.contato_id)) {
          const ex = clientMap.get(r.contato_id);
          ex.orders += r.orders;
          ex.spent  += parseFloat(r.spent || 0);
        } else {
          clientMap.set(r.contato_id, {
            id: r.contato_id,
            orders: r.orders,
            spent: parseFloat(r.spent || 0),
            daysSince: r.daysSince,
            firstDate: r.firstDate
          });
        }
      });
    }

    const clients = [...clientMap.values()];
    const total   = clients.length;

    // Calcular segmentos
    const vipLimit = Math.ceil(total * 0.1);
    const sorted   = [...clients].sort((a, b) => b.spent - a.spent);

    const vipIds       = new Set(sorted.slice(0, vipLimit).map(c => c.id));
    const recorrenteIds = new Set(clients.filter(c => c.orders >= 3).map(c => c.id));
    const novoIds      = new Set(clients.filter(c => {
      const fp = new Date(c.firstDate);
      return fp >= new Date(startDate) && fp <= new Date(endDate);
    }).map(c => c.id));
    const inativoIds   = new Set(clients.filter(c => c.daysSince > 90).map(c => c.id));

    conn.release();

    res.json({
      period: { startDate, endDate },
      businessUnit,
      segments: [
        { segment: 'vip',        customerCount: vipIds.size },
        { segment: 'recorrente', customerCount: recorrenteIds.size },
        { segment: 'novo',       customerCount: novoIds.size },
        { segment: 'inativo',    customerCount: inativoIds.size }
      ]
    });
  } catch (err) {
    logger.error('Erro /api/segments: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/segments/:type/customers', async (req, res) => {
  const { type } = req.params;
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const validTypes = ['vip', 'recorrente', 'novo', 'inativo', 'em_risco'];
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Tipo inválido.' });

  const tables = getTables(businessUnit);

  try {
    const conn = await pool.getConnection();
    const clientMap = new Map();

    for (const t of tables) {
      const [rows] = await conn.execute(
        `SELECT contato_id, contato_nome,
                COUNT(*) AS orders,
                SUM(total) AS spent,
                MAX(data) AS lastDate,
                MIN(data) AS firstDate,
                DATEDIFF(CURDATE(), MAX(data)) AS daysSince
         FROM \`${t.pedidos}\`
         WHERE data BETWEEN ? AND ?
         GROUP BY contato_id, contato_nome`,
        [startDate, endDate]
      );
      rows.forEach(r => {
        if (!r.contato_id) return;
        if (!clientMap.has(r.contato_id)) {
          clientMap.set(r.contato_id, {
            id: r.contato_id, name: r.contato_nome,
            orderCount: r.orders, totalSpent: parseFloat(r.spent || 0),
            daysSince: r.daysSince, firstDate: r.firstDate, lastDate: r.lastDate
          });
        } else {
          const ex = clientMap.get(r.contato_id);
          ex.orderCount += r.orders;
          ex.totalSpent += parseFloat(r.spent || 0);
        }
      });
    }

    conn.release();

    const clients = [...clientMap.values()];
    const total   = clients.length;
    const vipLimit = Math.ceil(total * 0.1);
    const sorted   = [...clients].sort((a, b) => b.totalSpent - a.totalSpent);

    let filtered = [];
    if (type === 'vip')        filtered = sorted.slice(0, vipLimit);
    if (type === 'recorrente') filtered = clients.filter(c => c.orderCount >= 3);
    if (type === 'novo')       filtered = clients.filter(c => {
      const fp = new Date(c.firstDate);
      return fp >= new Date(startDate) && fp <= new Date(endDate);
    });
    if (type === 'inativo')    filtered = clients.filter(c => c.daysSince > 90);
    if (type === 'em_risco')   filtered = clients.filter(c => c.daysSince > 30 && c.daysSince <= 90);

    res.json({ segment: type, customerCount: filtered.length, customers: filtered });
  } catch (err) {
    logger.error('Erro /api/segments/:type/customers: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── RFM ───────────────────────────────────────────────────────
app.get('/api/rfm/distribution', async (req, res) => {
  const { startDate, endDate, businessUnit = 'all' } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const tables = getTables(businessUnit);

  try {
    const conn = await pool.getConnection();
    const clientMap = new Map();

    for (const t of tables) {
      const [rows] = await conn.execute(
        `SELECT contato_id,
                DATEDIFF(CURDATE(), MAX(data)) AS recency,
                COUNT(*) AS frequency,
                COALESCE(SUM(total),0) AS monetary
         FROM \`${t.pedidos}\`
         WHERE data BETWEEN ? AND ?
         GROUP BY contato_id`,
        [startDate, endDate]
      );
      rows.forEach(r => {
        if (!r.contato_id) return;
        if (!clientMap.has(r.contato_id)) {
          clientMap.set(r.contato_id, {
            recency: r.recency, frequency: r.frequency,
            monetary: parseFloat(r.monetary)
          });
        } else {
          const ex = clientMap.get(r.contato_id);
          ex.frequency += r.frequency;
          ex.monetary  += parseFloat(r.monetary);
        }
      });
    }

    conn.release();

    const data = [...clientMap.values()];
    if (!data.length) return res.json({ distribution: [] });

    const calcQ = arr => {
      const s = [...arr].sort((a, b) => a - b);
      return [1,2,3,4,5].map(i => s[Math.ceil((i/5)*s.length)-1]);
    };
    const getScore = (v, q) => { for (let i=0;i<q.length;i++) if(v<=q[i]) return i+1; return 5; };

    const qR = calcQ(data.map(r => r.recency));
    const qF = calcQ(data.map(r => r.frequency));
    const qM = calcQ(data.map(r => r.monetary));

    const segCount = {};
    data.forEach(r => {
      const R = 6 - getScore(r.recency, qR);
      const F = getScore(r.frequency, qF);
      const M = getScore(r.monetary, qM);
      let seg;
      if (R===5&&F===5&&M===5)      seg='champions';
      else if (R>=4&&F>=4)          seg='loyal';
      else if (R>=3&&F>=3&&M>=3)    seg='potential_loyal';
      else if (R>=4&&F<=2)          seg='promising';
      else if (R<=2&&F>=3)          seg='at_risk';
      else if (R<=2&&F===2)         seg='hibernating';
      else                          seg='lost';
      segCount[seg] = (segCount[seg]||0)+1;
    });

    const total = data.length;
    const distribution = Object.entries(segCount).map(([segment, count]) => ({
      segment, customerCount: count,
      percentage: parseFloat(((count/total)*100).toFixed(2))
    })).sort((a,b) => b.customerCount - a.customerCount);

    res.json({ period:{startDate,endDate}, businessUnit, totalCustomers:total, distribution });
  } catch (err) {
    logger.error('Erro /api/rfm/distribution: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PRODUTOS mais vendidos ────────────────────────────────────
app.get('/api/products/top-selling', async (req, res) => {
  const { orderBy='quantity', limit=20, businessUnit='all', startDate, endDate } = req.query;

  const itensTables = businessUnit === 'ecommerce'
    ? ['bling_pedidos_venda_detalhes_itens_ecommerce']
    : businessUnit === 'distributor' || businessUnit === 'distribuidor'
    ? ['bling_pedidos_venda_detalhes_itens_distribuicao']
    : ['bling_pedidos_venda_detalhes_itens_ecommerce',
       'bling_pedidos_venda_detalhes_itens_distribuicao'];

  try {
    const conn = await pool.getConnection();
    const prodMap = new Map();

    for (const tbl of itensTables) {
      let sql = `SELECT itens_codigo AS code,
                        SUM(itens_quantidade) AS totalQty,
                        SUM(itens_valor * itens_quantidade) AS totalRevenue,
                        COUNT(DISTINCT pedido_venda_id) AS orderCount
                 FROM \`${tbl}\`
                 WHERE itens_codigo IS NOT NULL`;
      const params = [];
      if (startDate && endDate) {
        sql += ' AND pedido_data BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }
      sql += ' GROUP BY itens_codigo';

      const [rows] = await conn.execute(sql, params);
      rows.forEach(r => {
        if (!r.code) return;
        if (!prodMap.has(r.code)) {
          prodMap.set(r.code, {
            code: r.code, name: r.code,
            totalQty: parseFloat(r.totalQty)||0,
            totalRevenue: parseFloat(r.totalRevenue)||0,
            orderCount: parseInt(r.orderCount)||0
          });
        } else {
          const ex = prodMap.get(r.code);
          ex.totalQty     += parseFloat(r.totalQty)||0;
          ex.totalRevenue += parseFloat(r.totalRevenue)||0;
          ex.orderCount   += parseInt(r.orderCount)||0;
        }
      });
    }

    conn.release();

    const products = [...prodMap.values()]
      .sort((a,b) => orderBy==='revenue'
        ? b.totalRevenue - a.totalRevenue
        : b.totalQty     - a.totalQty)
      .slice(0, parseInt(limit));

    res.json({ products });
  } catch (err) {
    logger.error('Erro /api/products/top-selling: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GEOLOCALIZAÇÃO ────────────────────────────────────────────
app.get('/api/geolocation/states', async (req, res) => {
  const { startDate, endDate, businessUnit='all' } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const tables = getTables(businessUnit);

  try {
    const conn = await pool.getConnection();
    const stateMap = new Map();

    for (const t of tables) {
      const [rows] = await conn.execute(
        `SELECT kdd_cliente_estado AS state,
                COUNT(DISTINCT contato_id) AS customers,
                COALESCE(SUM(total),0) AS revenue,
                COUNT(*) AS orders
         FROM \`${t.pedidos}\`
         WHERE data BETWEEN ? AND ?
           AND kdd_cliente_estado IS NOT NULL
           AND kdd_cliente_estado != ''
         GROUP BY kdd_cliente_estado`,
        [startDate, endDate]
      );
      rows.forEach(r => {
        if (!stateMap.has(r.state)) {
          stateMap.set(r.state, {
            location: r.state,
            customerCount: parseInt(r.customers)||0,
            totalRevenue: parseFloat(r.revenue)||0,
            orderCount: parseInt(r.orders)||0
          });
        } else {
          const ex = stateMap.get(r.state);
          ex.customerCount += parseInt(r.customers)||0;
          ex.totalRevenue  += parseFloat(r.revenue)||0;
          ex.orderCount    += parseInt(r.orders)||0;
        }
      });
    }

    conn.release();

    const states = [...stateMap.values()]
      .map(s => ({ ...s, averageTicket: s.orderCount > 0
        ? parseFloat((s.totalRevenue/s.orderCount).toFixed(2)) : 0 }))
      .sort((a,b) => b.customerCount - a.customerCount);

    res.json({ states });
  } catch (err) {
    logger.error('Erro /api/geolocation/states: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/geolocation/cities', async (req, res) => {
  const { startDate, endDate, businessUnit='all', states } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const tables   = getTables(businessUnit);
  const stateArr = states ? states.split(',').map(s => s.trim()) : null;

  try {
    const conn = await pool.getConnection();
    const cityMap = new Map();

    for (const t of tables) {
      let sql = `SELECT transporte_etiqueta_municipio AS city,
                        kdd_cliente_estado AS state,
                        COUNT(DISTINCT contato_id) AS customers,
                        COALESCE(SUM(total),0) AS revenue,
                        COUNT(*) AS orders
                 FROM \`${t.pedidos}\`
                 WHERE data BETWEEN ? AND ?
                   AND transporte_etiqueta_municipio IS NOT NULL
                   AND transporte_etiqueta_municipio != ''`;
      const params = [startDate, endDate];
      if (stateArr) {
        sql += ` AND kdd_cliente_estado IN (${stateArr.map(()=>'?').join(',')})`;
        params.push(...stateArr);
      }
      sql += ' GROUP BY transporte_etiqueta_municipio, kdd_cliente_estado';

      const [rows] = await conn.execute(sql, params);
      rows.forEach(r => {
        const key = `${r.city}/${r.state}`;
        if (!cityMap.has(key)) {
          cityMap.set(key, {
            location: key, city: r.city, state: r.state,
            customerCount: parseInt(r.customers)||0,
            totalRevenue: parseFloat(r.revenue)||0,
            orderCount: parseInt(r.orders)||0
          });
        } else {
          const ex = cityMap.get(key);
          ex.customerCount += parseInt(r.customers)||0;
          ex.totalRevenue  += parseFloat(r.revenue)||0;
          ex.orderCount    += parseInt(r.orders)||0;
        }
      });
    }

    conn.release();

    const cities = [...cityMap.values()]
      .map(c => ({ ...c, averageTicket: c.orderCount > 0
        ? parseFloat((c.totalRevenue/c.orderCount).toFixed(2)) : 0 }))
      .sort((a,b) => b.customerCount - a.customerCount);

    res.json({ cities });
  } catch (err) {
    logger.error('Erro /api/geolocation/cities: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CAMPANHAS ─────────────────────────────────────────────────
// Nota: tabelas de pedidos não têm campo de cupom visível nas colunas retornadas
// Usamos notafiscal_id como indicador de pedidos com NF (completados)
app.get('/api/campaign/metrics', async (req, res) => {
  const { startDate, endDate, businessUnit='all' } = req.query;
  if (!startDate || !endDate)
    return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });

  const tables = getTables(businessUnit);

  try {
    const conn = await pool.getConnection();
    let totalOrders=0, totalRevenue=0, ordersWithNF=0, revenueWithNF=0;

    for (const t of tables) {
      const [all] = await conn.execute(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
         FROM \`${t.pedidos}\` WHERE data BETWEEN ? AND ?`,
        [startDate, endDate]
      );
      const [withNF] = await conn.execute(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
         FROM \`${t.pedidos}\`
         WHERE data BETWEEN ? AND ?
           AND notafiscal_id IS NOT NULL AND notafiscal_id != '' AND notafiscal_id != '0'`,
        [startDate, endDate]
      );
      totalOrders   += parseInt(all[0].orders)||0;
      totalRevenue  += parseFloat(all[0].revenue)||0;
      ordersWithNF  += parseInt(withNF[0].orders)||0;
      revenueWithNF += parseFloat(withNF[0].revenue)||0;
    }

    conn.release();

    res.json({
      metrics: {
        totalOrders,
        ordersWithNF,
        ordersWithoutNF:        totalOrders - ordersWithNF,
        averageTicket:          totalOrders > 0
          ? parseFloat((totalRevenue/totalOrders).toFixed(2)) : 0,
        averageTicketWithNF:    ordersWithNF > 0
          ? parseFloat((revenueWithNF/ordersWithNF).toFixed(2)) : 0,
        nfConversionRate:       totalOrders > 0
          ? parseFloat(((ordersWithNF/totalOrders)*100).toFixed(2)) : 0,
        totalRevenue:           parseFloat(totalRevenue.toFixed(2)),
        totalRevenueWithNF:     parseFloat(revenueWithNF.toFixed(2))
      }
    });
  } catch (err) {
    logger.error('Erro /api/campaign/metrics: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 404 → serve o frontend ────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  logger.error('Erro não tratado: ' + err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ── Start ─────────────────────────────────────────────────────
pool.getConnection()
  .then(conn => {
    conn.release();
    logger.info('Banco de dados conectado com sucesso.');
    app.listen(PORT, () => {
      logger.info(`Servidor rodando na porta ${PORT}`);
      console.log(`🚀 http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    logger.error('Falha ao conectar ao banco: ' + err.message);
    process.exit(1);
  });
