'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const rateLimit = require('express-rate-limit');
const { csrfSync } = require('csrf-sync');

const authRoutes = require('./routes/auth');
const crudRoutes = require('./routes/clientes');
const deployRoutes = require('./routes/deploys');

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const SECURE_COOKIES = String(process.env.SECURE_COOKIES).toLowerCase() === 'true';

// Detras de un proxy inverso (nginx) confiamos en la primera salto para X-Forwarded-*
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// No revelar el framework (ZAP: "Server Leaks Information / X-Powered-By")
app.disable('x-powered-by');

// -----------------------------------------------------------------------------
// Cabeceras de seguridad (corrige la mayoria de alertas de ZAP)
//  - Content-Security-Policy         -> XSS / carga de recursos
//  - X-Frame-Options / frame-ancestors -> Clickjacking
//  - X-Content-Type-Options: nosniff -> MIME sniffing
//  - Strict-Transport-Security (HSTS) -> fuerza HTTPS (solo aplica bajo TLS)
//  - Referrer-Policy                 -> fuga de informacion por referer
// -----------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "img-src": ["'self'", "data:"],
      "font-src": ["'self'"],
      "connect-src": ["'self'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
      "upgrade-insecure-requests": SECURE_COOKIES ? [] : null
    }
  },
  hsts: SECURE_COOKIES ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));

// Permissions-Policy restrictiva (ZAP la solicita en algunos escaneos)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Parsers
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));

// Archivos estaticos
app.use('/public', express.static(path.join(__dirname, 'public'), {
  setHeaders(res) { res.setHeader('Cache-Control', 'public, max-age=3600'); }
}));

// -----------------------------------------------------------------------------
// Sesion persistida en SQLite. Cookie endurecida:
//  httpOnly -> no accesible por JS (mitiga robo de sesion via XSS)
//  sameSite 'lax' -> mitiga CSRF de terceros
//  secure -> solo se envia por HTTPS (activar en produccion con TLS)
// -----------------------------------------------------------------------------
app.use(session({
  store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 }), // purga sesiones expiradas cada hora
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'inseguro-cambieme',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE_COOKIES,
    maxAge: 1000 * 60 * 30 // 30 minutos
  }
}));

// -----------------------------------------------------------------------------
// Proteccion CSRF (patron synchronizer token) para todos los formularios POST
// -----------------------------------------------------------------------------
const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body._csrf
});
app.use((req, res, next) => {
  res.locals.csrfToken = generateToken(req);
  res.locals.user = req.session.user || null;
  // Seccion activa para resaltar el enlace correspondiente en la barra de navegacion
  res.locals.active = req.path.startsWith('/clientes') ? 'clientes'
    : req.path.startsWith('/deploys') ? 'deploys' : null;
  next();
});
app.use(csrfSynchronisedProtection);

// Limitador global de peticiones (defensa en capa de aplicacion; el firewall
// iptables es la defensa principal contra DDoS a nivel de red)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

// -----------------------------------------------------------------------------
// Rutas
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/clientes');
  return res.redirect('/login');
});

app.use('/', authRoutes);
app.use('/clientes', crudRoutes);
app.use('/deploys', deployRoutes);

// Health check simple
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: 'No encontrado', message: 'La pagina solicitada no existe.' });
});

// Manejador de errores (incluye tokens CSRF invalidos)
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', { title: 'Solicitud invalida', message: 'Token CSRF invalido. Recargue la pagina e intente de nuevo.' });
  }
  console.error(err);
  res.status(500).render('error', { title: 'Error', message: 'Ocurrio un error interno.' });
});

app.listen(PORT, HOST, () => {
  console.log(`Servidor escuchando en http://${HOST}:${PORT}`);
});
