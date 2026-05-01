'use strict';

import nodepath from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodepath.dirname(__filename);

import express from 'express';

import Engine from '@amuject/template-engine';

const engine = new Engine(nodepath.resolve(__dirname, './views'));

const app = engine.express(new express());
app.use(express.static(nodepath.resolve(__dirname, './public')));

app.get('/', (req, res) => {
  const scope = {
    a: 10,
  };
  res.render('index', scope);
});

app.listen(80);
