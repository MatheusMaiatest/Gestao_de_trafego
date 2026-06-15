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

// Servir static ANTES das rotas API para não interferir
app.use(express.static(path.join(__dirname, 'public')));

// ── Nomes que NÃO são clientes reais (unidades de venda) ───────
const NOT_CLIENTS = [
  'loja fisica','loja física','e-commerce','ecommerce','distribuidor',
  'distribuicao','distribuição','marketplace','consumidor final','pdv',
  'online cosmeticos','online cosméticos','mercado livre'
];
function isNotClient(name) {
  if (!name) return true;
  const n = name.toLowerCase().trim();
  return NOT_CLIENTS.some(x => n === x || n.startsWith(x + ' ') || n.includes('loja fisica') || n.includes('loja física') || n === 'ecommerce' || n === 'e-commerce');
}

// ── Helper UNION SQL ──────────────────────────────────────────
function unionSQL(bu, cols, extra = '') {
  const eco  = `SELECT ${cols}, 'ecommerce' AS origem FROM \`bling_pedidos_venda_detalhes_ecommerce\` ${extra}`;
  const dist = `SELECT ${cols}, 'distribuicao' AS origem FROM \`bling_pedidos_venda_detalhes_distribuicao\` ${extra}`;
  if (bu === 'ecommerce')                            return eco;
  if (bu === 'distributor' || bu === 'distribuidor') return dist;
  return `(${eco}) UNION ALL (${dist})`;
}

// ── Corrigir datas vindas do MySQL ────────────────────────────
function safeDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0,10);
  const s = String(d);
  if (s === 'Invalid Date' || s === '0000-00-00') return null;
  // MySQL retorna Date objects ou strings "YYYY-MM-DD"
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0,10);
}

// ══════════════════════════════════════════════════════════════
// ROTAS API — todas começam com /api/
// ══════════════════════════════════════════════════════════════

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'OK', uptime: process.uptime() }));

// ── Debug ─────────────────────────────────────────────────────
app.get('/api/debug/tables', async (_req, res) => {
  try {
    const conn = await pool.getConnection();
    const [r] = await conn.execute('SHOW TABLES'); conn.release();
    res.json(r);
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.get('/api/debug/columns/:t', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [r] = await conn.execute(`DESCRIBE \`${req.params.t}\``);
    conn.release(); res.json(r);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── DASHBOARD KPIs ────────────────────────────────────────────
app.get('/api/dashboard/kpis', async (req, res) => {
  const { startDate, endDate, businessUnit: bu = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();

    const union = unionSQL(bu,
      `contato_id, total, data`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}'`);

    const [[kpi]] = await conn.execute(`
      SELECT COUNT(*) AS totalOrders,
             COUNT(DISTINCT contato_id) AS activeClients,
             COALESCE(SUM(total),0) AS totalRevenue,
             COALESCE(AVG(total),0) AS averageTicket
      FROM (${union}) t
      WHERE contato_id IS NOT NULL`);

    const unionAll = unionSQL('all', `contato_id, data`, '');
    const [[novos]] = await conn.execute(`
      SELECT COUNT(*) AS total FROM (
        SELECT contato_id FROM (${unionAll}) t
        WHERE contato_id IS NOT NULL
        GROUP BY contato_id
        HAVING MIN(data) BETWEEN '${startDate}' AND '${endDate}'
      ) n`);

    const [[inat]] = await conn.execute(`
      SELECT COUNT(DISTINCT contato_id) AS total
      FROM (${unionSQL('all','contato_id','')}) t
      WHERE contato_id IS NOT NULL
        AND contato_id NOT IN (
          SELECT DISTINCT contato_id
          FROM (${unionSQL('all','contato_id',`WHERE data >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`)}) a
          WHERE contato_id IS NOT NULL
        )`);

    conn.release();
    const active = parseInt(kpi.activeClients)||0;
    const orders = parseInt(kpi.totalOrders)||0;
    res.json({
      period: { startDate, endDate }, businessUnit: bu,
      totalClients: active, activeClients: active,
      inactiveClients: parseInt(inat.total)||0,
      newClients: parseInt(novos.total)||0,
      totalRevenue: parseFloat((kpi.totalRevenue||0).toFixed(2)),
      averageTicket: parseFloat((kpi.averageTicket||0).toFixed(2)),
      totalOrders: orders,
      averagePurchaseFrequency: active > 0 ? parseFloat((orders/active).toFixed(2)) : 0
    });
  } catch (err) {
    logger.error('kpis: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENTES ──────────────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
  const { startDate, endDate, businessUnit: bu = 'all',
          page = 1, limit = 500, search } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });

  let where = `WHERE data BETWEEN '${startDate}' AND '${endDate}'`;
  if (search) {
    const s = search.replace(/'/g,"''");
    where += ` AND (contato_nome LIKE '%${s}%' OR contato_numerodocumento LIKE '%${s}%' OR numero LIKE '%${s}%')`;
  }

  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `contato_id,
       MAX(contato_nome) AS name,
       MAX(contato_numerodocumento) AS cpf,
       MAX(contato_tipopessoa) AS tipoPessoa,
       MAX(NULLIF(TRIM(transporte_etiqueta_municipio),'')) AS city,
       MAX(NULLIF(TRIM(transporte_etiqueta_uf),'')) AS stateUF,
       MAX(NULLIF(TRIM(kdd_cliente_estado),'')) AS state,
       MIN(data) AS firstPurchaseDate,
       MAX(data) AS lastPurchaseDate,
       COUNT(*) AS totalOrders,
       COALESCE(SUM(total),0) AS totalSpent,
       COALESCE(AVG(total),0) AS averageTicket`,
      `${where} GROUP BY contato_id`);

    const [rows] = await conn.execute(
      `SELECT * FROM (${union}) c WHERE contato_id IS NOT NULL ORDER BY totalSpent DESC`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      if (!r.contato_id || isNotClient(r.name)) return;
      const key = r.contato_id;
      if (!map.has(key)) {
        map.set(key, {
          id: r.contato_id,
          name: r.name,
          cpf: r.cpf,
          tipoPessoa: r.tipoPessoa,
          city: r.city || r.state,
          state: r.stateUF || r.state,
          businessUnit: r.origem,
          firstPurchaseDate: safeDate(r.firstPurchaseDate),
          lastPurchaseDate: safeDate(r.lastPurchaseDate),
          totalOrders: parseInt(r.totalOrders)||0,
          totalSpent: parseFloat(r.totalSpent)||0,
          averageTicket: parseFloat(r.averageTicket)||0,
          _origens: new Set([r.origem])
        });
      } else {
        const ex = map.get(key);
        ex.totalOrders += parseInt(r.totalOrders)||0;
        ex.totalSpent  += parseFloat(r.totalSpent)||0;
        ex._origens.add(r.origem);
        // Manter data mais antiga como primeira compra
        if (r.firstPurchaseDate && safeDate(r.firstPurchaseDate) < ex.firstPurchaseDate)
          ex.firstPurchaseDate = safeDate(r.firstPurchaseDate);
        // Manter data mais recente como última compra
        if (r.lastPurchaseDate && safeDate(r.lastPurchaseDate) > ex.lastPurchaseDate)
          ex.lastPurchaseDate = safeDate(r.lastPurchaseDate);
      }
    });

    const all = [...map.values()].map(c => {
      const bothUnits = c._origens.size > 1;
      const bu2 = bothUnits ? 'both' : c.businessUnit;
      delete c._origens;
      return { ...c, businessUnit: bu2,
               averageTicket: c.totalOrders > 0 ? parseFloat((c.totalSpent/c.totalOrders).toFixed(2)) : 0 };
    }).sort((a,b) => b.totalSpent - a.totalSpent);

    const lim = parseInt(limit);
    const off = (parseInt(page)-1) * lim;
    res.json({ clients: all.slice(off, off+lim), total: all.length,
               page: parseInt(page), pages: Math.ceil(all.length/lim) });
  } catch (err) {
    logger.error('clients: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENTE por ID — retorna detalhes + pedidos ───────────────
app.get('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ID obrigatório.' });

  try {
    const conn = await pool.getConnection();

    // Buscar dados do cliente nas duas tabelas
    const [rowsE] = await conn.execute(
      `SELECT contato_id AS id, MAX(contato_nome) AS name,
              MAX(contato_numerodocumento) AS cpf,
              MAX(contato_tipopessoa) AS tipoPessoa,
              MAX(transporte_etiqueta_municipio) AS city,
              MAX(transporte_etiqueta_uf) AS stateUF,
              MAX(transporte_etiqueta_bairro) AS bairro,
              MAX(transporte_etiqueta_endereco) AS endereco,
              MAX(transporte_etiqueta_cep) AS cep,
              MIN(data) AS firstPurchaseDate,
              MAX(data) AS lastPurchaseDate,
              COUNT(*) AS totalOrders,
              COALESCE(SUM(total),0) AS totalSpent
       FROM bling_pedidos_venda_detalhes_ecommerce
       WHERE contato_id = ?
       GROUP BY contato_id`,
      [id]
    );

    const [rowsD] = await conn.execute(
      `SELECT contato_id AS id, MAX(contato_nome) AS name,
              MAX(contato_numerodocumento) AS cpf,
              MAX(contato_tipopessoa) AS tipoPessoa,
              MAX(transporte_etiqueta_municipio) AS city,
              MAX(transporte_etiqueta_uf) AS stateUF,
              MAX(transporte_etiqueta_bairro) AS bairro,
              MAX(transporte_etiqueta_endereco) AS endereco,
              MAX(transporte_etiqueta_cep) AS cep,
              MIN(data) AS firstPurchaseDate,
              MAX(data) AS lastPurchaseDate,
              COUNT(*) AS totalOrders,
              COALESCE(SUM(total),0) AS totalSpent
       FROM bling_pedidos_venda_detalhes_distribuicao
       WHERE contato_id = ?
       GROUP BY contato_id`,
      [id]
    );

    if (!rowsE.length && !rowsD.length) {
      conn.release();
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    // Mesclar dados
    const eco  = rowsE[0] || {};
    const dist = rowsD[0] || {};
    const both = rowsE.length > 0 && rowsD.length > 0;

    const client = {
      id,
      name: eco.name || dist.name,
      cpf: eco.cpf || dist.cpf,
      tipoPessoa: eco.tipoPessoa || dist.tipoPessoa,
      city: eco.city || dist.city,
      state: eco.stateUF || dist.stateUF,
      bairro: eco.bairro || dist.bairro,
      endereco: eco.endereco || dist.endereco,
      cep: eco.cep || dist.cep,
      businessUnit: both ? 'both' : (rowsE.length ? 'ecommerce' : 'distribuicao'),
      firstPurchaseDate: safeDate(
        (!eco.firstPurchaseDate || (dist.firstPurchaseDate && dist.firstPurchaseDate < eco.firstPurchaseDate))
          ? dist.firstPurchaseDate : eco.firstPurchaseDate
      ),
      lastPurchaseDate: safeDate(
        (!eco.lastPurchaseDate || (dist.lastPurchaseDate && dist.lastPurchaseDate > eco.lastPurchaseDate))
          ? dist.lastPurchaseDate : eco.lastPurchaseDate
      ),
      totalOrders: (parseInt(eco.totalOrders)||0) + (parseInt(dist.totalOrders)||0),
      totalSpent: (parseFloat(eco.totalSpent)||0) + (parseFloat(dist.totalSpent)||0),
    };
    client.averageTicket = client.totalOrders > 0
      ? parseFloat((client.totalSpent / client.totalOrders).toFixed(2)) : 0;

    // Buscar pedidos (últimos 100)
    const [pedidosE] = await conn.execute(
      `SELECT id, numero, data, total, situacao_nome, notafiscal_id, 'ecommerce' AS origem
       FROM bling_pedidos_venda_detalhes_ecommerce
       WHERE contato_id = ? ORDER BY data DESC LIMIT 50`, [id]
    );
    const [pedidosD] = await conn.execute(
      `SELECT id, numero, data, total, situacao_nome, notafiscal_id, 'distribuicao' AS origem
       FROM bling_pedidos_venda_detalhes_distribuicao
       WHERE contato_id = ? ORDER BY data DESC LIMIT 50`, [id]
    );

    // Buscar email via clientes_tray
    let email = null;
    const [[trayE]] = await conn.execute(
      `SELECT email FROM clientes_tray_ecommerce WHERE id = ? LIMIT 1`, [id]
    ).catch(() => [[]]);
    const [[trayD]] = await conn.execute(
      `SELECT email FROM clientes_tray_distribuicao WHERE id = ? LIMIT 1`, [id]
    ).catch(() => [[]]);
    email = trayE?.email || trayD?.email || null;

    const pedidos = [...pedidosE, ...pedidosD]
      .sort((a,b) => new Date(b.data) - new Date(a.data))
      .map(p => ({
        id: p.id,
        numero: p.numero,
        data: safeDate(p.data),
        total: parseFloat(p.total)||0,
        situacao: p.situacao_nome,
        origem: p.origem
      }));

    conn.release();
    res.json({ ...client, email, pedidos });
  } catch (err) {
    logger.error('clients/:id: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PEDIDO por ID — retorna detalhes completos com desmembramento de kits ────
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const conn = await pool.getConnection();

    // Buscar nas duas tabelas
    const [[pedE]] = await conn.execute(
      `SELECT p.*, 'ecommerce' AS origem
       FROM bling_pedidos_venda_detalhes_ecommerce p WHERE p.id = ?`, [id]
    ).catch(() => [[]]);

    const [[pedD]] = await conn.execute(
      `SELECT p.*, 'distribuicao' AS origem
       FROM bling_pedidos_venda_detalhes_distribuicao p WHERE p.id = ?`, [id]
    ).catch(() => [[]]);

    const ped = pedE || pedD;
    if (!ped) { conn.release(); return res.status(404).json({ error: 'Pedido não encontrado.' }); }

    const origem = ped.origem;
    const itensTable   = origem === 'ecommerce'
      ? 'bling_pedidos_venda_detalhes_itens_ecommerce'
      : 'bling_pedidos_venda_detalhes_itens_distribuicao';
    const prodTable    = origem === 'ecommerce'
      ? 'bling_produtos_detalhes_ecommerce'
      : 'bling_produtos_detalhes_distribuicao';
    const compTable    = origem === 'ecommerce'
      ? 'bling_produtos_estruturas_componentes_ecommerce'
      : 'bling_produtos_estruturas_componentes_distribuicao';

    // Buscar itens do pedido
    const [itensRaw] = await conn.execute(
      `SELECT i.itens_codigo AS sku,
              i.itens_id AS id,
              i.itens_produto_id AS produto_id,
              p.nome AS nome_produto,
              i.itens_quantidade AS quantidade,
              i.itens_valor AS precoUnitario,
              i.itens_desconto AS desconto,
              (i.itens_valor * i.itens_quantidade) AS total
       FROM \`${itensTable}\` i
       LEFT JOIN \`${prodTable}\` p ON p.id = i.itens_produto_id
       WHERE i.pedido_venda_id = ?`, [id]
    ).catch(() => [[]]);

    // Buscar componentes (kits) de todos os produto_ids presentes
    const prodIds = (itensRaw||[]).map(i => i.produto_id).filter(Boolean);
    let kitMap = {};

    if (prodIds.length > 0) {
      const ph = prodIds.map(() => '?').join(',');
      const [comps] = await conn.execute(
        `SELECT c.produto_pai_id, c.componentes_produto_id, c.componentes_quantidade,
                p.codigo AS comp_sku, p.nome AS comp_nome
         FROM \`${compTable}\` c
         JOIN \`${prodTable}\` p ON p.id = c.componentes_produto_id
         WHERE c.produto_pai_id IN (${ph})`, prodIds
      ).catch(() => [[]]);

      (comps||[]).forEach(c => {
        if (!kitMap[c.produto_pai_id]) kitMap[c.produto_pai_id] = [];
        kitMap[c.produto_pai_id].push({
          sku: c.comp_sku,
          nome: c.comp_nome,
          qtdPorKit: parseFloat(c.componentes_quantidade)||1
        });
      });
    }

    // Expandir kits em itens individuais
    const itens = [];
    (itensRaw||[]).forEach(i => {
      const comps = i.produto_id ? kitMap[i.produto_id] : null;
      const qtdPedida = parseFloat(i.quantidade)||1;

      if (comps && comps.length > 0) {
        // É um kit — desmembrar em componentes
        comps.forEach(c => {
          const qtdComp = c.qtdPorKit * qtdPedida;
          itens.push({
            sku: c.sku || i.sku,
            descricao: c.nome || c.sku,
            quantidade: qtdComp,
            precoUnitario: 0, // preço distribuído no kit
            desconto: 0,
            total: 0,
            isComponente: true,
            kitOrigem: i.nome_produto || i.sku
          });
        });
      } else {
        // Item simples
        itens.push({
          sku: i.sku,
          descricao: i.nome_produto || i.sku,
          quantidade: qtdPedida,
          precoUnitario: parseFloat(i.precoUnitario)||0,
          desconto: parseFloat(i.desconto)||0,
          total: parseFloat(i.total)||0
        });
      }
    });

    // Buscar email do cliente via clientes_tray_ecommerce
    let email = null;
    if (ped.contato_id) {
      const trayTable = origem === 'ecommerce' ? 'clientes_tray_ecommerce' : 'clientes_tray_distribuicao';
      const [[tray]] = await conn.execute(
        `SELECT email FROM \`${trayTable}\` WHERE id = ? LIMIT 1`,
        [ped.contato_id]
      ).catch(() => [[]]);
      email = tray?.email || null;
    }

    conn.release();

    res.json({
      id: ped.id,
      numero: ped.numero,
      data: safeDate(ped.data),
      dataSaida: safeDate(ped.datasaida),
      total: parseFloat(ped.total)||0,
      totalProdutos: parseFloat(ped.totalprodutos)||0,
      desconto: parseFloat(ped.desconto_valor)||0,
      frete: parseFloat(ped.transporte_frete)||0,
      situacao: ped.situacao_nome,
      origem,
      cliente: ped.contato_nome,
      cpf: ped.contato_numerodocumento,
      email,
      cidade: ped.transporte_etiqueta_municipio || ped.kdd_cliente_estado,
      estado: ped.transporte_etiqueta_uf || ped.kdd_cliente_estado,
      cep: ped.transporte_etiqueta_cep,
      bairro: ped.transporte_etiqueta_bairro,
      endereco: ped.transporte_etiqueta_endereco,
      transportadora: ped.transporte_contato_nome,
      itens
    });
  } catch (err) {
    logger.error('orders/:id: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SEGMENTOS ─────────────────────────────────────────────────
app.get('/api/segments', async (req, res) => {
  const { startDate, endDate, businessUnit: bu = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `contato_id, contato_nome, data, total`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}'`);

    const [rows] = await conn.execute(
      `SELECT * FROM (${union}) t WHERE contato_id IS NOT NULL`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      if (isNotClient(r.contato_nome)) return;
      if (!map.has(r.contato_id)) {
        map.set(r.contato_id, { orders:0, spent:0, firstDate:r.data, lastDate:r.data });
      }
      const c = map.get(r.contato_id);
      c.orders++;
      c.spent += parseFloat(r.total||0);
      if (r.data && r.data < c.firstDate) c.firstDate = r.data;
      if (r.data && r.data > c.lastDate)  c.lastDate  = r.data;
    });

    const clients  = [...map.values()];
    const total    = clients.length;
    const vipLimit = Math.ceil(total * 0.1);
    const sorted   = [...clients].sort((a,b) => b.spent - a.spent);
    const now      = new Date();
    const sd = new Date(startDate), ed = new Date(endDate);

    const vip        = vipLimit;
    const recorrente = clients.filter(c => c.orders >= 3).length;
    const novo       = clients.filter(c => {
      const fp = new Date(c.firstDate);
      return fp >= sd && fp <= ed;
    }).length;
    const inativo = clients.filter(c => c.lastDate &&
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
  const validTypes = ['vip','recorrente','novo','inativo','em_risco'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `contato_id, MAX(contato_nome) AS name,
       MAX(kdd_cliente_estado) AS state,
       MAX(transporte_etiqueta_municipio) AS city,
       MAX(transporte_etiqueta_uf) AS stateUF,
       MIN(data) AS firstDate, MAX(data) AS lastDate,
       COUNT(*) AS orders, COALESCE(SUM(total),0) AS spent`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}' GROUP BY contato_id`);

    const [rows] = await conn.execute(
      `SELECT * FROM (${union}) t WHERE contato_id IS NOT NULL`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      if (isNotClient(r.name)) return;
      const key = r.contato_id;
      if (!map.has(key)) {
        map.set(key, {
          id: key, name: r.name,
          city: r.city, state: r.stateUF || r.state,
          orderCount: parseInt(r.orders)||0,
          totalSpent: parseFloat(r.spent)||0,
          firstDate: safeDate(r.firstDate),
          lastDate: safeDate(r.lastDate),
          daysSince: r.lastDate ? Math.floor((Date.now()-new Date(r.lastDate))/86400000) : null,
          businessUnit: r.origem
        });
      } else {
        const ex = map.get(key);
        ex.orderCount += parseInt(r.orders)||0;
        ex.totalSpent += parseFloat(r.spent)||0;
      }
    });

    const clients  = [...map.values()];
    const vipLimit = Math.ceil(clients.length * 0.1);
    const sorted   = [...clients].sort((a,b) => b.totalSpent - a.totalSpent);
    const sd = new Date(startDate), ed = new Date(endDate);

    let filtered = [];
    if (type==='vip')        filtered = sorted.slice(0, vipLimit);
    if (type==='recorrente') filtered = clients.filter(c => c.orderCount >= 3);
    if (type==='novo')       filtered = clients.filter(c => {
      const fp = c.firstDate ? new Date(c.firstDate) : null;
      return fp && fp >= sd && fp <= ed;
    });
    if (type==='inativo')    filtered = clients.filter(c => c.daysSince !== null && c.daysSince > 90);
    if (type==='em_risco')   filtered = clients.filter(c => c.daysSince !== null && c.daysSince > 30 && c.daysSince <= 90);

    res.json({ segment:type, customerCount:filtered.length, customers:filtered });
  } catch (err) {
    logger.error('segments/customers: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── RFM ───────────────────────────────────────────────────────
app.get('/api/rfm/distribution', async (req, res) => {
  const { startDate, endDate, businessUnit: bu = 'all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `contato_id, MAX(contato_nome) AS contato_nome,
       DATEDIFF(CURDATE(),MAX(data)) AS recency,
       COUNT(*) AS frequency,
       COALESCE(SUM(total),0) AS monetary`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}' GROUP BY contato_id`);

    const [rows] = await conn.execute(
      `SELECT * FROM (${union}) t WHERE contato_id IS NOT NULL`);
    conn.release();

    if (!rows.length) return res.json({ distribution:[] });

    const calcQ = arr => {
      const s = [...arr].sort((a,b)=>a-b);
      return [1,2,3,4,5].map(i => s[Math.ceil((i/5)*s.length)-1]);
    };
    const score = (v,q) => { for(let i=0;i<q.length;i++) if(v<=q[i]) return i+1; return 5; };

    const map = new Map();
    rows.forEach(r => {
      if (isNotClient(r.contato_nome)) return;
      const key = r.contato_id;
      if (!map.has(key)) {
        map.set(key, { r:parseInt(r.recency)||0, f:parseInt(r.frequency)||0, m:parseFloat(r.monetary)||0 });
      } else {
        const ex = map.get(key);
        ex.f += parseInt(r.frequency)||0;
        ex.m += parseFloat(r.monetary)||0;
      }
    });

    const data = [...map.values()];
    if (!data.length) return res.json({ distribution:[] });

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

// ── PRODUTOS ──────────────────────────────────────────────────
app.get('/api/products/top-selling', async (req, res) => {
  const { orderBy='quantity', limit=20, businessUnit:bu='all', startDate, endDate } = req.query;
  const cols = `itens_codigo AS code, SUM(itens_quantidade) AS qty,
                SUM(itens_valor*itens_quantidade) AS revenue,
                COUNT(DISTINCT pedido_venda_id) AS orders`;
  const where = startDate && endDate
    ? `WHERE pedido_data BETWEEN '${startDate}' AND '${endDate}' GROUP BY itens_codigo`
    : 'GROUP BY itens_codigo';

  const eco  = `SELECT ${cols}, 'ecommerce' AS origem FROM bling_pedidos_venda_detalhes_itens_ecommerce ${where}`;
  const dist = `SELECT ${cols}, 'distribuicao' AS origem FROM bling_pedidos_venda_detalhes_itens_distribuicao ${where}`;
  const union = bu==='ecommerce' ? eco : bu==='distributor'||bu==='distribuidor' ? dist : `(${eco}) UNION ALL (${dist})`;

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(`SELECT * FROM (${union}) t WHERE code IS NOT NULL`);
    conn.release();

    const map = new Map();
    rows.forEach(r => {
      if (!r.code) return;
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

// ── GEOLOCALIZAÇÃO ────────────────────────────────────────────
app.get('/api/geolocation/states', async (req, res) => {
  const { startDate, endDate, businessUnit:bu='all' } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
  try {
    const conn = await pool.getConnection();
    const union = unionSQL(bu,
      `kdd_cliente_estado AS state,
       COUNT(DISTINCT contato_id) AS customers,
       COALESCE(SUM(total),0) AS revenue,
       COUNT(*) AS orders`,
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
      `transporte_etiqueta_municipio AS city,
       kdd_cliente_estado AS state,
       COUNT(DISTINCT contato_id) AS customers,
       COALESCE(SUM(total),0) AS revenue,
       COUNT(*) AS orders`,
      `WHERE data BETWEEN '${startDate}' AND '${endDate}'
       AND transporte_etiqueta_municipio IS NOT NULL
       AND transporte_etiqueta_municipio != ''
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

// ── CAMPANHAS ─────────────────────────────────────────────────
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

// ── 404 API ───────────────────────────────────────────────────
// Rotas /api/ que não existem retornam JSON, nunca HTML
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

// ── SPA fallback — DEVE vir DEPOIS de todas as rotas /api/ ───
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, _req, res, _next) =>
  res.status(500).json({ error: err.message }));

// ── Start ─────────────────────────────────────────────────────
pool.getConnection()
  .then(c => { c.release(); app.listen(PORT, () => console.log(`🚀 :${PORT}`)); })
  .catch(err => { logger.error(err.message); process.exit(1); });
