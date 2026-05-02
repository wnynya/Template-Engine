'use strict';

import nodecrypto from 'node:crypto';
import nodefs from 'node:fs';
import nodepath from 'node:path';

import { parse as parseHTML } from 'node-html-parser';

import parser from './parser.js';

class Templates {
  #templates = new Map();
  #scopes = new Map();

  constructor(views) {
    this.views = views;
  }

  getTemplate(path) {
    if (!this.#templates.has(path)) {
      const html = nodefs.readFileSync(path, 'utf8');
      const document = parseHTML(html);
      const ast = parser.parse(document);
      this.#templates.set(path, ast);
    }

    return structuredClone(this.#templates.get(path));
  }

  getScope(path) {
    if (!this.#scopes.has(path)) {
      const hexHash = nodecrypto
        .createHash('sha256')
        .update(path)
        .digest('hex');
      const b36Hash = BigInt('0x' + hexHash).toString(36);
      const hash = b36Hash.substring(0, 6);
      this.#scopes.set(path, hash);
    }

    return this.#scopes.get(path);
  }
}

export default Templates;
