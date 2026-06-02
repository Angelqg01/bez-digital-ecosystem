#[derive(Debug, Copy, Clone, PartialEq)]
pub struct EstadoSistema {
    pub radicando: f64,
    pub tiempo_propio: f64,
    pub colapso: bool,
}

/// Evalúa la estabilidad de la lona relacional basándose en tensiones estáticas y dinámicas.
pub fn evaluar_lona_unificada(
    fidelidad_max: f64,
    tension_estatica: f64,
    tension_dinamica: f64,
    tau_base: f64
) -> EstadoSistema {
    
    // Sanitización de bajo nivel ante datos corruptos
    let t_est = if tension_estatica.is_nan() || tension_estatica.is_infinite() || tension_estatica < 0.0 {
        1.0 
    } else {
        tension_estatica
    };

    let t_din = if tension_dinamica.is_nan() || tension_dinamica.is_infinite() || tension_dinamica < 0.0 {
        1.0
    } else {
        tension_dinamica
    };

    let radicando = fidelidad_max - t_est - t_din;

    if radicando <= 0.0 || radicando.is_nan() {
        EstadoSistema {
            radicando,
            tiempo_propio: 0.0,
            colapso: true,
        }
    } else {
        EstadoSistema {
            radicando,
            tiempo_propio: tau_base * radicando.sqrt(),
            colapso: false,
        }
    }
}