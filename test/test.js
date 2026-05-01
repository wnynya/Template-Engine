'use strict';

import assert from 'node:assert/strict';
import nodefs from 'node:fs';
import nodepath from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodepath.dirname(__filename);

import Engine from '../src/engine.js';

const views = nodepath.resolve(__dirname, './views');
const engine = new Engine(views);

function test() {
  const outputFile = nodepath.resolve(__dirname, 'output.html');

  const scope = {
    a: 10,
  };

  const output = engine.render('index.html', scope);

  assert.match(output, /<h1>Import test<\/h1>/);
  assert.match(
    output,
    /<section class="wrapper">\s*<h2>Nested import works<\/h2>\s*<\/section>/,
  );
  const scopeMatch = output.match(/<div scoped="([a-f0-9]{8})">/);
  assert.ok(scopeMatch);
  assert.match(output, new RegExp(`/assets/scoped/elements/part-${scopeMatch[1]}\\.css`));
  assert.match(
    output,
    /<script src="\/assets\/elements\/part\.js" type="module"><\/script>/,
  );
  assert.match(output, /<img src="\/assets\/elements\/IMG_7101-sq\.jpg" \/>/);
  assert.match(output, /<a href="\/assets\/elements\/IMG_7101-sq\.jpg">Download<\/a>/);
  assert.match(
    output,
    new RegExp(`<style>[^]*\\[scoped="${scopeMatch[1]}"\\][^]*<\\/style>`),
  );

  const scopedAsset = engine.asset(`/assets/scoped/elements/part-${scopeMatch[1]}.css`);
  assert.ok(scopedAsset);
  assert.match(
    scopedAsset.body,
    new RegExp(`@import ['"]/assets/scoped/elements/nested-${scopeMatch[1]}\\.css['"]`),
  );
  assert.match(scopedAsset.body, /@import ['"]\/global\.css['"]/);
  assert.match(scopedAsset.body, new RegExp(`\\[scoped="${scopeMatch[1]}"\\] \\.hello`));
  assert.match(
    scopedAsset.body,
    /background-image: url\(['"]\/assets\/elements\/IMG_7101-sq\.jpg['"]\)/,
  );
  assert.match(scopedAsset.body, /background-image: url\(['"]\/images\/bg\.png['"]\)/);
  const nestedScopedAsset = engine.asset(
    `/assets/scoped/elements/nested-${scopeMatch[1]}.css`,
  );
  assert.ok(nestedScopedAsset);
  assert.match(
    nestedScopedAsset.body,
    new RegExp(`\\[scoped="${scopeMatch[1]}"\\] \\.nested`),
  );
  const scriptAsset = engine.asset('/assets/elements/part.js');
  assert.ok(scriptAsset);
  assert.equal(scriptAsset.mime, 'text/javascript');
  assert.match(scriptAsset.body, /\/assets\/elements\/nested\.js/);
  assert.match(scriptAsset.body, /import ['"]\/runtime\.js['"]/);
  assert.match(scriptAsset.body, /window\.partLoaded = true;/);
  const nestedScriptAsset = engine.asset('/assets/elements/nested.js');
  assert.ok(nestedScriptAsset);
  assert.match(nestedScriptAsset.body, /window\.nestedLoaded = true;/);
  const imageAsset = engine.asset('/assets/elements/IMG_7101-sq.jpg');
  assert.ok(imageAsset);
  assert.equal(imageAsset.kind, 'link');
  assert.match(imageAsset.path, /IMG_7101-sq\.jpg$/);

  const absoluteOutput = engine.render('elements/absolute.html');
  assert.match(
    absoluteOutput,
    /<link href="\/global\.css" rel="stylesheet" \/>/,
  );
  assert.match(
    absoluteOutput,
    /<script src="\/runtime\.js" type="module"><\/script>/,
  );
  assert.match(absoluteOutput, /<img src="\/images\/logo\.png" \/>/);
  assert.match(absoluteOutput, /<a href="\/downloads\/manual\.pdf">Manual<\/a>/);
  assert.equal(engine.asset('/global.css'), null);
  assert.equal(engine.asset('/runtime.js'), null);

  const externalScriptOutput = engine.render('elements/external-script.html');
  assert.match(
    externalScriptOutput,
    /<script src="https:\/\/cdn\.example\.com\/external\.js"><\/script>/,
  );
  const externalLinkOutput = engine.render('elements/external-link.html');
  assert.match(
    externalLinkOutput,
    /<a href="mailto:test@example\.com">Mail<\/a>/,
  );
  assert.throws(
    () => engine.render('../package.json'),
    /outside views/,
  );

  nodefs.writeFileSync(outputFile, output);
}

test();
