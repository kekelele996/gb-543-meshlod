# backend 与 worker 共用同一镜像（build context 为项目根目录，以便把 worker/ 一起打进镜像）
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r /app/requirements.txt \
    || pip install --timeout 60 -r /app/requirements.txt

COPY backend/app /app/app
COPY backend/scripts /app/scripts
COPY backend/alembic.ini /app/alembic.ini
COPY worker /app/worker

RUN mkdir -p /data/artifacts

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
