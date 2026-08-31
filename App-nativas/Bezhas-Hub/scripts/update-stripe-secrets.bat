@echo off
REM Sustituido por scripts/update-secrets.js.
REM
REM Este .bat llevaba las claves escritas dentro, las volcaba a ficheros temporales
REM en disco y, por usar `echo "valor" > fichero`, subia el secreto CON comillas.
REM Ademas solo actualizaba los nombres en minuscula (stripe-secret-key), dejando
REM los de mayuscula (STRIPE_SECRET_KEY) que usan cloudbuild-backend.yaml y
REM scripts/gcp-deploy.sh apuntando a la clave anterior.
REM
REM El script de Node lee los valores del .env, los sube por stdin a los dos
REM nombres y aborta si alguna clave esta en el hueco equivocado.

node "%~dp0update-secrets.js" %*
exit /b %ERRORLEVEL%
