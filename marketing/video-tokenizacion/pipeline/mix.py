#!/usr/bin/env python3
"""Mezcla final del corte público: locución por escena + música original con ducking (sidechain) + loudnorm -16 LUFS.
  mix_public.py --video out/Public-EN-master.mp4 --timing out/timing.public.json --audio-dir audio-public --music audio-public/music.wav --out out/Public-EN-final.mp4"""
import argparse, json, subprocess
from pathlib import Path
ap = argparse.ArgumentParser()
for k in ('video', 'timing', 'audio-dir', 'music', 'out'): ap.add_argument('--' + k, required=True)
ap.add_argument('--lead', type=float, default=0.4); a = ap.parse_args()
tm = json.load(open(a.timing))['scenes']
inp, f, lab = ['-i', a.video, '-i', a.music], [], []
for i, s in enumerate(tm):
    p = next(q for e in ('mp3', 'wav', 'm4a') if (q := Path(a.audio_dir) / f"{s['id']}.{e}").exists())
    inp += ['-i', str(p)]
    f.append(f"[{i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int((s['start'] + a.lead) * 1000)}:all=1[v{i}]"); lab.append(f'[v{i}]')
f.append(f"{''.join(lab)}amix=inputs={len(lab)}:normalize=0:dropout_transition=0,asplit=2[vo][vsc]")
f.append("[1:a]aresample=48000,volume=0.9[mu]")
f.append("[mu][vsc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450:makeup=1[duck]")
f.append("[vo]volume=1.0[vo2];[vo2][duck]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=9,alimiter=limit=0.84:level=disabled,apad[aout]")
vdur = subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',a.video],text=True).strip()
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inp, '-filter_complex', ';'.join(f), '-map', '0:v', '-map', '[aout]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', vdur, '-movflags', '+faststart', a.out], check=True)
print('Listo:', a.out)
