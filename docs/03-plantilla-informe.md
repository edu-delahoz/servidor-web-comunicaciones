# Informe - Evaluacion de Montajes Practicos: Servidor Web (Parte I)

**Asignatura:** Comunicaciones
**Integrantes:** _(nombre 1) — (nombre 2)_
**Fecha:** _(30 sep / 01 oct 2026)_

---

## 1. Objetivo

Desplegar un servidor web con validacion de usuario y un formulario CRUD sobre
base de datos local en AlmaLinux (Proxmox `10.18.30.40`, red `10.18.30.x`),
protegerlo contra ataques DDoS mediante un cortafuegos iptables y evaluar su
seguridad con OWASP ZAP, corrigiendo las alertas rojas y naranjas.

## 2. Arquitectura de la solucion

- **Sistema operativo:** AlmaLinux 9 (VM en Proxmox).
- **Servidor de aplicacion:** Node.js 22 + Express.
- **Base de datos LOCAL:** SQLite (`node:sqlite`), archivo `db/app.db`.
- **Funcionalidad:** login con sesion + CRUD de clientes (crear/leer/editar/borrar).
- **Direccion del servidor:** `10.18.30.__` en la red `vmbr0v817`.

> _Inserte aqui un diagrama simple: PC cliente -> red 10.18.30.x -> VM AlmaLinux (Node+SQLite)._

## 3. Despliegue del sitio web (punto 1)

_Describa brevemente los pasos (ver `docs/01-despliegue-almalinux.md`) e inserte capturas:_

- [ ] Captura de la VM AlmaLinux con su IP en `10.18.30.x` (`ip a`).
- [ ] Captura del servicio corriendo (`systemctl status webapp`).
- [ ] Captura de la pantalla de **login**.
- [ ] Captura del **CRUD**: lista de clientes + formulario de creacion/edicion.
- [ ] Captura de un dato guardado en la BD (`sqlite3 db/app.db "SELECT * FROM clientes;"`).

## 4. Cortafuegos anti-DDoS (punto 2)

_Explique la estrategia del script (ver `firewall/firewall-ddos.sh`): politica DROP
por defecto, proteccion SYN flood, limite de conexiones por IP, proteccion ICMP y
SSH, cadena `DDOS_DROP` para contabilizar bloqueos._

- [ ] Captura **antes** del ataque: `sudo iptables -L -n -v` (contadores en 0).
- [ ] Captura del **ataque** ejecutandose (`hping3 --flood -S -p 80 ...` y/o `slowhttptest`).
- [ ] Captura **despues** del ataque: `sudo iptables -L -n -v` (contadores DROP altos).
- [ ] Explicacion de que regla bloqueo el ataque y cuantos paquetes se descartaron.

**Comando de ataque usado:**
```
sudo hping3 --flood -S -p 80 10.18.30.XX
slowhttptest -c 1000 -H -g -o slowhttp -i 10 -r 200 -t GET -u http://10.18.30.XX/ -x 24 -p 3
```

## 5. Evaluacion con OWASP ZAP (puntos 3 y 4)

_Ver `docs/02-guia-zap.md`._

- [ ] Captura del resumen de alertas **antes** de corregir.
- [ ] Tabla con cada alerta ROJA/NARANJA: implicacion + solucion aplicada.
- [ ] Captura del resumen de alertas **despues** de corregir (sin rojas/naranjas).

### Analisis de problemas graves encontrados

Por cada alerta grave, complete:

| Alerta | Prioridad | Implicacion | Como se resolvio |
|---|---|---|---|
| _(ej. CSP ausente)_ | Media | _riesgo_ | _cabecera Helmet en server.js_ |
| ... | ... | ... | ... |

## 6. Conclusiones

_Ejemplos de puntos a desarrollar:_

- La separacion entre defensa de red (iptables) y defensa de aplicacion
  (validacion, CSRF, cabeceras) ofrece proteccion en capas.
- El firewall demostro su efectividad: se descartaron _N_ paquetes durante el
  ataque SYN flood sin afectar el trafico legitimo.
- ZAP permitio identificar y corregir _N_ vulnerabilidades antes de exponer el
  servicio; las mas criticas fueron _..._.
- Lecciones aprendidas / dificultades / mejoras futuras (HTTPS con CA real,
  WAF, fail2ban, monitoreo).

## 7. Referencias

- OWASP ZAP. https://www.zaproxy.org/
- OWASP Top 10. https://owasp.org/www-project-top-ten/
- Documentacion de AlmaLinux. https://wiki.almalinux.org/
- iptables — manual (`man iptables`) y https://netfilter.org/documentation/
- Helmet (cabeceras de seguridad HTTP). https://helmetjs.github.io/
- Node.js — modulo `node:sqlite`. https://nodejs.org/api/sqlite.html
- Express.js. https://expressjs.com/
- hping3 (`man hping3`); slowhttptest. https://github.com/shekyan/slowhttptest
