#!/usr/bin/env bash
# Genera un vídeo completo en la RTX: voz (edge-tts) → fotogramas (Chromium sobre la NVIDIA por EGL)
# → codificación NVENC → mezcla de voz y música → MP4 final (+ copia ligera < 30 MB si hace falta).
#
#   render.sh <dir_trabajo> <escenas.json> <player.html> <ANCHOxALTO> <es|en> <voz> <salida.mp4> [velocidad_voz]
#
# Ejemplos (desde marketing/video-como-funciona):
#   pipeline/render.sh /tmp/v-es scenes.json    player.html 1920x1080 es es-ES-AlvaroNeural BeZhas-como-funciona.mp4
#   pipeline/render.sh /tmp/v-en scenes.en.json player.html 1920x1080 en en-GB-RyanNeural   BeZhas-how-it-works.mp4
#   pipeline/render.sh /tmp/s-es short.json     short.html  1080x1920 es es-ES-AlvaroNeural BeZhas-short-es.mp4 +10%
# PY apunta a un python con playwright y edge-tts (por defecto python3).
set -euo pipefail
W=$1; SCENES=$2; PLAYER=$3; SIZE=$4; LANG_=$5; VOICE=$6; OUT=$7; RATE=${8:-+4%}
P=$(cd "$(dirname "$0")" && pwd); D=$(dirname "$P"); PY=${PY:-python3}; J=${JOBS:-6}; FPS=25
export __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/10_nvidia.json
export VIDEO_SCENES=$SCENES VIDEO_PLAYER=$PLAYER VIDEO_SIZE=$SIZE VIDEO_LANG=$LANG_
mkdir -p "$W"; cd "$W"

$PY "$P/tts.py" "$D/$SCENES" "$W" "$VOICE" "$RATE"
$PY "$P/render.py" "$W" info > tl.json
N=$($PY -c "import json,math;print(math.ceil(json.load(open('tl.json'))['total']*$FPS))")
C=$(( (N+J-1)/J ))
for i in $(seq 0 $((J-1))); do
  a=$((i*C)); b=$(( (i+1)*C<N ? (i+1)*C : N ))
  $PY "$P/render.py" "$W" frames $a $b part$i.mp4 &
done
wait
rm -f parts.txt; for i in $(seq 0 $((J-1))); do echo "file 'part$i.mp4'" >> parts.txt; done
ffmpeg -loglevel error -y -f concat -safe 0 -i parts.txt -c copy video.mp4

# Voz: cada escena en su sitio. Música: acorde sintético suave, sin licencias.
$PY - <<'PY'
import json, subprocess
tl = json.load(open('tl.json')); T = tl['total']; inp = []; flt = []
for k, r in enumerate(tl['tl']):
    inp += ['-i', f"{r['id']}.mp3"]
    ms = int((r['start'] + tl['lead']) * 1000)
    flt.append(f"[{k}]adelay={ms}|{ms}[a{k}]")
n = len(tl['tl'])
flt.append(''.join(f'[a{k}]' for k in range(n)) + f"amix=inputs={n}:normalize=0,apad,atrim=0:{T}[v]")
subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', *inp, '-filter_complex', ';'.join(flt), '-map', '[v]', '-ac', '2', '-ar', '48000', 'voice.wav'])
pad = f"aevalsrc='0.05*(sin(2*PI*110*t)+0.7*sin(2*PI*164.81*t)+0.6*sin(2*PI*220*t)+0.4*sin(2*PI*277.18*t*(1+0.002*sin(t))))*(0.75+0.25*sin(2*PI*t/8))':s=48000:d={T}"
subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', pad, '-af', f'lowpass=f=900,afade=t=in:d=2,afade=t=out:st={max(T-3, 0)}:d=3', '-ac', '2', 'pad.wav'])
PY
ffmpeg -loglevel error -y -i voice.wav -i pad.wav -filter_complex "[0]asplit[v1][v2];[1]volume=0.35[m];[m][v1]sidechaincompress=threshold=0.03:ratio=6:attack=50:release=600[md];[v2][md]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5[a]" -map "[a]" -c:a aac -b:a 192k mix.m4a
ffmpeg -loglevel error -y -i video.mp4 -i mix.m4a -c:v copy -c:a copy -shortest -movflags +faststart "$D/$OUT"

# Copia ligera para enviar al móvil cuando el original pasa de 30 MB (también por NVENC)
if [ "$(stat -c %s "$D/$OUT")" -gt 30000000 ]; then
  SCALE=$([ "${SIZE%x*}" -gt "${SIZE#*x}" ] && echo 1280:720 || echo 720:1280)
  ffmpeg -loglevel error -y -hwaccel cuda -i video.mp4 -i mix.m4a -vf scale=$SCALE -c:v h264_nvenc -preset p7 -rc vbr -b:v 320k -maxrate 500k \
    -c:a aac -b:a 80k -movflags +faststart "$D/${OUT%.mp4}-ligero.mp4"
fi
echo "DONE $D/$OUT"
