FROM python:3.12-slim

WORKDIR /app

COPY workspace/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app and database package into /app
COPY workspace/backend/app /app/app
COPY database /app/database

ENV PYTHONPATH=/app

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]