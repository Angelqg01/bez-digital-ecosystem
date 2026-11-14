#!/usr/bin/env python3
"""Genera la locución sintética (edge-tts, voz neuronal de Microsoft) de cada escena en inglés.

El texto de la locución sale del equipo hacia el servicio de Microsoft (es texto de marketing del propio vídeo, sin datos
personales). Una escena = un archivo audio/<id>.mp3; con --short, audio-short/<id>.mp3 para el corte de 90 s.

  voice.py [--short] [--voice en-US-ChristopherNeural]"""
import argparse, asyncio, json, subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument('--short', action='store_true'); ap.add_argument('--voice')
a = ap.parse_args()
cfg = json.load(open(ROOT / 'scenes.en.json'))
voice = a.voice or cfg['voice']
out = ROOT / ('audio-short' if a.short else 'audio'); out.mkdir(exist_ok=True)


def dur(p):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)], text=True))


async def main():
    durs = {}
    for s in cfg['scenes']:
        lines = s.get('short') if a.short else s['say']
        if not lines: continue
        text = ' '.join(lines)
        f = out / f"{s['id']}.mp3"
        await edge_tts.Communicate(text, voice, rate='+0%', pitch='-2Hz').save(str(f))
        durs[s['id']] = round(dur(f), 2)
        print('ok', s['id'], durs[s['id']], 's')
    json.dump(durs, open(out / 'durations.json', 'w'), indent=1)
    print('total', round(sum(durs.values()), 1), 's')

asyncio.run(main())
