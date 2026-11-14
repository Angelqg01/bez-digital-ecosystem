#!/usr/bin/env python3
"""Música ORIGINAL del corte público, sintetizada con numpy (sin muestras ni material con derechos).
Pulso electrónico cinematográfico en La menor, 112 bpm, que crece con la intensidad de cada escena.

  music_public.py --timing out/timing.public.json --out audio-public/music.wav"""
import argparse, json
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 48000; BPM = 112; BEAT = 60 / BPM
ap = argparse.ArgumentParser(); ap.add_argument('--timing', required=True); ap.add_argument('--out', required=True)
a = ap.parse_args()
tm = json.load(open(a.timing))['scenes']; total = tm[-1]['end'] + 3.0
N = int(total * SR); t = np.arange(N) / SR
# curva de intensidad suave por escena
knots_t, knots_v = [0.0], [0.2]
for s in tm: knots_t += [s['start'] + 1.5, s['end'] - 1.5]; knots_v += [s.get('intensity', .6)] * 2
knots_t.append(total); knots_v.append(0.0)
inten = np.interp(t, knots_t, knots_v)
rng = np.random.default_rng(7)
def lp(x, f, o=2): b, aa = butter(o, f / (SR / 2), 'low'); return lfilter(b, aa, x)
def hp(x, f, o=2): b, aa = butter(o, f / (SR / 2), 'high'); return lfilter(b, aa, x)
def env(n, a_, d_):  # ataque/caída exponencial
    e = np.exp(-np.arange(n) / (SR * d_)); k = int(SR * a_); e[:k] *= np.linspace(0, 1, k); return e
def add(buf, i, x):
    if i >= len(buf): return
    j = min(len(buf), i + len(x)); buf[i:j] += x[:j - i]
def saw(f, n): ph = (np.arange(n) / SR * f) % 1; return 2 * ph - 1
chords = [(57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62)]   # Am F C G
mf = lambda m: 440 * 2 ** ((m - 69) / 12)
pad = np.zeros(N); bass = np.zeros(N); arp = np.zeros(N); drums = np.zeros(N); riser = np.zeros(N)
bar = 4 * BEAT; nbars = int(total / bar) + 1
for b in range(nbars):
    ch = chords[b % 4]; i0 = int(b * bar * SR); n = int(bar * SR)
    x = sum(saw(mf(m) * d, n) for m in ch for d in (0.995, 1.005)) / 6
    x = lp(x, 1400) * np.minimum(1, np.minimum(np.arange(n) / (SR * .5), (n - np.arange(n)) / (SR * .5)))
    add(pad, i0, x * .5)
    for k in range(8):                                   # bajo en corcheas
        nn = int(BEAT / 2 * SR); f = mf(ch[0] - 12)
        add(bass, i0 + int(k * BEAT / 2 * SR), lp(saw(f, nn), 300) * env(nn, .005, .25) * .9)
    for k in range(16):                                  # arpegio en semicorcheas
        m = ch[[0, 1, 2, 1][k % 4]] + (12 if (k // 4) % 2 else 24); nn = int(BEAT / 4 * SR * 2)
        add(arp, i0 + int(k * BEAT / 4 * SR), lp(saw(mf(m), nn), 3500) * env(nn, .002, .12) * .35)
    for k in range(4):                                   # bombo
        nn = int(.28 * SR); tt = np.arange(nn) / SR; f = 50 + 90 * np.exp(-tt * 28)
        add(drums, i0 + int(k * BEAT * SR), np.sin(2 * np.pi * np.cumsum(f) / SR) * env(nn, .001, .12) * 1.1)
    for k in range(8):                                   # hi-hat
        nn = int(.05 * SR); add(drums, i0 + int((k + .5) * BEAT / 2 * SR), hp(rng.standard_normal(nn), 7000) * env(nn, .0005, .02) * .18)
    for k in (1, 3):                                     # caja
        nn = int(.16 * SR); add(drums, i0 + int(k * BEAT * SR), (hp(rng.standard_normal(nn), 1500) * env(nn, .001, .06) * .5))
# riser antes del cierre y golpe final
r0 = tm[-1]['start'] - 6; nn = int(6 * SR)
if r0 > 0:
    sw = hp(rng.standard_normal(nn), 2000) * np.linspace(0, 1, nn) ** 2 * .35; add(riser, int(r0 * SR), sw)
bl = np.zeros(N)
# la batería y el arpegio sólo entran con intensidad; el bombo a partir de la escena 2
gd = np.clip((inten - .45) / .3, 0, 1); ga = np.clip((inten - .25) / .3, 0, 1)
mix = pad * (.55 + .3 * inten) + bass * gd * .8 + arp * ga + drums * gd * .85 + riser
# reverb simple (eco difuso)
for dly, g in ((0.19, .28), (0.31, .2), (0.47, .12)):
    d = int(dly * SR); mix[d:] += mix[:-d] * g
mix *= np.interp(t, [0, 2, total - 3, total], [0, 1, 1, 0]) * (0.5 + 0.5 * np.clip(inten, 0.3, 1))
mix = np.tanh(mix * 1.1); mix /= np.max(np.abs(mix)) / 0.8
st = np.stack([mix, np.roll(mix, 40)], 1)
wavfile.write(a.out, SR, (st * 32767).astype(np.int16)); print('música:', a.out, f'{total:.1f} s')
