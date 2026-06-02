import { useCallback } from 'react';

// Generador de sonidos sintetizados usando la Web Audio API (Cero dependencias)
const createSynthSound = (type, freq, type2 = null, freq2 = null, duration = 0.1, vol = 0.05) => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return () => {};
        
        return () => {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            if (type2) {
                // Frecuencia que cae para efecto futurista
                osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + duration);
            }
            
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + duration);
        };
    } catch (e) {
        return () => {};
    }
};

export const useSoundEffects = () => {
    // Sonido Hover: Pequeño "tick" metálico (onda sine alta y corta)
    const playHover = useCallback(createSynthSound('sine', 800, 'sine', 600, 0.05, 0.02), []);
    
    // Sonido Click: "Bleep" de confirmación digital (onda square bajando a sine)
    const playClick = useCallback(createSynthSound('square', 1200, 'sine', 400, 0.15, 0.05), []);
    
    // Sonido Boot/Inmersión (Para onMount o botones grandes)
    const playBoot = useCallback(createSynthSound('sawtooth', 150, 'sine', 50, 0.5, 0.03), []);

    return { playHover, playClick, playBoot };
};
