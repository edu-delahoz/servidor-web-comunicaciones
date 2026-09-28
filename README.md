# Entrega Montajes Practicos — Parte I: Servidor Web

Solucion completa de la Parte I: servidor web con **login + CRUD** sobre
**Node.js + SQLite** en AlmaLinux, protegido con un **cortafuegos iptables
anti-DDoS** y evaluado con **OWASP ZAP**.

## Estructura

```
entrega1/
├── README.md                      <- este archivo
├── webapp/                        <- aplicacion web (Node.js + SQLite)
│   ├── server.js                  <- servidor Express + cabeceras de seguridad
│   ├── db/                        <- conexion e inicializacion de SQLite (BD local)
│   ├── routes/                    <- auth (login) y clientes (CRUD)
│   ├── views/                     <- plantillas EJS
│   ├── public/                    <- CSS
│   └── deploy/                    <- webapp.service (systemd) + nginx-webapp.conf
├── firewall/
│   ├── firewall-ddos.sh           <- script de cortafuegos anti-DDoS
│   └── demo-ataque.md             <- procedimiento del ataque de prueba (antes/despues)
└── docs/
    ├── 01-despliegue-almalinux.md <- guia paso a paso de despliegue
    ├── 02-guia-zap.md             <- guia de ZAP + tabla de alertas/soluciones
    └── 03-plantilla-informe.md    <- plantilla del informe a entregar
```

## Que cubre cada punto de la entrega

| Punto de la entrega | Donde se resuelve |
|---|---|
| 1. Sitio web con login + CRUD + BD local | `webapp/` + `docs/01-despliegue-almalinux.md` |
| 2. Script cortafuegos anti-DDoS + ataque de prueba | `firewall/firewall-ddos.sh` + `firewall/demo-ataque.md` |
| 3. Evaluacion con OWASP ZAP | `docs/02-guia-zap.md` |
| 4. Analisis y correccion de alertas rojas/naranjas | app ya endurecida + tabla en `docs/02-guia-zap.md` |
| 5. Conclusiones | `docs/03-plantilla-informe.md` |
| 6. Referencias | `docs/03-plantilla-informe.md` |

## Prueba rapida en local (para verlo funcionando antes de subirlo a la VM)

```bash
cd webapp
npm install
cp .env.example .env          # edite SESSION_SECRET y ADMIN_PASSWORD
npm run init-db               # crea la BD local y el usuario admin
npm start                     # http://127.0.0.1:3000
```

Entre con el usuario/contrasena definidos en `.env` y pruebe el CRUD de clientes.

## Caracteristicas de seguridad ya incluidas (para pasar ZAP)

- Cabeceras: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy, HSTS (bajo HTTPS), sin X-Powered-By.
- Cookie de sesion `httpOnly` + `sameSite` + `secure` (HTTPS).
- Proteccion CSRF en todos los formularios.
- Contrasenas con `bcrypt`; limite de intentos de login (anti fuerza bruta).
- Consultas parametrizadas (anti inyeccion SQL); escape de salida (anti XSS).
- Regeneracion de sesion tras login (anti session fixation).

## Requisitos

- Node.js **>= 22.5** (usa el modulo integrado `node:sqlite`, sin compilacion nativa).
- AlmaLinux 9 para el despliegue final.
