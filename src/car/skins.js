// Paint options for cars. The player picks one; bots take the others.
// clearcoat (0..1) is the glossy lacquer layer that makes the paint look smooth and deep.
// accent: colour of the bonnet/roof/boot stripes (optional).
// glow: colour of the neon side strips and the light pool under the car, the car's "aura" (optional).
// iridescence (0..1): colour-shifting pearl effect (optional).

export const SKINS = [
  { id: 'red', name: 'Racing Red', color: 0xc1121f, metalness: 0.35, roughness: 0.3, clearcoat: 1, accent: 0xf4f4f4 },
  { id: 'blue', name: 'Midnight Blue', color: 0x1d3f9e, metalness: 0.45, roughness: 0.28, clearcoat: 1, accent: 0x8fd3ff },
  { id: 'yellow', name: 'Signal Yellow', color: 0xf2c200, metalness: 0.3, roughness: 0.35, clearcoat: 1, accent: 0x15171c },
  { id: 'green', name: 'British Green', color: 0x1f6b3a, metalness: 0.35, roughness: 0.32, clearcoat: 1, accent: 0xe8d9a0 },
  { id: 'white', name: 'Pearl White', color: 0xeeeeee, metalness: 0.25, roughness: 0.3, clearcoat: 1, accent: 0x1d3f9e },
  { id: 'orange', name: 'Sunset Orange', color: 0xe8590c, metalness: 0.35, roughness: 0.3, clearcoat: 1, accent: 0x15171c },
  { id: 'graphite', name: 'Graphite', color: 0x3a3f47, metalness: 0.6, roughness: 0.35, clearcoat: 1, accent: 0xff3b3b },
  { id: 'purple', name: 'Violet', color: 0x6d28d9, metalness: 0.4, roughness: 0.3, clearcoat: 1, accent: 0xffd166 },
  { id: 'teal', name: 'Lagoon Teal', color: 0x0f8b8d, metalness: 0.5, roughness: 0.22, clearcoat: 1, accent: 0xeafffb },
  { id: 'silver', name: 'Liquid Silver', color: 0xb8bec7, metalness: 0.85, roughness: 0.2, clearcoat: 1, accent: 0x1d3f9e },
  { id: 'black', name: 'Gloss Black', color: 0x0a0a0c, metalness: 0.5, roughness: 0.15, clearcoat: 1, accent: 0xc9ced6 },
  { id: 'matte', name: 'Matte Olive', color: 0x4a5240, metalness: 0.1, roughness: 0.85, clearcoat: 0 },
  { id: 'neon', name: 'Neon Circuit', color: 0x0a0d18, metalness: 0.6, roughness: 0.14, clearcoat: 1, accent: 0x00e5ff, glow: 0x00e5ff },
  { id: 'inferno', name: 'Inferno', color: 0x140808, metalness: 0.55, roughness: 0.16, clearcoat: 1, accent: 0xff5a00, glow: 0xff4d00 },
  { id: 'aurora', name: 'Aurora', color: 0x2b1a78, metalness: 0.7, roughness: 0.18, clearcoat: 1, accent: 0x7cffcb, glow: 0x7cffcb, iridescence: 1 },
  { id: 'chrome', name: 'Mirror Chrome', color: 0xe3e9f0, metalness: 1, roughness: 0.06, clearcoat: 1, accent: 0x3b82f6, glow: 0x3b82f6 },
  { id: 'toxic', name: 'Toxic', color: 0x10200a, metalness: 0.5, roughness: 0.2, clearcoat: 1, accent: 0xa3ff12, glow: 0xa3ff12 },
  { id: 'gold', name: 'Royal Gold', color: 0xd6a519, metalness: 0.95, roughness: 0.2, clearcoat: 1, accent: 0x111111, glow: 0xffc247 },
];

export function findSkin(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
