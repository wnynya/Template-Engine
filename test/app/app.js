'use strict';

import nodepath from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodepath.dirname(__filename);

import express from 'express';
import Engine from '@amuject/template-engine';

const app = new express();

app.use(express.static(nodepath.resolve(__dirname, './public')));

const engine = new Engine(nodepath.resolve(__dirname, './views'));
engine.express(app);

app.get('/', (req, res) => {
  const scope = {
    a: 10,
    date: new Date(),
  };
  res.render('index', scope);
});

app.listen(80);
