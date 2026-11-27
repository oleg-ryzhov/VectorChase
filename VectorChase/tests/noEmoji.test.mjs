import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// No emoji and no emoji-like symbols or arrows anywhere in the game's code or text: icons are drawn as SVG.
const BAD = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'data' ? [] : files(path);
    return /\.(js|mjs|html|md|css)$/.test(name) ? [path] : [];
  });
}

test('source files, tests and the page contain no emoji or emoji-like symbols', () => {
  for (const file of [...files('src'), ...files('tests'), 'index.html']) {
    const text = readFileSync(file, 'utf8');
    const m = text.match(BAD);
    assert.ok(!m, `${file} contains ${m && m[0]} (U+${m && m[0].codePointAt(0).toString(16)})`);
  }
});
