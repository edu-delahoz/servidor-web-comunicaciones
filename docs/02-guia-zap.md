# Guia de evaluacion con OWASP ZAP (Parte I, puntos 3 y 4)

## 1. Instalar ZAP en su PC

- Descargue desde https://www.zaproxy.org/download/
- Requiere Java (el instalador de Windows/Mac ya lo incluye).
- Alternativa por linea de comandos (Docker):
  ```bash
  docker run -it zaproxy/zap-stable zap.sh
  ```

## 2. Ejecutar un escaneo automatico

1. Abra ZAP y elija **Automated Scan** (Escaneo automatizado).
2. En "URL to attack" ponga la URL de su servidor:
   `http://10.18.30.50:3000/`  (o `https://10.18.30.50/` si configuro nginx).
3. Marque **Use traditional spider** y **Use ajax spider**.
4. Pulse **Attack**. Espere a que terminen el *Spider* y el *Active Scan*.
5. Revise la pestana **Alerts**. Las alertas se agrupan por prioridad:
   - **Rojo (High)** y **Naranja (Medium)** -> hay que corregirlas.
   - Amarillo (Low) e azul (Informational) -> se documentan pero no son obligatorias.

## 3. Escanear la parte autenticada (recomendado)

Para que ZAP evalue el CRUD detras del login:

1. Menu **Include in Context** sobre su sitio.
2. Configure una **Authentication** tipo *Form-based*:
   - Login URL: `/login`, parametros `username` y `password`.
   - Usuario/contrasena de prueba.
   - Indicador de sesion: la cookie `sid`.
3. Vuelva a lanzar el Active Scan.

## 4. Generar el reporte

`Report -> Generate Report -> HTML`. Guarde el HTML **antes** de aplicar
correcciones y **despues**, para mostrar en el informe que las alertas rojas y
naranjas desaparecieron.

---

## Alertas tipicas de ZAP y como las resuelve esta aplicacion

La aplicacion ya viene endurecida. Esta tabla le sirve para el punto 4
(explicar implicaciones y solucion de cada problema):

| Alerta de ZAP | Prioridad | Implicacion (riesgo) | Solucion aplicada en el proyecto |
|---|---|---|---|
| Content Security Policy (CSP) ausente | Media | Facilita XSS e inyeccion de contenido | Cabecera `Content-Security-Policy` restrictiva via Helmet (`server.js`) |
| Missing Anti-clickjacking Header | Media | El sitio puede embeberse en un iframe (clickjacking) | `X-Frame-Options` + `frame-ancestors 'none'` |
| Absence of Anti-CSRF Tokens | Media | Un tercero puede forzar acciones del usuario | Token CSRF (patron synchronizer) en todos los formularios |
| Cookie without HttpOnly flag | Media | La cookie de sesion es accesible por JS (robo via XSS) | Cookie de sesion con `httpOnly: true` |
| Cookie without Secure flag | Media | La cookie viaja en claro por HTTP | `secure: true` al activar HTTPS (`SECURE_COOKIES=true`) |
| Cookie without SameSite Attribute | Baja/Media | Facilita CSRF | `sameSite: 'lax'` |
| X-Content-Type-Options missing | Baja | MIME sniffing del navegador | `X-Content-Type-Options: nosniff` |
| Strict-Transport-Security missing | Baja/Media | Permite downgrade a HTTP | `HSTS` habilitado bajo HTTPS |
| Server Leaks Version / X-Powered-By | Baja | Revela tecnologia y facilita ataques dirigidos | `app.disable('x-powered-by')` + `server_tokens off` en nginx |
| SQL Injection | **Alta** | Robo/alteracion de la base de datos | Todas las consultas usan **sentencias parametrizadas** (`db.prepare(...).run(?)`) |
| Cross Site Scripting (XSS) | **Alta** | Ejecucion de JS malicioso en el navegador de la victima | EJS **escapa** las variables con `<%= %>`; validacion de entrada; CSP |
| Weak Authentication / brute force | Media | Adivinacion de credenciales | Contrasenas con `bcrypt`; `express-rate-limit` limita intentos de login |
| Session Fixation | Media | Reuso de un id de sesion previo al login | `req.session.regenerate()` tras autenticar |

### Como redactar el punto 4 del informe

Para cada alerta ROJA o NARANJA que ZAP le muestre:

1. **Nombre y prioridad** de la alerta.
2. **Implicacion**: que podria hacer un atacante si no se corrige.
3. **Solucion**: que se hizo (cite la fila de la tabla y el archivo).
4. **Evidencia**: captura del reporte "despues" mostrando que ya no aparece.

> Si su escaneo muestra alguna alerta roja/naranja que NO este en esta tabla,
> avise y la resolvemos: normalmente basta con ajustar una cabecera en
> `server.js` o la CSP.
