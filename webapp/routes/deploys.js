'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'deploy-data');

// Exige sesion iniciada (misma politica que el CRUD)
router.use((req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
});

function leerJson(archivo, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, archivo), 'utf8'));
  } catch {
    return porDefecto;
  }
}

// "hace 3 min", "hace 2 h", "hace 5 d"
function tiempoRelativo(iso) {
  if (!iso) return '';
  const seg = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return 'hace un momento';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  return `hace ${Math.floor(seg / 86400)} d`;
}

function formatoUptime(segundos) {
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

router.get('/', (req, res) => {
  const historial = leerJson('history.json', []);
  const ramasInfo = leerJson('branches.json', { fetchedAt: null, branches: [] });
  const actual = historial[0] || null;

  res.render('deploys', {
    title: 'Deploys',
    actual,
    historial: historial.slice(1),
    ramas: ramasInfo.branches,
    ramasFecha: tiempoRelativo(ramasInfo.fetchedAt),
    servidor: {
      node: process.version,
      plataforma: `${os.type()} ${os.release()}`,
      host: os.hostname(),
      uptime: formatoUptime(process.uptime())
    },
    tiempoRelativo
  });
});

module.exports = router;
