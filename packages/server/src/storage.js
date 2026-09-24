// Adaptadores de persistência. O servidor só conhece esta interface:
//   load()            → { users: {token: user}, rooms: [room] }
//   saveRoom(room)    / deleteRoom(id) / saveUsers(users)
//   saveNotices(list) (opcional; load() devolve também { notices })
// O match é JSON puro, por isso guardar uma sala é só serializá-la.
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function memoryStorage() {
  const rooms = new Map();
  let users = {};
  let notices = [];
  return {
    async load() {
      return { users: structuredClone(users), rooms: [...rooms.values()].map((r) => structuredClone(r)), notices: structuredClone(notices) };
    },
    async saveRoom(room) { rooms.set(room.id, structuredClone(room)); },
    async deleteRoom(id) { rooms.delete(id); },
    async saveUsers(u) { users = structuredClone(u); },
    async saveNotices(n) { notices = structuredClone(n); },
  };
}

/**
 * Um ficheiro JSON por sala + users.json. Escrita atómica (tmp + rename)
 * e em série por ficheiro, para um restart a meio não deixar JSON partido.
 * Em Railway, aponta `dir` para um volume.
 */
export function fileStorage(dir) {
  const roomsDir = join(dir, 'rooms');
  const queues = new Map();
  const safe = (id) => id.replace(/[^a-zA-Z0-9_-]/g, '_');

  const write = (file, data) => {
    const prev = queues.get(file) || Promise.resolve();
    const next = prev.then(async () => {
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(data));
      await rename(tmp, file);
    }).catch((e) => console.error('[storage]', file, e.message));
    queues.set(file, next);
    return next;
  };

  return {
    async load() {
      await mkdir(roomsDir, { recursive: true });
      let users = {};
      try { users = JSON.parse(await readFile(join(dir, 'users.json'), 'utf8')); } catch { /* primeira vez */ }
      const rooms = [];
      for (const f of await readdir(roomsDir)) {
        if (!f.endsWith('.json')) continue;
        try { rooms.push(JSON.parse(await readFile(join(roomsDir, f), 'utf8'))); } catch (e) {
          console.error('[storage] sala ilegível', f, e.message);
        }
      }
      let notices = [];
      try { notices = JSON.parse(await readFile(join(dir, 'notices.json'), 'utf8')); } catch { /* sem avisos */ }
      return { users, rooms, notices };
    },
    saveRoom: (room) => write(join(roomsDir, `${safe(room.id)}.json`), room),
    async deleteRoom(id) {
      const file = join(roomsDir, `${safe(id)}.json`);
      await (queues.get(file) || Promise.resolve());
      await rm(file, { force: true });
    },
    saveUsers: (users) => write(join(dir, 'users.json'), users),
    saveNotices: (notices) => write(join(dir, 'notices.json'), notices),
  };
}
