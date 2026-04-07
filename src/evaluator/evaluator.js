'use strict';

const DISALLOWED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const BINARY_PRECEDENCE = new Map([
  ['??', 1],
  ['||', 2],
  ['&&', 3],
  ['==', 4],
  ['!=', 4],
  ['===', 4],
  ['!==', 4],
  ['<', 5],
  ['<=', 5],
  ['>', 5],
  ['>=', 5],
  ['+', 6],
  ['-', 6],
  ['*', 7],
  ['/', 7],
  ['%', 7],
]);

function safeEval(code, scope = {}) {
  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const expression = parser.parseExpression();
  parser.expect('eof');
  return evaluateExpression(expression, scope);
}

function evaluateAST(ast, scope) {
  if (!ast.value) {
    return ast.value;
  }

  const value = safeEval(ast.value, scope);
  if (ast.return === 'string') {
    return String(value);
  }
  if (ast.return === 'number') {
    return Number(value);
  }
  if (ast.return === 'boolean') {
    return Boolean(value);
  }
  return value;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parseExpression(minPrecedence = 0) {
    let left = this.parsePrefix();

    while (true) {
      const token = this.peek();

      if (token.type === 'question' && minPrecedence <= 0) {
        this.next();
        const consequent = this.parseExpression();
        this.expect('colon');
        const alternate = this.parseExpression();
        left = {
          type: 'ConditionalExpression',
          test: left,
          consequent,
          alternate,
        };
        continue;
      }

      const precedence = BINARY_PRECEDENCE.get(token.value);
      if (token.type !== 'operator' || precedence == null || precedence < minPrecedence) {
        break;
      }

      this.next();
      const right = this.parseExpression(precedence + 1);
      left = createBinaryNode(token.value, left, right);
    }

    return left;
  }

  parsePrefix() {
    const token = this.next();

    switch (token.type) {
      case 'number':
      case 'string':
      case 'boolean':
      case 'null':
      case 'undefined': {
        return { type: 'Literal', value: token.value };
      }
      case 'identifier': {
        return this.parsePostfix({
          type: 'Identifier',
          name: token.value,
        });
      }
      case 'operator': {
        if (!['!', '-'].includes(token.value)) {
          throw new Error(`Unsupported unary operator: ${token.value}`);
        }
        return {
          type: 'UnaryExpression',
          operator: token.value,
          argument: this.parseExpression(8),
        };
      }
      case 'paren_open': {
        const expression = this.parseExpression();
        this.expect('paren_close');
        return this.parsePostfix(expression);
      }
      default: {
        throw new Error(`Unexpected token: ${token.type}`);
      }
    }
  }

  parsePostfix(expression) {
    let current = expression;

    while (true) {
      const token = this.peek();

      if (token.type === 'dot') {
        this.next();
        const property = this.expect('identifier');
        current = {
          type: 'MemberExpression',
          object: current,
          property: {
            type: 'Literal',
            value: property.value,
          },
          computed: false,
        };
        continue;
      }

      if (token.type === 'bracket_open') {
        this.next();
        const property = this.parseExpression();
        this.expect('bracket_close');
        current = {
          type: 'MemberExpression',
          object: current,
          property,
          computed: true,
        };
        continue;
      }

      if (token.type === 'paren_open') {
        throw new Error('Function calls are not allowed');
      }

      break;
    }

    return current;
  }

  peek() {
    return this.tokens[this.index] ?? { type: 'eof', value: null };
  }

  next() {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  expect(type) {
    const token = this.next();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    return token;
  }
}

function tokenize(code) {
  const tokens = [];
  let index = 0;

  while (index < code.length) {
    const char = code[index];

    if (/\s/.test(char)) {
      index++;
      continue;
    }

    const twoCharOperator = code.slice(index, index + 2);
    const threeCharOperator = code.slice(index, index + 3);

    if (['===', '!=='].includes(threeCharOperator)) {
      tokens.push({ type: 'operator', value: threeCharOperator });
      index += 3;
      continue;
    }

    if (
      ['&&', '||', '??', '==', '!=', '<=', '>='].includes(twoCharOperator)
    ) {
      tokens.push({ type: 'operator', value: twoCharOperator });
      index += 2;
      continue;
    }

    if ('+-*/%<>!'.includes(char)) {
      tokens.push({ type: 'operator', value: char });
      index += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'paren_open', value: char });
      index += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'paren_close', value: char });
      index += 1;
      continue;
    }
    if (char === '[') {
      tokens.push({ type: 'bracket_open', value: char });
      index += 1;
      continue;
    }
    if (char === ']') {
      tokens.push({ type: 'bracket_close', value: char });
      index += 1;
      continue;
    }
    if (char === '.') {
      tokens.push({ type: 'dot', value: char });
      index += 1;
      continue;
    }
    if (char === '?') {
      tokens.push({ type: 'question', value: char });
      index += 1;
      continue;
    }
    if (char === ':') {
      tokens.push({ type: 'colon', value: char });
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const { value, nextIndex } = readString(code, index, char);
      tokens.push({ type: 'string', value });
      index = nextIndex;
      continue;
    }

    if (/\d/.test(char)) {
      const match = code.slice(index).match(/^\d+(\.\d+)?/);
      if (!match) {
        throw new Error('Invalid number');
      }
      tokens.push({ type: 'number', value: Number(match[0]) });
      index += match[0].length;
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      const match = code.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
      if (!match) {
        throw new Error('Invalid identifier');
      }
      index += match[0].length;

      switch (match[0]) {
        case 'true':
        case 'false': {
          tokens.push({ type: 'boolean', value: match[0] === 'true' });
          break;
        }
        case 'null': {
          tokens.push({ type: 'null', value: null });
          break;
        }
        case 'undefined': {
          tokens.push({ type: 'undefined', value: undefined });
          break;
        }
        default: {
          tokens.push({ type: 'identifier', value: match[0] });
        }
      }
      continue;
    }

    throw new Error(`Unexpected character: ${char}`);
  }

  tokens.push({ type: 'eof', value: null });
  return tokens;
}

function readString(code, startIndex, quote) {
  let value = '';
  let escaped = false;
  let index = startIndex + 1;

  while (index < code.length) {
    const char = code[index];

    if (escaped) {
      value += decodeEscape(char);
      escaped = false;
      index++;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      index++;
      continue;
    }

    if (char === quote) {
      return {
        value,
        nextIndex: index + 1,
      };
    }

    value += char;
    index++;
  }

  throw new Error('Unterminated string literal');
}

function decodeEscape(char) {
  switch (char) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case '\\':
      return '\\';
    case '"':
      return '"';
    case "'":
      return "'";
    default:
      return char;
  }
}

function createBinaryNode(operator, left, right) {
  if (['&&', '||', '??'].includes(operator)) {
    return {
      type: 'LogicalExpression',
      operator,
      left,
      right,
    };
  }

  return {
    type: 'BinaryExpression',
    operator,
    left,
    right,
  };
}

function evaluateExpression(node, scope) {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'Identifier':
      return getIdentifierValue(scope, node.name);
    case 'MemberExpression':
      return getMemberValue(node, scope);
    case 'UnaryExpression':
      return evaluateUnary(node, scope);
    case 'BinaryExpression':
      return evaluateBinary(node, scope);
    case 'LogicalExpression':
      return evaluateLogical(node, scope);
    case 'ConditionalExpression':
      return evaluateExpression(node.test, scope)
        ? evaluateExpression(node.consequent, scope)
        : evaluateExpression(node.alternate, scope);
    default:
      throw new Error(`Unsupported expression node: ${node.type}`);
  }
}

function getIdentifierValue(scope, name) {
  if (DISALLOWED_KEYS.has(name)) {
    return undefined;
  }
  return scope[name];
}

function getMemberValue(node, scope) {
  const object = evaluateExpression(node.object, scope);
  if (object == null) {
    return undefined;
  }

  const property = node.computed
    ? evaluateExpression(node.property, scope)
    : node.property.value;

  if (DISALLOWED_KEYS.has(String(property))) {
    return undefined;
  }

  return object[property];
}

function evaluateUnary(node, scope) {
  const value = evaluateExpression(node.argument, scope);

  switch (node.operator) {
    case '!':
      return !value;
    case '-':
      return -value;
    default:
      throw new Error(`Unsupported unary operator: ${node.operator}`);
  }
}

function evaluateBinary(node, scope) {
  const left = evaluateExpression(node.left, scope);
  const right = evaluateExpression(node.right, scope);

  switch (node.operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
    case '%':
      return left % right;
    case '==':
      return left == right;
    case '!=':
      return left != right;
    case '===':
      return left === right;
    case '!==':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    default:
      throw new Error(`Unsupported binary operator: ${node.operator}`);
  }
}

function evaluateLogical(node, scope) {
  switch (node.operator) {
    case '&&': {
      const left = evaluateExpression(node.left, scope);
      return left ? evaluateExpression(node.right, scope) : left;
    }
    case '||': {
      const left = evaluateExpression(node.left, scope);
      return left ? left : evaluateExpression(node.right, scope);
    }
    case '??': {
      const left = evaluateExpression(node.left, scope);
      return left ?? evaluateExpression(node.right, scope);
    }
    default:
      throw new Error(`Unsupported logical operator: ${node.operator}`);
  }
}

export { evaluateAST, safeEval };
