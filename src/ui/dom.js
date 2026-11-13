// Small helpers for building menus without innerHTML, so names typed by players stay plain text.

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text, className) {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}

export function addStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
