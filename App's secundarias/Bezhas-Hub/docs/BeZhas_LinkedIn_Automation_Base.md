# BeZhas LinkedIn & Lead Automation Prompt Base

## 1. Sistema de Clasificación de Leads (Prompt Maestro)
Usa este prompt con Gemini (a través de nuestro MCP) para procesar los datos extraídos de LinkedIn o X. Este prompt obligará a la IA a decidir qué "producto" de BeZhas ofrecerle a cada contacto potencial.

**Prompt a ejecutar:**
```text
Actúa como el Director de Ventas y Emisor de Token de BeZhas. Analiza el siguiente perfil/post: "[DATOS_LEAD]"

Clasifica al lead en una de estas 3 categorías y genera la respuesta correspondiente:

1. DESARROLLADOR/EMPRESA (Interés en API y SDK): Enfócate en la automatización de flujos de trabajo, eficiencia técnica, ahorro de costos (reduce tiempo de integración y gastos de desarrollo en un 85%) y escalabilidad de la API de BeZhas.
2. TOKENIZADOR (RWA - Real World Assets): Enfócate en la seguridad del protocolo para digitalizar activos físicos, el uso de nuestro Quality Oracle, y los contratos BeZhasQualityEscrow para auditoría inmutable.
3. INVERSOR (BEZ-Coin y Gobernanza): Enfócate en el ROI (incluyendo Real Yield), la escasez del token, el poder de gobernanza (DAO) y cómo ser dueño del token es ser dueño de la infraestructura tecnológica.

Genera un mensaje de conexión de LinkedIn personalizado de 3 párrafos. El tercer párrafo debe ser un CTA (Call to Action) directo a la función específica de la DApp de BeZhas. Sé breve, profesional, no suenes como un bot y evita palabras de 'vendedor de humo'.
```

## 2. Guía de Bienvenida Dinámica (Onboarding Automatizado)
Cuando un lead convertido conecta su wallet a la DApp de BeZhas, usa este prompt para generar su experiencia de bienvenida según su perfil.

**Prompt a ejecutar:**
```text
Genera un tutorial rápido en formato Markdown para un usuario recién llegado a BeZhas.
Su categoría es: [CATEGORIA_DEL_LEAD] (Ej: Inversor, Tokenizador RWA o Desarrollador).

- Si es Inversor: Explica cómo acceder a la sección 'Governance' y cómo stakear BEZ-Coin para votar y sugerir propuestas.
- Si es Tokenizador RWA: Explica cómo iniciar el proceso de tokenización de activos en la testnet Amoy/Polygon y solicitar la validación del Quality Oracle.
- Si es Desarrollador/Empresa: Muestra cómo obtener sus API Keys desde la Developer Console y un pequeño snippet de código del SDK de BeZhas.
```

## 3. Generación de Contenido: "Latido de Gobernanza" (Weekly Post)
Para atraer leads pasivamente, usa este prompt semanalmente para publicar en el feed de LinkedIn/X.

**Prompt a ejecutar:**
```text
Actúa como Analista de Transparencia de Gobernanza Web3 para BeZhas.
Basado en estos datos de tesorería y propuestas activas: [DATOS_BLOCKCHAIN_ACTUALES]
(Usa el MCP para leer el estado del contrato principal).

Redacta un post de LinkedIn que destaque el crecimiento de la gobernanza de BeZhas esta semana y la adopción de nuestro SDK. Compara nuestro ROI y eficiencia frente a métodos tradicionales de desarrollo ($200k/año vs. usar nuestro SDK).
Incluye un CTA para entrar a la DApp y votar o integrar nuestra API.
```

## 4. Comparativa de ROI: Propuesta Económica Directa (Cierre de Ventas)
Cuando un contacto institucional o empresa muestra interés en los costos, usa este prompt.

**Prompt a ejecutar:**
```text
Genera una propuesta de venta para un lead tipo '[TIPO_EMPRESA]'.
Volumen de transacciones estimado: [VOLUMEN_ESTIMADO].

Incluye:
1. Comparativa: Cuánto le costaría hacer esto con un desarrollador blockchain in-house ($200k/año) vs usar el SDK de BeZhas. (Ahorro del 75%-94%).
2. Explica que si usa el "SaaS Tier" y paga la suscripción mensual con BEZ-Coin, ahorra un 20% adicional. Si elige "Pay-as-you-go", que solo paga por el cómputo que consume.
3. Menciona el ROI de tener gobernanza: podrá votar para bajar las comisiones futuras del SDK influyendo sobre los parámetros de la red.
```

---
*Este documento (.md) debe ser montado como archivo de contexto base (System Prompt/Knowledge Base) en la herramienta de automatización que conecte con la API de Gemini, permitiendo que el MCP de BeZhas ejecute llamadas diarias consistentes orientadas a la captación y tokenización.*
