'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db/connection');

const router = express.Router();

// Exige sesion iniciada
router.use((req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
});

// Limitador del cambio de contrasena (anti fuerza bruta contra la actual)
const cambioLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos. Intente de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false
});

function datosCuenta(req) {
  return db.prepare('SELECT username, created_at FROM users WHERE id = ?')
    .get(req.session.user.id);
}

router.get('/', (req, res) => {
  res.render('cuenta', { title: 'Mi cuenta', cuenta: datosCuenta(req), errores: [], exito: null });
});

router.post('/password', cambioLimiter, (req, res) => {
  const actual = String(req.body.actual || '');
  const nueva = String(req.body.nueva || '');
  const confirmar = String(req.body.confirmar || '');
  const errores = [];

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (!user || !bcrypt.compareSync(actual, user.password)) {
    errores.push('La contrasena actual no es correcta.');
  }
  if (nueva.length < 8 || nueva.length > 200) {
    errores.push('La nueva contrasena debe tener al menos 8 caracteres.');
  }
  if (nueva !== confirmar) {
    errores.push('La confirmacion no coincide con la nueva contrasena.');
  }
  if (!errores.length && bcrypt.compareSync(nueva, user.password)) {
    errores.push('La nueva contrasena debe ser distinta de la actual.');
  }

  if (errores.length) {
    return res.status(400).render('cuenta', { title: 'Mi cuenta', cuenta: datosCuenta(req), errores, exito: null });
  }

  db.prepare('UPDATE users SET password = ? WHERE id = ?')
    .run(bcrypt.hashSync(nueva, 12), user.id);

  res.render('cuenta', {
    title: 'Mi cuenta',
    cuenta: datosCuenta(req),
    errores: [],
    exito: 'Contrasena actualizada correctamente.'
  });
});

module.exports = router;
