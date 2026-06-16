/**
 * Varredura UI — clica elementos, captura logs e screenshots
 * Uso: node scripts/sweep-ui.mjs [url]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'resultado varredura');
const BASE_URL = process.argv[2] || 'https://gestao-de-trafego.onrender.com';

const logs = [];
const networkErrors = [];
const apiCalls = [];
const clickResults = [];
let shotNum = 0;

function log(type, msg, extra = {}) {
  const entry = { ts: new Date().toISOString(), type, msg, ...extra };
  logs.push(entry);
  console.log(`[${type}] ${msg}`);
}

async function screenshot(page, name) {
  shotNum++;
  const safe = String(name).replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
  const file = `${String(shotNum).padStart(2, '0')}_${safe}.png`;
  const full = path.join(OUT, file);
  await page.screenshot({ path: full, fullPage: true });
  log('SCREEN', file);
  return file;
}

async function safeClick(page, label, selectorOrFn) {
  try {
    if (typeof selectorOrFn === 'function') {
      await selectorOrFn();
    } else {
      const el = page.locator(selectorOrFn).first();
      await el.waitFor({ state: 'visible', timeout: 8000 });
      await el.scrollIntoViewIfNeeded();
      await el.click({ timeout: 5000 });
    }
    await page.waitForTimeout(1200);
    clickResults.push({ label, status: 'ok' });
    log('CLICK', label, { status: 'ok' });
    return true;
  } catch (e) {
    clickResults.push({ label, status: 'fail', error: e.message });
    log('CLICK_FAIL', label, { error: e.message });
    return false;
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  log('INFO', `URL alvo: ${BASE_URL}`);
  log('INFO', `Pasta saída: ${OUT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    logs.push({
      ts: new Date().toISOString(),
      type: 'CONSOLE_' + msg.type().toUpperCase(),
      msg: msg.text(),
      location: msg.location(),
    });
  });

  page.on('pageerror', (err) => {
    logs.push({ ts: new Date().toISOString(), type: 'PAGE_ERROR', msg: err.message, stack: err.stack });
  });

  page.on('requestfailed', (req) => {
    networkErrors.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText,
    });
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('/health')) {
      const entry = {
        url,
        status: res.status(),
        ok: res.ok(),
        method: res.request().method(),
      };
      if (!res.ok()) {
        try {
          entry.body = (await res.text()).slice(0, 500);
        } catch (_) {}
      }
      apiCalls.push(entry);
    }
  });

  // ── Carregar app ──
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });
  } catch (e) {
    log('ERROR', 'Falha ao carregar página inicial', { error: e.message });
    await screenshot(page, '00_erro_carga');
  }

  await page.waitForTimeout(3000);
  await screenshot(page, '01_dashboard_inicial');

  // ── DASHBOARD ──
  await safeClick(page, 'Dashboard Buscar', '.btn-search');
  await screenshot(page, '02_dashboard_apos_buscar');

  await safeClick(page, 'Unidade E-commerce', 'button.ubtn.eco');
  await safeClick(page, 'Dashboard Buscar eco', '.btn-search');
  await screenshot(page, '03_dashboard_ecommerce');

  await safeClick(page, 'Unidade Distribuidor', 'button.ubtn.dist');
  await safeClick(page, 'Dashboard Buscar dist', '.btn-search');
  await screenshot(page, '04_dashboard_distribuidor');

  await safeClick(page, 'Unidade Todos', 'button.ubtn[data-bu="all"]');
  await safeClick(page, 'Dashboard Buscar all', '.btn-search');
  await page.waitForTimeout(2000);

  // Gráficos modais
  for (const [sel, name] of [
    ['.chart-card:nth-of-type(1)', 'modal_rfm'],
    ['.chart-card:nth-of-type(2)', 'modal_segmentos'],
    ['.chart-card:nth-of-type(3)', 'modal_produtos'],
  ]) {
    if (await safeClick(page, `Abrir ${name}`, sel)) {
      await screenshot(page, `05_${name}_aberto`);
      await safeClick(page, `Fechar ${name}`, '#ov-chart .modal-close');
      await page.waitForTimeout(500);
    }
  }

  // Tema
  await safeClick(page, 'Toggle tema', '.theme-btn');
  await screenshot(page, '06_tema_alternado');
  await safeClick(page, 'Toggle tema volta', '.theme-btn');
  await page.waitForTimeout(500);

  // Mapa drill-down (clicar SP se existir)
  try {
    const statePath = page.locator('.state-path').first();
    if (await statePath.count()) {
      await statePath.click({ timeout: 5000 });
      await page.waitForTimeout(2500);
      await screenshot(page, '07_drill_estado');
      await safeClick(page, 'Fechar drill', '#ov-drill .modal-close');
    }
  } catch (e) {
    log('CLICK_FAIL', 'Drill mapa estado', { error: e.message });
  }

  // ── ABA CLIENTES ──
  await safeClick(page, 'Tab Clientes', 'button.tab:nth-child(2)');
  await page.waitForTimeout(2500);
  await screenshot(page, '08_clientes_inicial');

  await safeClick(page, 'Clientes Buscar', '#tab-clientes .btn-search');
  await page.waitForTimeout(3000);
  await screenshot(page, '09_clientes_apos_buscar');

  // Filtro segmento
  await page.selectOption('#c-seg', 'vip');
  await safeClick(page, 'Clientes Buscar VIP', '#tab-clientes .btn-search');
  await page.waitForTimeout(2000);
  await screenshot(page, '10_clientes_vip');

  await page.selectOption('#c-seg', '');
  await safeClick(page, 'Clientes Buscar todos', '#tab-clientes .btn-search');
  await page.waitForTimeout(2000);

  // Abrir modal cliente se houver link
  try {
    const link = page.locator('.client-link').first();
    if (await link.count()) {
      await link.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      await screenshot(page, '11_modal_cliente');
      // Abrir pedido se houver
      const orderItem = page.locator('.order-item').first();
      if (await orderItem.count()) {
        await orderItem.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        await screenshot(page, '12_modal_pedido');
        await safeClick(page, 'Fechar pedido', '#ov-pedido .modal-close');
      }
      await safeClick(page, 'Fechar cliente', '#ov-cliente .modal-close');
    }
  } catch (e) {
    log('CLICK_FAIL', 'Modal cliente/pedido', { error: e.message });
  }

  // Paginação clientes
  const pagBtn = page.locator('#c-pag .pag-btn').filter({ hasText: '2' }).first();
  if (await pagBtn.count()) {
    await pagBtn.click().catch(() => {});
    await page.waitForTimeout(800);
    await screenshot(page, '13_clientes_pagina2');
  }

  // ── ABA RELATÓRIOS ──
  await safeClick(page, 'Tab Relatórios', 'button.tab:nth-child(3)');
  await page.waitForTimeout(1500);
  await screenshot(page, '14_relatorios_inicial');

  const rptCards = [
    ['meta', 'Meta Ads'],
    ['google', 'Google Ads'],
    ['completo', 'Clientes Completo'],
    ['top', 'Top Clientes'],
    ['inativos', 'Inativos'],
    ['rfm', 'RFM'],
    ['geo', 'Geo'],
  ];

  for (const [type, name] of rptCards) {
    try {
      await page.evaluate((t) => previewRpt(t), type);
      await page.waitForTimeout(3500);
      await screenshot(page, `15_relatorio_${type}`);
    } catch (e) {
      log('CLICK_FAIL', `Relatório ${name}`, { error: e.message });
    }
  }

  // ── ABA DISPARO ──
  await safeClick(page, 'Tab Disparo', 'button.tab:nth-child(4)');
  await page.waitForTimeout(1000);
  await screenshot(page, '16_disparo_inicial');

  for (const seg of ['inativo', 'em_risco', 'vip', 'recorrente', 'novo']) {
    await page.locator(`input[name="dm-seg"][value="${seg}"]`).click().catch(() => {});
    await safeClick(page, `Disparo Identificar ${seg}`, '#tab-disparo .btn-apply');
    await page.waitForTimeout(2500);
    await screenshot(page, `17_disparo_${seg}`);
  }

  // ── Health check explícito ──
  try {
    const health = await page.evaluate(async () => {
      const r = await fetch('/health');
      return { status: r.status, body: await r.json() };
    });
    log('HEALTH', JSON.stringify(health));
  } catch (e) {
    log('HEALTH_FAIL', e.message);
  }

  await screenshot(page, '99_final');

  await browser.close();

  // ── Diagnóstico ──
  const consoleErrors = logs.filter((l) =>
    ['CONSOLE_ERROR', 'PAGE_ERROR', 'CLICK_FAIL', 'ERROR', 'HEALTH_FAIL'].includes(l.type) ||
    l.type === 'CONSOLE_WARNING'
  );
  const failedApis = apiCalls.filter((a) => !a.ok);
  const okClicks = clickResults.filter((c) => c.status === 'ok').length;
  const failClicks = clickResults.filter((c) => c.status === 'fail').length;

  const diag = {
    url: BASE_URL,
    dataExecucao: new Date().toISOString(),
    resumo: {
      screenshots: shotNum,
      cliquesOk: okClicks,
      cliquesFalha: failClicks,
      errosConsole: logs.filter((l) => l.type === 'CONSOLE_ERROR' || l.type === 'PAGE_ERROR').length,
      avisosConsole: logs.filter((l) => l.type === 'CONSOLE_WARNING').length,
      apisChamadas: apiCalls.length,
      apisComErro: failedApis.length,
      errosRede: networkErrors.length,
    },
    cliques: clickResults,
    apis: apiCalls,
    apisComErro: failedApis,
    errosRede: networkErrors,
    errosConsole: consoleErrors,
    todosLogs: logs,
  };

  const statusGeral =
    failedApis.length === 0 && failClicks === 0 && diag.resumo.errosConsole === 0
      ? 'OK'
      : failedApis.length > 0 || diag.resumo.errosConsole > 0
        ? 'COM_ERROS'
        : 'AVISOS';

  const md = `# Diagnóstico — Varredura UI

**URL:** ${BASE_URL}  
**Data:** ${diag.dataExecucao}  
**Status geral:** ${statusGeral}

## Resumo

| Métrica | Valor |
|---------|-------|
| Screenshots | ${shotNum} |
| Cliques OK | ${okClicks} |
| Cliques falha | ${failClicks} |
| Erros console/página | ${diag.resumo.errosConsole} |
| Avisos console | ${diag.resumo.avisosConsole} |
| Chamadas API | ${apiCalls.length} |
| APIs com erro HTTP | ${failedApis.length} |
| Falhas de rede | ${networkErrors.length} |

## Abas testadas

1. **Dashboard** — Buscar, filtros unidade, modais RFM/Segmentos/Produtos, tema, mapa drill-down
2. **Clientes** — Buscar, filtro VIP, modal cliente/pedido, paginação
3. **Relatórios** — Meta, Google, Completo, Top, Inativos, RFM, Geo
4. **Disparo** — Segmentos inativo, em_risco, vip, recorrente, novo

## APIs com erro

${failedApis.length ? failedApis.map((a) => `- \`${a.method} ${a.url}\` → **${a.status}** ${a.body || ''}`).join('\n') : '_Nenhuma_'}

## Cliques com falha

${failClicks ? clickResults.filter((c) => c.status === 'fail').map((c) => `- **${c.label}:** ${c.error}`).join('\n') : '_Nenhum_'}

## Erros de rede

${networkErrors.length ? networkErrors.map((n) => `- ${n.method} ${n.url}: ${n.failure}`).join('\n') : '_Nenhum_'}

## Erros / avisos console

${consoleErrors.length ? consoleErrors.slice(0, 30).map((e) => `- [${e.type}] ${e.msg}`).join('\n') : '_Nenhum_'}

## Observações

- App hospedado no Render: \`gestao-de-trafego.onrender.com\`
- Health check: \`/health\`
- Frontend SPA em \`public/index.html\` com API relativa \`/api\`

## Arquivos gerados

Screenshots numerados \`01_*.png\` … \`99_*.png\` nesta pasta.  
Log completo em \`logs.json\`.
`;

  fs.writeFileSync(path.join(OUT, 'DIAGNOSTICO.md'), md, 'utf8');
  fs.writeFileSync(path.join(OUT, 'logs.json'), JSON.stringify(diag, null, 2), 'utf8');

  console.log('\n=== VARREDURA CONCLUÍDA ===');
  console.log(`Status: ${statusGeral}`);
  console.log(`Pasta: ${OUT}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
