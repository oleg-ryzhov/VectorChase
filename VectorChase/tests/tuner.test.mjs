import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, DRIVE_LAYOUTS, ROW_HEIGHT, computePaging } from '../src/ui/settingsMenu.js';
import { PARAMS } from '../src/config/registry.js';
import { ICONS } from '../src/ui/icons.js';

test('every tuning setting appears in exactly one section, and basic ones are the essentials', () => {
  const seen = SECTIONS.flatMap((s) => s.ids);
  assert.equal(new Set(seen).size, seen.length, 'a setting is listed twice');
  assert.deepEqual([...seen].sort(), PARAMS.map((p) => p.id).sort());
  const essentials = SECTIONS.find((s) => s.id === 'essentials');
  assert.deepEqual([...essentials.ids].sort(), PARAMS.filter((p) => p.basic).map((p) => p.id).sort());
  for (const s of SECTIONS) assert.ok(ICONS[s.icon], s.icon);
  assert.ok(SECTIONS.filter((s) => s.advanced).length >= 1 && !SECTIONS[0].advanced);
});

test('drive layouts are real front drive shares', () => {
  const p = PARAMS.find((x) => x.id === 'drivetrain.frontBias');
  for (const [, , share] of DRIVE_LAYOUTS) assert.ok(share >= p.min && share <= p.max);
});

test('paging fits rows to the screen: columns by width, rows by height, and a page count that covers everything', () => {
  assert.deepEqual(computePaging(700, 300, ROW_HEIGHT, 7), { columns: 2, perPage: 6, pages: 2 });
  assert.deepEqual(computePaging(360, 520, ROW_HEIGHT, 7), { columns: 1, perPage: 6, pages: 2 });
  assert.deepEqual(computePaging(900, 380, ROW_HEIGHT, 7), { columns: 2, perPage: 10, pages: 1 });
  assert.equal(computePaging(300, 10, ROW_HEIGHT, 3).perPage, 1); // never zero
  for (const total of [0, 1, 5, 6, 7, 13]) {
    const { perPage, pages } = computePaging(700, 300, ROW_HEIGHT, total);
    assert.ok(pages * perPage >= total && pages >= 1);
  }
});
