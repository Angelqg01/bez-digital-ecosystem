"""Voz en off por escena con edge-tts. Uso: tts.py <scenes.json> <dir_salida> <voz> [velocidad]"""
import json, subprocess, sys, asyncio, edge_tts
scenes = json.load(open(sys.argv[1])); out = sys.argv[2]; voice = sys.argv[3]; rate = sys.argv[4] if len(sys.argv) > 4 else '+4%'
async def go():
    for s in scenes:
        await edge_tts.Communicate(s['say'], voice, rate=rate).save(f"{out}/{s['id']}.mp3")
asyncio.run(go())
d = {s['id']: float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f"{out}/{s['id']}.mp3"])) for s in scenes}
json.dump(d, open(f"{out}/durations.json", 'w'), indent=1)
print(f"{len(d)} escenas, {sum(d.values()):.1f} s de voz")
