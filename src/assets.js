'use strict';

import nodefs from 'node:fs';
import nodepath from 'node:path';

class Assets {
  #assets = new Map();

  constructor(views, { resolvePath }) {
    this.views = views;
    this.resolvePath = resolvePath;
  }

  getAsset(path) {
    return this.#assets.get(path) ?? null;
  }

  ensureAsset(sourcePath, scope = null) {
    const assetPath = this.createAssetPath(sourcePath, scope);

    if (!this.#assets.has(assetPath)) {
      this.#assets.set(assetPath, this.createAssetEntry(sourcePath, scope));
    }

    return assetPath;
  }

  createAssetPath(sourcePath, scope = null) {
    const relativePath = nodepath.relative(this.views, sourcePath);
    const normalizedPath = relativePath.split(nodepath.sep).join('/');

    if (!scope) {
      return `/assets/${normalizedPath}`;
    }

    const extension = nodepath.extname(normalizedPath);
    const basename = normalizedPath.slice(0, -extension.length);
    return `/assets/scoped/${basename}-${scope}${extension}`;
  }

  createAssetEntry(sourcePath, scope = null) {
    const mime = getMime(sourcePath);

    if (isTransformableAsset(sourcePath)) {
      const source = nodefs.readFileSync(sourcePath, 'utf8');
      const body = this.transformAsset(source, sourcePath, scope);
      return {
        kind: 'store',
        mime,
        body,
        path: sourcePath,
        scope,
      };
    }

    return {
      kind: 'link',
      mime,
      path: sourcePath,
      scope,
    };
  }

  transformAsset(source, sourcePath, scope = null) {
    switch (nodepath.extname(sourcePath)) {
      case '.css': {
        return this.transformCSS(source, sourcePath, scope);
      }
      case '.js': {
        return this.transformJavaScript(source, sourcePath);
      }
      default: {
        return source;
      }
    }
  }

  transformCSS(source, sourcePath, scope = null) {
    let content = scope ? rewriteScopedCSS(source, scope) : source;

    content = content.replaceAll(
      /@import\s+(url\()?\s*(['"])([^'"]+)\2\s*\)?/g,
      (match, urlWrapper, quote, target) =>
        this.rewriteCSSImport(match, sourcePath, target, {
          quote,
          scope,
          urlWrapper,
        }),
    );

    content = content.replaceAll(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
      (match, quote, target) =>
        this.rewriteCSSUrl(match, sourcePath, target, quote),
    );

    return content;
  }

  rewriteCSSImport(match, sourcePath, target, options) {
    if (!isLocalSpecifier(target)) {
      return match;
    }

    const assetPath = this.ensureDependency(sourcePath, target, options.scope);

    if (options.urlWrapper) {
      return `@import url(${options.quote}${assetPath}${options.quote})`;
    }
    return `@import ${options.quote}${assetPath}${options.quote}`;
  }

  rewriteCSSUrl(match, sourcePath, target, quote) {
    if (!isLocalSpecifier(target)) {
      return match;
    }

    const assetPath = this.ensureDependency(sourcePath, target);
    const wrappedQuote = quote || '"';
    return `url(${wrappedQuote}${assetPath}${wrappedQuote})`;
  }

  transformJavaScript(source, sourcePath) {
    let content = source;

    content = content.replaceAll(
      /(import\s+[^'"]*?\sfrom\s*)(['"])([^'"]+)\2/g,
      (match, prefix, quote, target) =>
        `${prefix}${quote}${this.rewriteJavaScriptImport(sourcePath, target)}${quote}`,
    );

    content = content.replaceAll(
      /(^|[\n\r;]\s*)(import\s*)(['"])([^'"]+)\3/g,
      (match, leading, prefix, quote, target) =>
        `${leading}${prefix}${quote}${this.rewriteJavaScriptImport(sourcePath, target)}${quote}`,
    );

    content = content.replaceAll(
      /(export\s+[^'"]*?\sfrom\s*)(['"])([^'"]+)\2/g,
      (match, prefix, quote, target) =>
        `${prefix}${quote}${this.rewriteJavaScriptImport(sourcePath, target)}${quote}`,
    );

    content = content.replaceAll(
      /(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
      (match, prefix, quote, target, suffix) =>
        `${prefix}${quote}${this.rewriteJavaScriptImport(sourcePath, target)}${quote}${suffix}`,
    );

    return content;
  }

  rewriteJavaScriptImport(sourcePath, target) {
    if (!isLocalSpecifier(target)) {
      return target;
    }

    return this.ensureDependency(sourcePath, target);
  }

  ensureDependency(sourcePath, target, scope = null) {
    const dependencyPath = this.resolvePath(sourcePath, target);
    return this.ensureAsset(dependencyPath, scope);
  }

  rewriteInlineStyle(css, scope) {
    return rewriteScopedCSS(css, scope);
  }
}

function rewriteScopedCSS(css, scope) {
  return css.replaceAll('[scoped]', `[scoped="${scope}"]`);
}

function isLocalSpecifier(target) {
  return (
    typeof target === 'string' &&
    target.length > 0 &&
    !isExternalURL(target) &&
    !target.startsWith('/') &&
    !target.startsWith('data:') &&
    !target.startsWith('#')
  );
}

function isExternalURL(target) {
  return typeof target === 'string' && /^[a-z][a-z\d+\-.]*:/i.test(target);
}

function getMime(path) {
  switch (nodepath.extname(path)) {
    case '.css': {
      return 'text/css';
    }
    case '.js': {
      return 'text/javascript';
    }
    case '.jpg':
    case '.jpeg': {
      return 'image/jpeg';
    }
    case '.png': {
      return 'image/png';
    }
    case '.gif': {
      return 'image/gif';
    }
    case '.webp': {
      return 'image/webp';
    }
    case '.svg': {
      return 'image/svg+xml';
    }
    case '.mp4': {
      return 'video/mp4';
    }
    case '.webm': {
      return 'video/webm';
    }
    case '.mp3': {
      return 'audio/mpeg';
    }
    case '.wav': {
      return 'audio/wav';
    }
    case '.ogg': {
      return 'audio/ogg';
    }
    default: {
      return 'application/octet-stream';
    }
  }
}

function isTransformableAsset(sourcePath) {
  return ['.css', '.js'].includes(nodepath.extname(sourcePath));
}

export default Assets;
