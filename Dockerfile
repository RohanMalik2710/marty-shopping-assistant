FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libzbar0 \
    curl \
    git \
    && apt-get clean

# Install Node.js (use NodeSource for latest stable version)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Set workdir
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Build frontend
RUN cd frontend && npm install && npm run build

# Expose port (optional, if running locally)
EXPOSE 8000

# Run the backend using Gunicorn
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8000", "backend.app:app"]
