/** Deterministic pleasant gradient from a string — for placeholder covers/tiles. */
const PALETTES = [
  ["#ff4d8d", "#7c5cff"],
  ["#7c5cff", "#4dd0ff"],
  ["#ff6b6b", "#ffa14d"],
  ["#4dd0ff", "#5cff9d"],
  ["#c94dff", "#ff4d8d"],
  ["#ff4d6b", "#ffcf4d"],
  ["#4d7cff", "#c94dff"],
  ["#00d4a0", "#4d7cff"],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function gradientFor(seed: string): string {
  const h = hash(seed);
  const [a, b] = PALETTES[h % PALETTES.length];
  const angle = 100 + ((h >> 8) % 80);
  return `linear-gradient(${angle}deg, ${a}, ${b})`;
}
