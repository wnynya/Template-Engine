import assert from 'node:assert/strict';

import { safeEval } from '../src/evaluator/evaluator.js';

assert.equal(safeEval('a + 1', { a: 2 }), 3);
assert.equal(safeEval('user.name', { user: { name: 'wany' } }), 'wany');
assert.equal(safeEval('flag ? title : "guest"', { flag: true, title: 'hello' }), 'hello');
assert.equal(
  safeEval('records[i].content.text.substring(0, 5)', {
    i: 0,
    records: [{ content: { text: 'hello world' } }],
  }),
  'hello',
);
assert.equal(
  safeEval("records[i].date.at.format('YY년 M월의 GK')", {
    i: 0,
    records: [
      {
        date: {
          at: {
            format(pattern) {
              return pattern.replace('YY', '26').replace('M', '5');
            },
          },
        },
      },
    ],
  }),
  '26년 5월의 GK',
);
assert.equal(safeEval('label.trim().toUpperCase()', { label: '  hi  ' }), 'HI');

assert.throws(
  () => safeEval('[].filter.constructor("console.log(1)")()'),
  /Unexpected token|Expected eof/,
);
assert.equal(
  safeEval('text.substring.constructor("console.log(1)")()', { text: 'hello' }),
  undefined,
);

console.log('eval ok');
