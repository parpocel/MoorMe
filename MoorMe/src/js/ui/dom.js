// Minimalny pomocnik do budowania DOM
export function h(tag, attrs = {}, ...children) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function seg(options, value, onChange) {
  const wrap = h('div.seg');
  const render = () => {
    wrap.innerHTML = '';
    for (const o of options) {
      wrap.appendChild(h('button', { class: o.value === value ? 'on' : '', onclick: () => { value = o.value; render(); onChange(o.value); }, title: o.title || '' }, o.label));
    }
  };
  render();
  return wrap;
}

export function slider({ min, max, step, value, onInput, fmt }) {
  const out = h('b', {}, fmt ? fmt(value) : value);
  const inp = h('input', { type: 'range', min, max, step, value });
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmt ? fmt(v) : v; onInput(v); });
  return { el: h('div', {}, inp), out, inp };
}
