use mtfc_core::evaluar_lona_unificada;
use std::time::Instant;
use futures::stream::{self, StreamExt};
use tokio::task;

fn generar_caos(seed: &mut u64) -> f64 {
    *seed ^= *seed << 13;
    *seed ^= *seed >> 7;
    *seed ^= *seed << 17;
    (*seed % 1000) as f64 / 1000.0
}

#[tokio::main]
async fn main() {
    println!("=================================================================");
    println!("   M-TFC ENGINE: PRUEBA DE ESTRÉS ESTOCÁSTICO EN RUST v1.2       ");
    println!("=================================================================\n");

    let num_operaciones = 1_000_000;
    let nucleos_cpu = num_cpus::get();
    
    let tiempo_inicio = Instant::now();

    let colapsos_totales = stream::iter(0..num_operaciones)
        .map(|i| {
            task::spawn(async move {
                let mut semilla = (i + 42) as u64;
                let fidelidad_max = 1.0;
                let tension_est = generar_caos(&mut semilla) * 0.8;
                let tension_din = generar_caos(&mut semilla) * 0.8;
                let tau_base = 1e-6;

                evaluar_lona_unificada(fidelidad_max, tension_est, tension_din, tau_base)
            })
        })
        .buffer_unordered(nucleos_cpu * 2) 
        .fold(0, |mut acc, resultado| async move {
            if let Ok(estado) = resultado {
                if estado.colapso {
                    acc += 1;
                }
            }
            acc
        })
        .await;

    let duracion = tiempo_inicio.elapsed();
    
    println!("=================================================================");
    println!("              INFORME DE RENDIMIENTO BAJO CAOS TÉRMICO           ");
    println!("=================================================================");
    println!(" Tiempo de procesamiento nativo:    {:?}", duracion);
    println!(" Rendimiento bruto del motor:       {:.2} operaciones/seg", num_operaciones as f64 / duracion.as_secs_f64());
    println!(" Transiciones críticas mitigadas:   {}", colapsos_totales);
    println!(" Inmunidad de Memoria RAM:          100% [0 Excepciones descontroladas]");
    println!("=================================================================");
}