# Informe - Evaluación de Montajes Prácticos: Servidor Web (Parte I)

**Asignatura:** Comunicaciones — Universidad de Antioquia
**Integrantes:** Eduardo de la Hoz — _(compañero/a de grupo)_
**Fecha:** 28 de septiembre de 2026

---

## 1. Objetivo

Desplegar un servidor web con validación de usuario y un formulario CRUD sobre
una base de datos local en AlmaLinux (dentro del servidor Proxmox del laboratorio,
`10.18.30.40`, red `10.18.30.x` / bridge `vmbr0v817`), protegerlo contra ataques
DDoS mediante un cortafuegos con iptables, y evaluar su seguridad con OWASP ZAP,
corrigiendo las alertas rojas y naranjas.

## 2. Arquitectura de la solución

- **Hipervisor:** Proxmox VE 9.2 (`10.18.30.40`, nodo `tele`).
- **Máquina virtual:** `web-entrega1` (VMID 2194), AlmaLinux 9.6, 2 vCPU, 2 GB RAM,
  disco 12 GB, interfaz de red en el bridge **`vmbr0v817`**.
- **Dirección IP del servidor:** `10.18.30.132/24` (gateway `10.18.30.1`).
- **Servidor de aplicación:** Node.js v22.23.3 + Express, plantillas EJS.
- **Base de datos LOCAL:** SQLite (módulo integrado `node:sqlite`), archivo
  `/root/webapp/db/app.db`.
- **Publicación:** servicio systemd `webapp.service` (arranque automático), sitio
  por **HTTP** en el puerto **3000**.
- **Acceso al laboratorio:** VPN OpenVPN + Stunnel de la Universidad.

> _[INSERTAR CAPTURA: diagrama simple — PC (VPN) → red 10.18.30.x → VM AlmaLinux (Node+SQLite)]_

## 3. Despliegue del sitio web (punto 1)

Pasos realizados:
1. Creación de la VM AlmaLinux en Proxmox sobre el bridge `vmbr0v817`.
2. Instalación de AlmaLinux 9.6 (Minimal), con IP en `10.18.30.x` y SSH habilitado.
3. Copia de la aplicación a la VM con `scp` e instalación de Node.js 22 (repositorio
   oficial NodeSource) y dependencias con `npm install`.
4. Configuración (`.env`): secreto de sesión aleatorio, usuario administrador,
   `HOST=0.0.0.0`, `SECURE_COOKIES=false` (sitio por HTTP).
5. Inicialización de la base de datos local (`npm run init-db`).
6. Publicación como servicio systemd y apertura del puerto 3000.

**Funcionalidad entregada:**
- **Login** con validación de usuario (`admin`), contraseñas cifradas con bcrypt.
- **CRUD** de clientes (crear, listar, editar, eliminar) que graba en SQLite local.

> _[INSERTAR CAPTURA: `ip a` mostrando 10.18.30.132]_
> _[INSERTAR CAPTURA: `systemctl status webapp` → active (running)]_
> _[INSERTAR CAPTURA: pantalla de login]_
> _[INSERTAR CAPTURA: lista de clientes + formulario CRUD]_
> _[INSERTAR CAPTURA: `sqlite3 db/app.db "SELECT * FROM clientes;"`]_

## 4. Cortafuegos anti-DDoS y ataque de prueba (punto 2)

Se implementó un cortafuegos con **iptables** (se deshabilitó `firewalld` para
trabajar con iptables puro, como pide el enunciado). El script aplica una estrategia
de **denegar por defecto** (política `DROP`) y permitir solo lo necesario, con las
siguientes protecciones:

| # | Protección | Regla |
|---|---|---|
| 1 | Política por defecto DROP | `iptables -P INPUT DROP` |
| 2 | Permitir loopback y conexiones establecidas | `ctstate ESTABLISHED,RELATED` |
| 3 | Descartar paquetes inválidos | `ctstate INVALID` |
| 4 | Anti flood de ICMP (ping) | `limit 1/second` |
| 5 | Anti escaneo de puertos | flags NULL, XMAS, SYN/FIN, SYN/RST |
| 6 | **Anti SYN flood** | límite 25/seg + connlimit 30/IP + recent 40/10s |
| 7 | Puertos del servicio permitidos | 80, 443, 3000 |
| 8 | Anti fuerza bruta SSH | `recent` 5 intentos/60s en puerto 22 |
| 9 | Descartar y contar el resto | cadena `DDOS_DROP` |

Todo el tráfico bloqueado se envía a una cadena `DDOS_DROP` que registra (LOG) y
descarta (DROP), permitiendo contabilizar los paquetes bloqueados.

### Ataque de prueba

Desde el equipo atacante (Mac en la misma red por VPN) se ejecutaron:
- **SYN flood** con `nping`: `sudo nping --tcp -p 3000 --flags syn --rate 1000 -c 20000 10.18.30.132`
- **Ataque de conexiones lentas** con `slowhttptest`:
  `slowhttptest -c 1000 -H -g -o slowhttp -i 10 -r 200 -t GET -l 30 -u http://10.18.30.132:3000/ -x 24 -p 3`

### Resultados (efectividad del firewall)

| Métrica | ANTES del ataque | DESPUÉS del ataque |
|---|---|---|
| Paquetes bloqueados (cadena `DDOS_DROP`) | 0 | **6.054 (390 KB)** |
| Descartados por la regla anti-SYN-flood | 0 | **6.017** |
| Conexiones legítimas permitidas (límite 25/seg) | — | 697 |
| Estado del servicio web | disponible | **sigue disponible** |

- Del lado del atacante, `nping` reportó **99,36 % de paquetes perdidos** (19.871 de
  20.000), evidencia de que el flood fue absorbido por el servidor sin tumbarlo.
- El firewall **descartó 6.054 paquetes** del ataque lento mientras el servicio
  **permaneció disponible**, demostrando que las reglas son efectivas.

> _[INSERTAR CAPTURA: `iptables -L -n -v` ANTES (contadores en 0) — ver evidencias/]_
> _[INSERTAR CAPTURA: comando de ataque ejecutándose]_
> _[INSERTAR CAPTURA: `iptables -L -n -v` DESPUÉS (DDOS_DROP en 6.054)]_

**Observación técnica:** el ataque SYN flood con `nping` usó un puerto de origen
fijo, por lo que el sistema de seguimiento de conexiones (conntrack) de Linux lo
interpretó como una única conexión repetida (todos los paquetes cayeron en la regla
`ESTABLISHED`). El ataque con `slowhttptest`, que abre múltiples conexiones reales
distintas, sí ejercitó plenamente las reglas anti-DDoS y produjo los 6.054 descartes.
Esto ilustra cómo iptables evalúa las reglas en orden y cómo conntrack clasifica las
conexiones.

## 5. Evaluación con OWASP ZAP (puntos 3 y 4)

Se ejecutó OWASP ZAP (imagen oficial en Docker) contra `http://10.18.30.132:3000`,
con un escaneo activo completo y un escaneo baseline (pasivo).

### Escaneo activo
Todas las reglas de ataque activo se ejecutaron sin encontrar vulnerabilidades
(**0 alertas**): inyección SQL, XSS (reflejado, persistente y DOM), path traversal,
inclusión remota de archivos, ShellShock, ejecución remota de código, redirección
externa, entre otras. Esto confirma la efectividad de las protecciones de la
aplicación (consultas parametrizadas contra inyección SQL y escape de plantillas
contra XSS).

### Escaneo pasivo — alertas y corrección

| Alerta | Riesgo | Estado |
|---|---|---|
| CSP: Wildcard Directive | 🟠 Medio | **Corregida** |
| Cross-Origin-Embedder-Policy ausente | 🟡 Bajo | **Corregida** |
| Non-Storable Content, Auth/Session identified | 🔵 Informativa | No son vulnerabilidades |

**Problemas encontrados y corregidos:**

- **CSP: Wildcard Directive (NARANJA / Medio).**
  - *Implicación:* la política de seguridad de contenido (CSP) tenía la directiva
    `font-src` demasiado permisiva (`https:`), permitiendo cargar fuentes desde
    cualquier origen HTTPS. Un comodín en la CSP debilita la protección contra
    inyección de contenido (XSS).
  - *Solución:* se restringió `font-src` (y `connect-src`) a `'self'` en el archivo
    `server.js`, cerrando la política a solo el propio dominio.

- **Cross-Origin-Embedder-Policy ausente (AMARILLA / Bajo).**
  - *Implicación:* sin esta cabecera, el navegador no aísla completamente el
    documento de recursos de otros orígenes, lo que reduce la protección frente a
    ataques tipo Spectre (fuga de memoria entre orígenes).
  - *Solución:* se añadió la cabecera `Cross-Origin-Embedder-Policy: require-corp`
    mediante Helmet en `server.js`, verificando que la carga de recursos del sitio
    (CSS) siguiera funcionando correctamente.

**Resultado tras las correcciones:** re-escaneo con **0 alertas rojas, 0 naranjas y
0 amarillas**, y 64 verificaciones pasadas. Solo quedan alertas informativas (ZAP
identifica la presencia de login y de gestión de sesión, que no son
vulnerabilidades). Se superó el requisito del enunciado (que pedía corregir solo
rojas y naranjas).

> _[INSERTAR CAPTURA: resumen ZAP inicial (con la naranja CSP)]_
> _[INSERTAR CAPTURA: resumen ZAP final (0 rojas, 0 naranjas)]_
> Reportes completos en `evidencias/zap_report.html` (inicial) y
> `evidencias/zap_report_final.html` (final).

## 6. Conclusiones

- Se logró un montaje práctico funcional que integra los conceptos del curso:
  despliegue de servicios, redireccionamiento de red vía VPN, virtualización con
  Proxmox, seguridad de red (iptables) y seguridad de aplicación web.
- La **defensa en capas** resultó clave: la protección de red (iptables) y la
  protección de aplicación (validación de entrada, tokens CSRF, cabeceras de
  seguridad, consultas parametrizadas) se complementan. Un atacante debe superar
  ambas.
- El cortafuegos demostró su **efectividad de forma medible**: pasó de 0 a **6.054
  paquetes descartados** durante el ataque, manteniendo el servicio disponible. La
  columna `pkts` de `iptables -L -n -v` es la evidencia cuantitativa de que las
  reglas actúan.
- OWASP ZAP permitió **verificar objetivamente** la seguridad: el escaneo activo no
  encontró vulnerabilidades críticas (inyección SQL / XSS), y la única alerta de
  riesgo medio (CSP permisiva) se corrigió, dejando el sitio sin alertas rojas ni
  naranjas.
- **Aprendizajes / dificultades:** entender el orden de evaluación de las reglas de
  iptables y el comportamiento de conntrack (por qué un SYN flood con puerto de
  origen fijo no ejercita las reglas anti-flood). También la diferencia entre servir
  por HTTP y HTTPS y su impacto en cabeceras como HSTS y en las cookies `Secure`.
- **Mejoras futuras:** servir el sitio por HTTPS (certificado y nginx como proxy
  inverso), hacer persistentes las reglas de iptables, agregar `fail2ban` y
  monitoreo, y completar la cabecera Cross-Origin-Embedder-Policy.

## 7. Referencias

- OWASP ZAP — Zed Attack Proxy. https://www.zaproxy.org/
- OWASP Top 10. https://owasp.org/www-project-top-ten/
- Documentación de AlmaLinux. https://wiki.almalinux.org/
- Proxmox VE — Documentación. https://pve.proxmox.com/pve-docs/
- Netfilter / iptables — Documentación. https://netfilter.org/documentation/
- Manual de iptables (`man iptables`).
- Helmet — Cabeceras de seguridad HTTP para Express. https://helmetjs.github.io/
- Node.js — Módulo `node:sqlite`. https://nodejs.org/api/sqlite.html
- Express.js. https://expressjs.com/
- slowhttptest. https://github.com/shekyan/slowhttptest
- Nmap / Nping. https://nmap.org/nping/
