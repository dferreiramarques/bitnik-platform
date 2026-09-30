// Documentação — pequenas interações: menu no telemóvel, destaque da secção
// ativa na navegação, copiar código, e a demonstração da modal de regras
// (as mesmas classes .rules-* da plataforma, ver app.css).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const navToggle = $('#navToggle');
const nav = $('#nav');
navToggle?.addEventListener('click', () => nav.classList.toggle('open'));
$$('.doc-nav a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

// Destaca na navegação a secção mais visível.
const sections = $$('.doc-section[id]');
const links = new Map($$('.doc-nav a').map((a) => [a.getAttribute('href').slice(1), a]));
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const link = links.get(e.target.id);
    if (!link) continue;
    if (e.isIntersecting) { $$('.doc-nav a.active').forEach((a) => a.classList.remove('active')); link.classList.add('active'); }
  }
}, { rootMargin: '-20% 0px -70% 0px' });
sections.forEach((s) => io.observe(s));

// Copiar código.
$$('.doc-example').forEach((ex) => {
  const pre = $('.doc-code', ex);
  if (!pre) return;
  const code = pre.textContent; // antes de acrescentar o botão, para não se copiar a si mesmo
  const btn = document.createElement('button');
  btn.className = 'doc-copy'; btn.type = 'button'; btn.textContent = 'Copiar';
  btn.style.cssText = 'position:absolute;top:8px;right:8px;font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid rgb(255 255 255/.25);background:rgb(255 255 255/.08);color:inherit;cursor:pointer;';
  pre.style.position = 'relative';
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code); btn.textContent = 'Copiado'; }
    catch { btn.textContent = 'Erro'; }
    setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
  });
  pre.appendChild(btn);
});

// Demonstração da modal de regras: abre/fecha como na mesa a sério.
const rulesDemo = $('#rulesDemoOpen');
rulesDemo?.addEventListener('click', () => { $('#rulesDemoModal').hidden = false; });
$('#rulesDemoClose')?.addEventListener('click', () => { $('#rulesDemoModal').hidden = true; });
