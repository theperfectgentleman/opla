import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

describe('package stays host-free', () => {
  it('does not import react, react-native, or the DOM', () => {
    for (const name of readdirSync(src)) {
      const text = readFileSync(join(src, name), 'utf8');
      assert.doesNotMatch(text, /from ['"]react['"]/);
      assert.doesNotMatch(text, /from ['"]react-native['"]/);
      assert.doesNotMatch(text, /from ['"]react-dom['"]/);
      assert.doesNotMatch(text, /\bwindow\b/);
      assert.doesNotMatch(text, /\bdocument\b/);
    }
  });
});
