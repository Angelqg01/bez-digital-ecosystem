#[derive(Debug, Copy, Clone, PartialEq)]
pub struct EstadoSistema {
    pub radicando: f64,
    pub tiempo_propio: f64,
    pub colapso: bool,
}

fn sanitizar_tension(valor: f64) -> f64 {
    if valor.is_nan() || valor.is_infinite() || valor < 0.0 {
        1.0
    } else {
        valor
    }
}

/// Evalua la estabilidad de la lona relacional usando tensiones estaticas y dinamicas.
pub fn evaluar_lona_unificada(
    fidelidad_max: f64,
    tension_estatica: f64,
    tension_dinamica: f64,
    tau_base: f64,
) -> EstadoSistema {
    let fidelidad = if fidelidad_max.is_nan() || fidelidad_max.is_infinite() || fidelidad_max <= 0.0 {
        1.0
    } else {
        fidelidad_max
    };
    let tau = if tau_base.is_nan() || tau_base.is_infinite() || tau_base < 0.0 {
        0.0
    } else {
        tau_base
    };
    let t_est = sanitizar_tension(tension_estatica);
    let t_din = sanitizar_tension(tension_dinamica);
    let radicando = fidelidad - t_est - t_din;

    if radicando <= 0.0 || radicando.is_nan() {
        EstadoSistema {
            radicando,
            tiempo_propio: 0.0,
            colapso: true,
        }
    } else {
        EstadoSistema {
            radicando,
            tiempo_propio: tau * radicando.sqrt(),
            colapso: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evalua_estado_estable() {
        let estado = evaluar_lona_unificada(1.0, 0.2, 0.3, 10.0);
        assert!(!estado.colapso);
        assert_eq!(estado.radicando, 0.5);
        assert!(estado.tiempo_propio > 7.0);
    }

    #[test]
    fn intercepta_colapso() {
        let estado = evaluar_lona_unificada(1.0, 0.8, 0.8, 1e-6);
        assert!(estado.colapso);
        assert_eq!(estado.tiempo_propio, 0.0);
    }

    #[test]
    fn sanea_telemetria_corrupta() {
        let estado = evaluar_lona_unificada(f64::NAN, f64::INFINITY, -2.0, f64::NAN);
        assert!(estado.colapso);
        assert_eq!(estado.tiempo_propio, 0.0);
    }
}
