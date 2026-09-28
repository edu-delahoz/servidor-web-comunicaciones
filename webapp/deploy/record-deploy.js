'use strict';

// Registra los metadatos de un despliegue. Lo ejecuta el workflow de GitHub
// Actions en la VM despues de reiniciar el servicio. Escribe en
// <webapp>/deploy-data/ (fuera del repo), que el dashboard /deploys lee.
//
// Variables de entorno esperadas (las provee el workflow):
//   DEPLOY_SHA, DEPLOY_MESSAGE, DEPLOY_BRANCH, DEPLOY_ACTOR,
//   DEPLOY_RUN_NUMBER, DEPLOY_RUN_ID, DEPLOY_REPO, DEPLOY_DURATION_SEC
// Opcional: BRANCHES_FILE (JSON crudo del API de GitHub con las ramas)

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'deploy-data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const BRANCHES_FILE_OUT = path.join(DATA_DIR, 'branches.json');
const MAX_HISTORY = 20;

// --- Historial de despliegues ---
let history = [];
try {
  history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  if (!Array.isArray(history)) history = [];
} catch { /* primera vez: no existe */ }

const entry = {
  runNumber: Number(process.env.DEPLOY_RUN_NUMBER) || null,
  runId: process.env.DEPLOY_RUN_ID || null,
  sha: process.env.DEPLOY_SHA || '',
  shortSha: (process.env.DEPLOY_SHA || '').slice(0, 7),
  message: process.env.DEPLOY_MESSAGE || '(sin mensaje)',
  branch: process.env.DEPLOY_BRANCH || 'main',
  actor: process.env.DEPLOY_ACTOR || 'desconocido',
  repo: process.env.DEPLOY_REPO || '',
  durationSec: Number(process.env.DEPLOY_DURATION_SEC) || null,
  timestamp: new Date().toISOString(),
  status: 'ready'
};

history.unshift(entry);
history = history.slice(0, MAX_HISTORY);
fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
console.log(`Deploy #${entry.runNumber} (${entry.shortSha}) registrado en el historial.`);

// --- Snapshot de ramas (viene del API de GitHub via curl en el workflow) ---
if (process.env.BRANCHES_FILE && fs.existsSync(process.env.BRANCHES_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(process.env.BRANCHES_FILE, 'utf8'));
    const branches = (Array.isArray(raw) ? raw : []).map((b) => ({
      name: b.name,
      sha: (b.commit && b.commit.sha || '').slice(0, 7),
      protected: Boolean(b.protected)
    }));
    fs.writeFileSync(BRANCHES_FILE_OUT, JSON.stringify({
      fetchedAt: new Date().toISOString(),
      branches
    }, null, 2));
    console.log(`Snapshot de ${branches.length} ramas guardado.`);
  } catch (e) {
    console.error('No se pudo procesar el snapshot de ramas:', e.message);
  }
}
