'use strict';

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Base de datos LOCAL (archivo en disco) - requisito de la Parte I.
// Usa el modulo SQLite integrado en Node (>=22.5), sin compilacion nativa.
const DB_PATH = path.join(__dirname, 'app.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

module.exports = db;
