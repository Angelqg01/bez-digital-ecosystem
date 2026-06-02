# Seguridad y Buenas Prácticas

> La seguridad es prioridad en BeZhas. Sigue estas recomendaciones para proteger tus integraciones y despliegues.

## Protección de Claves y Credenciales
- Nunca subas claves privadas, mnemonics ni archivos .env a repositorios públicos
- Usa variables de entorno y gestores de secretos
- Limita el uso de API Keys a entornos de desarrollo y revoca las no utilizadas

## Prácticas para Producción
- Usa endpoints HTTPS siempre
- Revisa los permisos de tus contratos y agentes
- Mantén tus dependencias actualizadas
- Realiza auditorías de seguridad periódicas
- Implementa monitoreo y alertas ante actividad sospechosa

## Reporte de Vulnerabilidades
Si detectas una vulnerabilidad, repórtala de inmediato a security@bezhas.io o vía el canal privado de Discord. No publiques detalles técnicos en foros públicos.
