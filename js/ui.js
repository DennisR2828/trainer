/* Shared DOM helpers + the SVG progress ring used by the diet logger/calendar. */

export const h = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(kids)) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

export const clearNode = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };

export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/* Progress ring. value/max numeric; over-target tints the stroke amber. */
export function ring({ value, max, color, label, unit = '', size = 84 }) {
  const pct = max > 0 ? value / max : 0;
  const R = 33, C = 2 * Math.PI * R;
  const off = C * (1 - Math.max(0, Math.min(1, pct)));
  const over = max > 0 && value > max * 1.02;
  const wrap = h('div', { class: 'ring' });
  // start empty, then fill to target on the next frame so the CSS transition plays
  wrap.innerHTML =
    `<svg viewBox="0 0 80 80" width="${size}" height="${size}" class="ring-svg" aria-hidden="true">
       <circle cx="40" cy="40" r="${R}" class="ring-bg"></circle>
       <circle cx="40" cy="40" r="${R}" class="ring-fg${over ? ' over' : ''}" stroke="${over ? 'var(--cal)' : color}"
         stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"></circle>
     </svg>
     <div class="ring-center"><span class="ring-val">${Math.round(value)}</span><span class="ring-max">/ ${max}${unit}</span></div>
     <div class="ring-label">${label}</div>`;
  requestAnimationFrame(() => {
    const fg = wrap.querySelector('.ring-fg');
    if (fg) fg.style.strokeDashoffset = off.toFixed(1);
  });
  return wrap;
}
