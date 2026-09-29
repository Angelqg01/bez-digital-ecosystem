#!/usr/bin/env python3
"""Assemble the beZhas launch video.

Downloads the Higgsfield clips and voice-over listed in higgsfield-assets.md,
lays the HUD overlays (motion/out/overlays/hud_NN.mov) over each clip, interleaves
the motion-graphics scenes (motion/out/escena_X.mp4) and syncs every block to
its voice-over track. Optional: --music path/to/licensed_track.mp3

Usage: python3 compose.py [--music FILE] [--placeholders]
"""
import argparse, os, re, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION = os.path.join(HERE, 'motion', 'out')
WORK = os.path.join(HERE, 'build')
FPS = 30

# (voice block, visuals). "clipN" = Higgsfield clip N + HUD N; a letter = motion scene.
TIMELINE = [
    (1, ['clip1', 'clip2']),                          # E1-E2 gancho y problema
    (2, ['A']),                                       # E3 nace BeZhas
    (3, ['clip11', 'K']),                             # E4 pilares + BEZ-Coin
    (4, ['clip3', 'B']),                              # E5 motor de la verdad
    (5, ['clip4', 'C', 'clip5', 'G']),                # E6-E7 logística y salud
    (6, ['clip6', 'clip7', 'H', 'clip8', 'clip9', 'I']),  # E8-E9 RWA, retail, agro, energía
    (7, ['clip10', 'J', 'D']),                        # E10-E11 instituciones y efecto red
    (8, ['E', 'clip12', 'F']),                        # E12-E13 integración y cierre
]


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


FF = ffmpeg()


def run(*args):
    subprocess.run([FF, '-y', '-loglevel', 'error', *args], check=True)


def duration(path):
    out = subprocess.run([FF, '-i', path], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', out).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def manifest_urls():
    text = open(os.path.join(HERE, 'higgsfield-assets.md'), encoding='utf-8').read()
    clips = re.findall(r'^\| (\d+) \|.*?\| (https://\S+\.mp4) \|$', text, re.M)
    voices = re.findall(r'^\| (\d+) \|.*?\| (https://\S+\.wav) \|$', text, re.M)
    return {int(n): u for n, u in clips}, {int(n): u for n, u in voices}


def fetch(clips, voices, placeholders):
    os.makedirs(os.path.join(WORK, 'src'), exist_ok=True)
    for kind, table, ext in (('clip', clips, 'mp4'), ('vo', voices, 'wav')):
        for n, url in table.items():
            dst = os.path.join(WORK, 'src', f'{kind}{n}.{ext}')
            if os.path.exists(dst):
                continue
            if placeholders:
                if kind == 'clip':
                    run('-f', 'lavfi', '-i', f'testsrc2=s=1280x720:r=24:d=5', '-pix_fmt', 'yuv420p', dst)
                else:
                    run('-f', 'lavfi', '-i', f'sine=frequency={220 + 40 * n}:duration={8 + n}', dst)
            else:
                urllib.request.urlretrieve(url, dst)


def visual(item, idx):
    """Normalise one visual to 1920x1080@30 without audio; returns path."""
    out = os.path.join(WORK, f'v_{idx:02d}.mp4')
    if item.startswith('clip'):
        n = int(item[4:])
        src = os.path.join(WORK, 'src', f'clip{n}.mp4')
        hud = os.path.join(MOTION, 'overlays', f'hud_{n:02d}.mov')
        pre = os.path.join(WORK, 'src', f'clip{n}_hud.mp4')
        if os.path.exists(pre):
            src, hud = pre, None
        if hud is None or not os.path.exists(hud):
            run('-i', src, '-vf', f'scale=1920:1080:flags=lanczos,fps={FPS},setsar=1,format=yuv420p', '-an', '-c:v', 'libx264', '-crf', '17', out)
            return out
        run('-i', src, '-i', hud, '-filter_complex',
            f'[0:v]scale=1920:1080:flags=lanczos,fps={FPS},setsar=1[b];[b][1:v]overlay=0:0:shortest=1,format=yuv420p[v]',
            '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '17', out)
    else:
        src = os.path.join(MOTION, f'escena_{item}.mp4')
        run('-i', src, '-vf', f'fps={FPS},format=yuv420p', '-an', '-c:v', 'libx264', '-crf', '17', out)
    return out


def concat(paths, out, audio=False):
    lst = out + '.txt'
    with open(lst, 'w') as f:
        f.writelines(f"file '{p}'\n" for p in paths)
    run('-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out)


def build_block(block, items, counter):
    parts = [visual(it, next(counter)) for it in items]
    raw = os.path.join(WORK, f'block{block}_raw.mp4')
    concat(parts, raw)
    vo = os.path.join(WORK, 'src', f'vo{block}.wav')
    length = max(duration(raw), duration(vo) + 0.8)
    out = os.path.join(WORK, f'block{block}.mp4')
    # Hold the last frame if the voice runs longer than the visuals; pad voice with silence.
    run('-i', raw, '-i', vo, '-filter_complex',
        f'[0:v]tpad=stop_mode=clone:stop_duration={length:.2f},trim=duration={length:.2f}[v];'
        f'[1:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=300|300,apad,atrim=duration={length:.2f}[a]',
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '17', '-c:a', 'aac', '-b:a', '192k', out)
    return out


PAD_CHORDS = [(110.0, 261.63, 329.63), (87.31, 220.0, 261.63), (130.81, 329.63, 392.0), (98.0, 246.94, 293.66)]


def make_pad(length):
    """Original ambient pad (Am-F-C-G, 8 s per chord) synthesised with ffmpeg: royalty-free by construction."""
    out = os.path.join(WORK, 'pad.wav')
    terms = []
    for i, (f1, f2, f3) in enumerate(PAD_CHORDS):
        gate = f'eq(floor(mod(t,32)/8),{i})'
        terms.append(f'{gate}*(0.5*sin(2*PI*{f1}*t)+0.3*sin(2*PI*{f2}*t)+0.3*sin(2*PI*{f3}*t))')
    env = '(0.5-0.5*cos(2*PI*mod(t,8)/8))'
    expr = f'0.18*{env}*(' + '+'.join(terms) + ')'
    run('-f', 'lavfi', '-i', f'aevalsrc={expr}|{expr}:s=48000:d={length + 1:.2f}',
        '-af', 'lowpass=f=1200,aecho=0.8:0.7:120|240:0.35|0.2,afade=t=in:d=2', out)
    return out


MOTION_ORDER = ['A', 'K', 'B', 'C', 'G', 'H', 'I', 'J', 'D', 'E', 'F']


def motion_cut(xf=0.6):
    """Brand motion-graphics cut: every scene chained with crossfades, ambient pad underneath."""
    ins, durs = [], []
    for sc in MOTION_ORDER:
        p = os.path.join(MOTION, f'escena_{sc}.mp4')
        ins += ['-i', p]
        durs.append(duration(p))
    chain, prev, off = [], '[0:v]', 0.0
    for i in range(1, len(durs)):
        off += durs[i - 1] - xf
        lab = f'[x{i}]'
        chain.append(f'{prev}[{i}:v]xfade=transition=fade:duration={xf}:offset={off:.2f}{lab}')
        prev = lab
    total = sum(durs) - xf * (len(durs) - 1)
    silent = os.path.join(WORK, 'motion_silent.mp4')
    run(*ins, '-filter_complex', ';'.join(chain) + f';{prev}format=yuv420p[v]', '-map', '[v]',
        '-c:v', 'libx264', '-crf', '17', '-r', str(FPS), silent)
    pad = make_pad(total)
    out = os.path.join(HERE, 'bezhas-launch-motion.mp4')
    run('-i', silent, '-i', pad, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-af', f'afade=t=out:st={total - 2.5:.2f}:d=2.5', '-shortest', '-movflags', '+faststart', out)
    print('OK', out, f'{duration(out):.1f}s')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--music', help='licensed music track to mix under the voice')
    ap.add_argument('--pad', action='store_true', help='mix a synthesized ambient pad under the voice when no --music is given')
    ap.add_argument('--motion-only', action='store_true', help='build the brand motion-graphics cut only (no downloads)')
    ap.add_argument('--placeholders', action='store_true', help='test the pipeline with synthetic clips/voices')
    a = ap.parse_args()
    os.makedirs(WORK, exist_ok=True)
    if a.motion_only:
        return motion_cut()
    clips, voices = manifest_urls()
    fetch(clips, voices, a.placeholders)
    counter = iter(range(1000))
    blocks = [build_block(b, items, counter) for b, items in TIMELINE]
    joined = os.path.join(WORK, 'joined.mp4')
    concat(blocks, joined)
    final = os.path.join(HERE, 'bezhas-launch.mp4' if not a.placeholders else 'build/bezhas-launch-TEST.mp4')
    if not a.music and a.pad:
        a.music = make_pad(duration(joined))
    if a.music:
        run('-i', joined, '-stream_loop', '-1', '-i', a.music, '-filter_complex',
            '[1:a]volume=0.18,afade=t=in:d=2[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]',
            '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final)
    else:
        run('-i', joined, '-c', 'copy', '-movflags', '+faststart', final)
    print('OK', final, f'{duration(final):.1f}s')


if __name__ == '__main__':
    main()
