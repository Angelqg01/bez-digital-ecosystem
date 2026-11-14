#!/usr/bin/env python3
"""Monta el vídeo: une los clips grabados, genera la música, mezcla la locución en inglés y quema los subtítulos en español.

  assemble.py [--mode all|long|short]

Salidas (en ../out): master.mp4 (sin audio), timing.json, subtitles.es.srt / subtitles.en.srt,
BeZhas-Tokenizacion-EN-subs-ES.mp4 (1080p), BeZhas-Tokenizacion-EN-subs-ES-720p.mp4 (ligero) y,
con el corte corto, BeZhas-Tokenizacion-90s-EN-subs-ES.mp4.

La voz de cada escena entra 0,4 s después de su inicio (el margen que usa record.py para anclar los gestos)."""
import argparse, json, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / 'out'
CFG = json.load(open(ROOT / 'scenes.en.json'))
SCN = {s['id']: s for s in CFG['scenes']}
LEAD = 0.4
STORY = ['T01', 'T02', 'T03', 'hub', 'T08', 'venta-a', 'venta-b', 'rentas-emisor', 'rentas-titular', 'T12', 'T13', 'T14']
NAME = 'BeZhas-Tokenizacion'


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode: sys.exit(f"{' '.join(map(str, cmd[:3]))}…: {r.stderr[-600:]}")
    return r.stdout


def dur(p): return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)]))


def srt_time(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


def manifest_clips():
    man = json.load(open(OUT / 'clips.json')); by = {}
    for sess in man.values():
        for e in sess:
            by[Path(e['clip']).stem] = e
    return by


def build_timeline(adur):
    """Orden de la historia → inicio global de cada escena (suma de las duraciones reales de los clips)."""
    by = manifest_clips(); t = 0.0; scenes = {}; files = []
    for c in STORY:
        if c not in by: sys.exit(f'Falta el clip «{c}»: graba esa sesión antes de montar.')
        f = OUT / by[c]['clip']; d = dur(f); files.append(f)
        for s in by[c]['scenes']:
            sid = s['id']; st = t + s['start']; en = t + min(s['end'] + 0.6, d)   # 0,6 s de fundido final
            if sid in scenes: scenes[sid]['end'] = en        # escena en dos clips (T09)
            else: scenes[sid] = {'id': sid, 'title': SCN[sid]['title'], 'start': st, 'end': en, 'intensity': SCN[sid].get('intensity', .6)}
        t += d
    order = [s['id'] for s in CFG['scenes']]
    return [scenes[i] for i in order], files


def concat(files, out):
    lst = OUT / 'concat.txt'; lst.write_text(''.join(f"file '{f}'\n" for f in files))
    run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', '-movflags', '+faststart', str(out)])


def write_srts(scenes, adur, short=False, tag=''):
    es, en, n = [], [], 1
    for s in scenes:
        cfg = SCN[s['id']]
        sents_en = cfg['short'] if short and cfg.get('short') else cfg['say']
        sents_es = (cfg.get('short_sub') or (cfg['sub'] if sents_en == cfg['say'] else None)) if short else cfg['sub']
        if not sents_es or len(sents_es) != len(sents_en): sys.exit(f"Subtítulos y locución no casan en {s['id']}")
        words = [len(x.split()) for x in sents_en]; tot = sum(words); cur = s['start'] + LEAD
        for e, x, w in zip(sents_en, sents_es, words):
            d = w / tot * adur[s['id']]
            for lst, txt in ((es, x), (en, e)):
                lst += [str(n), f'{srt_time(cur)} --> {srt_time(cur + d - 0.05)}', txt, '']
            cur += d; n += 1
    (OUT / f'subtitles.es{tag}.srt').write_text('\n'.join(es)); (OUT / f'subtitles.en{tag}.srt').write_text('\n'.join(en))
    return OUT / f'subtitles.es{tag}.srt'


STYLE = "FontName=Noto Sans,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&HB0140A07,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=19"


def burn(src, srt, out, height=None):
    vf = f"subtitles={srt}:force_style='{STYLE}'" + (f',scale=-2:{height}' if height else '')
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src), '-vf', vf, '-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '24' if not height else '27', '-b:v', '0',
         '-c:a', 'copy', '-movflags', '+faststart', str(out)])


def mix(master, timing_json, audio_dir, music, out):
    raw = Path(str(out) + '.raw.mp4')
    run([sys.executable, str(HERE / 'mix.py'), '--video', str(master), '--timing', str(timing_json), '--audio-dir', str(audio_dir), '--music', str(music), '--out', str(raw)])
    # Pasada final: el AAC de la mezcla llegaba a +1,7 dBFS (recorte). Se limita a −3 dB antes de volver a codificar
    # y se vigila el resultado: el sobrepaso del AAC cabe en el margen.
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-map', '0:v', '-map', '0:a', '-c:v', 'copy', '-af', 'alimiter=limit=0.55:level=disabled:attack=5:release=60',
         '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', str(out)])
    raw.unlink()



def long_cut():
    adur = json.load(open(ROOT / 'audio' / 'durations.json'))
    scenes, files = build_timeline(adur)
    master = OUT / 'master.mp4'; concat(files, master)
    json.dump({'scenes': scenes}, open(OUT / 'timing.json', 'w'), indent=1)
    for s in scenes:
        room = s['end'] - s['start'] - LEAD
        if adur[s['id']] > room + 0.05: print(f"⚠ {s['id']}: la voz dura {adur[s['id']]:.1f} s y la escena deja {room:.1f} s", file=sys.stderr)
    run([sys.executable, str(HERE / 'music.py'), '--timing', str(OUT / 'timing.json'), '--out', str(ROOT / 'audio' / 'music.wav')])
    mixed = OUT / 'mixed.mp4'; mix(master, OUT / 'timing.json', ROOT / 'audio', ROOT / 'audio' / 'music.wav', mixed)
    srt = write_srts(scenes, adur)
    final = OUT / f'{NAME}-EN-subs-ES.mp4'; burn(mixed, srt, final)
    light = OUT / f'{NAME}-EN-subs-ES-720p.mp4'; burn(mixed, srt, light, height=720)
    print('Listo:', final, f'({dur(final):.1f} s)'); print('Listo:', light)


SHORT_SCENES = ['T01', 'T03', 'T06', 'T09', 'T11', 'T12', 'T14']


def short_cut():
    sdur = json.load(open(ROOT / 'audio-short' / 'durations.json'))
    ldur = json.load(open(ROOT / 'audio' / 'durations.json'))
    scenes_l = {s['id']: s for s in json.load(open(OUT / 'timing.json'))['scenes']}
    master = OUT / 'master.mp4'; segs = []; t = 0.0; timing = []
    tmp = OUT / 'short'; tmp.mkdir(exist_ok=True)
    for sid in SHORT_SCENES:
        s = scenes_l[sid]; src = s['end'] - s['start']; target = sdur[sid] + LEAD + 0.5
        speed = max(1.0, src / target); seg_len = src / speed
        f = tmp / f'{sid}.mp4'
        run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f"{s['start']:.3f}", '-t', f'{src:.3f}', '-i', str(master), '-an',
             '-vf', f'setpts=PTS/{speed:.4f},fps=30', '-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '21', '-b:v', '0', str(f)])
        d = dur(f); segs.append(f)
        timing.append({'id': sid, 'title': SCN[sid]['title'], 'start': t, 'end': t + d, 'intensity': SCN[sid].get('intensity', .6)}); t += d
        print(f'  {sid}: {src:.1f} s → {d:.1f} s (×{speed:.2f})')
    mastr = OUT / 'master-short.mp4'; concat(segs, mastr)
    json.dump({'scenes': timing}, open(OUT / 'timing-short.json', 'w'), indent=1)
    run([sys.executable, str(HERE / 'music.py'), '--timing', str(OUT / 'timing-short.json'), '--out', str(ROOT / 'audio-short' / 'music.wav')])
    mixed = OUT / 'mixed-short.mp4'; mix(mastr, OUT / 'timing-short.json', ROOT / 'audio-short', ROOT / 'audio-short' / 'music.wav', mixed)
    srt = write_srts(timing, sdur, short=True, tag='-short')
    final = OUT / f'{NAME}-90s-EN-subs-ES.mp4'; burn(mixed, srt, final)
    print('Listo:', final, f'({dur(final):.1f} s)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--mode', default='all', choices=['all', 'long', 'short'])
    a = ap.parse_args()
    if a.mode in ('all', 'long'): long_cut()
    if a.mode in ('all', 'short'): short_cut()
