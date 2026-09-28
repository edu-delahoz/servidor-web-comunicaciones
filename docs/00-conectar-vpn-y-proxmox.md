# Paso 0: Conectar a la VPN, entrar a Proxmox y preparar la VM

Guia previa al despliegue. El servidor web corre DENTRO de una VM AlmaLinux
hospedada en el Proxmox del laboratorio (`10.18.30.40`). Para llegar a el hay
que estar conectado a la VPN del lab (OpenVPN + Stunnel).

---

## Paso 1. Reconectar la VPN (OpenVPN + Stunnel)

En Mac normalmente son dos piezas:

1. **Stunnel** corriendo (crea el tunel TLS local en `127.0.0.1`).
2. **OpenVPN Connect** con el perfil `tele2024-stunnel.ovpn` importado,
   conectando a `127.0.0.1`.

Reconecta con el mismo metodo que usaste hace dos dias:
- Abre **stunnel** (que quede activo).
- Abre **OpenVPN Connect** y pulsa **Connect** en el perfil `tele2024-stunnel`.
- Ingresa usuario/contrasena institucional del LIS.
- Debe decir **"Securely Connected"** y asignarte una IP en `10.8.0.x`.

### Verificar que quedo conectado
```bash
# Debe aparecer una utun con IP 10.8.0.x
ifconfig | grep "10.8.0"

# Debe responder el Proxmox
ping -c 3 10.18.30.40

# Debe responder la red de Telematica (prueba de la guia de la U)
ping -c 3 192.168.30.254
```

---

## Paso 2. Entrar a la interfaz web de Proxmox

En el navegador del Mac:

```
https://10.18.30.40:8006
```

- Acepta la advertencia de certificado autofirmado.
- Inicia sesion con las credenciales que te dio el profesor (Realm suele ser
  "Linux PAM" o "Proxmox VE authentication").

---

## Paso 3. Ver si ya tienes una VM AlmaLinux asignada

En el panel izquierdo, expande el nodo (ej. `pve` / `proxmox`). Veras la lista
de VMs (cada una con un numero, ej. `101 (alma-grupoX)`).

- Si ves una VM que parezca de tu grupo -> selecciónala, pestana **Console**
  para entrar, o **Summary** para ver su estado. Ve al Paso 4A.
- Si no hay ninguna tuya -> Paso 4B (crearla).

> Si no estas seguro de cual es tuya, pregunta al profesor cual VM/rango de IP
> le corresponde a tu grupo. NO toques VMs de otros grupos.

---

## Paso 4A. La VM ya existe: averiguar su IP

1. Selecciona la VM -> **Console** e inicia sesion (usuario/clave del grupo).
2. Dentro de la VM:
   ```bash
   ip a          # busca la IP en 10.18.30.x
   ```
3. Anota esa IP: es la que usaras para `scp` y para abrir el sitio.

---

## Paso 4B. Crear la VM AlmaLinux (si no existe)

1. **Subir la ISO** (si no esta): nodo -> `local` (storage) -> **ISO Images**
   -> **Upload** o **Download from URL** (AlmaLinux 9 minimal/DVD).
2. Boton **Create VM** (arriba a la derecha):
   - **General**: Name = `alma-grupoX`.
   - **OS**: ISO = AlmaLinux; Type = Linux, 6.x kernel.
   - **System**: dejar por defecto (BIOS SeaBIOS, SCSI VirtIO).
   - **Disks**: 20-32 GB.
   - **CPU**: 2 cores.
   - **Memory**: 2048-4096 MB.
   - **Network**: **Bridge = `vmbr0v817`** (importante, lo pide el enunciado).
3. **Start** la VM -> **Console** -> instalar AlmaLinux (usuario, root, red).
   - En red, asigna IP fija en `10.18.30.x` (ver `01-despliegue-almalinux.md`).
4. Habilita SSH dentro de la VM:
   ```bash
   sudo systemctl enable --now sshd
   ```

---

## Paso 5. Copiar la webapp a la VM (desde el Mac)

Con la VPN arriba y la IP de la VM (ej. `10.18.30.50`):

```bash
# Desde la carpeta que contiene "webapp"
cd "/Users/edudelahoz/Desktop/semestre 2026-2/comunicaciones/entrega 2/entrega1"

# Copiar la carpeta webapp a la VM (ajusta usuario e IP)
scp -r webapp usuario@10.18.30.50:/home/usuario/
```

Luego continua con `docs/01-despliegue-almalinux.md` (instalar Node 22,
`npm install`, `init-db`, systemd, abrir puerto).

> Recomendacion del profesor: el sitio va por **HTTP** en el puerto 3000
> (`HOST=0.0.0.0`, `SECURE_COOKIES=false`). No se exige HTTPS.
