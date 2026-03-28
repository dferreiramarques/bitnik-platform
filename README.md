# Bitnik Games

Plataforma de jogos de tabuleiro digitais — David Marques · MIT License · 2026

## Estrutura

```
bitnik/
├── server.js          ← servidor principal (HTTP + WebSocket)
├── package.json
├── public/
│   ├── index.html     ← landing page + catálogo + wizard
│   ├── play.html      ← cliente de jogo (serve /play/:gameId)
│   ├── editor.html    ← node editor BGE
│   └── docs.html      ← documentação
└── games/
    └── bulbous.bge.json   ← jogos carregados ao arrancar
```

## Correr localmente

```bash
npm install
node server.js
# → http://localhost:3000
```

Adicionar um jogo: coloca o `.bge.json` na pasta `games/` e reinicia.

## Deploy no Railway

### 1. Criar repositório Git

```bash
cd bitnik
git init
git add .
git commit -m "feat: bitnik platform v0.1"
```

Cria um repositório novo em github.com (ex: `david-marques/bitnik-games`), depois:

```bash
git remote add origin https://github.com/SEU_USER/bitnik-games.git
git branch -M main
git push -u origin main
```

### 2. Criar serviço no Railway

1. Vai a **railway.app** → **New Project** → **Deploy from GitHub repo**
2. Selecciona `bitnik-games`
3. Railway detecta o `package.json` automaticamente — não precisas de configurar nada
4. Adiciona uma variável de ambiente: `PORT` = `3000` (Railway injeta automaticamente, mas é bom ter explícito)
5. Clica **Deploy**

### 3. Domínio

No painel do Railway: **Settings → Networking → Generate Domain**

Recebes um URL tipo `bitnik-games.up.railway.app`.

Para domínio próprio (`bitnik.games`): Settings → Custom Domain → adiciona o CNAME.

### 4. Adicionar jogos depois do deploy

**Opção A** — Via wizard na landing page:
- Abre o site → "+ Novo Jogo" → preenche as regras → Claude gera o `.bge` → publica
- O `.bge` é guardado em `games/` no servidor Railway

**Opção B** — Via Git:
```bash
cp meu_jogo.bge.json games/
git add games/meu_jogo.bge.json
git commit -m "feat: add meu_jogo"
git push
# Railway redeploy automático
```

## Variáveis de ambiente (Railway)

| Variável | Valor | Descrição |
|---|---|---|
| `PORT` | `3000` | Railway injeta automaticamente |

Sem mais variáveis necessárias. A Claude API key para o wizard é injectada no browser via o endpoint da Anthropic — se quiseres proteger a key, adiciona um proxy endpoint no server.js.

## URLs

| Path | Descrição |
|---|---|
| `/` | Landing page + catálogo |
| `/play/bulbous` | Jogo Bulbous |
| `/play/:gameId` | Qualquer jogo carregado |
| `/editor` | Node Editor BGE |
| `/docs` | Documentação |
| `/api/games` | Lista de jogos (JSON) |
| `/api/upload-bge` | Upload de novo .bge (POST) |

---

Bitnik Framework (beta) · David Marques · MIT License · Bitnik Games 2026
