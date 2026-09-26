# Funciones compartidas por los scripts de deploy/gcp (se cargan con `source`).

# Nombre del certificado gestionado de un dominio: bezhas-cert-apex,
# bezhas-cert-www, bezhas-cert-api, bezhas-cert-mcp.
nombre_cert() {
  local host="$1"
  if [[ "$host" == "$DOMAIN" ]]; then echo "${CERT_NAME}-apex"
  else echo "${CERT_NAME}-${host%%.*}"; fi
}
