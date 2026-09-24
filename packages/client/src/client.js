// @bitnik/client — SDK de browser (também corre em Node 22+).
// Trata da identidade (token guardado localmente), da reconexão com
// backoff e de reabrir a mesa aberta. Qualquer UI de jogo, genérica ou
// feita à medida, fala com o servidor só através disto.
//
//   const client = new BitnikClient();
//   client.on('room', (msg) => render(msg));
//   client.connect();
//   client.move(roomId, { type: 'COLLECT', payload: { hex: 3 } });

const TOKEN_KEY = 'bitnik.token';

function defaultUrl() {
  const loc = globalThis.location;
  if (!loc) throw new Error('BitnikClient: indica o url fora do browser');
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws`;
}

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export class BitnikClient {
  constructor({ url, storage, name, lang, WebSocketImpl } = {}) {
    this.url = url || defaultUrl();
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.name = name;
    this.lang = lang;
    this.WS = WebSocketImpl || globalThis.WebSocket;
    this.listeners = new Map();
    this.ws = null;
    this.retry = 0;
    this.openRoom = null;
    this.welcome = null;
    this.closed = false;
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }

  emit(type, data) {
    for (const fn of this.listeners.get(type) || []) fn(data);
    for (const fn of this.listeners.get('*') || []) fn({ type, data });
  }

  /** Espera pela próxima mensagem de um tipo (útil em testes). */
  next(type, predicate = () => true) {
    return new Promise((resolve) => {
      const off = this.on(type, (d) => { if (predicate(d)) { off(); resolve(d); } });
    });
  }

  connect() {
    this.closed = false;
    const ws = new this.WS(this.url);
    this.ws = ws;
    this.emit('status', 'connecting');
    ws.onopen = () => {
      this.retry = 0;
      this.emit('status', 'open');
      this.send('HELLO', { token: this.storage?.getItem(TOKEN_KEY) || null, name: this.name, lang: this.lang });
      clearInterval(this.ping);
      this.ping = setInterval(() => this.send('PING'), 20_000);
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.type === 'WELCOME') {
        this.welcome = msg;
        this.storage?.setItem(TOKEN_KEY, msg.token);
        if (this.openRoom) this.send('OPEN', { roomId: this.openRoom });
      }
      if (msg.type === 'ROOM') {
        this.openRoom = msg.room.id;
        this.seq = msg.seq ?? null; // último estado confirmado que o jogador viu
      }
      this.emit(msg.type.toLowerCase(), msg);
    };
    ws.onclose = () => {
      clearInterval(this.ping);
      this.emit('status', 'closed');
      if (this.closed) return;
      const wait = Math.min(10_000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), wait);
    };
    ws.onerror = () => {};
    return this;
  }

  close() { this.closed = true; clearInterval(this.ping); this.ws?.close(); }

  /** Envia uma mensagem. Devolve false se não houver ligação (nada é enviado). */
  send(type, data = {}) {
    if (this.ws?.readyState !== 1) return false;
    this.ws.send(JSON.stringify({ type, ...data }));
    return true;
  }

  // Açúcar para o protocolo.
  setName(name) { return this.send('SET_NAME', { name }); }
  list() { return this.send('LIST'); }
  createSolo(gameId, numPlayers, level) { return this.send('CREATE_SOLO', { gameId, numPlayers, level }); }
  open(roomId) { this.openRoom = roomId; this.send('OPEN', { roomId }); }
  closeRoom() { this.openRoom = null; this.send('CLOSE'); }
  join(roomId) { this.openRoom = roomId; return this.send('JOIN', { roomId }); }
  leave(roomId) { if (this.openRoom === roomId) this.openRoom = null; this.send('LEAVE', { roomId }); }
  start(roomId) { return this.send('START', { roomId }); }
  /**
   * Envia uma jogada com o seq do estado que o jogador viu. Devolve false
   * sem ligação: a UI deve avisar, e ao reconectar recebe o estado atual.
   */
  move(roomId, move) {
    const seq = roomId === this.openRoom ? this.seq : undefined;
    return this.send('MOVE', { roomId, move, seq });
  }
  restart(roomId) { this.send('RESTART', { roomId }); }
  remove(roomId) { this.send('DELETE', { roomId }); }
}
