'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db/connection');

const router = express.Router();

// Limitador especifico para el login: mitiga ataques de fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de inicio de sesion. Intente de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/clientes');
  res.render('login', { title: 'Iniciar sesion', error: null });
});

router.post('/login', loginLimiter, (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  // Comparacion resistente a enumeracion: siempre se ejecuta bcrypt
  const ok = user ? bcrypt.compareSync(password, user.password) : bcrypt.compareSync(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');

  if (!user || !ok) {
    return res.status(401).render('login', { title: 'Iniciar sesion', error: 'Usuario o contrasena incorrectos.' });
  }

  // Regenerar la sesion tras autenticar (previene session fixation)
  req.session.regenerate((err) => {
    if (err) return res.status(500).render('login', { title: 'Iniciar sesion', error: 'Error al iniciar sesion.' });
    req.session.user = { id: user.id, username: user.username };
    res.redirect('/clientes');
  });
});

// Limitador para el registro: evita creacion masiva de cuentas
const registroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados registros seguidos. Intente de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false
});

function validarRegistro(body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const confirmar = String(body.confirmar || '');
  const errores = [];

  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    errores.push('El usuario debe tener de 3 a 30 caracteres: letras, numeros, punto, guion o guion bajo.');
  }
  if (password.length < 8 || password.length > 200) {
    errores.push('La contrasena debe tener al menos 8 caracteres.');
  }
  if (password !== confirmar) {
    errores.push('Las contrasenas no coinciden.');
  }
  return { username, password, errores };
}

router.get('/registro', (req, res) => {
  if (req.session.user) return res.redirect('/clientes');
  res.render('registro', { title: 'Crear cuenta', errores: [], valores: {} });
});

router.post('/registro', registroLimiter, (req, res) => {
  if (req.session.user) return res.redirect('/clientes');

  const { username, password, errores } = validarRegistro(req.body);
  if (errores.length) {
    return res.status(400).render('registro', { title: 'Crear cuenta', errores, valores: { username } });
  }

  const existente = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existente) {
    return res.status(400).render('registro', { title: 'Crear cuenta', errores: ['Ese nombre de usuario ya esta en uso.'], valores: { username } });
  }

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);

  // Inicia sesion de una vez (regenerando la sesion, igual que en el login)
  req.session.regenerate((err) => {
    if (err) return res.redirect('/login');
    req.session.user = { id: Number(info.lastInsertRowid), username };
    res.redirect('/clientes');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.redirect('/login');
  });
});

module.exports = router;
