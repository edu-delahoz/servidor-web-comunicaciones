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

## CI/CD y dashboard de deploys

Cada push a `main` dispara `.github/workflows/deploy.yml`, que corre en un
**runner self-hosted dentro de la VM**: copia `webapp/`, instala dependencias y
reinicia el servicio. Ademas registra los metadatos del despliegue
(`webapp/deploy/record-deploy.js`), visibles en la pagina **`/deploys`**
(dashboard tipo Vercel: despliegue actual, historial, ramas y estado del servidor).

Flujo de ramas: `feature/*` → PR a `develop` → PR a `main` (deploy automatico).

## Dominio

La VM vive en la red privada del laboratorio (solo accesible por VPN), asi que
no puede tener un dominio publico apuntandole de forma util. Se usa
[nip.io](https://nip.io) (DNS comodin que resuelve al IP embebido en el nombre):

```
http://entrega1.10.18.30.132.nip.io:3000
```

Resuelve a `10.18.30.132` desde cualquier red; con la VPN activa funciona como
un dominio normal, sin configurar nada en el servidor.

## Requisitos

- Node.js **>= 22.5** (usa el modulo integrado `node:sqlite`, sin compilacion nativa).
- AlmaLinux 9 para el despliegue final.
