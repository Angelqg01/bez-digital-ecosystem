# M-TFC Core

Motor Rust del Modelo Adimensional de Transicion de Fase usado por BeZhas como nucleo de simulacion cientifica.

## Contrato de integracion

- `evaluar_lona_unificada(fidelidad_max, tension_estatica, tension_dinamica, tau_base)`
- salida: `radicando`, `tiempo_propio`, `colapso`
- los datos corruptos (`NaN`, `Inf`, tensiones negativas) se sanean antes de evaluar.

## Relacion con BeZhas

El crate esta pensado para correr como motor nativo detras de la API `/api/mtfc`. La blockchain no ejecuta el calculo pesado; registra hashes, pagos, creditos BEZ-Coin y certificados de resultado.

## Comandos

```bash
cargo test
cargo run --release
```
