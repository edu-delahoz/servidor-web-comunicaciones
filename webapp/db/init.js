'use strict';

// Inicializa el esquema de la base de datos LOCAL y crea el usuario administrador.
// Uso:  node db/init.js   (o  npm run init-db)

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./connection');

// --- Esquema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL,
    email      TEXT NOT NULL,
    telefono   TEXT,
    notas      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Usuario administrador inicial ---
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser);
if (!existing) {
  const hash = bcrypt.hashSync(adminPass, 12);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(adminUser, hash);
  console.log(`Usuario administrador creado: "${adminUser}"`);
} else {
  console.log(`El usuario "${adminUser}" ya existe. No se realizan cambios.`);
}

console.log('Base de datos inicializada correctamente.');
