# ═══════════════════════════════════════════════════════════════
# BeZhas OpenClaw Engine — Dockerfile
# Soporte: NVIDIA GPU (RTX 4090) + CPU fallback
# ═══════════════════════════════════════════════════════════════

# Base con CUDA 12.1 para soporte bitsandbytes + llama-cpp-python GPU
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

# ── Variables de entorno ───────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CUDA_HOME=/usr/local/cuda \
    # llama.cpp — activa soporte CUDA durante compilación
    CMAKE_ARGS="-DLLAMA_CUBLAS=on" \
    FORCE_CMAKE=1

WORKDIR /app/bezhas-openclaw

# ── Sistema base ───────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3-pip \
    build-essential \
    cmake \
    git \
    curl \
    # Para web3.py
    libssl-dev \
    libffi-dev \
    # Para bitsandbytes compilación nativa
    ninja-build \
    && ln -s /usr/bin/python3.11 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Instalar dependencias Python ───────────────────────────────
COPY requirements.txt .

# Primero PyTorch con CUDA (debe ir antes de bitsandbytes)
RUN pip install --upgrade pip && \
    pip install torch==2.3.1+cu121 --index-url https://download.pytorch.org/whl/cu121 && \
    # Compilar llama-cpp-python con soporte CUDA (Q3_K_M = TurboQuant 3-bit)
    pip install llama-cpp-python --no-binary :all: && \
    # Resto de dependencias
    pip install -r requirements.txt

# ── Copiar código fuente ───────────────────────────────────────
COPY . .

# ── Directorio para modelos GGUF locales ──────────────────────
# Monta tu disco con: -v D:\BeZhas\models:/app/models
RUN mkdir -p /app/models /app/logs /app/cache

# ── Variables de entorno runtime (se inyectan desde .env) ─────
# NUNCA hardcodear API keys aquí
ENV ANTHROPIC_API_KEY=""  \
    GOOGLE_API_KEY=""     \
    OPENAI_API_KEY=""     \
    DEEPSEEK_API_KEY=""   \
    BEZHAS_ENV="production" \
    LOG_LEVEL="INFO"

# ── Healthcheck ───────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# ── Entrypoint ────────────────────────────────────────────────
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
