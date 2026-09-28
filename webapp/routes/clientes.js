'use strict';

const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Middleware: exige sesion iniciada
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
router.use(requireAuth);

// Validacion basica de entrada
function validarCliente(body) {
  const nombre = String(body.nombre || '').trim();
  const email = String(body.email || '').trim();
  const telefono = String(body.telefono || '').trim();
  const notas = String(body.notas || '').trim();
  const errores = [];

  if (nombre.length < 2 || nombre.length > 100) errores.push('El nombre debe tener entre 2 y 100 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push('El email no es valido.');
  if (telefono && !/^[0-9+\-\s()]{5,20}$/.test(telefono)) errores.push('El telefono no es valido.');
  if (notas.length > 500) errores.push('Las notas no pueden superar 500 caracteres.');

  return { datos: { nombre, email, telefono, notas }, errores };
}

// LISTAR (Read)
router.get('/', (req, res) => {
  const clientes = db.prepare('SELECT * FROM clientes ORDER BY id DESC').all();
  res.render('clientes/list', { title: 'Clientes', clientes });
});

// FORMULARIO NUEVO (Create - form)
router.get('/nuevo', (req, res) => {
  res.render('clientes/form', { title: 'Nuevo cliente', cliente: {}, errores: [], accion: '/clientes' });
});

// CREAR (Create)
router.post('/', (req, res) => {
  const { datos, errores } = validarCliente(req.body);
  if (errores.length) {
    return res.status(400).render('clientes/form', { title: 'Nuevo cliente', cliente: datos, errores, accion: '/clientes' });
  }
  db.prepare('INSERT INTO clientes (nombre, email, telefono, notas) VALUES (?, ?, ?, ?)')
    .run(datos.nombre, datos.email, datos.telefono, datos.notas);
  res.redirect('/clientes');
});

// FORMULARIO EDITAR (Update - form)
router.get('/:id/editar', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).render('error', { title: 'No encontrado', message: 'Cliente no encontrado.' });
  res.render('clientes/form', { title: 'Editar cliente', cliente, errores: [], accion: `/clientes/${cliente.id}` });
});

// ACTUALIZAR (Update) - se usa POST con action explicita
router.post('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).render('error', { title: 'No encontrado', message: 'Cliente no encontrado.' });

  const { datos, errores } = validarCliente(req.body);
  if (errores.length) {
    return res.status(400).render('clientes/form', { title: 'Editar cliente', cliente: { ...datos, id: cliente.id }, errores, accion: `/clientes/${cliente.id}` });
  }
  db.prepare("UPDATE clientes SET nombre = ?, email = ?, telefono = ?, notas = ?, updated_at = datetime('now') WHERE id = ?")
    .run(datos.nombre, datos.email, datos.telefono, datos.notas, cliente.id);
  res.redirect('/clientes');
});

// BORRAR (Delete)
router.post('/:id/eliminar', (req, res) => {
  db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  res.redirect('/clientes');
});

module.exports = router;
