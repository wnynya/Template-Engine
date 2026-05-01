'use strict';

import { evaluateAST } from './evaluator/evaluator.js';

const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
  'command',
]);
const resourceAttributes = {
  a: ['href'],
  audio: ['src'],
  embed: ['src'],
  iframe: ['src'],
  img: ['src'],
  input: ['src'],
  object: ['data'],
  source: ['src'],
  track: ['src'],
  video: ['src', 'poster'],
};

function renderAST(ast, scope, ctx) {
  if (Array.isArray(ast)) {
    return ast.map((a) => renderAST(a, scope, ctx)).join('');
  }

  switch (ast.type) {
    case 'text': {
      return renderText(ast, scope, ctx);
    }
    case 'element': {
      return renderElement(ast, scope, ctx);
    }
    case 'evaluation': {
      return renderEvaluate(ast, scope, ctx);
    }
    case 'if': {
      return renderIf(ast, scope, ctx);
    }
    case 'repeat': {
      return renderRepeat(ast, scope, ctx);
    }
    case 'import': {
      return renderImport(ast, scope, ctx);
    }
    default: {
      return '';
    }
  }
}

// evaluate
function renderEvaluate(ast, scope, ctx) {
  return evaluateAST(ast, scope);
}

// text node
function renderText(ast, scope, ctx) {
  return ast.value;
}

// element node attributes
function renderAttributes(attributes, scope, ctx) {
  const attrs = {};
  for (const [k, v] of Object.entries(attributes)) {
    attrs[k] = renderAST(v, scope, ctx);
  }
  return attrs;
}
function joinAttributes(attributes) {
  let attrs = '';
  for (const [k, v] of Object.entries(attributes)) {
    attrs += ` ${k}="${escapeAttribute(v)}"`;
  }
  return attrs;
}
function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// element node
function renderElement(ast, scope, ctx) {
  const attributes = renderAttributes(ast.attributes, scope, ctx);

  const isScopedRoot = Object.hasOwn(attributes, 'scoped');
  if (ast.tag === 'style' && isScopedRoot) {
    return renderScopedStyle(ast, attributes, scope, ctx);
  }
  if (ast.tag === 'link' && isLinkedStyle(attributes)) {
    return renderLinkedStyle(ast, attributes, scope, ctx);
  }
  if (ast.tag === 'script' && isLocalScript(attributes)) {
    return renderScript(ast, attributes, scope, ctx);
  }
  rewriteResourceAttributes(ast.tag, attributes, ctx);
  if (isScopedRoot && ctx.scopeKey) {
    attributes.scoped = ctx.scopeKey;
  }

  const attrs = joinAttributes(attributes);
  const value = renderAST(ast.childs, scope, ctx);

  let html = ``;
  if (ast.tag !== undefined) {
    html += `<${ast.tag}`;
    html += attrs ? attrs : '';
    html += voidTags.has(ast.tag) ? ` />` : `>${value}</${ast.tag}>`;
  } else {
    html += value;
  }

  return html;
}
function renderIf(ast, scope, ctx) {
  for (const branch of ast.branches) {
    if (branch.condition === null || evaluateAST(branch.condition, scope)) {
      return renderAST(branch.childs, scope, ctx);
    }
  }
  return '';
}
function renderRepeat(ast, scope, ctx) {
  const times = Math.max(0, evaluateAST(ast.times, scope) || 0);
  const fromRaw = evaluateAST(ast.from, scope);
  const from = fromRaw ?? 0;
  const toRaw = evaluateAST(ast.to, scope);
  const to = toRaw == null || Number.isNaN(toRaw) ? from + times : toRaw;
  const step = 1;
  const key = ast.index;

  let valueIndex = from;
  let timeIndex = 0;
  let dir = from <= to ? step : -step;

  let output = '';
  while (true) {
    if (timeIndex >= times) {
      break;
    }
    if (dir > 0) {
      if (valueIndex >= to) {
        break;
      }
    } else {
      if (valueIndex <= to) {
        break;
      }
    }

    const localscope = structuredClone(scope);
    if (key) {
      localscope[key] = valueIndex;
    }
    output += renderAST(ast.childs, localscope, ctx);

    valueIndex += dir;
    timeIndex++;
  }

  return output;
}
function renderImport(ast, scope, ctx) {
  const src = ast.attributes.src;
  if (!src) {
    return '';
  }

  const target = renderAST(src, scope, ctx);
  return ctx.resolveImport(ctx.path, target, scope);
}

// assets: style
function renderScopedStyle(ast, attributes, scope, ctx) {
  delete attributes.scoped;
  const css = renderAST(ast.childs, scope, ctx);
  const scopedCSS =
    typeof ctx.inlineStyleRenderer === 'function'
      ? ctx.inlineStyleRenderer(css, ctx.path, ctx.scopeKey)
      : css;

  return `<style${joinAttributes(attributes)}>${scopedCSS}</style>`;
}
function renderLinkedStyle(ast, attributes, scope, ctx) {
  const href = attributes.href;
  if (
    typeof href === 'string' &&
    typeof ctx.assetRenderer === 'function' &&
    isLocalResource(href)
  ) {
    attributes.href = ctx.assetRenderer(
      href,
      ctx.path,
      Object.hasOwn(attributes, 'scoped') ? ctx.scopeKey : null,
    );
  }

  delete attributes.scoped;

  let html = `<${ast.tag}`;
  html += joinAttributes(attributes);
  html += voidTags.has(ast.tag) ? ` />` : `></${ast.tag}>`;
  return html;
}
function isLinkedStyle(attributes) {
  return attributes.rel === 'stylesheet' && typeof attributes.href === 'string';
}

// assets: script
function renderScript(ast, attributes, scope, ctx) {
  if (
    typeof ctx.assetRenderer === 'function' &&
    typeof attributes.src === 'string'
  ) {
    attributes.src = ctx.assetRenderer(attributes.src, ctx.path);
  }

  let html = `<${ast.tag}`;
  html += joinAttributes(attributes);
  html += `>${renderAST(ast.childs, scope, ctx)}</${ast.tag}>`;
  return html;
}
function isLocalScript(attributes) {
  return typeof attributes.src === 'string' && isLocalResource(attributes.src);
}

// assets: resources
function rewriteResourceAttributes(tag, attributes, ctx) {
  const keys = resourceAttributes[tag];
  if (!keys || typeof ctx.assetRenderer !== 'function') {
    return;
  }

  for (const key of keys) {
    if (
      typeof attributes[key] !== 'string' ||
      !isLocalResource(attributes[key])
    ) {
      continue;
    }
    attributes[key] = ctx.assetRenderer(attributes[key], ctx.path);
  }
}
function isLocalResource(target) {
  return (
    typeof target === 'string' &&
    target.length > 0 &&
    !isExternalURL(target) &&
    !target.startsWith('/') &&
    !target.startsWith('#')
  );
}
function isExternalURL(target) {
  return typeof target === 'string' && /^[a-z][a-z\d+\-.]*:/i.test(target);
}

// root render
function render(ast, scope = {}, ctx = {}) {
  scope = structuredClone(scope);
  return renderAST(ast, scope, ctx);
}

export default { render };
