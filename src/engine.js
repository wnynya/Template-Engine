'use strict';

import nodepath from 'node:path';

import renderer from './renderer.js';
import Templates from './templates.js';
import Assets from './assets.js';

class Engine {
  constructor(views) {
    this.views = views;
    this.templates = new Templates(this.views);
    this.assets = new Assets(this.views, {
      resolvePath: (source, target) => this.resolvePath(target, source),
    });
  }

  resolvePath(target, source = null) {
    if (isExternalURL(target)) {
      return target;
    }

    if (nodepath.isAbsolute(target)) {
      if (!isPathInside(this.views, target)) {
        throw new Error(`Path is outside views: ${target}`);
      }
      return target;
    }

    let dir = source ? nodepath.dirname(source) : this.views;
    if (target.startsWith('/')) {
      target = target.substring(1);
      dir = this.views;
    }

    let path = nodepath.resolve(dir, target);
    if (!isPathInside(this.views, path)) {
      throw new Error(`Path is outside views: ${target}`);
    }
    return path;

    function isExternalURL(target) {
      return typeof target === 'string' && /^[a-z][a-z\d+\-.]*:/i.test(target);
    }

    function isPathInside(root, target) {
      const relativePath = nodepath.relative(root, target);
      return (
        (relativePath !== '' &&
          !relativePath.startsWith('..') &&
          !nodepath.isAbsolute(relativePath)) ||
        target === root
      );
    }
  }

  render(path, scope = {}) {
    path = this.resolvePath(path);

    const ast = this.templates.getTemplate(path);
    const scopeKey = this.templates.getScope(path);
    const ctx = {
      path,
      scopeKey,
      resolveImport: (source = path, target, nextScope) => {
        let importPath = this.resolvePath(target, source);
        if (nodepath.extname(importPath) === '') {
          importPath += '.html';
        }

        return this.render(importPath, nextScope);
      },
      inlineStyleRenderer: (css, sourceFile = path, key = scopeKey) =>
        this.assets.rewriteInlineStyle(css, key),
      assetRenderer: (target, sourceFile = path, key = null) => {
        const assetPath = this.resolvePath(target, sourceFile);
        return this.assets.ensureAsset(assetPath, key);
      },
    };

    return renderer.render(ast, scope, ctx);
  }

  asset(path) {
    return this.assets.getAsset(path);
  }

  express(app) {
    app.engine(
      'html',
      ((path, scope, callback) => {
        try {
          delete scope.settings;
          callback(null, this.render(path, scope));
        } catch (error) {
          callback(error, null);
        }
      }).bind(this),
    );
    app.set('view engine', 'html');
    app.set('views', this.views);
    app.use(
      ((req, res, next) => {
        const asset = this.asset(req.path);
        if (!asset) {
          next();
        } else if (asset.kind === 'link') {
          res.type(asset.mime).sendFile(asset.path);
        } else {
          res.type(asset.mime).send(asset.body);
        }
      }).bind(this),
    );

    return app;
  }
}

export default Engine;
