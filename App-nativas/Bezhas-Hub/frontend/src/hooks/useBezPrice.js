import { useEffect, useState } from 'react';
import { fetchPrecioBez } from '../lib/rwaOps';

/** Precio real del BEZ en USD (oráculo del Gateway), o null mientras carga o si no responde. */
export function useBezPrice() {
    const [precio, setPrecio] = useState(null);
    useEffect(() => {
        let vivo = true;
        fetchPrecioBez().then((p) => { if (vivo) setPrecio(p); });
        return () => { vivo = false; };
    }, []);
    return precio;
}
