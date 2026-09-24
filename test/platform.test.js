// Testes ponta a ponta: servidor real + SDK de cliente por WebSocket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BitnikClient } from '@bitnik/client';
import { fileStorage, createPlatform } from '@bitnik/server';
import race from '../packages/engine/test/fixtures/race.js';
import { makeStudio } from '../apps/studio/server.js';
import { makeRuntime } from '../examples/clean-runtime/server.js';

const quiet = { log() {}, warn() {}, error: console.error };
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

async function boot(make, opts = {}) {
  const platform = make({ botDelayMs: [0, 1], logger: quiet, ...opts });
  const port = await platform.listen(0);
  const clients = [];
  const client = async (storage = memStore(), name = 'Teste') => {
    const c = new BitnikClient({ url: `ws://localhost:${port}/ws`, storage, name });
    clients.push(c);
    const welcome = c.next('welcome');
    c.connect();
    await welcome;
    return c;
  };
  const stop = async () => { clients.forEach((c) => c.close()); await platform.close(); };
  return { platform, port, client, stop };
}

/** Joga pelo humano (primeira jogada legal) até o jogo acabar. */
function playToEnd(c, roomId) {
  return new Promise((resolve) => {
    const off = c.on('room', (msg) => {
      if (msg.room.id !== roomId) return;
      if (msg.result) { off(); resolve(msg); return; }
      if (msg.active.includes(msg.seat) && msg.legal.length) {
        const mv = msg.legal.find((m) => m.type === 'COLLECT') && msg.view.players[msg.seat].turn.collects < 2
          ? msg.legal.find((m) => m.type === 'COLLECT') : msg.legal.find((m) => m.type === 'FOUND') || msg.legal.at(-1);
        c.move(roomId, { type: mv.type, payload: mv.payload });
      }
    });
    c.open(roomId);
  });
}

test('mesa solo: uma instância privada com bots, jogada até ao fim', async () => {
  const s = await boot(makeStudio);
  const c = await s.client();
  const first = c.next('room');
  c.createSolo('catania', 3);
  const room = await first;
  assert.equal(room.room.kind, 'solo');
  assert.equal(room.seat, 0);
  assert.deepEqual(room.room.seats.map((x) => x.bot), [false, true, true]);
  assert.ok(room.legal.every((m) => m.label?.key), 'jogadas legais trazem rótulo');
  const end = await playToEnd(c, room.room.id);
  assert.ok(end.result.winners.length >= 1);
  await s.stop();
});

test('as mesas solo são só do dono', async () => {
  const s = await boot(makeStudio);
  const a = await s.client();
  const b = await s.client();
  const created = a.next('room');
  a.createSolo('catania', 2);
  const { room } = await created;
  const rooms = await new Promise((r) => { b.on('rooms', r); b.list(); });
  assert.equal(rooms.mine.length, 0);
  assert.ok(!rooms.public.some((x) => x.id === room.id));
  const err = b.next('error');
  b.open(room.id);
  assert.equal((await err).code, 'server.ROOM_NOT_FOUND');
  await s.stop();
});

test('identidade: o mesmo token volta a ser o mesmo utilizador', async () => {
  const s = await boot(makeStudio);
  const store = memStore();
  const a = await s.client(store);
  const uid = a.welcome.userId;
  a.close();
  const again = await s.client(store);
  assert.equal(again.welcome.userId, uid);
  await s.stop();
});

test('persistência: a mesa solo sobrevive a um restart do servidor', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const store = memStore();
  const s1 = await boot(makeStudio, { dataDir: dir, botDelayMs: [60_000, 60_001] });
  const c1 = await s1.client(store);
  const created = c1.next('room');
  c1.createSolo('catania', 2);
  const { room } = await created;
  const after = c1.next('room', (m) => m.seq === 1);
  c1.move(room.id, { type: 'END_TURN' });
  const before = await after;
  await new Promise((r) => setTimeout(r, 50));
  await s1.stop();

  const s2 = await boot(makeStudio, { dataDir: dir, botDelayMs: [60_000, 60_001] });
  const c2 = await s2.client(store);
  const rooms = await new Promise((r) => { c2.on('rooms', r); c2.list(); });
  assert.ok(rooms.mine.some((x) => x.id === room.id), 'a mesa aparece em "as minhas mesas"');
  const reopened = c2.next('room');
  c2.open(room.id);
  const r = await reopened;
  assert.equal(r.seq, before.seq);
  assert.deepEqual(r.view, before.view);
  const saved = JSON.parse(await readFile(join(dir, 'rooms', `${room.id}.json`), 'utf8'));
  assert.equal(saved.match.gameId, 'catania');
  await s2.stop();
});

test('mesa pública: dois humanos, vez validada, quem sai é substituído por um bot', async () => {
  const s = await boot(makeStudio);
  const a = await s.client(memStore(), 'Ana');
  const b = await s.client(memStore(), 'Rui');
  let seated = a.next('room', (m) => m.room.seats.filter((x) => x.taken).length === 1);
  a.join('catania-2p');
  await seated;
  seated = b.next('room', (m) => m.room.seats.filter((x) => x.taken).length === 2);
  b.join('catania-2p');
  await seated;
  const started = b.next('room', (m) => m.room.status === 'playing');
  a.start('catania-2p');
  const g = await started;
  assert.equal(g.seat, 1);
  const err = b.next('error');
  b.move('catania-2p', { type: 'END_TURN' });
  assert.equal((await err).code, 'engine.NOT_ACTIVE');
  const botTurn = b.next('room', (m) => m.room.seats[0].bot && m.active.includes(1));
  a.leave('catania-2p');
  await botTurn;
  await s.stop();
});

test('jogada reenviada sobre um estado antigo é recusada e o cliente recebe o estado atual', async () => {
  const s = await boot(makeStudio, { botDelayMs: [60_000, 60_001] });
  const c = await s.client();
  const created = c.next('room');
  c.createSolo('catania', 2);
  const first = await created;
  const { room } = first;
  const hex = first.legal.find((m) => m.type === 'COLLECT').payload.hex;
  const applied = c.next('room', (m) => m.seq === 1);
  assert.equal(c.move(room.id, { type: 'COLLECT', payload: { hex } }), true);
  await applied;
  // Reenvio da mesma jogada com o seq antigo (ex.: depois de uma reconexão).
  const err = c.next('error');
  const resync = c.next('room');
  c.send('MOVE', { roomId: room.id, move: { type: 'COLLECT', payload: { hex } }, seq: 0 });
  assert.equal((await err).code, 'engine.STALE_MOVE');
  const r = await resync;
  assert.equal(r.seq, 1, 'recebe o último estado confirmado');
  assert.equal(r.view.players[0].turn.collects, 1, 'a jogada não foi aplicada duas vezes');
  await s.stop();
});

test('sem ligação, move() devolve false e não envia nada', async () => {
  const s = await boot(makeStudio);
  const c = await s.client();
  c.close();
  assert.equal(c.move('qualquer', { type: 'END_TURN' }), false);
  await s.stop();
});

test('runtime limpo: outra marca, só os pacotes entregues', async () => {
  const s = await boot(makeRuntime);
  const health = await (await fetch(`http://localhost:${s.port}/health`)).json();
  assert.deepEqual(health, { ok: true, brand: 'editora-exemplo', games: ['catania'], rooms: 3 });
  const html = await (await fetch(`http://localhost:${s.port}/`)).text();
  assert.match(html, /Editora Exemplo/);
  assert.match(html, /--color-brick:#1f4e6b/);
  const c = await s.client();
  assert.equal(c.welcome.studio, false);
  const created = c.next('room');
  c.createSolo('catania', 4);
  const end = await playToEnd(c, (await created).room.id);
  assert.ok(end.result);
  const pkg = JSON.parse(await readFile(new URL('../examples/clean-runtime/package.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@bitnik/game-catania', '@bitnik/server']);
  await s.stop();
});

/** Guarda uma mesa solo com um match de outra versão, dono 'u' (token 'tok'). */
async function oldSolo(dir, match) {
  const st = fileStorage(dir);
  await st.load();
  await st.saveUsers({ tok: { userId: 'u', name: 'Ana' } });
  await st.saveRoom({
    id: 'solo-old', gameId: 'catania', kind: 'solo', owner: 'u', name: '', numPlayers: 2, level: 'default',
    seats: [{ userId: 'u', name: 'Ana', bot: false, away: false }, { userId: null, name: 'Bot 1', bot: true, away: false }],
    match: { gameVersion: '3.0.0', engineVersion: '0.2.0', seq: 4, timers: [{ key: 't', delayMs: 1, event: 'X', seq: 4 }], state: {}, ...match },
    status: 'playing', timerDue: {}, createdAt: 0, updatedAt: 0,
  });
  return st;
}
const tokenStore = () => { const m = memStore(); m.setItem('bitnik.token', 'tok'); return m; };

test('ficheiros de storage de outro jogo ou versão incompatível não partem o arranque', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const st = await oldSolo(dir, { gameVersion: '1.0.0' });
  await st.saveRoom({ id: 'x', gameId: 'nao-existe', kind: 'solo', seats: [] });
  const s = await boot(makeStudio, { dataDir: dir });
  assert.ok(!s.platform.rooms.has('x'));
  const old = s.platform.rooms.get('solo-old');
  assert.equal(old.status, 'expired', 'não é apagada: fica marcada');
  assert.deepEqual(old.expired, { reason: 'game', from: '1.0.0', to: '3.0.1' });
  assert.ok(old.match, 'o match fica guardado para replay');
  await s.stop();
});

test('mesa solo expirada: aparece com aviso, não aceita jogadas e pode recomeçar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  await oldSolo(dir, { gameVersion: '2.4.0' });
  const s = await boot(makeStudio, { dataDir: dir });
  const c = await s.client(tokenStore());
  const rooms = await new Promise((r) => { c.on('rooms', r); c.list(); });
  const mine = rooms.mine.find((x) => x.id === 'solo-old');
  assert.equal(mine.status, 'expired');
  assert.equal(mine.expired.from, '2.4.0');
  const opened = c.next('room');
  c.open('solo-old');
  const msg = await opened;
  assert.equal(msg.view, undefined, 'o estado antigo não passa pelo view');
  const err = c.next('error');
  c.move('solo-old', { type: 'END_TURN' });
  assert.equal((await err).code, 'server.EXPIRED');
  const fresh = c.next('room', (m) => m.room.status === 'playing');
  c.restart('solo-old');
  const r = await fresh;
  assert.equal(r.room.expired, null);
  assert.equal(r.seq, 0);
  await s.stop();
});

test('um match de outra versão major do motor também expira', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  await oldSolo(dir, { gameVersion: '3.0.1', engineVersion: '0.1.0' });
  const s = await boot(makeStudio, { dataDir: dir });
  assert.equal(s.platform.rooms.get('solo-old').expired.reason, 'engine');
  await s.stop();
});

test('avisos: chegam a quem está ligado e a quem se liga depois, e sobrevivem a um restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const s1 = await boot(makeStudio, { dataDir: dir });
  const a = await s1.client();
  const got = a.next('notices');
  const at = Date.now() + 3600_000;
  s1.platform.notify({ id: 'deploy', key: 'notice.UPDATE_AT', at });
  const { notices } = await got;
  assert.equal(notices.length, 1);
  assert.equal(notices[0].key, 'notice.UPDATE_AT');
  assert.equal(notices[0].until, at, 'por omissão, o aviso acaba à hora da atualização');
  const b = await s1.client();
  assert.deepEqual(b.welcome.notices.map((n) => n.id), ['deploy']);
  await new Promise((r) => setTimeout(r, 50));
  await s1.stop();
  const s2 = await boot(makeStudio, { dataDir: dir });
  const c = await s2.client();
  assert.deepEqual(c.welcome.notices.map((n) => n.id), ['deploy']);
  await s2.stop();
});

test('janela de manutenção: não começam partidas novas desse jogo; as outras continuam', async () => {
  const s = await boot(makeStudio);
  const c = await s.client();
  const created = c.next('room');
  c.createSolo('catania', 2);
  const { room } = await created;
  s.platform.notify({ id: 'm', key: 'notice.UPDATE_AT', at: Date.now() + 3600_000, maintenance: { games: ['catania'] } });
  const err = c.next('error');
  c.createSolo('catania', 2);
  assert.equal((await err).code, 'server.MAINTENANCE');
  const moved = c.next('room', (m) => m.seq === 1);
  c.move(room.id, { type: 'END_TURN' });
  await moved;
  s.platform.clearNotice('m');
  const again = c.next('room', (m) => m.room.id !== room.id);
  c.createSolo('catania', 2);
  await again;
  await s.stop();
});

test('admin: avisos por HTTP com ADMIN_TOKEN; sem token as rotas não existem', async () => {
  const off = await boot(makeStudio, { adminToken: undefined });
  assert.equal((await fetch(`http://localhost:${off.port}/admin/notices`)).status, 404);
  await off.stop();

  const s = await boot(makeStudio, { adminToken: 'segredo' });
  const url = `http://localhost:${s.port}/admin/notices`;
  const auth = { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' };
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer errado' } })).status, 401);
  const c = await s.client();
  const got = c.next('notices');
  const post = await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ text: { pt: 'Olá', en: 'Hi' }, level: 'warn' }) });
  assert.equal(post.status, 201);
  const n = await post.json();
  assert.deepEqual((await got).notices[0].text, { pt: 'Olá', en: 'Hi' });
  assert.equal((await (await fetch(url, { headers: auth })).json()).notices.length, 1);
  assert.equal((await fetch(`${url}/${n.id}`, { method: 'DELETE', headers: auth })).status, 204);
  assert.equal((await fetch(url, { method: 'POST', headers: auth, body: '{}' })).status, 400);
  await s.stop();
});

test('o ROOM traz o prazo absoluto de cada timer do jogo', async () => {
  const s = await boot(() => createPlatform({ games: [race], botDelayMs: [60_000, 60_001], logger: quiet }));
  const c = await s.client();
  const created = c.next('room');
  c.createSolo('race', 2);
  const msg = await created;
  assert.equal(msg.timers.length, 1);
  const [t] = msg.timers;
  assert.equal(t.key, 'turn');
  assert.equal(t.event, 'TIMEOUT');
  assert.ok(Math.abs(t.at - (msg.now + 10_000)) < 1000, 'vence 10 s depois de agendado');
  await s.stop();
});

test('consola: /console e /admin/status, /admin/games só com ADMIN_TOKEN', async () => {
  const off = await boot(makeStudio, { adminToken: undefined });
  assert.equal((await fetch(`http://localhost:${off.port}/console`)).status, 404);
  await off.stop();

  const s = await boot(makeStudio, { adminToken: 'segredo' });
  const base = `http://localhost:${s.port}`;
  const auth = { Authorization: 'Bearer segredo' };
  const page = await fetch(`${base}/console`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>Consola · Bitnik<\/title>/);
  assert.equal((await fetch(`${base}/console.js`)).status, 200);
  assert.equal((await fetch(`${base}/admin/status`)).status, 401);
  await s.client();
  const st = await (await fetch(`${base}/admin/status`, { headers: auth })).json();
  assert.equal(st.engineVersion, '0.2.0');
  assert.equal(st.studio, true);
  assert.equal(st.online, 1);
  assert.equal(st.rooms.total, 3);
  const { games } = await (await fetch(`${base}/admin/games`, { headers: auth })).json();
  assert.equal(games[0].id, 'catania');
  assert.equal(games[0].name, 'Catania');
  assert.deepEqual(games[0].problems, []);
  await s.stop();
});

test('consola: simulação por HTTP devolve vitórias por lugar para cada número de jogadores', async () => {
  const s = await boot(makeStudio, { adminToken: 'segredo' });
  const r = await fetch(`http://localhost:${s.port}/admin/games/catania/simulate`, {
    method: 'POST', headers: { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' }, body: JSON.stringify({ games: 30 }),
  });
  const { results } = await r.json();
  assert.deepEqual(results.map((x) => x.numPlayers), [2, 3, 4]);
  for (const x of results) {
    assert.equal(x.finished, 30);
    assert.deepEqual(x.failures, []);
    assert.equal(x.winRateBySeat.length, x.numPlayers);
    assert.ok(Math.abs(x.winRateBySeat.reduce((a, b) => a + b, 0) - 100) < 1);
  }
  await s.stop();
});

test('mesas de aprovação: criadas na consola, só entra quem tem o link, jogam-se até ao fim', async () => {
  const s = await boot(makeStudio, { adminToken: 'segredo' });
  const url = `http://localhost:${s.port}/admin/tables`;
  const auth = { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' };
  const created = await (await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ gameId: 'catania', numPlayers: 3, name: 'Revisão <b>' }) })).json();
  assert.equal(created.kind, 'invite');
  assert.equal(created.name, 'Revisão b');
  assert.equal(created.link, `/#/r/${created.id}`);
  assert.equal((await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ gameId: 'catania', numPlayers: 9 }) })).status, 400);

  const a = await s.client(memStore(), 'Ana');
  const rooms = await new Promise((r) => { a.on('rooms', r); a.list(); });
  assert.ok(!rooms.public.some((x) => x.id === created.id), 'não aparece no lobby público');
  const seated = a.next('room', (m) => m.seat === 0);
  a.join(created.id);
  await seated;
  const mine = await new Promise((r) => { a.on('rooms', r); a.list(); });
  assert.ok(mine.mine.some((x) => x.id === created.id), 'aparece em "as minhas mesas" de quem se sentou');
  const started = a.next('room', (m) => m.room.status === 'playing');
  a.start(created.id);
  await started;
  const end = await playToEnd(a, created.id);
  assert.ok(end.result);
  const { tables } = await (await fetch(url, { headers: auth })).json();
  assert.equal(tables[0].id, created.id);
  assert.ok(tables[0].result || tables[0].status === 'waiting');
  assert.equal((await fetch(`${url}/${created.id}`, { method: 'DELETE', headers: auth })).status, 204);
  assert.ok(!s.platform.rooms.has(created.id));
  await s.stop();
});

test('UI própria: o servidor serve a UI e as regras do pacote, nunca os testes', async () => {
  const s = await boot(makeStudio);
  const base = `http://localhost:${s.port}`;
  const c = await s.client();
  assert.equal(c.welcome.games[0].ui, '/games/catania/ui/index.js');
  assert.equal(c.welcome.games[0].tutorial, '/games/catania/ui/tutorial.js');
  assert.equal((await fetch(`${base}/games/catania/scenarios.js`)).status, 200, 'cenários para o tutorial');
  const ui = await fetch(`${base}/games/catania/ui/index.js`);
  assert.equal(ui.status, 200);
  assert.match(ui.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${base}/games/catania/rules.js`)).status, 200, 'regras para o tutorial no browser');
  assert.equal((await fetch(`${base}/games/catania/ui/skin.json`)).status, 200);
  assert.equal((await fetch(`${base}/games/catania/test/catania.test.js`)).status, 404);
  assert.equal((await fetch(`${base}/games/catania/%2e%2e/%2e%2e/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/games/catania/REGRAS.md`)).status, 404);
  assert.match(await (await fetch(`${base}/`)).text(), /"@bitnik\/engine": "\/engine\/index\.js"/, 'import map');
  await s.stop();
});

test('aparência: catálogo com skin e temas; afinações validadas, enviadas aos ligados e guardadas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const s = await boot(makeStudio, { adminToken: 'segredo', dataDir: dir });
  const url = `http://localhost:${s.port}/admin/appearance`;
  const auth = { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' };
  const put = (body) => fetch(url, { method: 'PUT', headers: auth, body: JSON.stringify(body) });

  const cat = await (await fetch(url, { headers: auth })).json();
  const catania = cat.games.find((g) => g.id === 'catania');
  assert.ok(catania.skin.tokens['--table-bg'], 'a skin define a mesa');
  assert.equal(catania.themes.dia.name.pt, 'Dia');
  assert.equal(catania.meta.preview.scenario, 'tutorial-meio');
  assert.ok('--brand-primary' in cat.brandTokens);

  // Recusas: token que não existe, tema que não existe, tentativa de fugir da declaração, url perigoso.
  assert.equal((await put({ games: { catania: { tokens: { '--nao-existe': '#fff' } } } })).status, 400);
  assert.equal((await put({ games: { catania: { theme: 'noite' } } })).status, 400);
  assert.equal((await put({ games: { catania: { tokens: { '--cat-gold': 'red;}body{display:none' } } } })).status, 400);
  assert.equal((await put({ games: { catania: { tokens: { '--table-bg': 'url(javascript:alert(1))' } } } })).status, 400);
  assert.equal((await put({ games: { catania: { tokens: { '--cat-gold': 'url(https://x.pt/a.png)' } } } })).status, 400, 'url só em fundos e imagens');
  assert.equal((await put({ brand: { tokens: { '--qualquer': '#fff' } } })).status, 400);

  const c = await s.client();
  const live = c.next('appearance');
  const png = 'url("data:image/png;base64,iVBORw0KGgo=") center / cover no-repeat';
  const ok = await put({
    brand: { tokens: { '--brand-primary': '#123456' } },
    games: { catania: { theme: 'dia', tokens: { '--cat-gold': '#ff0000', '--table-bg': png } } },
  });
  assert.equal(ok.status, 200);
  const { appearance } = await live;
  assert.equal(appearance.games.catania.theme, 'dia');
  assert.equal(appearance.games.catania.tokens['--table-bg'], png);
  const later = await s.client();
  assert.equal(later.welcome.appearance.brand.tokens['--brand-primary'], '#123456');
  assert.match(await (await fetch(`http://localhost:${s.port}/`)).text(), /id="appearance-brand">:root\{--brand-primary:#123456\}/);
  assert.equal((await fetch(`http://localhost:${s.port}/console-appearance.js`)).status, 200);
  await new Promise((r) => setTimeout(r, 50));
  await s.stop();

  const s2 = await boot(makeStudio, { dataDir: dir });
  const again = await s2.client();
  assert.equal(again.welcome.appearance.games.catania.tokens['--cat-gold'], '#ff0000', 'sobrevive a um restart');
  assert.equal(again.welcome.games[0].themes.dia, '/games/catania/ui/themes/dia/theme.json');
  await s2.stop();
});

test('Figma: exporta tokens em W3C Design Tokens e a volta dá a aparência certa', async () => {
  const { exportAll, defaultsFor } = await import('../tools/figma.js');
  const { designTokensToAppearance, readDesignTokens, isDesignTokens } = await import('../packages/server/public/design-tokens.js');
  const files = await exportAll();
  assert.deepEqual(Object.keys(files).sort(), ['brand.tokens.json', 'catania.default.tokens.json', 'catania.dia.tokens.json', 'vanilla.tokens.json']);
  const vanilla = readDesignTokens(files['vanilla.tokens.json']);
  assert.ok(vanilla.some((t) => t.name === '--table-bg'), 'a vanilla também define a mesa');
  const defaults = await defaultsFor();

  // Sem alterações no Figma: nada fica fixado, só o tema do modo exportado.
  const dia = files['catania.dia.tokens.json'];
  assert.ok(isDesignTokens(dia));
  assert.deepEqual(designTokensToAppearance(dia, { defaults }), { brand: { tokens: {} }, games: { catania: { theme: 'dia', tokens: {} } } });

  // O designer muda uma cor no Figma: só essa volta.
  const changed = structuredClone(files['catania.default.tokens.json']);
  changed.catania.base['cat-gold'].$value = '#00aaff';
  assert.deepEqual(designTokensToAppearance(changed, { defaults }).games.catania, { theme: null, tokens: { '--cat-gold': '#00aaff' } });
});
