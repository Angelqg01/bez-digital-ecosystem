#!/usr/bin/env node

/**
 * check-compose-defaults.cjs — Impide que vuelva a haber credenciales escritas
 * como valor por defecto en los ficheros de compose.
 *
 * POR QUÉ EXISTE
 *
 * docker-compose.yml llevaba ocho credenciales en la forma `${VAR:-valor}`.
 * Como el fichero está versionado, cualquiera que levantase el stack sin .env
 * inicializaba los volúmenes con una contraseña publicada. Y Postgres y
 * Grafana fijan su contraseña en el PRIMER arranque y luego ignoran la
 * variable, así que ese valor se quedaba puesto para siempre sin que nadie
 * volviera a mirarlo.
 *
 * No es hipotético: la contraseña real de la base `bezhas` fue durante meses
 * `TuPasswordSeguro`, el marcador de posición de la documentación, que llegó
 * ahí por el default de docker-compose.dev.yml.
 *
 * Este guardián corre en CI y no necesita ningún .env: sólo lee los ficheros
 * del repositorio. La forma correcta es `${VAR:?mensaje}`, que aborta con un
 * mensaje en vez de inventarse una credencial.
 *
 * Un default VACÍO (`${VAR:-}`) se acepta: no publica nada, sólo marca la
 * variable como opcional.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');

// Nombres cuyo valor es un secreto. Se busca el fragmento en el nombre de la
// variable, no en el valor: un default llamado *_PASSWORD es sospechoso sea
// cual sea su contenido.
const FRAGMENTOS_SENSIBLES = ['PASSWORD', 'SECRET', 'TOKEN', 'PRIVATE_KEY', 'API_KEY', 'ADMIN_KEY'];

// `${NOMBRE:-valor}` con valor no vacío.
const DEFAULT_CON_VALOR = /\$\{([A-Z0-9_]+):-([^}]+)\}/g;

function esSensible(nombre) {
    return FRAGMENTOS_SENSIBLES.some(f => nombre.includes(f));
}

function ficherosCompose() {
    return fs.readdirSync(RAIZ)
        .filter(f => /^docker-compose[.\w-]*\.ya?ml$/.test(f))
        .sort();
}

function main() {
    const hallazgos = [];

    for (const fichero of ficherosCompose()) {
        const ruta = path.join(RAIZ, fichero);
        const lineas = fs.readFileSync(ruta, 'utf8').split('\n');

        lineas.forEach((linea, i) => {
            // Los comentarios documentan la regla; no son configuración.
            if (linea.trim().startsWith('#')) return;

            for (const m of linea.matchAll(DEFAULT_CON_VALOR)) {
                const [, nombre] = m;
                if (esSensible(nombre)) {
                    hallazgos.push({
                        fichero,
                        linea: i + 1,
                        variable: nombre,
                        // El valor NO se imprime: sigue siendo una credencial
                        // aunque esté en un fichero versionado, y este informe
                        // acaba en los logs de CI.
                        sugerencia: `\${${nombre}:?define ${nombre} en .env}`,
                    });
                }
            }
        });
    }

    if (hallazgos.length === 0) {
        console.log('✅ Ningún valor por defecto con credencial en los ficheros de compose.');
        process.exit(0);
    }

    console.error(`❌ ${hallazgos.length} credencial(es) escritas como valor por defecto:\n`);
    for (const h of hallazgos) {
        console.error(`   ${h.fichero}:${h.linea}  ${h.variable}`);
        console.error(`      usa  ${h.sugerencia}\n`);
    }
    console.error('Un valor por defecto en un fichero versionado es una credencial publicada:');
    console.error('quien levante el stack sin .env inicializará los volúmenes con ella.');
    process.exit(1);
}

main();
