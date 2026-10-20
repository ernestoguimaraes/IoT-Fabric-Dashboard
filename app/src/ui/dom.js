export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) n.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) n.append(c);
  return n;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pad = (n) => String(n).padStart(2, '0');
export const hms = (d) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : '—');

// Atualiza texto apenas quando muda (evita reflow e preserva seleção/cliques).
export function setText(node, text) {
  if (node && node.textContent !== String(text)) node.textContent = text;
}

// Reconciliação por chave: mantém os nós existentes e só atualiza o conteúdo.
export function reconcile(container, items, keyOf, create, update) {
  const existing = new Map([...container.children].filter((c) => c.dataset.key).map((c) => [c.dataset.key, c]));
  let prev = null;
  for (const item of items) {
    const key = keyOf(item);
    let node = existing.get(key);
    if (!node) { node = create(item); node.dataset.key = key; }
    existing.delete(key);
    update(node, item);
    const expected = prev ? prev.nextSibling : container.firstChild;
    if (node !== expected) container.insertBefore(node, expected);
    prev = node;
  }
  existing.forEach((n) => n.remove());
}

let toastTimer = null;
export function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.style.background = kind === 'err' ? 'rgba(218,54,51,0.92)' : kind === 'info' ? 'rgba(10,102,194,0.92)' : 'rgba(35,134,54,0.92)';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
