FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY workspace/database/requirements.txt /app/workspace/database/requirements.txt

RUN pip install --no-cache-dir -r /app/workspace/database/requirements.txt

COPY workspace /app/workspace

CMD ["sh", "-c", "alembic -c workspace/database/alembic.ini upgrade head && python3 -m workspace.database.seeds.seed"]
