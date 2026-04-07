import assert from 'node:assert/strict';

import { safeEval } from '../src/evaluator/evaluator.js';

assert.equal(safeEval('a + 1', { a: 2 }), 3);
assert.equal(safeEval('user.name', { user: { name: 'wany' } }), 'wany');
assert.equal(safeEval('flag ? title : "guest"', { flag: true, title: 'hello' }), 'hello');

assert.throws(
  () => safeEval('[].filter.constructor("console.log(1)")()'),
  /Unexpected token|Function calls are not allowed/,
);

console.log('eval ok');
