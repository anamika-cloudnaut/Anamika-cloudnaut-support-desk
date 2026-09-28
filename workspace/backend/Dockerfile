FROM python:3.12-slim

WORKDIR /app

COPY workspace/backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY workspace/backend/app ./app
COPY workspace/database ./database

ENV PYTHONPATH=/app

EXPOSE 8001

CMD ["sh", "-c", "python -m app.initialize_db && uvicorn app.main:app --host 0.0.0.0 --port 8001"]