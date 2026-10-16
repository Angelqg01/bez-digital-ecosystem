# Funciones compartidas por los scripts de deploy/gcp (se cargan con `source`).

# Nombre del certificado gestionado de un dominio: bezhas-cert-apex,
# bezhas-cert-www, bezhas-cert-api, bezhas-cert-mcp.
nombre_cert() {
  local host="$1"
  local sub="${host%%.*}" compartidos
  if [[ "$host" == "$DOMAIN" ]]; then echo "${CERT_NAME}-apex"; return; fi
  # Los de CERT_SHARED_SUBS van todos en un certificado: ${CERT_NAME}-pay-wallet.
  if [[ " ${CERT_SHARED_SUBS[*]:-} " == *" ${sub} "* ]]; then
    compartidos=$(IFS=-; echo "${CERT_SHARED_SUBS[*]}")
    echo "${CERT_NAME}-${compartidos}"
  else echo "${CERT_NAME}-${sub}"; fi
}
