// Paint options for cars. The player picks one; bots take the others.
// clearcoat (0..1) is the glossy lacquer layer that makes the paint look smooth and deep.

export const SKINS = [
  { id: 'red', name: 'Racing Red', color: 0xc1121f, metalness: 0.35, roughness: 0.3, clearcoat: 1 },
  { id: 'blue', name: 'Midnight Blue', color: 0x1d3f9e, metalness: 0.45, roughness: 0.28, clearcoat: 1 },
  { id: 'yellow', name: 'Signal Yellow', color: 0xf2c200, metalness: 0.3, roughness: 0.35, clearcoat: 1 },
  { id: 'green', name: 'British Green', color: 0x1f6b3a, metalness: 0.35, roughness: 0.32, clearcoat: 1 },
  { id: 'white', name: 'Pearl White', color: 0xeeeeee, metalness: 0.25, roughness: 0.3, clearcoat: 1 },
  { id: 'orange', name: 'Sunset Orange', color: 0xe8590c, metalness: 0.35, roughness: 0.3, clearcoat: 1 },
  { id: 'graphite', name: 'Graphite', color: 0x3a3f47, metalness: 0.6, roughness: 0.35, clearcoat: 1 },
  { id: 'purple', name: 'Violet', color: 0x6d28d9, metalness: 0.4, roughness: 0.3, clearcoat: 1 },
  { id: 'teal', name: 'Lagoon Teal', color: 0x0f8b8d, metalness: 0.5, roughness: 0.22, clearcoat: 1 },
  { id: 'silver', name: 'Liquid Silver', color: 0xb8bec7, metalness: 0.85, roughness: 0.2, clearcoat: 1 },
  { id: 'black', name: 'Gloss Black', color: 0x0a0a0c, metalness: 0.5, roughness: 0.15, clearcoat: 1 },
  { id: 'matte', name: 'Matte Olive', color: 0x4a5240, metalness: 0.1, roughness: 0.85, clearcoat: 0 },
];

export function findSkin(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
