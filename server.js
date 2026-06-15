require('dotenv').config();
const express     = require('express');
const mysql       = require('mysql2/promise');
const path        = require('path');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const winston     = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) =>
      `${timestamp} [${level}]: ${message}`)
  ),
  transports: [new winston.transports.Console()]
});

const REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) { logger.error('Env faltando: ' + missing.join(', ')); process.exit(1); }

const app  = express();
const PORT = process.env.PORT || 3001;

const pool = mysql.createPool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT)||3306,
  user: process.env.DB_USER, password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true, connectionLimit: 10, queueLimit: 20
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper: WHERE clause por businessUnit ─────────────────────
// Tabelas reais: bling_pedidos_venda_detalhes_ecommerce / _distribuicao
// Colunas: contato_id, contato_nome, contato_numerodocumento,
//          data (date), total (double), situacao_nome, numero,
//          notafiscal_id, kdd_cliente_estado, transporte_etiqueta_municipio

function unionSQL(bu, cols, extra = '') {
  const eco  = `SELECT ${cols}, 'ecommerce' AS origem FROM \`bling_pedidos_venda_detalhes_ecommerce\` ${extra}`;
  const dist = `SELECT ${cols}, 'distribuicao' AS origem FROM \`bling_pedidos_venda_detalhes_distribuicao\` ${extra}`;
  if (bu === 'ecommerce')                           return eco;
  if (bu === 'distributor' || bu === 'distribuidor') return dist;
  return `(${eco}) UNION ALL (${dist})`;
}

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'OK', uptime: process.uptime() }));

// ── Debug ─────────────────────────────────────────────────────
app.get('/api/debug/tables', async (_req, res) => {
  const conn = await pool.getConnection();
  const [r] = await conn.execute('SHOW TABLES'); conn.release(); res.json(r);
});
app.get('/api/debug/columns/:t', async (req, res) => {
  const conn = await pool.getConnection();
  const [r] = await conn.execute(`DESCRIBE \`${req.params.t}\``);
  conn.release(); res.json(r);
});

// ── DASHBOARD KPIs — 1 query via UNION ALL ────────────────────
app.get('/api/dashboard/kpis', async (req, res) => {
  const { startDate, endDate, businessUnit: bu = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();

    const union = unionSQL(bu,
      `contato_id, total, data`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}'`);

    // Tudo em 1 query só
    const [[kpi]] = await conn.execute(`
      SELECT
        COUNT(*)                                          AS totalOrders,
        COUNT(DISTINCT contato_id)                        AS activeClients,
        COALESCE(SUM(total),0)                            AS totalRevenue,
        COALESCE(AVG(total),0)                            AS averageTicket
      FROM (${union}) t`);

    // Novos clientes: primeira compra no período — 1 query
    const unionAll = unionSQL('all', `contato_id, data`, '');
    const [[novos]] = await conn.execute(`
      SELECT COUNT(*) AS total FROM (
        SELECT contato_id FROM (${unionAll}) t
        GROUP BY contato_id
        HAVING MIN(data) BETWEEN '${startDate}' AND '${endDate}'
      ) n`);

    // Inativos: sem compra nos últimos 90 dias — 1 query
    const [[inat]] = await conn.execute(`
      SELECT COUNT(DISTINCT contato_id) AS total
      FROM (${unionSQL('all','contato_id','')}) t
      WHERE contato_id NOT IN (
        SELECT DISTINCT contato_id
        FROM (${unionSQL('all','contato_id',`WHERE data >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`)}) a
      )`);

    conn.release();

    const active = parseInt(kpi.activeClients)||0;
    const orders = parseInt(kpi.totalOrders)||0;
    res.json({
      period: { startDate, endDate }, businessUnit: bu,
      totalClients:             active,
      activeClients:            active,
      inactiveClients:          parseInt(inat.total)||0,
      newClients:               parseInt(novos.total)||0,
      totalRevenue:             parseFloat((kpi.totalRevenue||0).toFixed(2)),
      averageTicket:            parseFloat((kpi.averageTicket||0).toFixed(2)),
      totalOrders:              orders,
      averagePurchaseFrequency: active > 0 ? parseFloat((orders/active).toFixed(2)) : 0
    });
  } catch (err) {
    logger.error('kpis: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENTES — 1 query UNION ALL + paginação em JS ───────────
app.get('/api/clients', async (req, res) => {
  const { startDate, endDate, businessUnit: bu = 'all',
          page = 1, limit = 50, search } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });

  let where = `WHERE data BETWEEN '${startDate}' AND '${endDate}'`;
  if (search) {
    const s = search.replace(/'/g,"''");
    where += ` AND (contato_nome LIKE '%${s}%' OR contato_numerodocumento LIKE '%${s}%' OR numero LIKE '%${s}%')`;
  }

  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `contato_id, MAX(contato_nome) AS name,
       MAX(contato_numerodocumento) AS cpf,
       MAX(transporte_etiqueta_municipio) AS city,
       MAX(kdd_cliente_estado) AS state,
       MIN(data) AS firstPurchaseDate, MAX(data) AS lastPurchaseDate,
       COUNT(*) AS totalOrders,
       COALESCE(SUM(total),0) AS totalSpent`,
      `${where} GROUP BY contato_id`);

    const [rows] = await conn.execute(
      `SELECT * FROM (${union}) c ORDER BY totalSpent DESC`);
    conn.release();

    // Deduplica contato_id entre eco + dist
    const map = new Map();
    rows.forEach(r => {
      if (!r.contato_id) return;
      if (!map.has(r.contato_id)) {
        map.set(r.contato_id, { ...r, totalSpent: parseFloat(r.totalSpent) });
      } else {
        const ex = map.get(r.contato_id);
        ex.totalOrders += r.totalOrders;
        ex.totalSpent  += parseFloat(r.totalSpent);
      }
    });

    const all    = [...map.values()].sort((a,b) => b.totalSpent - a.totalSpent);
    const lim    = parseInt(limit);
    const off    = (parseInt(page)-1) * lim;
    res.json({ clients: all.slice(off, off+lim), total: all.length,
               page: parseInt(page), pages: Math.ceil(all.length/lim) });
  } catch (err) {
    logger.error('clients: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SEGMENTOS — 1 query UNION ALL, cálculo em JS ─────────────
app.get('/api/segments', async (req, res) => {
  const { startDate, endDate, businessUnit: bu = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `contato_id, data, total`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}'`);

    const [rows] = await conn.execute(`SELECT * FROM (${union}) t WHERE contato_id IS NOT NULL`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.contato_id)) {
        map.set(r.contato_id, { orders:0, spent:0, firstDate:r.data, lastDate:r.data });
      }
      const c = map.get(r.contato_id);
      c.orders++;
      c.spent += parseFloat(r.total||0);
      if (new Date(r.data) < new Date(c.firstDate)) c.firstDate = r.data;
      if (new Date(r.data) > new Date(c.lastDate))  c.lastDate  = r.data;
    });

    const clients  = [...map.values()];
    const total    = clients.length;
    const vipLimit = Math.ceil(total * 0.1);
    const sorted   = [...clients].sort((a,b) => b.spent - a.spent);
    const now      = new Date();
    const s = endDate, e = startDate;

    const vip        = vipLimit;
    const recorrente = clients.filter(c => c.orders >= 3).length;
    const novo       = clients.filter(c => {
      const fp = new Date(c.firstDate);
      return fp >= new Date(startDate) && fp <= new Date(endDate);
    }).length;
    const inativo = clients.filter(c =>
      (now - new Date(c.lastDate)) / 86400000 > 90).length;

    res.json({ period:{startDate,endDate}, businessUnit:bu, segments:[
      { segment:'vip',        customerCount: vip },
      { segment:'recorrente', customerCount: recorrente },
      { segment:'novo',       customerCount: novo },
      { segment:'inativo',    customerCount: inativo }
    ]});
  } catch (err) {
    logger.error('segments: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/segments/:type/customers', async (req, res) => {
  const { type } = req.params;
  const { startDate, endDate, businessUnit: bu = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `contato_id, MAX(contato_nome) AS name, MAX(kdd_cliente_estado) AS state,
       MAX(transporte_etiqueta_municipio) AS city,
       MIN(data) AS firstDate, MAX(data) AS lastDate,
       COUNT(*) AS orders, COALESCE(SUM(total),0) AS spent`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}' GROUP BY contato_id`);

    const [rows] = await conn.execute(`SELECT * FROM (${union}) t WHERE contato_id IS NOT NULL`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.contato_id)) {
        map.set(r.contato_id, { id:r.contato_id, name:r.name, city:r.city, state:r.state,
          orderCount: r.orders, totalSpent: parseFloat(r.spent||0),
          firstDate:r.firstDate, lastDate:r.lastDate,
          daysSince: Math.floor((new Date()-new Date(r.lastDate))/86400000) });
      } else {
        const ex = map.get(r.contato_id);
        ex.orderCount += r.orders;
        ex.totalSpent += parseFloat(r.spent||0);
      }
    });

    const clients  = [...map.values()];
    const vipLimit = Math.ceil(clients.length * 0.1);
    const sorted   = [...clients].sort((a,b) => b.totalSpent - a.totalSpent);
    const now      = new Date();

    let filtered = [];
    if (type==='vip')        filtered = sorted.slice(0, vipLimit);
    if (type==='recorrente') filtered = clients.filter(c => c.orderCount >= 3);
    if (type==='novo')       filtered = clients.filter(c => {
      const fp = new Date(c.firstDate);
      return fp >= new Date(startDate) && fp <= new Date(endDate);
    });
    if (type==='inativo')    filtered = clients.filter(c => c.daysSince > 90);
    if (type==='em_risco')   filtered = clients.filter(c => c.daysSince > 30 && c.daysSince <= 90);

    res.json({ segment:type, customerCount:filtered.length, customers:filtered });
  } catch (err) {
    logger.error('segments customers: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── RFM — 1 query UNION ALL, cálculo em JS ───────────────────
app.get('/api/rfm/distribution', async (req, res) => {
  const { startDate, endDate, businessUnit: bu = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `contato_id, DATEDIFF(CURDATE(),MAX(data)) AS recency,
       COUNT(*) AS frequency, COALESCE(SUM(total),0) AS monetary`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}' GROUP BY contato_id`);

    const [rows] = await conn.execute(`SELECT * FROM (${union}) t WHERE contato_id IS NOT NULL`);
    conn.release();

    if (!rows.length) return res.json({ distribution:[] });

    const calcQ = arr => {
      const s = [...arr].sort((a,b)=>a-b);
      return [1,2,3,4,5].map(i => s[Math.ceil((i/5)*s.length)-1]);
    };
    const score = (v,q) => { for(let i=0;i<q.length;i++) if(v<=q[i]) return i+1; return 5; };

    // Agregar por contato (UNION pode duplicar)
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.contato_id)) {
        map.set(r.contato_id, { r: r.recency, f: r.frequency, m: parseFloat(r.monetary) });
      } else {
        const ex = map.get(r.contato_id);
        ex.f += r.frequency;
        ex.m += parseFloat(r.monetary);
      }
    });

    const data = [...map.values()];
    const qR = calcQ(data.map(d=>d.r));
    const qF = calcQ(data.map(d=>d.f));
    const qM = calcQ(data.map(d=>d.m));

    const seg = {};
    data.forEach(d => {
      const R = 6 - score(d.r, qR);
      const F = score(d.f, qF);
      const M = score(d.m, qM);
      const s = R===5&&F===5&&M===5 ? 'champions'
              : R>=4&&F>=4          ? 'loyal'
              : R>=3&&F>=3&&M>=3    ? 'potential_loyal'
              : R>=4&&F<=2          ? 'promising'
              : R<=2&&F>=3          ? 'at_risk'
              : R<=2&&F===2         ? 'hibernating'
              :                       'lost';
      seg[s] = (seg[s]||0)+1;
    });

    const total = data.length;
    res.json({ totalCustomers:total, distribution:
      Object.entries(seg).map(([segment,count]) => ({
        segment, customerCount:count,
        percentage: parseFloat(((count/total)*100).toFixed(2))
      })).sort((a,b)=>b.customerCount-a.customerCount)
    });
  } catch (err) {
    logger.error('rfm: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PRODUTOS mais vendidos — 1 query UNION ALL ────────────────
app.get('/api/products/top-selling', async (req, res) => {
  const { orderBy='quantity', limit=20, businessUnit:bu='all', startDate, endDate } = req.query;

  const cols = `itens_codigo AS code, SUM(itens_quantidade) AS qty,
                SUM(itens_valor*itens_quantidade) AS revenue,
                COUNT(DISTINCT pedido_venda_id) AS orders`;
  const where = startDate && endDate
    ? `WHERE pedido_data BETWEEN '${startDate}' AND '${endDate}' GROUP BY itens_codigo`
    : 'GROUP BY itens_codigo';

  const eco  = `SELECT ${cols}, 'ecommerce' AS origem FROM \`bling_pedidos_venda_detalhes_itens_ecommerce\` ${where}`;
  const dist = `SELECT ${cols}, 'distribuicao' AS origem FROM \`bling_pedidos_venda_detalhes_itens_distribuicao\` ${where}`;
  const union = bu==='ecommerce' ? eco : bu==='distributor'||bu==='distribuidor' ? dist : `(${eco}) UNION ALL (${dist})`;

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(`SELECT * FROM (${union}) t WHERE code IS NOT NULL`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.code)) map.set(r.code, { code:r.code, name:r.code, totalQty:0, totalRevenue:0, orderCount:0 });
      const ex = map.get(r.code);
      ex.totalQty     += parseFloat(r.qty)||0;
      ex.totalRevenue += parseFloat(r.revenue)||0;
      ex.orderCount   += parseInt(r.orders)||0;
    });

    const products = [...map.values()]
      .sort((a,b) => orderBy==='revenue' ? b.totalRevenue-a.totalRevenue : b.totalQty-a.totalQty)
      .slice(0, parseInt(limit));

    res.json({ products });
  } catch (err) {
    logger.error('products: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GEOLOCALIZAÇÃO — 1 query UNION ALL ───────────────────────
app.get('/api/geolocation/states', async (req, res) => {
  const { startDate, endDate, businessUnit:bu='all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `kdd_cliente_estado AS state, COUNT(DISTINCT contato_id) AS customers,
       COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}'
       AND kdd_cliente_estado IS NOT NULL AND kdd_cliente_estado != ''
       GROUP BY kdd_cliente_estado`);

    const [rows] = await conn.execute(`SELECT * FROM (${union}) t`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.state)) map.set(r.state, { location:r.state, customerCount:0, totalRevenue:0, orderCount:0 });
      const ex = map.get(r.state);
      ex.customerCount += parseInt(r.customers)||0;
      ex.totalRevenue  += parseFloat(r.revenue)||0;
      ex.orderCount    += parseInt(r.orders)||0;
    });

    const states = [...map.values()]
      .map(s => ({ ...s, averageTicket: s.orderCount>0 ? parseFloat((s.totalRevenue/s.orderCount).toFixed(2)):0 }))
      .sort((a,b) => b.customerCount-a.customerCount);

    res.json({ states });
  } catch (err) {
    logger.error('geo states: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/geolocation/cities', async (req, res) => {
  const { startDate, endDate, businessUnit:bu='all', states } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });

  const stateFilter = states
    ? `AND kdd_cliente_estado IN ('${states.split(',').map(s=>s.trim().replace(/'/g,"''")).join("','")}')`
    : '';

  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `transporte_etiqueta_municipio AS city, kdd_cliente_estado AS state,
       COUNT(DISTINCT contato_id) AS customers, COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}'
       AND transporte_etiqueta_municipio IS NOT NULL AND transporte_etiqueta_municipio != ''
       ${stateFilter} GROUP BY transporte_etiqueta_municipio, kdd_cliente_estado`);

    const [rows] = await conn.execute(`SELECT * FROM (${union}) t`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      const k = `${r.city}/${r.state}`;
      if (!map.has(k)) map.set(k, { location:k, city:r.city, state:r.state, customerCount:0, totalRevenue:0, orderCount:0 });
      const ex = map.get(k);
      ex.customerCount += parseInt(r.customers)||0;
      ex.totalRevenue  += parseFloat(r.revenue)||0;
      ex.orderCount    += parseInt(r.orders)||0;
    });

    const cities = [...map.values()]
      .map(c => ({ ...c, averageTicket: c.orderCount>0 ? parseFloat((c.totalRevenue/c.orderCount).toFixed(2)):0 }))
      .sort((a,b) => b.customerCount-a.customerCount);

    res.json({ cities });
  } catch (err) {
    logger.error('geo cities: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CAMPANHAS — 1 query UNION ALL ────────────────────────────
app.get('/api/campaign/metrics', async (req, res) => {
  const { startDate, endDate, businessUnit:bu='all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `total, notafiscal_id`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}'`);

    const [[r]] = await conn.execute(`
      SELECT COUNT(*) AS total, COALESCE(SUM(total),0) AS revenue,
             SUM(CASE WHEN notafiscal_id IS NOT NULL AND notafiscal_id!='' AND notafiscal_id!='0' THEN 1 ELSE 0 END) AS withNF,
             SUM(CASE WHEN notafiscal_id IS NOT NULL AND notafiscal_id!='' AND notafiscal_id!='0' THEN total ELSE 0 END) AS revenueNF
      FROM (${union}) t`);
    conn.release();

    const tot = parseInt(r.total)||0;
    const nf  = parseInt(r.withNF)||0;
    res.json({ metrics:{
      totalOrders: tot, ordersWithNF: nf, ordersWithoutNF: tot-nf,
      totalRevenue:       parseFloat((r.revenue||0).toFixed(2)),
      totalRevenueWithNF: parseFloat((r.revenueNF||0).toFixed(2)),
      averageTicket:      tot>0 ? parseFloat((r.revenue/tot).toFixed(2)):0,
      averageTicketWithNF:nf>0  ? parseFloat((r.revenueNF/nf).toFixed(2)):0,
      nfConversionRate:   tot>0 ? parseFloat(((nf/tot)*100).toFixed(2)):0
    }});
  } catch (err) {
    logger.error('campaign: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 404 → frontend ────────────────────────────────────────────
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, _req, res, _next) =>
  res.status(500).json({ error: err.message }));

// ── Start ─────────────────────────────────────────────────────
pool.getConnection()
  .then(c => { c.release(); app.listen(PORT, () => console.log(`🚀 :${PORT}`)); })
  .catch(err => { logger.error(err.message); process.exit(1); });
