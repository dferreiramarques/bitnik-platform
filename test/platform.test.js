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
    match: { gameVersion: '4.0.0', engineVersion: '0.2.0', seq: 4, timers: [{ key: 't', delayMs: 1, event: 'X', seq: 4 }], state: {}, ...match },
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
  assert.deepEqual(old.expired, { reason: 'game', from: '1.0.0', to: '4.0.0' });
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
  await oldSolo(dir, { gameVersion: '4.0.0', engineVersion: '0.1.0' });
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

test('PWA: service worker com versão por conteúdo e o que o tutorial precisa para funcionar offline', async () => {
  const s = await boot(makeStudio);
  const base = `http://localhost:${s.port}`;
  const res = await fetch(`${base}/sw.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  const js = await res.text();
  assert.doesNotMatch(js, /\{\{/, 'sem marcadores por preencher');
  const { version, precache } = s.platform.serviceWorker;
  assert.match(js, new RegExp(`const VERSION = '${version}'`));
  for (const f of ['/', '/app.js', '/sdk/client.js', '/engine/index.js', '/games/catania/ui/tutorial.js', '/games/catania/scenarios.js', '/games/catania/i18n/pt.js']) {
    assert.ok(precache.includes(f), `guarda ${f}`);
  }
  assert.ok(!precache.some((f) => f.includes('/test/') || f.startsWith('/console') || f.startsWith('/admin')), 'nunca testes, consola nem admin');
  const again = await boot(makeStudio);
  assert.equal(again.platform.serviceWorker.version, version, 'a mesma versão enquanto nada muda');
  await again.stop();
  const other = await boot(makeRuntime);
  assert.notEqual(other.platform.serviceWorker.version, version, 'outra marca, outra versão');
  await other.stop();
  const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  await s.stop();
});

test('Forge: projetos no Studio; importar do Rule Forge; guardar normalizado; sobrevive a restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const s = await boot(makeStudio, { adminToken: 'segredo', dataDir: dir });
  const url = `http://localhost:${s.port}/admin/forge`;
  const auth = { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' };
  assert.equal((await fetch(url)).status, 401);

  // Importar o exemplo do Rule Forge (bitnik-logic/examples/capivaras.json).
  const rf = JSON.parse(await readFile(new URL('./fixtures/rule-forge-capivaras.json', import.meta.url), 'utf8'));
  const imp = await (await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ project: rf }) })).json();
  assert.equal(imp.slug, 'capivaras');
  assert.equal(imp.project.nodes.length, rf.nodes.length);
  assert.equal(imp.project.cards.length, rf.cards.length);
  assert.ok(imp.project.cards.every((c) => c.category === 'regra'), 'sem categoria, cada cartão começa como regra');

  // Um segundo com o mesmo nome ganha outro slug; um projeto novo só com nome.
  const again = await (await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ project: rf }) })).json();
  assert.equal(again.slug, 'capivaras-2');
  const novo = await (await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ gameName: 'Farol à Vista!' }) })).json();
  assert.equal(novo.slug, 'farol-a-vista');
  assert.deepEqual(novo.project.cards, []);

  // Guardar: campos desconhecidos saem, ligações inválidas saem, categoria válida fica.
  const p = structuredClone(imp.project);
  p.cards[4].category = 'plataforma';
  p.cards[0].kind = 'NAO_EXISTE';
  p.edges.push({ from: 'n1', to: 'nao-existe' }, { from: 'n1', to: 'n1' });
  p.intruso = '<script>';
  const saved = await (await fetch(`${url}/capivaras`, { method: 'PUT', headers: auth, body: JSON.stringify(p) })).json();
  assert.equal(saved.project.cards[4].category, 'plataforma');
  assert.equal(saved.project.cards[0].kind, 'ACTION');
  assert.equal(saved.project.edges.length, rf.edges.length);
  assert.equal(saved.project.intruso, undefined);

  const list = (await (await fetch(url, { headers: auth })).json()).projects;
  assert.deepEqual(list.map((x) => x.slug).sort(), ['capivaras', 'capivaras-2', 'farol-a-vista']);
  assert.equal((await fetch(`${url}/capivaras-2`, { method: 'DELETE', headers: auth })).status, 204);
  assert.equal((await fetch(`${url}/capivaras-2`, { headers: auth })).status, 404);
  assert.equal((await fetch(`${url}/..%2F..%2Fusers`, { headers: auth })).status, 404);
  await new Promise((r) => setTimeout(r, 50));
  await s.stop();

  const s2 = await boot(makeStudio, { adminToken: 'segredo', dataDir: dir });
  const back = await (await fetch(`http://localhost:${s2.port}/admin/forge/capivaras`, { headers: auth })).json();
  assert.equal(back.project.cards[4].category, 'plataforma');
  assert.equal((await (await fetch(`http://localhost:${s2.port}/admin/forge`, { headers: auth })).json()).projects.length, 2);
  await s2.stop();

  // Nos runtimes dos clientes a Forge não existe.
  const rt = await boot(makeRuntime, { adminToken: 'segredo' });
  assert.equal((await fetch(`http://localhost:${rt.port}/admin/forge`, { headers: auth })).status, 404);
  await rt.stop();
});

test('Forge: partida narrada com dúvidas e commits das regras com versão 0.x', async () => {
  const s = await boot(makeStudio, { adminToken: 'segredo' });
  const url = `http://localhost:${s.port}/admin/forge`;
  const auth = { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' };
  const post = (path, body) => fetch(`${url}${path}`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  const { slug } = await (await post('', { gameName: 'Farol' })).json();
  assert.equal((await (await fetch(`${url}/${slug}`, { headers: auth })).json()).project.version, '0.0.0');

  // Commit das regras: 0.1.0; só texto: 0.1.1; regras outra vez: 0.2.0.
  const c1 = await (await post(`/${slug}/commit`, { message: 'primeira versão' })).json();
  assert.equal(c1.commit.version, '0.1.0');
  assert.equal((await (await post(`/${slug}/commit`, { kind: 'texto', message: 'gralha' })).json()).commit.version, '0.1.1');
  const c3 = await (await post(`/${slug}/commit`, { message: 'fim do jogo' })).json();
  assert.equal(c3.project.version, '0.2.0');
  assert.equal(c3.project.ruleCommits.length, 3);

  // Um PUT não reescreve os commits.
  const put = await (await fetch(`${url}/${slug}`, { method: 'PUT', headers: auth, body: JSON.stringify({ ...c3.project, ruleCommits: [] }) })).json();
  assert.equal(put.project.ruleCommits.length, 3);

  // Partida narrada colada da IA, com uma dúvida em aberto.
  const narrada = {
    cenario: '2 jogadores, jogo completo', jogadores: 2,
    jogadas: [{ n: 1, jogador: 1, acao: 'Aposta na carta 3', cartoes: ['c4'], resultado: 'aposta registada', estado: { mesa: [1, 2, 3] } }],
    duvidas: [{ jogada: 1, pergunta: 'E se o baralho acabar a meio?', assumido: 'termina o jogo', cartoes: ['c12'] }],
    fim: { vencedor: 1 },
  };
  assert.equal((await post(`/${slug}/narrations`, { cenario: 'vazia', jogadas: [] })).status, 400);
  const n = await (await post(`/${slug}/narrations`, narrada)).json();
  assert.equal(n.narration.versaoRegras, '0.2.0', 'fica ligada à versão das regras');
  assert.equal(n.narration.duvidas[0].estado, 'aberta');
  assert.equal(typeof n.narration.jogadas[0].estado, 'string');

  // Não se aprova com dúvidas em aberto; resolvida, já dá.
  const p = n.project;
  p.narrations[0].aprovada = true;
  let saved = (await (await fetch(`${url}/${slug}`, { method: 'PUT', headers: auth, body: JSON.stringify(p) })).json()).project;
  assert.equal(saved.narrations[0].aprovada, false);
  p.narrations[0].duvidas[0].estado = 'resolvida';
  saved = (await (await fetch(`${url}/${slug}`, { method: 'PUT', headers: auth, body: JSON.stringify(p) })).json()).project;
  assert.equal(saved.narrations[0].aprovada, true);
  await s.stop();
});

test('Forge: um projeto guardado por uma versão anterior ganha os campos novos ao carregar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const st = fileStorage(dir);
  await st.load();
  await st.saveForgeProject('antigo', { gameName: 'Antigo', nodes: [{ id: 'n1', kind: 'FLOW', label: 'Início', x: 0, y: 0 }], edges: [], cards: [], rules: [], createdAt: 1, updatedAt: 2 });
  const s = await boot(makeStudio, { adminToken: 'segredo', dataDir: dir });
  const { project } = await (await fetch(`http://localhost:${s.port}/admin/forge/antigo`, { headers: { Authorization: 'Bearer segredo' } })).json();
  assert.deepEqual(project.narrations, []);
  assert.deepEqual(project.ruleCommits, []);
  assert.equal(project.version, '0.0.0');
  assert.equal(project.createdAt, 1);
  await s.stop();
});

test('Forge: testes a partir dos cartões; os aprovados ficam fixos', async () => {
  const s = await boot(makeStudio, { adminToken: 'segredo' });
  const url = `http://localhost:${s.port}/admin/forge`;
  const auth = { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' };
  const post = (path, body) => fetch(`${url}${path}`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  const { slug } = await (await post('', { gameName: 'Farol' })).json();
  assert.equal((await post(`/${slug}/tests`, { testes: [] })).status, 400);
  const resposta = {
    estado: '{ jogadores: [{ mao: [] }], mesa: [] }',
    testes: [
      { cartao: 'c1', nome: 'Aposta única ganha', dado: 'uma mesa com 4 cartas', quando: 'só um jogador aposta na carta 2', entao: 'ganha a carta', codigo: "test('x', () => {})" },
      { cartao: 'c2', nome: 'Empate', dado: 'a', quando: 'b', entao: 'c', codigo: "test('y', () => {})" },
    ],
  };
  let r = await (await post(`/${slug}/tests`, resposta)).json();
  assert.equal(r.tests.itens.length, 2);
  assert.ok(r.tests.itens.every((t) => !t.aprovado), 'chegam por aprovar');

  // Aprovar o primeiro e tentar mudá-lo por PUT: não muda.
  const p = r.project;
  p.tests.itens[0].aprovado = true;
  let saved = (await (await fetch(`${url}/${slug}`, { method: 'PUT', headers: auth, body: JSON.stringify(p) })).json()).project;
  assert.equal(saved.tests.itens[0].aprovado, true);
  saved.tests.itens[0].entao = 'outra coisa';
  saved = (await (await fetch(`${url}/${slug}`, { method: 'PUT', headers: auth, body: JSON.stringify(saved) })).json()).project;
  assert.equal(saved.tests.itens[0].entao, 'ganha a carta', 'um teste aprovado está fixo');
  // Um teste por aprovar edita-se na consola (código incluído).
  saved.tests.itens[1].codigo = "test('y', () => { assert.ok(true); })";
  saved = (await (await fetch(`${url}/${slug}`, { method: 'PUT', headers: auth, body: JSON.stringify(saved) })).json()).project;
  assert.equal(saved.tests.itens[1].codigo, "test('y', () => { assert.ok(true); })");

  // Nova resposta da IA: o aprovado fica, o outro é substituído.
  r = await (await post(`/${slug}/tests`, { testes: [{ cartao: 'c1', nome: 'mudado' }, { cartao: 'c2', nome: 'Empate v2' }] })).json();
  assert.deepEqual(r.tests.itens.map((t) => t.nome), ['Aposta única ganha', 'Empate v2']);
  assert.equal(r.tests.estado, resposta.estado, 'sem modelo novo, mantém o anterior');
  await s.stop();
});

test('Forge: verificação isolada de um pacote gerado (contrato, pureza, testes, simulação, limites)', async () => {
  const { verifyPackage } = await import('../packages/server/src/verify.js');
  const base = new URL('./fixtures/forge-pacote/', import.meta.url);
  const files = Object.fromEntries(await Promise.all(['index.js', 'i18n/pt.js', 'i18n/en.js'].map(async (f) => [f, await readFile(new URL(f, base), 'utf8')])));
  const t = (nome, codigo) => ({ cartao: 'c1', nome, aprovado: true, codigo });
  const passa = t('Avançar soma', "test('Avançar soma', () => { const m = createMatch(game, { numPlayers: 2, seed: 1 }); assert.equal(applyMove(game, m, 0, { type: 'AVANCAR', payload: { passos: 2 } }).match.state.pontos[0], 2); });");

  const ok = await verifyPackage({ files, tests: [passa] });
  assert.ok(ok.ok, JSON.stringify(ok.steps.filter((s) => !s.ok)));
  assert.equal(ok.tests.pass, 1);
  assert.ok(ok.simulation.every((x) => x.finished === x.games));

  const falha = await verifyPackage({ files, tests: [passa, t('Três passos', "test('Três passos', () => { assert.equal(1, 2); });")] });
  assert.equal(falha.ok, false);
  assert.deepEqual(falha.tests.failures.map((x) => x.name), ['Três passos']);

  const impuro = await verifyPackage({ files: { ...files, 'index.js': `${files['index.js']}\nconst x = Math.random();` }, tests: [passa] });
  assert.equal(impuro.steps.find((s) => s.id === 'pureza').ok, false);

  // Isolamento: ler fora da pasta é recusado; um ciclo infinito é parado.
  const fora = await verifyPackage({ files, tests: [t('Ler fora', "import('node:fs').then(); test('Ler fora', async () => { const fs = await import('node:fs'); fs.readFileSync(process.execPath); });")] });
  assert.match(fora.tests.failures[0]?.error ?? '', /restricted|permission|ERR_ACCESS_DENIED/i);
  const ciclo = await verifyPackage({ files, tests: [t('Ciclo', "test('Ciclo', () => { while (true) {} });")], timeoutMs: 4000 });
  assert.equal(ciclo.steps.find((s) => s.id === 'tempo')?.ok, false);

  assert.equal((await verifyPackage({ files: { '../fora.js': 'x' }, tests: [passa] })).steps[0].ok, false);

  // Testes que usam funções auxiliares: sem elas, o relatório diz que o problema é dos testes; com elas, passam.
  const usaAux = t('Com auxiliar', "test('Com auxiliar', () => { assert.equal(avancar(novo(), 0, 2).state.pontos[0], 2); });");
  const semAux = await verifyPackage({ files, tests: [usaAux] });
  assert.match(semAux.steps.find((s) => s.id === 'testes-auxiliares')?.details[0] ?? '', /avancar|novo/);
  const aux = [
    'const novo = () => createMatch(game, { numPlayers: 2, seed: 1 });',
    "const avancar = (m, lugar, passos) => applyMove(game, m, lugar, { type: 'AVANCAR', payload: { passos } }).match;",
  ].join('\n');
  const comAux = await verifyPackage({ files, tests: [usaAux], auxiliares: aux });
  assert.ok(comAux.ok, JSON.stringify(comAux.steps.filter((s) => !s.ok)));
  assert.equal((await verifyPackage({ files, tests: [] })).steps.find((s) => s.id === 'testes-aprovados').ok, false);
});

test('Forge: lê o JSON colado mesmo com texto à volta ou colado duas vezes', async () => {
  const { parseNarration } = await import('../packages/server/public/console-forge-play.js');
  const obj = { files: { 'index.js': "const a = '}{';\nexport default { x: \"{\" };" } };
  const j = JSON.stringify(obj);
  assert.deepEqual(parseNarration(j + j), obj);
  assert.deepEqual(parseNarration(`Aqui está {o pacote}:\n\`\`\`json\n${j}\n\`\`\`\nBom jogo!`), obj);
  assert.throws(() => parseNarration('sem nada'), /sem JSON/);
});

test('Forge: instalar o pacote verificado como protótipo, sem reiniciar, e voltar a carregá-lo no arranque', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const base = new URL('./fixtures/forge-pacote/', import.meta.url);
  const files = Object.fromEntries(await Promise.all(['index.js', 'i18n/pt.js', 'i18n/en.js'].map(async (f) => [f, await readFile(new URL(f, base), 'utf8')])));
  const auth = { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' };
  const gamesDir = join(dir, 'games');
  let s = await boot(makeStudio, { adminToken: 'segredo', dataDir: dir, gamesDir });
  const url = `http://localhost:${s.port}/admin/forge`;
  const post = (path, body = {}) => fetch(`${url}${path}`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  const { slug } = await (await post('', { gameName: 'Corrida Simples' })).json();
  assert.equal(slug, 'corrida-simples');
  assert.equal((await post(`/${slug}/install`)).status, 400, 'sem verificação não instala');
  assert.equal((await post(`/${slug}/publish`)).status, 400, 'sem protótipo não publica');

  await post(`/${slug}/commit`, { message: 'regras' });
  const { project } = await (await post(`/${slug}/tests`, { testes: [{ cartao: 'c1', nome: 'Soma', codigo: "test('Soma', () => { assert.equal(applyMove(game, createMatch(game, { numPlayers: 2, seed: 1 }), 0, { type: 'AVANCAR', payload: { passos: 1 } }).match.state.pontos[0], 1); });" }] })).json();
  project.tests.itens[0].aprovado = true;
  await fetch(`${url}/${slug}`, { method: 'PUT', headers: auth, body: JSON.stringify(project) });
  const v = await (await post(`/${slug}/verify`, { files })).json();
  assert.ok(v.report.ok, JSON.stringify(v.report.steps.filter((x) => !x.ok)));

  const inst = await (await post(`/${slug}/install`)).json();
  assert.equal(inst.prototype.version, '0.1.0');
  const c = await s.client();
  const g = c.welcome.games.find((x) => x.id === slug);
  assert.ok(g?.prototype, 'aparece no lobby como protótipo');
  const rooms = await new Promise((r) => { c.on('rooms', r); c.list(); });
  assert.ok(rooms.public.some((r) => r.gameId === slug), 'com mesas públicas');
  // Joga-se: uma mesa com bots começa com o protótipo.
  const created = c.next('room');
  c.createSolo(slug, 2);
  assert.equal((await created).room.gameId, slug);

  // Publicar: grava games/<id>/ como 1.0.0, com testes, regras e histórico; só uma vez.
  const pub = await (await post(`/${slug}/publish`)).json();
  assert.equal(pub.published.version, '1.0.0', JSON.stringify(pub));
  for (const f of ['index.js', 'i18n/pt.js', 'i18n/en.js', 'test/forge.test.js', 'REGRAS.md', 'CHANGELOG.md', 'package.json']) {
    assert.ok(pub.published.files.includes(f), f);
  }
  const pubDir = join(gamesDir, slug);
  assert.match(await readFile(join(pubDir, 'index.js'), 'utf8'), /version: '1\.0\.0'/);
  assert.match(await readFile(join(pubDir, 'test', 'forge.test.js'), 'utf8'), /test\('Soma'/);
  assert.equal(JSON.parse(await readFile(join(pubDir, 'package.json'), 'utf8')).name, '@bitnik/game-corrida-simples');
  assert.match(await readFile(join(pubDir, 'CHANGELOG.md'), 'utf8'), /## 1\.0\.0/);
  assert.equal((await post(`/${slug}/publish`)).status, 400, 'não publica duas vezes');
  await s.stop();

  // Depois de reiniciar, o protótipo volta a estar instalado.
  s = await boot(makeStudio, { adminToken: 'segredo', dataDir: dir, gamesDir });
  const games = (await (await fetch(`http://localhost:${s.port}/admin/games`, { headers: auth })).json()).games;
  assert.ok(games.find((x) => x.id === slug)?.prototype);
  await s.stop();
});

test('Forge: cada mesa fica presa à versão do protótipo com que começou; as versões sem mesas saem', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const base = new URL('./fixtures/forge-pacote/', import.meta.url);
  const v1 = Object.fromEntries(await Promise.all(['index.js', 'i18n/pt.js', 'i18n/en.js'].map(async (f) => [f, await readFile(new URL(f, base), 'utf8')])));
  // A 0.2.0 deixa avançar 3 passos; a 0.1.0 não.
  const v2 = { ...v1, 'index.js': v1['index.js'].replace("version: '0.1.0'", "version: '0.2.0'").replace('passos !== 1 && passos !== 2', 'passos < 1 || passos > 3') };
  const auth = { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' };
  const opts = { adminToken: 'segredo', dataDir: dir, botDelayMs: [60_000, 60_001] };
  let s = await boot(makeStudio, opts);
  const url = `http://localhost:${s.port}/admin/forge`;
  const post = async (path, body = {}) => (await fetch(`${url}${path}`, { method: 'POST', headers: auth, body: JSON.stringify(body) })).json();
  const { slug } = await post('', { gameName: 'Corrida Simples' });
  const { project } = await post(`/${slug}/tests`, { testes: [{ cartao: 'c1', nome: 'Soma', codigo: "test('Soma', () => { assert.equal(applyMove(game, createMatch(game, { numPlayers: 2, seed: 1 }), 0, { type: 'AVANCAR', payload: { passos: 1 } }).match.state.pontos[0], 1); });" }] });
  project.tests.itens[0].aprovado = true;
  await fetch(`${url}/${slug}`, { method: 'PUT', headers: auth, body: JSON.stringify(project) });
  const install = async (files) => {
    await post(`/${slug}/commit`, { message: 'regras' });
    assert.ok((await post(`/${slug}/verify`, { files })).report.ok);
    return (await post(`/${slug}/install`)).project;
  };
  await install(v1);

  const c = await s.client();
  const created = c.next('room');
  c.createSolo(slug, 2);
  const { room: antiga } = await created;
  assert.equal(antiga.version, '0.1.0');

  let p = await install(v2);
  assert.deepEqual(p.prototypes.map((x) => x.version), ['0.1.0', '0.2.0'], 'a 0.1.0 fica: tem uma mesa');
  const tres = { type: 'AVANCAR', payload: { passos: 3 } };
  const recusa = c.next('error');
  c.move(antiga.id, tres);
  assert.equal((await recusa).code, 'err.PASSOS', 'a mesa antiga continua com as regras 0.1.0');

  const nova = c.next('room');
  c.createSolo(slug, 2);
  const { room } = await nova;
  assert.equal(room.version, '0.2.0');
  const ok = c.next('room', (m) => m.room.id === room.id && m.seq === 1);
  c.move(room.id, tres);
  assert.equal((await ok).view.pontos[0], 3);
  await s.stop();

  // Depois de reiniciar, a mesa antiga continua na 0.1.0 (não fica "versão antiga").
  s = await boot(makeStudio, opts);
  const c2 = await s.client(c.storage);
  const reaberta = c2.next('room');
  c2.open(antiga.id);
  const r = await reaberta;
  assert.equal(r.room.status, 'playing');
  assert.equal(r.room.version, '0.1.0');

  // Sem mesas na 0.1.0, a instalação seguinte limpa-a.
  c2.remove(antiga.id);
  await new Promise((res) => setTimeout(res, 100));
  p = (await (await fetch(`http://localhost:${s.port}/admin/forge/${slug}/install`, { method: 'POST', headers: auth, body: '{}' })).json()).project;
  assert.deepEqual(p.prototypes.map((x) => x.version), ['0.2.0']);
  await s.stop();
});

test('Forge: com testes aprovados, as funções auxiliares atuais ficam e só entram as novas', async () => {
  const { mergeTests, mergeHelpers } = await import('../packages/server/src/forge.js');
  const antigas = "const novo = (n) => createMatch(game, { numPlayers: n });\nconst iniciado = (n) => novo(n);";
  const novas = "import x from 'y';\nconst novo = (n = 3) => createMatch(game, { numPlayers: n, seed: 2 });\nconst ronda = (m, letras) =>\n  letras.reduce((a) => a, m);";
  assert.equal(mergeHelpers(antigas, novas), `${antigas}\nconst ronda = (m, letras) =>\n  letras.reduce((a) => a, m);`);
  const atual = { auxiliares: antigas, itens: [{ id: 't1', cartao: 'c1', nome: 'A', aprovado: true, codigo: 'iniciado(2)' }] };
  assert.match(mergeTests(atual, { auxiliares: novas, testes: [] }, '0.1.0').auxiliares, /iniciado[\s\S]*ronda/);
  // Sem aprovados, a resposta nova substitui tudo.
  const livre = mergeTests({ ...atual, itens: [{ ...atual.itens[0], aprovado: false }] }, { auxiliares: novas, testes: [] }, '0.1.0');
  assert.equal(livre.auxiliares, novas);
});

test('os ficheiros do browser (lobby e consola) não têm erros de sintaxe', async () => {
  const { spawnSync } = await import('node:child_process');
  const { readdirSync } = await import('node:fs');
  const dir = new URL('../packages/server/public/', import.meta.url);
  const { fileURLToPath } = await import('node:url');
  // sw.js é um modelo: o servidor preenche {{PRECACHE}} antes de o servir.
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'sw.js')) {
    const r = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(f, dir))], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr.split('\n').slice(0, 5).join('\n')}`);
  }
});
