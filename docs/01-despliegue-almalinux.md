# Guia de despliegue en AlmaLinux (Parte I)

Servidor Web con login + CRUD sobre **Node.js + SQLite**, desplegado en una VM
AlmaLinux dentro de Proxmox (`10.18.30.40`), en la red `10.18.30.x (vmbr0v817)`.

---

## 0. Requisitos previos

- Una VM AlmaLinux 9 creada en Proxmox, con IP fija en la red `10.18.30.x`.
- Acceso `sudo`.
- Los archivos de la carpeta `webapp/` copiados a la VM (por ejemplo con `scp`
  o clonando el repositorio).

### Asignar IP fija (ejemplo con nmcli)

```bash
# Ver el nombre de la interfaz
nmcli con show

# Configurar IP estatica (ajuste el nombre de conexion y la IP libre que le asignen)
sudo nmcli con mod "ens18" ipv4.addresses 10.18.30.50/24
sudo nmcli con mod "ens18" ipv4.gateway 10.18.30.1
sudo nmcli con mod "ens18" ipv4.dns 8.8.8.8
sudo nmcli con mod "ens18" ipv4.method manual
sudo nmcli con up "ens18"

ip a        # verificar
```

---

## 1. Instalar Node.js 22 LTS

El proyecto usa el modulo `node:sqlite` integrado, que requiere **Node >= 22.5**.
En AlmaLinux se instala facilmente desde NodeSource:

```bash
sudo dnf install -y curl
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
node --version    # debe mostrar v22.x o superior
```

---

## 2. Copiar la aplicacion y crear el usuario de servicio

```bash
# Crear un usuario sin privilegios para correr la app (buena practica de seguridad)
sudo useradd -r -m -d /opt/webapp -s /sbin/nologin webapp

# Copiar los archivos del proyecto a /opt/webapp
sudo cp -r webapp/* /opt/webapp/
sudo chown -R webapp:webapp /opt/webapp
```

---

## 3. Instalar dependencias y configurar variables

```bash
cd /opt/webapp
sudo -u webapp npm install --omit=dev

# Crear el archivo .env a partir del ejemplo
sudo -u webapp cp .env.example .env

# Generar un secreto de sesion fuerte y editarlo en .env
openssl rand -hex 32
sudo -u webapp nano .env
```

En `.env` configure al menos:

```
PORT=3000
HOST=0.0.0.0                       # 0.0.0.0 para acceso directo; 127.0.0.1 si usa nginx
SESSION_SECRET=<el valor de openssl rand -hex 32>
SECURE_COOKIES=false               # ponga true cuando tenga HTTPS
ADMIN_USER=admin
ADMIN_PASSWORD=<una contrasena fuerte>
```

---

## 4. Inicializar la base de datos local

```bash
cd /opt/webapp
sudo -u webapp npm run init-db
# -> "Usuario administrador creado: admin"
# Esto crea el archivo LOCAL db/app.db con las tablas users y clientes.
```

---

## 5. Ejecutar como servicio (systemd)

Copie el archivo de servicio incluido y actívelo:

```bash
sudo cp deploy/webapp.service /etc/systemd/system/webapp.service
sudo systemctl daemon-reload
sudo systemctl enable --now webapp
sudo systemctl status webapp        # debe aparecer "active (running)"
```

Ver logs en vivo:

```bash
sudo journalctl -u webapp -f
```

---

## 6. Abrir el puerto en el firewall del sistema

> Nota: en el punto 2 de la entrega se usa un **script iptables propio**. Si va a
> usar ese script, aplíquelo (ver `firewall/`). Si de momento usa `firewalld`:

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

---

## 7. Probar

Desde su PC en la misma red:

```
http://10.18.30.50:3000/
```

Debe aparecer la pantalla de **Iniciar sesion**. Entre con el usuario/contrasena
de administrador y pruebe el CRUD de clientes (crear, listar, editar, eliminar).

---

## (Recomendado) Servir por HTTPS con nginx

Para que ZAP no marque alertas por falta de HTTPS y para poder activar HSTS,
puede poner nginx como proxy inverso con un certificado autofirmado:

```bash
sudo dnf install -y nginx
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/webapp.key -out /etc/nginx/ssl/webapp.crt \
  -subj "/C=CO/ST=Antioquia/L=Medellin/O=Universidad/CN=10.18.30.50"

sudo cp deploy/nginx-webapp.conf /etc/nginx/conf.d/webapp.conf
# Edite server_name con su IP, luego:
sudo nginx -t && sudo systemctl enable --now nginx
```

Luego ponga `HOST=127.0.0.1` y `SECURE_COOKIES=true` en `.env` y reinicie:

```bash
sudo systemctl restart webapp
```

Acceda por `https://10.18.30.50/`.

---

## Comandos utiles

| Accion | Comando |
|---|---|
| Reiniciar la app | `sudo systemctl restart webapp` |
| Ver estado | `sudo systemctl status webapp` |
| Ver logs | `sudo journalctl -u webapp -f` |
| Reinicializar BD | `sudo -u webapp npm run init-db` |
| Ver BD | `sqlite3 /opt/webapp/db/app.db "SELECT * FROM clientes;"` |
