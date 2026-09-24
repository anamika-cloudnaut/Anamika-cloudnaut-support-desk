# Use an official, lightweight Python image
#FROM python:3.11-slim

# Set the working directory inside the container
#WORKDIR /app

# Copy the requirements file and install dependencies
#COPY requirements.txt .
#RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
#COPY . .

# Expose the port the app runs on (matching your docker-compose.yml)
#EXPOSE 4000

# Command to run the application
#CMD ["python", "app.py"]

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 4000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "4000"]