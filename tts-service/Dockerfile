FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsndfile1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV VIENEU_HOST=0.0.0.0
ENV VIENEU_PORT=8100
ENV OMP_NUM_THREADS=4

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

EXPOSE 8100

VOLUME /root/.cache/huggingface

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8100/health || exit 1

CMD ["python", "server.py"]
