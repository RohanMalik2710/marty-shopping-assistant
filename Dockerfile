FROM python:3.12-slim

# Install required OS packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libzbar0 \
    libgl1 \
    curl \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js (for frontend build)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Build frontend
RUN cd frontend && npm install && npm run build

# Start the app (shell form to expand $PORT)
CMD gunicorn -w 1 -b 0.0.0.0:$PORT backend.app:app