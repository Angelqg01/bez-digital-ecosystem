# Guía para Configurar la Autenticación con Google

Para que el inicio de sesión con Google funcione, necesitas obtener credenciales de API desde la Google Cloud Console y añadirlas a tu archivo `.env` en el backend.

## Paso 1: Crear un Proyecto en Google Cloud Console

1.  Ve a la [Google Cloud Console](https://console.cloud.google.com/).
2.  Crea un nuevo proyecto (o selecciona uno existente).

## Paso 2: Configurar la Pantalla de Consentimiento de OAuth

1.  En el menú de navegación, ve a **APIs y servicios > Pantalla de consentimiento de OAuth**.
2.  Selecciona el tipo de usuario **Externo** y haz clic en **Crear**.
3.  Rellena la información de la aplicación:
    *   **Nombre de la aplicación**: BeZhas Web3
    *   **Correo electrónico de asistencia del usuario**: Tu correo electrónico.
    *   **Datos de contacto del desarrollador**: Tu correo electrónico.
4.  Haz clic en **Guardar y continuar** en los siguientes pasos (puedes dejar los alcances y usuarios de prueba en blanco por ahora).

## Paso 3: Crear las Credenciales de OAuth 2.0

1.  Ve a **APIs y servicios > Credenciales**.
2.  Haz clic en **+ CREAR CREDENCIALES** y selecciona **ID de cliente de OAuth**.
3.  Configura las credenciales:
    *   **Tipo de aplicación**: Aplicación web.
    *   **Nombre**: BeZhas Web Client.
    *   **Orígenes de JavaScript autorizados**: Añade la URL de tu frontend. Para desarrollo local, añade `http://localhost:5174`.
    *   **URIs de redirección autorizados**: Añade la URL de callback de tu backend. Para desarrollo local, añade `http://localhost:3001/api/auth/google/callback`.
4.  Haz clic en **Crear**.

## Paso 4: Copiar tus Credenciales

Después de crear las credenciales, se mostrará una ventana con tu **ID de cliente** y tu **Secreto de cliente**. Cópialos.

## Paso 5: Añadir las Credenciales a tu Archivo `.env`

1.  Abre el archivo `.env` en la carpeta `bezhas-web3/backend/`.
2.  Añade las siguientes líneas, reemplazando los valores con tus credenciales:

    ```
    # Google OAuth Credentials
    GOOGLE_CLIENT_ID=TU_ID_DE_CLIENTE_VA_AQUI
    GOOGLE_CLIENT_SECRET=TU_SECRETO_DE_CLIENTE_VA_AQUI

    # Session Secret (puedes usar un generador de contraseñas seguras para esto)
    SESSION_SECRET=UNA_CADENA_SECRETA_LARGA_Y_ALEATORIA_DE_MAS_DE_32_CARACTERES

    # Frontend URL (para redirecciones)
    FRONTEND_URL=http://localhost:5174
    ```

## Paso 6: Reiniciar el Servidor

Una vez que hayas guardado los cambios en tu archivo `.env`, detén y reinicia el servidor del backend para que los nuevos valores se carguen.

¡Listo! Ahora el inicio de sesión con Google debería funcionar.
