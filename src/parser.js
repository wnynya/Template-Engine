'use strict';

function parse(node) {
  if (Array.isArray(node) || node instanceof Array) {
    return node.map(parse.bind(this)).filter(Boolean).flat();
  }

  if (node.nodeType === 1) {
    switch (node.tagName) {
      case 'IMPORT': {
        return parseImport(node);
      }
      case 'IF': {
        return parseIf(node);
      }
      case 'ELIF':
      case 'ELSE': {
        return null;
      }
      case 'REPEAT': {
        return parseRepeat(node);
      }
      default: {
        return parseElement(node);
      }
    }
  } else if (node.nodeType === 3) {
    return findEvaluations(node.rawText);
  }
}

function parseImport(node) {
  return [
    {
      type: 'import',
      attributes: Object.fromEntries(
        Object.entries(node.attributes).map(([key, value]) => [
          key,
          findEvaluations(value),
        ]),
      ),
    },
  ];
}

function parseIf(node) {
  const branches = [];
  let cursor = node;
  branches: while (cursor) {
    const condition =
      cursor.tagName === 'ELSE'
        ? null
        : {
            type: 'evaluation',
            value: cursor.getAttribute('condition'),
            return: 'boolean',
          };

    branches.push({
      condition,
      childs: parse(cursor.childNodes),
    });

    sibling: while (true) {
      cursor = cursor.nextElementSibling;
      if (!cursor) {
        break branches;
      } else if (['ELIF', 'ELSE'].includes(cursor.tagName)) {
        break sibling;
      } else {
        break branches;
      }
    }
  }

  return [{ type: 'if', branches }];
}

function parseRepeat(node) {
  return [
    {
      type: 'repeat',
      times: {
        type: 'evaluation',
        value: node.getAttribute('times'),
        return: 'number',
      },
      from: {
        type: 'evaluation',
        value: node.getAttribute('from'),
        return: 'number',
      },
      to: {
        type: 'evaluation',
        value: node.getAttribute('to'),
        return: 'number',
      },
      index: node.getAttribute('index'),
      childs: parse(node.childNodes),
    },
  ];
}

function parseElement(node) {
  return [
    {
      type: 'element',
      tag: node.tagName?.toLowerCase(),
      attributes: Object.fromEntries(
        Object.entries(node.attributes).map(([key, value]) => [
          key,
          findEvaluations(value),
        ]),
      ),
      childs: parse(node.childNodes),
    },
  ];
}

function findEvaluations(text) {
  const childs = [];

  let read = null;
  let buffer = '';
  let braket = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const nextChar = text.charAt(i + 1);

    if (read) {
      buffer += char;
      if (char === '{') {
        braket++;
      } else if (char === '}' && braket > 0) {
        braket--;
      } else if (char === '}') {
        buffer = buffer.substring(0, buffer.length - 1);
        childs.push({
          type: 'evaluation',
          value: buffer,
          return: read === 'instant' ? 'string' : null,
        });
        buffer = '';
        read = null;
      }
    } else if (char === '#' && nextChar === '{') {
      childs.push({ type: 'text', value: buffer });
      buffer = '';
      read = char === '#' ? 'instant' : 'return';
      i++;
    } else {
      buffer += char;
    }
  }
  childs.push({ type: 'text', value: buffer });

  return childs.filter((x) => x.value.length > 0);
}

export default { parse };
