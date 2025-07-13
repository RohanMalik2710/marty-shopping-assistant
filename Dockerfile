# Use an official Python runtime as the base image
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies including libzbar0
RUN apt-get update && apt-get install -y \
    libzbar0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Build the React frontend
RUN cd frontend && npm install && npm run build

# Run the application
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:$PORT", "backend.app:app"]