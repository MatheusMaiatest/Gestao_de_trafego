# PROMPT DE IMPLEMENTAÇÃO — Correções Pós-Auditoria

## Contexto

Você é um agente de desenvolvimento. Foi realizada uma auditoria completa da aplicação **Inteligência Comercial** publicada em https://gestao-de-trafego.onrender.com/.

A aplicação é um SPA (Single Page Application) com:
- **Frontend:** `public/index.html` — HTML/CSS/JS puro (sem framework)
- **Backend:** `server.js` — Node.js + Express + MySQL (mysql2/promise)
- **Deploy:** Render.com

A auditoria identificou **4 bugs críticos**, **problemas de UX** e **riscos de segurança**. Sua tarefa é implementar todas as correções listadas abaixo, **arquivo por arquivo**, sem quebrar funcionalidades existentes.

Antes de começar, leia os arquivos:
- `server.js` — backend completo
- `public/index.html` — frontend completo

---

## CORREÇÃO 1 — WhatsApp: botões não aparecem no Disparo

**Arquivo:** `server.js`
**Problema:** O endpoint `/api/segments/:type/customers` não retorna o campo `cpf` (contato_numerodocumento). O frontend usa `c.cpf` para montar o link `wa.me/55...`, mas como o campo não existe, nenhum botão é gerado.
**Localizar:** A query dentro de `app.get('/api/segments/:type/customers', ...)` que faz o `unionSQL` com os campos selecionados.

**Correção:** Adicionar `MAX(contato_numerodocumento) AS cpf` na lista de colunas do `unionSQL` dessa rota. Também garantir que o campo `cpf` seja incluído no objeto retornado no array `customers`.

Antes:
```js
const union = unionSQL(bu,
  `contato_id, MAX(contato_nome) AS name,
   MAX(kdd_cliente_estado) AS state,
   MAX(transporte_etiqueta_municipio) AS city,
   MAX(transporte_etiqueta_uf) AS stateUF,
   MIN(data) AS firstDate, MAX(data) AS lastDate,
   COUNT(*) AS orders, COALESCE(SUM(total),0) AS spent`,
  `WHERE data BETWEEN '${startDate}' AND '${endDate}' GROUP BY contato_id`);
```

Depois:
```js
const union = unionSQL(bu,
  `contato_id, MAX(contato_nome) AS name,
   MAX(contato_numerodocumento) AS cpf,
   MAX(kdd_cliente_estado) AS state,
   MAX(transporte_etiqueta_municipio) AS city,
   MAX(transporte_etiqueta_uf) AS stateUF,
   MIN(data) AS firstDate, MAX(data) AS lastDate,
   COUNT(*) AS orders, COALESCE(SUM(total),0) AS spent`,
  `WHERE data BETWEEN '${startDate}' AND '${endDate}' GROUP BY contato_id`);
```

E no `map.set(key, {...})` adicionar:
```js
cpf: r.cpf || null,
```

---

## CORREÇÃO 2 — Erro JS "Invalid or unexpected token" na paginação

**Arquivo:** `public/index.html`
**Problema:** A função `renderPag()` serializa callbacks Arrow Function via `.toString()` e injeta dentro de atributos `onclick` HTML. Quando o texto da função contém aspas simples ou caracteres especiais, o HTML resultante quebra o parser JavaScript. Erro detectado na paginação do Disparo (2 ocorrências).

**Localizar:** Função `renderPag(id, cur, total, cb)` no `<script>` do index.html.

**Correção:** Substituir a abordagem de `onclick` inline por `data-page` attributes + event delegation:

```js
function renderPag(id, cur, total, cb) {
  const el = document.getElementById(id);
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }

  const pgs = [];
  if (cur > 1) pgs.push(`<button class="pag-btn" data-page="${cur-1}">‹</button>`);

  if (total <= 7) {
    for (let i = 1; i <= total; i++)
      pgs.push(`<button class="pag-btn${i===cur?' active':''}" data-page="${i}">${i}</button>`);
  } else {
    pgs.push(`<button class="pag-btn${cur===1?' active':''}" data-page="1">1</button>`);
    if (cur > 3) pgs.push('<span class="pag-info">…</span>');
    for (let i = Math.max(2, cur-1); i <= Math.min(total-1, cur+1); i++)
      pgs.push(`<button class="pag-btn${i===cur?' active':''}" data-page="${i}">${i}</button>`);
    if (cur < total - 2) pgs.push('<span class="pag-info">…</span>');
    pgs.push(`<button class="pag-btn${cur===total?' active':''}" data-page="${total}">${total}</button>`);
  }

  if (cur < total) pgs.push(`<button class="pag-btn" data-page="${cur+1}">›</button>`);
  pgs.push(`<span class="pag-info">Pág ${cur} de ${total}</span>`);

  el.innerHTML = pgs.join('');

  // Event delegation — sem onclick inline
  el.querySelectorAll('.pag-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => cb(parseInt(btn.dataset.page)));
  });
}
```

---

## CORREÇÃO 3 — Dois cards "Clientes Inativos" no Dashboard

**Arquivo:** `public/index.html`
**Problema:** Na função `renderDashKPIs(kpi, seg)`, o array `ks` tem dois itens com label `'Clientes Inativos'` — o segundo deveria ser `'Em Risco'`.

**Localizar:** Função `renderDashKPIs` — array `ks`.

**Antes:**
```js
{l:'Clientes Inativos', v:fmtN(risco), c:'warn'},
```

**Depois:**
```js
{l:'Clientes Em Risco', v:fmtN(risco), c:'warn'},
```

---

## CORREÇÃO 4 — Produtos sem nome (exibe SKU em vez de descrição)

**Arquivo:** `server.js`
**Problema:** O endpoint `/api/products/top-selling` retorna apenas o código SKU do produto no campo `name` (usa `code` como fallback). Não faz JOIN com a tabela de produtos para buscar o nome real.

**Localizar:** `app.get('/api/products/top-selling', ...)`.

**Correção:** Adicionar coluna de nome na query. Como a query usa UNION entre duas tabelas de itens, fazer um JOIN separado para enriquecer com o nome após agregar:

```js
// Após montar o map de produtos, fazer lookup de nomes
// Adicionar na coluna selecionada:
const cols = `itens_codigo AS code,
              MAX(itens_descricao) AS name_raw,
              SUM(itens_quantidade) AS qty,
              SUM(itens_valor*itens_quantidade) AS revenue,
              COUNT(DISTINCT pedido_venda_id) AS orders`;
```

E no mapeamento:
```js
if (!map.has(r.code)) map.set(r.code, {
  code: r.code,
  name: r.name_raw || r.code,  // usar descrição se disponível
  totalQty: 0, totalRevenue: 0, orderCount: 0
});
```

> **Nota:** Se a coluna `itens_descricao` não existir nas tabelas de itens, verificar o nome correto com `DESCRIBE bling_pedidos_venda_detalhes_itens_ecommerce` e usar o campo de descrição correto.

---

## CORREÇÃO 5 — SQL Injection (segurança crítica)

**Arquivo:** `server.js`
**Problema:** `startDate`, `endDate` e `businessUnit` são concatenados diretamente nas strings SQL, criando vulnerabilidade de SQL Injection.

**Correção:** Para as datas, adicionar validação com regex antes de usar. Exemplo no início de cada rota:

```js
// Adicionar esta função utilitária no topo do server.js, após as imports:
function safeParam(val, pattern = /^[\w\-,. ]+$/) {
  if (!val) return null;
  if (!pattern.test(String(val))) throw new Error('Parâmetro inválido');
  return String(val);
}

// Validar datas com:
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
function validateDate(d) {
  if (!d || !dateRegex.test(d)) throw new Error('Data inválida');
  return d;
}
```

E em cada rota que recebe `startDate`/`endDate`:
```js
const start = validateDate(startDate);
const end   = validateDate(endDate);
// Usar start e end no lugar de startDate e endDate nas queries
```

Para `businessUnit`, validar com allowlist:
```js
const VALID_BU = ['all', 'ecommerce', 'distributor', 'distribuidor'];
if (!VALID_BU.includes(bu)) return res.status(400).json({ error: 'businessUnit inválido' });
```

---

## CORREÇÃO 6 — GeoJSON local (eliminar dependência do GitHub)

**Arquivo:** `server.js` e `public/index.html`
**Problema:** O mapa carrega o GeoJSON do Brasil de `raw.githubusercontent.com` — dependência externa com risco de indisponibilidade e latência (~6s).

**Passos:**
1. Baixar o arquivo: `https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson`
2. Salvar em `public/brazil-states.geojson`
3. No `public/index.html`, localizar a constante `MAP_GEO_URL` e alterar:

```js
// Antes:
const MAP_GEO_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';

// Depois:
const MAP_GEO_URL = '/brazil-states.geojson';
```

---

## CORREÇÃO 7 — Feedback visual no botão Buscar

**Arquivo:** `public/index.html`
**Problema:** O botão "🔍 Buscar" não dá nenhum feedback durante o carregamento — o usuário não sabe se a ação foi registrada.

**Correção:** Adicionar função de loading state nos botões de busca. Localizar as funções `loadDash()`, `loadClientes()` e `loadDisparo()` e adicionar no início e fim de cada uma:

```js
// No início de loadDash():
const btnDash = document.querySelector('#tab-dashboard .btn-search');
if (btnDash) { btnDash.disabled = true; btnDash.textContent = '⏳ Buscando...'; }

// No finally (adicionar try/finally):
// No fim (sempre executar, mesmo com erro):
if (btnDash) { btnDash.disabled = false; btnDash.textContent = '🔍 Buscar'; }
```

Aplicar o mesmo padrão para `loadClientes()` e `loadDisparo()` com seus respectivos botões.

---

## CORREÇÃO 8 — Validação cruzada de datas

**Arquivo:** `public/index.html`
**Problema:** Não há validação que impeça o usuário de colocar data de início maior que a data de fim.

**Correção:** No início de cada função de load (`loadDash`, `loadClientes`, `loadDisparo`, `previewRpt`), adicionar:

```js
if (s > e) {
  alert('A data de início não pode ser maior que a data de fim.');
  return;
}
```

---

## CORREÇÃO 9 — Campo de busca com botão Limpar

**Arquivo:** `public/index.html`
**Problema:** O input de pesquisa da aba Clientes não tem botão para limpar rapidamente.

**Localizar:** O elemento:
```html
<input type="text" id="c-search" class="search-input" placeholder="Buscar por nome, CPF ou nº pedido..."/>
```

**Correção:** Envolver num wrapper com posição relativa e adicionar botão X:

```html
<div style="position:relative;flex:1;min-width:200px;">
  <input type="text" id="c-search" class="search-input" placeholder="Buscar por nome, CPF ou nº pedido..." style="width:100%;padding-right:32px;"/>
  <button onclick="document.getElementById('c-search').value='';document.getElementById('c-search').dispatchEvent(new Event('input'))"
    style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--tm);cursor:pointer;font-size:1rem;line-height:1;"
    title="Limpar pesquisa">✕</button>
</div>
```

---

## CORREÇÃO 10 — Mobile: menu de abas com overflow

**Arquivo:** `public/index.html`
**Problema:** Em viewports < 480px, as abas do menu superior (`Dashboard`, `Clientes`, `Relatórios`, `Disparo`) ficam cortadas.

**Localizar:** No CSS, a regra `.tabs`:
```css
.tabs{display:flex;gap:2px;flex:1;overflow-x:auto}
```

**Correção:** Adicionar scroll suave e esconder a scrollbar no mobile:
```css
.tabs{
  display:flex;
  gap:2px;
  flex:1;
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
}
.tabs::-webkit-scrollbar{display:none}
```

---

## APÓS TODAS AS CORREÇÕES — Verificações Obrigatórias

1. **Testar WhatsApp:** Ir em Disparo → Identificar Inativos → verificar se a coluna WhatsApp agora exibe botões `📱 WhatsApp`
2. **Testar paginação:** Ir em Disparo → Identificar → clicar na página 2 → verificar se não há erros no console
3. **Verificar Dashboard:** Confirmar que os 8 KPIs têm labels únicos (sem "Clientes Inativos" duplicado)
4. **Verificar Produtos:** Confirmar que o gráfico Top 10 exibe nomes em vez de códigos SKU
5. **Testar mobile:** Abrir o DevTools em 375px e verificar se as abas do menu têm scroll
6. **Testar botão Buscar:** Clicar e verificar se fica desabilitado durante o carregamento
7. **Verificar console:** Abrir DevTools → Console → realizar todas as ações acima → confirmar zero erros

---

## Arquivos a Modificar

| Arquivo | Correções |
|---------|-----------|
| `server.js` | Correções 1, 4, 5 |
| `public/index.html` | Correções 2, 3, 7, 8, 9, 10 |
| `public/` (novo arquivo) | Correção 6 — `brazil-states.geojson` |

---

## Referência — Diagnóstico Completo

O relatório completo de auditoria está em:
`resultado varredura/diagnostico.md`

O log de rede está em:
`resultado varredura/network_log.json`

Os screenshots de cada problema estão em:
`resultado varredura/prints/`
