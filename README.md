# Template Engine

```
npm i @amuject/template-engine
```

## Directory Structure

```
/src
  - app.js
  - ... server-side codes

  /views
    index.html
    /pages
    ... templates, assets, etc
```

## Usage

```js
// app.js

'use strict';

import nodepath from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodepath.dirname(__filename);

import express from 'express';
import Engine from '@amuject/template-engine';

const engine = new Engine(nodepath.resolve(__dirname, './views'));
const app = engine.express(new express());

app.get('/', (req, res) => {
  const scope = {};
  res.render('index', scope);
});

app.listen(80);
```

## 템플릿 문법

### Scope Evaluation

```html
<div class="#{eval}"></div>
<p>#{eval}</p>
```

### Import Tags

```html
<import src="template"></import>
```

### Conditional Tags

```html
<if condition="cond"></if>

<elif condition="cond"></elif>

<else condition="cond"></else>
```

### Repeat Tag

```html
<repeat times="5"></repeat>

<repeat times="5" from="1"></repeat>

<repeat from="1" to="10"></repeat>

<repeat times="5" index="i">
  <p>index is: #{i}</p>
</repeat>
```

### Scoped Style

```html
<link rel="stylesheet" href="style.css" scoped />

<style scoped>
  /* ... */
</style>

<div scoped>
  <h1>Hello</h1>
</div>

<p scoped></p>
```
