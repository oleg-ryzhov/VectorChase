import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, DRIVE_LAYOUTS, ROW_HEIGHT, computePaging } from '../src/ui/settingsMenu.js';
import { PARAMS } from '../src/config/registry.js';
import { ICONS } from '../src/ui/icons.js';
import { SLOT_COUNT } from '../src/config/tunerKeys.js';

test('advanced tabs hold every setting once; basic is the basic-flagged settings; no page has more than 10 rows', () => {
  const basic = SECTIONS.filter((s) => !s.advanced);
  const tabs = SECTIONS.filter((s) => s.advanced);
  assert.equal(basic.length, 1);
  assert.ok(tabs.length >= 3 && tabs.length <= 5);
  const seen = tabs.flatMap((s) => s.ids);
  assert.equal(new Set(seen).size, seen.length, 'a setting is listed twice');
  assert.deepEqual([...seen].sort(), PARAMS.map((p) => p.id).sort());
  assert.deepEqual([...basic[0].ids].sort(), PARAMS.filter((p) => p.basic).map((p) => p.id).sort());
  for (const s of SECTIONS) {
    assert.ok(ICONS[s.icon], s.icon);
    assert.ok(s.ids.length + 1 <= SLOT_COUNT, `${s.id} needs more keys than there are`); // +1: the drive share row
  }
  assert.ok(!SECTIONS[0].advanced);
});

test('drive layouts are real front drive shares', () => {
  const p = PARAMS.find((x) => x.id === 'drivetrain.frontBias');
  for (const [, , share] of DRIVE_LAYOUTS) assert.ok(share >= p.min && share <= p.max);
});

test('paging fits rows to the screen: columns by width, rows by height, and a page count that covers everything', () => {
  assert.deepEqual(computePaging(700, 300, ROW_HEIGHT, 7), { columns: 2, perPage: 6, pages: 2 });
  assert.deepEqual(computePaging(360, 520, ROW_HEIGHT, 7), { columns: 1, perPage: 6, pages: 2 });
  assert.deepEqual(computePaging(900, 380, ROW_HEIGHT, 7), { columns: 2, perPage: 8, pages: 1 });
  assert.equal(computePaging(300, 10, ROW_HEIGHT, 3).perPage, 1); // never zero
  for (const total of [0, 1, 5, 6, 7, 13]) {
    const { perPage, pages } = computePaging(700, 300, ROW_HEIGHT, total);
    assert.ok(pages * perPage >= total && pages >= 1);
  }
});
