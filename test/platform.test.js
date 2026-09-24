// Testes ponta a ponta: servidor real + SDK de cliente por WebSocket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BitnikClient } from '@bitnik/client';
import { fileStorage } from '@bitnik/server';
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

test('ficheiros de storage de outro jogo ou versão incompatível não partem o arranque', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitnik-'));
  const st = fileStorage(dir);
  await st.load();
  await st.saveRoom({ id: 'x', gameId: 'nao-existe', kind: 'solo', seats: [] });
  await st.saveRoom({ id: 'solo-old', gameId: 'catania', kind: 'solo', owner: 'u', seats: [{ userId: 'u' }], match: { gameVersion: '1.0.0', timers: [] }, status: 'playing' });
  const s = await boot(makeStudio, { dataDir: dir });
  assert.ok(!s.platform.rooms.has('x'));
  assert.ok(!s.platform.rooms.has('solo-old'));
  await s.stop();
});
