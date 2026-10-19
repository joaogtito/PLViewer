# Plano: app de consultas públicas do Senado

PWA para visualizar as consultas públicas do e-Cidadania. Somente leitura: o voto acontece no site oficial, via gov.br.

Este plano foi validado contra o site real em 17/10/2026. Os números abaixo (77 páginas, 7.690 proposições) mudam com o tempo; use-os como ordem de grandeza.

> **Revisão de 17/10/2026.** A arquitetura mudou depois de uma rodada de decisões: sem backend, sem Electron/Capacitor, sem Next. Ver seção 12 para o que saiu e por quê.

---

## 1. Escopo do MVP

**Entra**
- Lista de proposições com consulta pública, com votos SIM/NÃO.
- Busca por tema, número ou ementa.
- Filtro por tipo (PL, PEC, PLP...) e por ano.
- Toggle "incluir sem votos" (desligado por padrão).
- Ordenação: mais votos (padrão), menos votos, mais disputadas, mais apoiadas, mais rejeitadas.
- Botão que abre a página oficial da consulta para votar.
- Instalável (PWA) e funcional offline com o último dado em cache.
- Histórico diário de votos gravado pelo pipeline (sem UI no MVP).

**Fica de fora (por enquanto)**
- Backend/API, banco de dados e qualquer dado salvo por usuário.
- Conta, login e voto dentro do app.
- Apps de loja (Electron, Capacitor).
- Ordenação "mais recentes" (o card não traz data; `id` não é confiável como data).
- Página de detalhe própria (prazo, autor, tramitação).
- UI de histórico/gráficos e notificações push.

---

## 2. Fonte de dados

### Endpoint

```
GET https://www12.senado.leg.br/ecidadania/pesquisamateria?p=<pagina>
```

Parâmetros que o formulário aceita: `q`, `nomeAutor`, `numero`, `ano`, `tipo`, `fechada` (checkbox "incluir proposições com tramitação encerrada") e `p` (página).

### O que foi observado

| Item | Valor |
|---|---|
| Cards por página | 100 |
| Páginas (listagem padrão) | 77 (última com 90 cards) |
| Total | 7.690 proposições |
| Tamanho de cada página | ~170 KB |
| Escopo padrão | Só tramitação em curso |
| Ordenação | Aproximadamente por total de votos, decrescente |
| Cards sem votos | 2.514 (um terço) |
| Tipos presentes | PL, PDL, PLP, PEC, PRS, PLS, SUG, MPV, PDS, PLC, SCD |
| `robots.txt` | `User-agent: *` com `Disallow:` vazio (não proíbe rastreio) |
| Teste local (17/10/2026) | 200 OK, 174 KB em ~1,2 s com User-Agent honesto |

Tipos que o formulário oferece e que podem aparecer: ECD, EDS, MPV, PDL, PDS, PEC, PL, PLC, PLP, PLS, PLV, PRS, SCD, SDS, SUG.

### Estrutura de um card

```html
<div class="resumo-materia">
  <header><a href="visualizacaomateria?id=137929">PLP 183/2019</a></header>
  <section><a href="...">Ementa...</a></section>
  <a href="...">
    <figure class="grafico-consulta-publica">
      <header><span>371.616</span><span>10.857</span></header>   <!-- SIM, NÃO -->
      <section><div style="width:97.16%"></div></section>        <!-- % de SIM -->
      <footer><span>SIM</span><span>NÃO</span></footer>
    </figure>
  </a>
</div>
```

**Card sem votos:** o bloco `figure.grafico-consulta-publica` simplesmente não existe. A consulta está aberta, com 0 votos.

### Regras de parse

| Campo | Origem | Regra |
|---|---|---|
| `id` | `href` do `header a` | regex `[?&]id=(\d+)` |
| `sigla`, `numero`, `ano` | texto do `header a` | regex `^([^\W\d_]+)\s+(\d+)\s*/\s*(\d{4})$` |
| `ementa` | `section a` | colapsar espaços e quebras de linha (`" ".join(texto.split())`) |
| `votos_sim`, `votos_nao` | dois `span` dentro de `figure ... header` | remover tudo que não é dígito (ponto é separador de milhar) |
| sem `figure` | ausência do bloco | `votos_sim = votos_nao = 0` |
| `figure` com número de `span` diferente de 2 | | descartar o card e contar como erro de parse |
| `pct_sim` | calculado | `sim * 100 / total`, ou `null` se total = 0 |
| `url` | calculado | `{base}/visualizacaomateria?id={id}` |

Conferência: o `width` da barra do site é a porcentagem de SIM (40,12% calculado = `width:40.1184...%`).

### Total de páginas

Pegar o maior `p=` entre os links `a.page-link` (inclui o link "último"). Na última página, considerar também o número da página atual.

---

## 3. Armadilhas já encontradas

1. **`selectolax` atual (1.0+)** só tem o backend `lexbor`. Use `from selectolax.lexbor import LexborHTMLParser`. O import antigo (`selectolax.parser.HTMLParser`) lança erro.
2. **Header HTTP só aceita ASCII.** Um `User-Agent` com acento ("públicos") derruba a inicialização do cliente.
3. **Falhas transitórias:** apareceu um 503 isolado do proxy. Retry com backoff é obrigatório.
4. **A ordem muda durante o rastreio** (os votos mudam). Itens podem se repetir ou escapar entre páginas. Deduplicar por `id`; o que escapar entra no próximo ciclo.
5. **Processos em background em scripts de teste** podem se matar entre si com `pkill -f`. Use PIDs, não padrão de texto.

---

## 4. Arquitetura

```
GitHub Actions (cron, a cada 30 min)
   │  scraper Python: 77 páginas, 3 requisições simultâneas
   │  valida o resultado (seção 5)
   ▼
consultas.json  ──►  GitHub Pages  ◄──  SPA (Vite + React), mesmo site
                         │                     │
                         │                     └─ PWA: service worker, cache, offline
                         └─ (1x/dia) snapshot de votos → branch `data`
```

Princípios:
- **Nenhum scraping no app.** O navegador só baixa um JSON estático. Sem CORS (mesma origem) e volume de requisições ao Senado baixo e previsível.
- **Sem servidor, sem estado em memória.** Dados e frontend são arquivos estáticos.
- **Dados e frontend desacoplados.** A URL do JSON vem de `VITE_DATA_URL`, para migrar o frontend (ex.: Vercel) sem mexer no pipeline.
- Repositório público; Actions e Pages gratuitos.

---

## 5. Pipeline de dados

### Scraper (Python)
Stack: httpx (assíncrono), selectolax (lexbor), pydantic v2, pytest.

- Baixar a página 1, extrair o total de páginas e baixar o restante com concorrência limitada (3).
- Pausa curta (~150 ms) entre requisições.
- Até 4 tentativas por página, com backoff exponencial (1,5 s, 3 s, 6 s...).
- `User-Agent` honesto e só ASCII, por exemplo `ConsultasSenadoApp/0.1 (independent reader of public data)`.
- Deduplicar por `id`.
- Desempenho medido: 77 páginas em ~20 s.

### Validação antes de publicar
O workflow **falha sem publicar** (o JSON antigo continua no ar e o GitHub envia e-mail) se:
- a página 1 vier sem nenhum card ("layout mudou?");
- qualquer página falhar após os retries (rastreio incompleto);
- o total for menor que 50% do `consultas.json` publicado anterior;
- a taxa de cards descartados por erro de parse passar de um limite (ex.: 1%).

### Saída: `consultas.json`
Arquivo único com todos os itens (inclui os sem votos; o toggle filtra no cliente). Servido com compressão pelo Pages (~2–3 MB bruto, ordem de 500 KB comprimido; **medir**).

```
{
  "atualizado_em": "2026-10-17T03:00:00Z",
  "total": 7690,
  "itens": [
    {
      "id": 137929,
      "sigla": "PLP",
      "numero": 183,
      "ano": 2019,
      "titulo": "PLP 183/2019",
      "ementa": "...",
      "votos_sim": 371616,
      "votos_nao": 10857,
      "votos_total": 382473,
      "pct_sim": 97.16,
      "url": "https://www12.senado.leg.br/ecidadania/visualizacaomateria?id=137929"
    }
  ]
}
```

O texto de busca normalizado (título + ementa, sem acento, minúsculo) é calculado no cliente ao carregar, para não inflar o JSON.

### Histórico diário
Uma vez por dia (primeira execução após 00:00 UTC-3), gravar `id, votos_sim, votos_nao` numa branch `data` (um arquivo por dia, ex. `historico/2026-10-17.json`, ~100 KB comprimido). Sem UI no MVP. Habilita depois "consultas que mais cresceram" e gráficos de evolução.

### Workflow
- `schedule` (cron `*/30 * * * *`) + `workflow_dispatch`.
- O cron do Actions pode atrasar 5–15 min; aceitável para dados que mudam devagar.
- Em repositório sem atividade por 60 dias, o GitHub desativa workflows agendados. O commit do histórico diário mantém o repo ativo, e ainda assim vale um lembrete.
- Deploy do frontend (quando o código muda) separado da atualização dos dados, para não refazer o build a cada 30 min.

### Testes (sem rede)
- **Fixtures reais** em `tests/fixtures/`: uma página com votos (3 cards, incluindo um com ementa multilinha e a paginação) e uma página final (1 card com votos + 3 sem gráfico).
- **Parser:** separador de milhar, ementa em uma linha, cards sem gráfico viram 0 votos, card quebrado é descartado sem derrubar a página, HTML sem cards.
- **Rastreador** com cliente falso: retry com backoff, dedup, falha de página.
- **Validação:** cada regra de reprovação (sem cards, incompleto, total muito menor, muitos erros de parse).
- **Teste ao vivo manual** (não automatizar): rodar o scraper e conferir ~7.690 itens.

---

## 6. Frontend

### Stack
Vite + React 19 + TypeScript, CSS puro (sem Tailwind), `vite-plugin-pwa`.

- SPA estática, sem SSR nem rotas.
- `VITE_DATA_URL` define de onde vem o JSON.
- Fontes via `@fontsource-variable` (Archivo e Source Serif 4), empacotadas no build para funcionar offline.
- `<html lang="pt-BR">` e `viewport-fit=cover`.

### Dados no cliente
- Carregar `consultas.json` uma vez; busca, filtro e ordenação em memória.
- Busca: normalizar com NFKD sem acentos, minúsculo; todos os termos precisam aparecer (AND) em título + ementa. Permite buscar "pec 2/2022" ou "educacao".
- Filtros: `tipo` (case-insensitive), `ano` e toggle "incluir sem votos" (desligado por padrão).
- Ordens:

| Ordem | Critério | Observação |
|---|---|---|
| mais votos (padrão) | total desc, depois `id` desc | |
| menos votos | total asc, depois `id` desc | com o toggle desligado, ignora quem tem 0 votos |
| disputadas | `abs(pct_sim - 50)` asc | só consultas com ≥ 1.000 votos |
| apoiadas | `pct_sim` desc | só ≥ 1.000 votos |
| rejeitadas | `pct_sim` asc | só ≥ 1.000 votos |

O mínimo de 1.000 votos evita que "1 voto = 100% SIM" lidere os rankings. Com esse corte, sobram ~337 consultas.

- Renderização incremental ("Mostrar mais", 30 por vez) ou virtualização; **medir** com a lista cheia em celular modesto antes de decidir.
- Busca com debounce de ~300 ms.

### PWA e cache
- **Stale-while-revalidate:** abre na hora com o último JSON em cache, busca a versão nova (ETag/`If-None-Match`) em segundo plano e troca sem recarregar.
- Rótulo "atualizado há X min" (a partir de `atualizado_em`), recalculado a cada minuto.
- Offline: funciona com o cache e mostra aviso "Sem conexão. Mostrando dados de há X."
- Primeira visita sem rede e sem cache: estado de erro com "Tentar de novo".
- Ao voltar o foco para a janela, se o JSON mudou e o usuário não expandiu a lista, atualizar do início.
- Abrir links externos: `window.open(url, '_blank', 'noopener,noreferrer')`.

### Interface
- Chips de tipo (rolagem horizontal), seletor de ano, seletor de ordenação e toggle "incluir sem votos".
- Ao escolher um tipo, mostrar o nome completo em uma linha ("Projeto de lei complementar"): a sigla sozinha não é óbvia no celular.
- Ao escolher `disputadas`, `apoiadas` ou `rejeitadas`, avisar: "Considera só consultas com 1.000 votos ou mais."

### Estados
- **Vazio:** "Nenhuma proposição encontrada. Tente outro termo ou remova os filtros." + botão "Limpar filtros".
- **Erro de rede:** explicar o que houve e oferecer "Tentar de novo". Sem pedir desculpas, sem texto vago.
- **Carregando:** esqueleto simples; o JSON único chega de uma vez.
- **Sem votos** (quando o toggle os mostra): a barra vira uma faixa tracejada com "Ainda sem votos".

### Direção de design

**Elemento memorável:** uma coluna de barras de balanço SIM/NÃO alinhadas à direita, com uma marca no 50%. Todas as linhas ficam comparáveis na mesma coluna; dá para escanear e ver quem lidera.

- **Estrutura:** linhas com divisores finos, não cards.
- **Layout:**
  - Desktop (≥ ~900 px): à esquerda sigla + ementa; à direita uma coluna de largura fixa com a barra, os números e o link "Votar no Senado".
  - Mobile: tudo empilhado, com a barra em largura total.
- **Ementa:** limitada a 3 linhas; um botão (`aria-expanded`) expande o texto.
- **Cores:**
  - Fundo: cinza frio, não creme.
  - SIM em azul e NÃO em laranja: par seguro para daltonismo. Além da cor, sempre rótulo em texto.
  - Preenchimento da barra com tons vivos; **texto** com variantes mais escuras (o laranja vivo não tem contraste suficiente sobre fundo claro).
  - Modo escuro com os mesmos papéis.
- **Tipografia:** Archivo (largura condensada para siglas e títulos; números tabulares) + Source Serif 4 para as ementas. Linhas com menos de 80 caracteres.
- **Porcentagens:** arredondar; se for maior que 0 e menor que 1, mostrar "<1%"; se for maior que 99 e menor que 100, ">99%".
- **Sem animações** além do necessário; respeitar `prefers-reduced-motion`; foco de teclado visível.
- **Rodapé:** "App independente, sem vínculo com o Senado Federal. Os dados vêm do portal e-Cidadania e o voto é registrado no site oficial, com login gov.br."
- **Cabeçalho:** frase simples, por exemplo "5.176 proposições com votos. Dados do e-Cidadania, atualizados há 3 min." (o número deve refletir o filtro do toggle).
- Não usar o brasão nem a identidade visual do Senado.

---

## 7. Estrutura de pastas sugerida

```
consultas-senado/
├── .github/workflows/
│   ├── atualizar-dados.yml   # cron: rastreia, valida, publica JSON + histórico
│   └── deploy-site.yml       # build do frontend e deploy no Pages
├── scraper/
│   ├── src/
│   │   ├── config.py         # variáveis de ambiente
│   │   ├── models.py         # Consulta
│   │   ├── parser.py         # parse_pagina
│   │   ├── crawler.py        # Rastreador (concorrência, retry, dedup)
│   │   ├── validar.py        # regras de reprovação
│   │   └── main.py           # gera consultas.json (+ histórico diário)
│   ├── tests/
│   │   ├── fixtures/         # HTML real, trechos
│   │   ├── test_parser.py
│   │   ├── test_crawler.py
│   │   └── test_validar.py
│   └── requirements.txt
└── web/
    ├── src/
    │   ├── components/       # Consultas, LinhaConsulta, BarraBalanco
    │   ├── lib/              # dados.ts (fetch+cache), busca.ts, formato.ts
    │   ├── App.tsx
    │   └── styles.css
    ├── public/               # ícones, manifest
    ├── index.html
    └── vite.config.ts        # vite-plugin-pwa, base para o Pages
```

---

## 8. Ordem de implementação

| # | Etapa | Pronto quando |
|---|---|---|
| 0 | Repositório + workflow descartável que faz `curl` da página 1 do Senado | Responde 200 a partir do IP do Actions. **Se falhar**, plano B: Cloudflare Workers (cron + R2) |
| 1 | Parser + fixtures + testes | Testes passam sem rede; cards sem gráfico viram 0 votos |
| 2 | Rastreador (concorrência, retry, dedup) | Rastreia as 77 páginas e dá ~7.690 itens |
| 3 | Validação + geração do JSON | Cada regra de reprovação tem teste; JSON gerado localmente |
| 4 | Workflow de dados + Pages | Cron publica o JSON; falha não derruba o JSON anterior; medir tamanho comprimido |
| 5 | Frontend web | Funciona no navegador contra o JSON real, com os estados vazio, erro e carregando |
| 6 | PWA | Instala, abre offline com cache e atualiza em segundo plano |
| 7 | Histórico diário | Branch `data` recebe um arquivo por dia |

---

## 9. Riscos e pontos em aberto

- **IP do Actions bloqueado pelo Senado.** Mitigação: etapa 0 antes de qualquer outra coisa. Plano B: Cloudflare Workers.
- **Fragilidade do scraping.** O layout pode mudar. Mitigação: classes semânticas (`resumo-materia`, `grafico-consulta-publica`), validação que impede publicar dado ruim, e-mail do GitHub em falha.
- **Termos de uso do portal.** O `robots.txt` não proíbe rastreio, mas confira os termos antes de publicar. Mantenha concorrência baixa, intervalo de 30 min e `User-Agent` identificável.
- **Atraso e desativação do cron.** Cron do Actions atrasa e é desativado após 60 dias sem atividade no repositório (o histórico diário ajuda a evitar isso).
- **Tamanho do JSON no celular.** Medir parse e renderização com ~7.690 itens em aparelho modesto. Se pesar, dividir em dois arquivos (com votos / sem votos) ou abreviar campos.
- **Crescimento do repositório.** Histórico diário é pequeno, mas confira o tamanho em 3 meses; se necessário, agregar os dias antigos.
- **Página de detalhe** (`visualizacaomateria?id=...`): fora do MVP. Se for incluída, não entra no rastreio completo.
- **Lojas de aplicativos.** Fora do MVP. Se voltarem (Capacitor/Electron), reaproveitam a mesma SPA e o mesmo JSON; verificar a política de apps que agregam dados governamentais.

---

## 10. Evoluções futuras

- Marcar "já votei" localmente no dispositivo, sem conta nem backend. Evita coletar dados sobre posicionamento político.
- UI de histórico: gráfico de evolução e "consultas que mais cresceram nas últimas 24 h" (os dados já estarão sendo gravados).
- Ordenação "novas" baseada em "primeira vez vista" no histórico.
- Notificações push (exigiria servidor ou serviço externo).
- Detalhe da proposição com dados da API de Dados Abertos (`legis.senado.leg.br/dadosabertos`), caso o `id` do e-Cidadania coincida com o código da matéria. Vale testar com `/materia/{id}` antes de contar com isso.
- Empacotamento Capacitor (lojas mobile) ou Electron (desktop), se houver demanda.

---

## 11. Decisões desta revisão

| Área | Decisão | Motivo |
|---|---|---|
| Backend | Removido; JSON estático gerado por cron | Dados públicos, somente leitura, mudam a cada 30 min; nenhum estado de usuário |
| Hospedagem | GitHub Actions + Pages, repositório público | Gratuito, um serviço só; URL dos dados configurável |
| Scraper | Python | Reaproveita o parser já validado |
| Frontend | Vite + React + TS | Next 16 sem SSR/rotas era peso sem benefício |
| Plataformas | Só PWA | Electron/Capacitor custam empacotamento e lojas sem necessidade no MVP |
| Formato | Arquivo único | Simples; busca instantânea e offline |
| Sem votos | Escondidos + toggle | Lista inicial mais útil |
| Ordenação | Votos (↑↓) + 3 rankings; sem "recentes" | Card não tem data |
| Histórico | Snapshot diário em branch `data` | Barato e preserva o passado para a UI futura |
| Falhas | Falhar sem publicar + e-mail do GitHub | JSON antigo continua no ar |
| PWA | Stale-while-revalidate | Abertura instantânea e funciona offline |

## 12. O que saiu do plano anterior

FastAPI e rotas `/api/*`; snapshot em memória e ciclo de atualização interno; CORS; Docker e deploy com HTTPS; Next 16; Electron (protocolo `app://`, path traversal, `electron-builder`); Capacitor (`10.0.2.2`, `appId`, `@capacitor/browser`); ordem "recentes"; testes de Store e de falha do servidor (viraram testes de validação).
