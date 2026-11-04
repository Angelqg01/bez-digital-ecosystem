#!/usr/bin/env python3
"""Servidor Whisper local y gratuito, con API compatible con OpenAI.

    POST /v1/audio/transcriptions   (multipart: file, model, language)  ->  {"text": "..."}

Solo escucha en 127.0.0.1. Uso:
    ~/.local/share/bezhas-whisper/venv/bin/python scripts/voice/whisper-server.py
y en el .env de OPERANT:  WHISPER_URL=http://127.0.0.1:8765
"""
import json, os, tempfile
from email import message_from_bytes
from email.policy import HTTP
from http.server import BaseHTTPRequestHandler, HTTPServer
from faster_whisper import WhisperModel

MODEL = os.environ.get("WHISPER_MODEL", "small")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")  # "cuda" si tienes cuDNN instalado
model = WhisperModel(MODEL, device=DEVICE, compute_type="int8" if DEVICE == "cpu" else "float16")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/v1/audio/transcriptions":
            return self._send(404, {"error": "no encontrado"})
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        msg = message_from_bytes(b"Content-Type: " + self.headers["Content-Type"].encode() + b"\r\n\r\n" + body, policy=HTTP)
        parts = {p.get_param("name", header="content-disposition"): p for p in msg.iter_parts()}
        if "file" not in parts:
            return self._send(400, {"error": "falta file"})
        lang = parts["language"].get_content().strip() if "language" in parts else None
        with tempfile.NamedTemporaryFile(suffix=".audio") as f:
            f.write(parts["file"].get_payload(decode=True)); f.flush()
            segments, _ = model.transcribe(f.name, language=lang or None, vad_filter=True)
            text = " ".join(s.text.strip() for s in segments).strip()
        self._send(200, {"text": text})

    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

    def log_message(self, *a):  # sin ruido en consola
        pass


if __name__ == "__main__":
    port = int(os.environ.get("WHISPER_PORT", "8765"))
    print(f"Whisper '{MODEL}' en {DEVICE}: http://127.0.0.1:{port}", flush=True)
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
