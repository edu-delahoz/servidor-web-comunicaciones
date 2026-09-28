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

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.redirect('/login');
  });
});

module.exports = router;
