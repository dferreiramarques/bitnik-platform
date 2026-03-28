# Bitnik Games Platform

David Marques · MIT License · Bitnik Games 2026

## Estrutura do repositório

```
bitnik-platform/
├── server.js              ← servidor principal (HTTP + WebSocket)
├── package.json
├── .gitignore
├── public/
│   ├── index.html         ← landing page + catálogo + wizard
│   ├── play.html          ← cliente de jogo (/play/:gameId)
│   ├── editor.html        ← node editor BGE
│   └── docs.html          ← documentação
├── games/
│   └── bulbous.bge.json   ← jogos (carregados ao arrancar)
└── src/                   ← TypeScript source (referência)
    ├── engine/
    │   ├── types.ts
    │   ├── loader.ts
    │   └── engine.ts
    └── executors/
        └── flow-logic.ts
```

## Correr localmente

```bash
npm install
node server.js
# → http://localhost:3000
```

## Deploy no Railway

### 1. Git

```bash
git init
git add .
git commit -m "feat: bitnik platform v0.1"
git remote add origin https://github.com/SEU_USER/bitnik-platform.git
git branch -M main
git push -u origin main
```

### 2. Railway

1. railway.app → **New Project** → **Deploy from GitHub repo**
2. Selecciona `bitnik-platform`
3. Railway detecta o `package.json` automaticamente
4. **Settings → Networking → Generate Domain**

### 3. Adicionar jogos

**Via git:**
```bash
cp meu_jogo.bge.json games/
git add games/meu_jogo.bge.json
git commit -m "add meu_jogo"
git push  # Railway redeploy automático
```

**Via wizard no site:**
Landing page → "+ Novo Jogo" → descreve as regras → Claude gera o `.bge` → publica

## URLs

| Path | Descrição |
|---|---|
| `/` | Landing page + catálogo |
| `/play/bulbous` | Jogo Bulbous |
| `/play/:gameId` | Qualquer jogo em `games/` |
| `/editor` | Node Editor BGE |
| `/docs` | Documentação |
| `/api/games` | Lista de jogos (JSON) |
| `/api/upload-bge` | Upload de novo .bge (POST) |
