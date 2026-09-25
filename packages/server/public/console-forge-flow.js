// Forge › Fluxo: editor de nós DATA / FLOW / ACTION / SCORE e ligações,
// portado (em versão compacta) do Rule Forge (bitnik-logic). Mexe
// diretamente em project.nodes / project.edges e avisa com onChange().
//
//   mountFlow(host, project, { t, onChange }) → { destroy() }

const KINDS = ['DATA', 'FLOW', 'ACTION', 'SCORE'];
const SVG_NS = 'http://www.w3.org/2000/svg';
const GRID = 12;
const snap = (v) => Math.round(v / GRID) * GRID;
const uid = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function mountFlow(host, project, { t, onChange }) {
  const view = { x: 40, y: 40, z: 1 };
  const past = [];
  const future = [];
  const snapshot = () => JSON.stringify({ nodes: project.nodes, edges: project.edges });
  /** Guarda o estado antes de uma alteração (anular volta a ele). */
  function remember() {
    past.push(snapshot());
    if (past.length > 100) past.shift();
    future.length = 0;
    syncHistory();
  }
  function restore(from, to) {
    if (!from.length) return;
    to.push(snapshot());
    const s = JSON.parse(from.pop());
    project.nodes = s.nodes;
    project.edges = s.edges;
    if (selected && !project.nodes.some((n) => n.id === selected)) selected = null;
    selectedEdge = null;
    onChange();
    draw();
    syncHistory();
  }
  function syncHistory() {
    const u = host.querySelector('[data-ff="undo"]');
    if (!u) return;
    u.disabled = !past.length;
    host.querySelector('[data-ff="redo"]').disabled = !future.length;
  }
  let selected = null;      // id do nó selecionado
  let selectedEdge = null;  // { from, to }

  host.innerHTML = `<div class="ff">
    <div class="ff-bar">
      <select class="ff-kind" aria-label="${t('ffKind')}">${KINDS.map((k) => `<option>${k}</option>`).join('')}</select>
      <button class="btn btn-primary" data-ff="add">${t('ffAdd')}</button>
      <span class="ff-sep"></span>
      <input class="ff-label" aria-label="${t('ffLabel')}" placeholder="${t('ffLabel')}" disabled>
      <select class="ff-selkind" aria-label="${t('ffKind')}" disabled>${KINDS.map((k) => `<option>${k}</option>`).join('')}</select>
      <button class="btn btn-ghost" data-ff="del" disabled>${t('ffDelete')}</button>
      <span class="ff-grow"></span>
      <button class="btn btn-ghost" data-ff="undo" aria-label="${t('ffUndo')}" title="${t('ffUndo')} (Ctrl+Z)" disabled>↶</button>
      <button class="btn btn-ghost" data-ff="redo" aria-label="${t('ffRedo')}" title="${t('ffRedo')} (Ctrl+Y)" disabled>↷</button>
      <button class="btn btn-ghost" data-ff="layout">${t('ffLayout')}</button>
      <button class="btn btn-ghost" data-ff="zout" aria-label="${t('ffZoomOut')}">−</button>
      <button class="btn btn-ghost" data-ff="zin" aria-label="${t('ffZoomIn')}">+</button>
      <button class="btn btn-ghost" data-ff="fit" aria-label="${t('ffFit')}">⤢</button>
    </div>
    <div class="ff-area">
      <div class="ff-canvas" tabindex="0" aria-label="${t('ffCanvas')}">
        <div class="ff-world"><svg class="ff-edges" width="1" height="1" overflow="visible"></svg></div>
        <svg class="ff-mini" aria-hidden="true"></svg>
      </div>
      <aside class="ff-panel" hidden></aside>
    </div>
    <p class="ff-help">${t('ffHelp')}</p>
  </div>`;
  const $ = (s) => host.querySelector(s);
  const canvas = $('.ff-canvas');
  const world = $('.ff-world');
  const edges = $('.ff-edges');

  const nodeById = (id) => project.nodes.find((n) => n.id === id);
  const nodeEl = (id) => world.querySelector(`.ff-node[data-id="${CSS.escape(id)}"]`);
  const counts = (id) => ({
    cards: project.cards.filter((c) => c.ref === id).length,
    text: project.rules.some((r) => r.ref === id && r.text.trim()),
  });

  // ─── Vista (arrastar e zoom) ─────────────────────────────
  const apply = () => {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
    canvas.style.backgroundSize = `${24 * view.z}px ${24 * view.z}px`;
    canvas.style.backgroundPosition = `${view.x}px ${view.y}px`;
  };
  const toWorld = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z };
  };
  const zoomAt = (f, px, py) => {
    const z = Math.min(2.5, Math.max(0.25, view.z * f));
    const wx = (px - view.x) / view.z;
    const wy = (py - view.y) / view.z;
    view.z = z; view.x = px - wx * z; view.y = py - wy * z;
    apply();
  };
  function fit() {
    if (!project.nodes.length || !canvas.clientWidth) { view.x = 40; view.y = 40; view.z = 1; apply(); return; }
    const els = [...world.querySelectorAll('.ff-node')];
    const minX = Math.min(...els.map((e) => e.offsetLeft));
    const minY = Math.min(...els.map((e) => e.offsetTop));
    const maxX = Math.max(...els.map((e) => e.offsetLeft + e.offsetWidth));
    const maxY = Math.max(...els.map((e) => e.offsetTop + e.offsetHeight));
    const pad = 40;
    view.z = Math.min(1.2, Math.max(0.25, Math.min((canvas.clientWidth - pad * 2) / (maxX - minX || 1), (canvas.clientHeight - pad * 2) / (maxY - minY || 1))));
    view.x = pad - minX * view.z + ((canvas.clientWidth - pad * 2) - (maxX - minX) * view.z) / 2;
    view.y = pad - minY * view.z;
    apply();
  }

  // ─── Desenho ─────────────────────────────────────────────
  function drawNodes() {
    world.querySelectorAll('.ff-node').forEach((n) => n.remove());
    for (const n of project.nodes) {
      const el = document.createElement('div');
      el.className = `ff-node${n.id === selected ? ' sel' : ''}`;
      el.dataset.id = n.id;
      el.dataset.kind = n.kind;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${n.kind}: ${n.label}`);
      el.style.left = `${n.x}px`;
      el.style.top = `${n.y}px`;
      const c = counts(n.id);
      el.innerHTML = `<span class="ff-k">${n.kind}</span><span class="ff-l"></span>
        <span class="ff-badges"><span title="${t('ffCards')}" class="${c.cards ? '' : 'miss'}">▤${c.cards}</span><span title="${t('ffText')}" class="${c.text ? '' : 'miss'}">¶</span></span>
        <i class="ff-handle" title="${t('ffHandle')}"></i>`;
      el.querySelector('.ff-l').textContent = n.label;
      world.append(el);
    }
  }

  function box(id) {
    const el = nodeEl(id);
    return el && { cx: el.offsetLeft + el.offsetWidth / 2, cy: el.offsetTop + el.offsetHeight / 2, hw: el.offsetWidth / 2, hh: el.offsetHeight / 2 };
  }
  // Onde a linha do centro de `a` para `b` sai do retângulo de `a`.
  function border(a, b) {
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    if (!dx && !dy) return { x: a.cx, y: a.cy };
    const k = Math.min(dx ? a.hw / Math.abs(dx) : Infinity, dy ? a.hh / Math.abs(dy) : Infinity);
    return { x: a.cx + dx * k, y: a.cy + dy * k };
  }
  function drawEdges() {
    const mk = (id, fill) => `<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="${fill}"/></marker>`;
    let html = `<defs>${mk('ffa', '#8b8a92')}${mk('ffs', 'currentColor')}</defs>`;
    for (const e of project.edges) {
      const a = box(e.from);
      const b = box(e.to);
      if (!a || !b) continue;
      const p1 = border(a, b);
      const p2 = border(b, a);
      const sel = selectedEdge && selectedEdge.from === e.from && selectedEdge.to === e.to;
      const hl = selected && (e.from === selected || e.to === selected);
      const attrs = `x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"`;
      html += `<line ${attrs} class="ff-hit" data-from="${e.from}" data-to="${e.to}"/>
        <line ${attrs} class="ff-edge${sel ? ' sel' : hl ? ' hl' : ''}" marker-end="url(#${sel ? 'ffs' : 'ffa'})"/>`;
    }
    edges.innerHTML = html;
  }
  function draw() { drawNodes(); drawEdges(); syncBar(); drawMini(); drawPanel(); }

  // ─── Minimapa ────────────────────────────────────────────
  function drawMini() {
    const mini = $('.ff-mini');
    const els = [...world.querySelectorAll('.ff-node')];
    if (!els.length) { mini.innerHTML = ''; return; }
    const minX = Math.min(...els.map((e) => e.offsetLeft)) - 40;
    const minY = Math.min(...els.map((e) => e.offsetTop)) - 40;
    const maxX = Math.max(...els.map((e) => e.offsetLeft + e.offsetWidth)) + 40;
    const maxY = Math.max(...els.map((e) => e.offsetTop + e.offsetHeight)) + 40;
    mini.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    const vw = canvas.clientWidth / view.z;
    const vh = canvas.clientHeight / view.z;
    mini.innerHTML = els.map((e) => `<rect class="k-${e.dataset.kind.toLowerCase()}" x="${e.offsetLeft}" y="${e.offsetTop}" width="${e.offsetWidth}" height="${e.offsetHeight}" rx="6"/>`).join('')
      + `<rect class="vp" x="${-view.x / view.z}" y="${-view.y / view.z}" width="${vw}" height="${vh}"/>`;
    mini.dataset.box = JSON.stringify([minX, minY, maxX - minX, maxY - minY]);
  }

  // ─── Painel do bloco ─────────────────────────────────────
  function drawPanel() {
    const panel = $('.ff-panel');
    const n = selected && nodeById(selected);
    panel.hidden = !n;
    if (!n) return;
    const cards = project.cards.filter((c) => c.ref === n.id);
    const rule = project.rules.find((r) => r.ref === n.id);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const warn = [];
    if (!cards.length) warn.push(t('ffNoCards'));
    const mismatch = cards.filter((c) => c.kind !== n.kind);
    if (mismatch.length) warn.push(t('ffKindMismatch', { n: mismatch.length, kind: n.kind }));
    if (!rule?.text.trim()) warn.push(t('ffNoText'));
    panel.innerHTML = `<h3><span class="ff-k">${n.kind}</span>${esc(n.label)}</h3>
      ${warn.length ? `<ul class="ff-warn">${warn.map((w) => `<li>⚠ ${esc(w)}</li>`).join('')}</ul>` : ''}
      ${mismatch.length ? `<button class="btn btn-outline" data-fp="fixkind">${t('ffFixKind', { kind: n.kind })}</button>` : ''}
      <h4>${t('ffCardsOf', { n: cards.length })}</h4>
      <ul class="ff-cards">${cards.map((c) => `<li><span class="pill">${esc(t(`cat_${c.category}`))}</span> ${esc(c.title || '—')}</li>`).join('')}</ul>
      <button class="btn btn-outline" data-fp="card">${t('ffAddCard')}</button>
      <h4>${t('ffRuleText')}</h4>
      <textarea class="ff-rule" rows="6" placeholder="${t('ffRuleHint')}">${esc(rule?.text ?? '')}</textarea>`;
  }

  function syncBar() {
    const n = selected && nodeById(selected);
    const label = $('.ff-label');
    const kind = $('.ff-selkind');
    label.disabled = !n; kind.disabled = !n;
    $('[data-ff="del"]').disabled = !n && !selectedEdge;
    if (n) { if (document.activeElement !== label) label.value = n.label; kind.value = n.kind; } else label.value = '';
  }
  function select(id, edge = null) { selected = id; selectedEdge = edge; draw(); }

  // ─── Edição ──────────────────────────────────────────────
  function addNode(x, y, kind = $('.ff-kind').value) {
    remember();
    const n = { id: uid(), kind, label: `${t('ffNew')} ${kind}`, x: snap(x), y: snap(y) };
    project.nodes.push(n);
    onChange();
    select(n.id);
    const input = $('.ff-label');
    input.focus();
    input.select();
    return n;
  }
  function link(from, to, record = true) {
    if (from === to || project.edges.some((e) => e.from === from && e.to === to)) return false;
    if (record) remember();
    project.edges.push({ from, to });
    onChange();
    return true;
  }
  function removeSelection() {
    if (selectedEdge || selected) remember();
    if (selectedEdge) {
      project.edges = project.edges.filter((e) => !(e.from === selectedEdge.from && e.to === selectedEdge.to));
    } else if (selected) {
      // Os cartões e as secções de regras desse bloco ficam guardados ("sem bloco").
      project.nodes = project.nodes.filter((n) => n.id !== selected);
      project.edges = project.edges.filter((e) => e.from !== selected && e.to !== selected);
    } else return;
    onChange();
    select(null);
  }

  // ─── Gestos ──────────────────────────────────────────────
  function track(e, move, end) {
    const sx = e.clientX;
    const sy = e.clientY;
    let started = false;
    const mv = (ev) => {
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
      started = true;
      move(ev, ev.clientX - sx, ev.clientY - sy);
    };
    const up = (ev) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); end?.(ev, started); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const handle = e.target.closest('.ff-handle');
    const nodeElx = e.target.closest('.ff-node');
    if (handle && nodeElx) {
      // Arrastar a bolinha: ligar a outro nó; largar no vazio cria um nó já ligado.
      e.preventDefault();
      const from = nodeElx.dataset.id;
      const a = box(from);
      const ghost = document.createElementNS(SVG_NS, 'line');
      ghost.setAttribute('class', 'ff-edge ghost');
      edges.append(ghost);
      track(e, (ev) => {
        const p = toWorld(ev.clientX, ev.clientY);
        ghost.setAttribute('x1', a.cx); ghost.setAttribute('y1', a.cy);
        ghost.setAttribute('x2', p.x); ghost.setAttribute('y2', p.y);
        world.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
        document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.ff-node')?.classList.add('drop');
      }, (ev, moved) => {
        ghost.remove();
        if (!moved) return;
        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.ff-node');
        if (target && target.dataset.id !== from) { link(from, target.dataset.id); select(from); return; }
        if (!target) {
          const p = toWorld(ev.clientX, ev.clientY);
          const n = addNode(p.x - 60, p.y - 20);
          link(from, n.id, false); // o mesmo passo de anular que a criação
          draw();
        }
      });
      return;
    }
    if (nodeElx) {
      const id = nodeElx.dataset.id;
      const n = nodeById(id);
      const ox = n.x;
      const oy = n.y;
      if (selected !== id) select(id);
      const before = snapshot();
      track(e, (ev, dx, dy) => {
        n.x = snap(ox + dx / view.z);
        n.y = snap(oy + dy / view.z);
        const el = nodeEl(id);
        el.style.left = `${n.x}px`;
        el.style.top = `${n.y}px`;
        drawEdges();
      }, (ev, moved) => {
        if (!moved) return;
        past.push(before); future.length = 0; syncHistory();
        onChange();
        drawMini();
      });
      return;
    }
    const hit = e.target.closest('.ff-hit');
    if (hit) { select(null, { from: hit.dataset.from, to: hit.dataset.to }); return; }
    // Fundo: arrastar move a vista; um clique limpa a seleção.
    const vx = view.x;
    const vy = view.y;
    canvas.classList.add('panning');
    track(e, (ev, dx, dy) => { view.x = vx + dx; view.y = vy + dy; apply(); drawMini(); }, (ev, moved) => {
      canvas.classList.remove('panning');
      if (!moved && (selected || selectedEdge)) select(null);
    });
  });

  canvas.addEventListener('dblclick', (e) => {
    if (e.target.closest('.ff-node')) { $('.ff-label').focus(); $('.ff-label').select(); return; }
    const p = toWorld(e.clientX, e.clientY);
    addNode(p.x - 60, p.y - 20);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    drawMini();
  }, { passive: false });

  canvas.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) restore(future, past); else restore(past, future); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); restore(future, past); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelection(); }
    if (e.key === 'Escape') select(null);
    if (e.key === 'Enter' && e.target.classList.contains('ff-node')) select(e.target.dataset.id);
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d && selected) {
      e.preventDefault();
      remember();
      const n = nodeById(selected);
      n.x += d[0] * GRID; n.y += d[1] * GRID;
      onChange();
      draw();
      nodeEl(selected)?.focus();
    }
  });

  host.querySelector('.ff-bar').addEventListener('click', (e) => {
    const a = e.target.closest('[data-ff]')?.dataset.ff;
    const r = canvas.getBoundingClientRect();
    if (a === 'add') { const p = toWorld(r.left + r.width / 2, r.top + r.height / 2); addNode(p.x - 60, p.y - 20); }
    if (a === 'del') removeSelection();
    if (a === 'zin') zoomAt(1.2, r.width / 2, r.height / 2);
    if (a === 'zout') zoomAt(1 / 1.2, r.width / 2, r.height / 2);
    if (a === 'fit') fit();
    if (a === 'undo') restore(past, future);
    if (a === 'redo') restore(future, past);
    if (a === 'layout') { remember(); layout(); onChange(); draw(); fit(); }
  });

  // Minimapa: clicar leva a vista para esse ponto.
  $('.ff-mini').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const [bx, by, bw, bh] = JSON.parse(e.currentTarget.dataset.box || '[0,0,1,1]');
    const r = e.currentTarget.getBoundingClientRect();
    const wx = bx + ((e.clientX - r.left) / r.width) * bw;
    const wy = by + ((e.clientY - r.top) / r.height) * bh;
    view.x = canvas.clientWidth / 2 - wx * view.z;
    view.y = canvas.clientHeight / 2 - wy * view.z;
    apply();
    drawMini();
  });

  // Painel do bloco: cartões e texto das regras deste bloco.
  const panelEl = $('.ff-panel');
  panelEl.addEventListener('input', (e) => {
    if (!e.target.classList.contains('ff-rule') || !selected) return;
    const n = nodeById(selected);
    let rule = project.rules.find((r) => r.ref === n.id);
    if (!rule) { rule = { id: `r${Date.now().toString(36)}`, ref: n.id, title: n.label, text: '' }; project.rules.push(rule); }
    rule.text = e.target.value;
    onChange();
    const el = nodeEl(n.id)?.querySelector('.ff-badges span:last-child');
    if (el) el.classList.toggle('miss', !rule.text.trim());
  });
  panelEl.addEventListener('click', (e) => {
    const a = e.target.closest('[data-fp]')?.dataset.fp;
    const n = selected && nodeById(selected);
    if (!a || !n) return;
    if (a === 'fixkind') for (const c of project.cards) if (c.ref === n.id) c.kind = n.kind;
    if (a === 'card') {
      project.cards.unshift({ id: `c${Date.now().toString(36)}`, kind: n.kind, category: 'regra', scope: n.kind === 'DATA' ? 'component' : 'node', ref: n.id, title: '', given: '', when: '', then: '' });
    }
    onChange();
    draw();
  });

  /**
   * Organizar: camadas de cima para baixo pela ordem do fluxo (profundidade
   * a partir dos blocos sem entradas; ligações para trás não contam).
   */
  function layout() {
    const incoming = new Map(project.nodes.map((n) => [n.id, 0]));
    for (const e of project.edges) incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
    const out = new Map(project.nodes.map((n) => [n.id, []]));
    for (const e of project.edges) out.get(e.from)?.push(e.to);
    const depth = new Map();
    const roots = project.nodes.filter((n) => !incoming.get(n.id)).map((n) => n.id);
    const queue = (roots.length ? roots : [project.nodes[0]?.id]).filter(Boolean).map((id) => [id, 0]);
    const onPath = new Set();
    const visit = (id, d) => {
      if (onPath.has(id)) return; // ciclo: ligação para trás
      if ((depth.get(id) ?? -1) >= d) return;
      depth.set(id, d);
      onPath.add(id);
      for (const to of out.get(id) || []) visit(to, d + 1);
      onPath.delete(id);
    };
    for (const [id, d] of queue) visit(id, d);
    for (const n of project.nodes) if (!depth.has(n.id)) depth.set(n.id, 0);
    const layers = new Map();
    for (const n of project.nodes) {
      const d = depth.get(n.id);
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d).push(n);
    }
    // Muitos níveis (um fluxo quase em cadeia): dobra em colunas de até 6 níveis.
    const ROWS = 6;
    const widest = Math.max(1, ...[...layers.values()].map((l) => l.length));
    const colWidth = widest * 220 + 80;
    for (const [d, list] of layers) {
      const col = Math.floor(d / ROWS);
      list.forEach((n, i) => { n.x = snap(col * colWidth + i * 220); n.y = snap((d % ROWS) * 120); });
    }
  }
  $('.ff-label').addEventListener('input', (e) => {
    const n = selected && nodeById(selected);
    if (!n) return;
    n.label = e.target.value.slice(0, 120);
    const el = nodeEl(n.id);
    if (el) el.querySelector('.ff-l').textContent = n.label;
    drawEdges();
    onChange();
  });
  $('.ff-label').addEventListener('keydown', (e) => { if (e.key === 'Enter') nodeEl(selected)?.focus(); });
  $('.ff-selkind').addEventListener('change', (e) => {
    const n = selected && nodeById(selected);
    if (!n) return;
    n.kind = e.target.value;
    onChange();
    draw();
  });

  draw();
  requestAnimationFrame(fit);
  return { destroy() { host.replaceChildren(); } };
}
