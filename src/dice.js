export const DICE = [4, 6, 8, 10, 12, 20];

export const COLORS = [
  { name: 'Crimson', hex: '#E5383B' },
  { name: 'Amber', hex: '#F4A261' },
  { name: 'Emerald', hex: '#2BB673' },
  { name: 'Sapphire', hex: '#3A86FF' },
  { name: 'Violet', hex: '#8338EC' },
  { name: 'Ivory', hex: '#F1EAD8' },
  { name: 'Obsidian', hex: '#2B2D42' },
];

export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// Lighten (amt > 0) or darken (amt < 0) a hex color by a 0..1 amount.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (c) => Math.round(c + (target - c) * p);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 170 ? '#1B1B1F' : '#FFFFFF';
}

// A version of the color that stays readable on the dark background.
export function onDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 80 ? shade(hex, 0.6) : hex;
}
