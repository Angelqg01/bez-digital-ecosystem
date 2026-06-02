# ☁️ Guía de Despliegue y Gestión de Archivos

Esta guía detalla qué elementos del proyecto **BeZhas Web3** deben subir al repositorio de código (GitHub), cuáles van al servidor de producción (Google Cloud / VPS), y cómo manejar la seguridad de las credenciales.

## 📂 1. Qué subir a GitHub (Control de Versiones)

A GitHub solo debe subirse el **código fuente** y los archivos de **configuración pública**.

**✅ SÍ subir:**
*   `backend/` (Todo el código fuente: controladores, modelos, rutas)
*   `frontend/` (Todo el código fuente React: componentes, páginas, estilos)
*   `contracts/` (Smart Contracts en Solidity)
*   `scripts/` (Scripts de despliegue y mantenimiento)
*   `documentation/` (Toda la documentación generada)
*   `docker-compose.production.yml` (La estructura de orquestación)
*   `open-api.yml` y docs de API
*   `Dockerfile` (En backend y frontend, definen cómo se construyen las imágenes)
*   `package.json` y `package-lock.json`
*   `.gitignore` (Crítico para evitar subir secretos)

**❌ NO subir (Agregar a .gitignore):**
*   `.env` (Variables de entorno locales)
*   `.env.production` (Variables de entorno de producción con claves reales)
*   `node_modules/` (Dependencias, se instalan en cada entorno)
*   `artifacts/` (Compilados de Hardhat, se generan al compilar)
*   `cache/` (Caché de Hardhat)
*   `dist/` o `build/` (Archivos compilados del frontend)
*   `coverage/` (Reportes de tests)
*   Archivos `.log` o carpetas de logs

---

## 🚀 2. Qué subir a Google Cloud / Servidor (Producción)

Al servidor no se suben archivos manualmente arrastrando carpetas. Se utiliza **Git** para clonar el código y **Docker** para ejecutarlo.

**Proceso de subida óptimo:**
1.  Conéctate al servidor vía SSH.
2.  Clona tu repositorio de GitHub: `git clone https://github.com/tu-usuario/bezhas-web3.git`.
3.  Crea el archivo de secretos **manualmente** en el servidor (ver sección 3).

**Lo único que "subes" manualmente o creas directo en el servidor es:**
*   El archivo `.env.production` con las claves reales.
*   Archivos de certificados SSL (si no usas Certbot automático).

---

## 🔒 3. Qué proteger (Secretos y Seguridad)

Estos archivos contienen las llaves de tu reino. **NUNCA deben estar en GitHub**.

### **El archivo `.env.production`**
Debe crearse directamente en el servidor (`nano .env.production`) y contener:
*   `PRIVATE_KEY`: La llave privada de la wallet que despliega los contratos (Mainnet).
*   `MONGO_ROOT_PASSWORD`: Contraseña maestra de la base de datos.
*   `JWT_SECRET`: Clave para firmar los tokens de sesión de usuarios.
*   `PINATA_SECRET_KEY`: Acceso a IPFS.
*   `OPENAI_API_KEY`: Acceso a la IA.
*   `STRIPE_SECRET_KEY`: Claves de pagos.

### **Gestión de Secretos en Google Cloud (Mejor Práctica)**
Si usas Google Cloud Platform (GCP), en lugar de un archivo `.env`, puedes usar **Secret Manager**:
1.  Sube tus claves a Google Secret Manager.
2.  Configura tus contenedores Docker para inyectar estos secretos como variables de entorno al iniciarse.

---

## 👣 4. Pasos para un Despliegue Óptimo

Sigue este flujo para asegurar que el despliegue sea seguro, rápido y sin errores.

### **Paso 1: Preparación Local**
1.  Asegúrate de que todo el código esté commiteado y pusheado a la rama `main` en GitHub.
2.  Verifica que no haya ningún archivo `.env` o credencial hardcodeada en el código.

### **Paso 2: Configuración del Servidor (Google Cloud Compute Engine)**
1.  Crea una instancia (VM) con Ubuntu 22.04 LTS.
2.  Instala **Docker** y **Docker Compose**.
3.  Genera una llave SSH en el servidor y agrégala a tu cuenta de GitHub ("Deploy Keys") para permitir al servidor descargar el código privado.

### **Paso 3: Despliegue Inicial**
1.  Clona el repo: `git clone ...`
2.  Entra a la carpeta: `cd bezhas-web3`
3.  Crea el archivo de variables:
    ```bash
    cp .env.production.example .env.production
    nano .env.production
    # Pega aquí tus claves REALES de producción
    ```
4.  Levanta los servicios:
    ```bash
    docker-compose -f docker-compose.production.yml up -d --build
    ```

### **Paso 4: Mantenimiento y Actualizaciones**
Para subir cambios futuros (CI/CD Básico):
1.  Haz tus cambios en local y sube a GitHub (`git push`).
2.  En el servidor, ejecuta:
    ```bash
    git pull origin main
    docker-compose -f docker-compose.production.yml up -d --build backend frontend
    ```
    *Esto solo reconstruye los contenedores que cambiaron, sin tocar la base de datos.*

---

## 📝 Resumen Gráfico

| Archivo/Carpeta | GitHub 🌐 | Servidor ☁️ | Notas |
| :--- | :---: | :---: | :--- |
| **Código Fuente** (`backend/`, `frontend/`) | ✅ | ✅ | Llega al servidor vía `git clone` |
| **Configs Docker** (`Dockerfile`, `docker-compose`) | ✅ | ✅ | Necesarios para construir |
| **Variables Locales** (`.env`) | ❌ | ❌ | Solo para tu máquina local |
| **Variables Producción** (`.env.production`) | ❌ | ✅ | **CREAR MANUALMENTE EN SERVIDOR** |
| **Node Modules** | ❌ | ❌ | Se generan dentro de Docker automáticamente |
| **Base de Datos** (Archivos de datos) | ❌ | ✅ | Viven en "volúmenes" de Docker en el servidor |
