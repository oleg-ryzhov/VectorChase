// Inline SVG icons (24 x 24, drawn with strokes) so the interface never relies on emoji or font symbols.
// Built with createElementNS, never innerHTML.

export const ICONS = {
  pause: ['M8 5v14', 'M16 5v14'],
  play: ['M7 4.5v15l12-7.5z'],
  gear: ['M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z', 'M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z', 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1'],
  camera: ['M3 8h3l1.5-2h9L18 8h3v11H3z', 'M12 10.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z'],
  gas: ['M8 3h8a1.5 1.5 0 0 1 1.5 1.5V18L16 21H8l-1.5-3V4.5A1.5 1.5 0 0 1 8 3z', 'M9.5 8h5M9.5 11.5h5M9.5 15h5'],
  brake: ['M5 6h14a1.5 1.5 0 0 1 1.5 1.5V16a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5A1.5 1.5 0 0 1 5 6z', 'M8 10h8M8 14h8', 'M12 18v3'],
  handbrake: ['M6 6a8 8 0 0 0 0 12', 'M18 6a8 8 0 0 1 0 12', 'M12 7.5v6', 'M12 16.5v.01'],
  left: ['M14.5 5l-7 7 7 7'],
  right: ['M9.5 5l7 7-7 7'],
  up: ['M5 14.5l7-7 7 7'],
  down: ['M5 9.5l7 7 7-7'],
  wheel: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M3 12h5.5M15.5 12H21M12 12v9', 'M12 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z'],
  close: ['M6 6l12 12M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  reset: ['M4 12a8 8 0 1 0 2.5-5.8', 'M4 4v5h5'],
  tune: ['M4 7h9M17 7h3M4 17h3M11 17h9', 'M15 4.5v5M9 14.5v5'],
  car: ['M3 15.5v-3l2-4.5A2 2 0 0 1 6.8 6.8h7.4a2 2 0 0 1 1.5.7L19 11l2 1v3.5h-2M3 15.5h2M9 15.5h6', 'M7 13.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4z', 'M17 13.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4z'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5v1a3 3 0 0 0 3 3', 'M16 6h3v1a3 3 0 0 1-3 3', 'M12 13v4M8.5 20h7M10 17h4'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4.5 20a7.5 7.5 0 0 1 15 0'],
  speaker: ['M4 9.5h3.5L12 6v12l-4.5-3.5H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a8 8 0 0 1 0 11'],
  music: ['M9 18V6l10-2v12', 'M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z', 'M19 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z'],
  display: ['M3 5h18v11H3z', 'M9 20h6M12 16v4'],
  sparkle: ['M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'],
  touch: ['M9 11V5a1.5 1.5 0 0 1 3 0v5.5', 'M12 10.5a1.5 1.5 0 0 1 3 0V12', 'M15 11.5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-4-2L5.5 15.5a1.5 1.5 0 0 1 2.3-1.8L9 15'],
  flag: ['M5 21V4', 'M5 5h11l-2 3.5 2 3.5H5'],
  move: ['M12 3v18M3 12h18', 'M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3'],
  mirror: ['M12 3v18', 'M7 7l-4 5 4 5z', 'M17 7l4 5-4 5z'],
  engine: ['M5 9h3V6h6v3h3l2 2v6H5z', 'M5 12H3M21 12v3'],
  grip: ['M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M12 8v8M8 12h8'],
  chassis: ['M3 16h18', 'M5 16v-4l3-4h8l3 4v4', 'M7 19.5v-3.5M17 19.5v-3.5'],
  aero: ['M3 9c6-3 12-3 18 0', 'M3 14c6-3 12-3 18 0', 'M6 19l3-2M15 19l3-2'],
  brakes: ['M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z', 'M12 4v2M12 18v2M4 12h2M18 12h2'],
  suspension: ['M9 4h6M9 20h6', 'M9 7l6 2.5-6 2.5 6 2.5-6 2.5'],
};

const NS = 'http://www.w3.org/2000/svg';

// An svg element for the named icon. It takes the colour of the text around it.
export function icon(name, size = 24) {
  const paths = ICONS[name];
  if (!paths) throw new Error(`Unknown icon: ${name}`);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of paths) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}
