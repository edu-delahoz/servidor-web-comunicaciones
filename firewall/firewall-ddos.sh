#!/bin/bash
# =============================================================================
#  firewall-ddos.sh  -  Cortafuegos anti-DDoS para el Servidor Web (Parte I)
#  Plataforma: AlmaLinux (iptables)
#  Uso:   sudo ./firewall-ddos.sh
#         sudo ./firewall-ddos.sh reset     (borra todas las reglas)
#
#  Estrategia:
#   - Politica por defecto DROP en INPUT (todo lo no permitido se descarta).
#   - Se crean cadenas dedicadas con reglas DROP para que el conteo de paquetes
#     bloqueados sea VISIBLE con:  iptables -L -n -v
#   - Proteccion contra: SYN flood, exceso de conexiones por IP, flood ICMP,
#     paquetes invalidos y escaneos de puertos.
# =============================================================================

set -e
IPT=/sbin/iptables

# ------- Puertos del servicio (ajuste segun su despliegue) -------
SSH_PORT=22
HTTP_PORT=80
HTTPS_PORT=443
APP_PORT=3000          # Puerto de la app Node (si se expone directo, sin nginx)

# =============================================================================
#  RESET: limpiar todo y dejar el firewall abierto
# =============================================================================
if [ "$1" == "reset" ]; then
  echo "[*] Limpiando reglas y restaurando politica ACCEPT..."
  $IPT -P INPUT ACCEPT
  $IPT -P FORWARD ACCEPT
  $IPT -P OUTPUT ACCEPT
  $IPT -F
  $IPT -X
  echo "[+] Firewall reiniciado (sin reglas)."
  exit 0
fi

echo "[*] Aplicando reglas de cortafuegos anti-DDoS..."

# ------- 1. Limpiar reglas previas -------
$IPT -F
$IPT -X
$IPT -Z

# ------- 2. Politicas por defecto -------
$IPT -P INPUT   DROP        # Denegar por defecto todo el trafico entrante
$IPT -P FORWARD DROP
$IPT -P OUTPUT  ACCEPT      # Permitir salida (el servidor responde/actualiza)

# ------- 3. Cadenas dedicadas de conteo/bloqueo (para ver DROP con -v) -------
$IPT -N DDOS_DROP           # Descartes por proteccion DDoS
$IPT -A DDOS_DROP -m limit --limit 5/min -j LOG --log-prefix "DDOS-DROP: " --log-level 4
$IPT -A DDOS_DROP -j DROP

# ------- 4. Trafico basico permitido -------
# Loopback
$IPT -A INPUT -i lo -j ACCEPT
# Conexiones ya establecidas o relacionadas
$IPT -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# Descartar paquetes en estado INVALID (contador visible)
$IPT -A INPUT -m conntrack --ctstate INVALID -j DDOS_DROP

# ------- 5. Proteccion ICMP (ping) flood -------
# Permite ping a ritmo limitado; el exceso cae a DDOS_DROP
$IPT -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/second --limit-burst 5 -j ACCEPT
$IPT -A INPUT -p icmp --icmp-type echo-request -j DDOS_DROP

# ------- 6. Proteccion contra escaneo de puertos / paquetes anomalos -------
# Paquetes NULL, XMAS y SYN+FIN son tipicos de escaneos/ataques
$IPT -A INPUT -p tcp --tcp-flags ALL NONE -j DDOS_DROP
$IPT -A INPUT -p tcp --tcp-flags ALL ALL -j DDOS_DROP
$IPT -A INPUT -p tcp --tcp-flags SYN,FIN SYN,FIN -j DDOS_DROP
$IPT -A INPUT -p tcp --tcp-flags SYN,RST SYN,RST -j DDOS_DROP

# =============================================================================
#  7. PROTECCION SYN FLOOD (ataque tipo: hping3 --flood -S)
# =============================================================================
# a) Limitar la TASA de nuevas conexiones SYN a los puertos web.
#    Se usa el modulo "limit": se aceptan hasta 25 SYN/seg con rafaga de 50;
#    el exceso se descarta y queda contabilizado en DDOS_DROP.
$IPT -A INPUT -p tcp --syn -m multiport --dports $HTTP_PORT,$HTTPS_PORT,$APP_PORT \
     -m limit --limit 25/second --limit-burst 50 -j ACCEPT
$IPT -A INPUT -p tcp --syn -m multiport --dports $HTTP_PORT,$HTTPS_PORT,$APP_PORT \
     -j DDOS_DROP

# b) Limitar el NUMERO de conexiones simultaneas por IP de origen
#    (mitiga slowhttptest / slowloris que abre muchas conexiones lentas).
$IPT -A INPUT -p tcp -m multiport --dports $HTTP_PORT,$HTTPS_PORT,$APP_PORT \
     -m connlimit --connlimit-above 30 --connlimit-mask 32 -j DDOS_DROP

# c) Limitar la tasa de nuevas conexiones por IP con el modulo "recent"
#    (mas de 40 conexiones nuevas en 10s desde una IP -> se bloquea).
$IPT -A INPUT -p tcp --syn -m multiport --dports $HTTP_PORT,$HTTPS_PORT,$APP_PORT \
     -m recent --set --name WEB
$IPT -A INPUT -p tcp --syn -m multiport --dports $HTTP_PORT,$HTTPS_PORT,$APP_PORT \
     -m recent --update --seconds 10 --hitcount 40 --name WEB -j DDOS_DROP

# ------- 8. Puertos del servicio permitidos (trafico legitimo ya filtrado) -------
$IPT -A INPUT -p tcp --dport $HTTP_PORT  -j ACCEPT
$IPT -A INPUT -p tcp --dport $HTTPS_PORT -j ACCEPT
$IPT -A INPUT -p tcp --dport $APP_PORT   -j ACCEPT

# ------- 9. SSH con proteccion contra fuerza bruta -------
# Mas de 4 intentos nuevos de SSH en 60s desde una IP -> bloqueado
$IPT -A INPUT -p tcp --dport $SSH_PORT -m conntrack --ctstate NEW \
     -m recent --set --name SSH
$IPT -A INPUT -p tcp --dport $SSH_PORT -m conntrack --ctstate NEW \
     -m recent --update --seconds 60 --hitcount 5 --name SSH -j DDOS_DROP
$IPT -A INPUT -p tcp --dport $SSH_PORT -j ACCEPT

# ------- 10. Todo lo demas se descarta y se contabiliza -------
$IPT -A INPUT -j DDOS_DROP

echo "[+] Reglas aplicadas correctamente."
echo ""
echo "    Ver reglas y contadores:   sudo iptables -L -n -v"
echo "    Reiniciar contadores:      sudo iptables -Z"
echo "    Quitar todas las reglas:   sudo ./firewall-ddos.sh reset"
