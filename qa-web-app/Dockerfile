# Stage 1: build the React frontend
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /build/dist ./frontend/dist/

# Volume mount point — populated at runtime, never baked in
RUN mkdir -p /app/volume/config /app/volume/reports /app/volume/cache

EXPOSE 8080

# Bind to 0.0.0.0 inside the container; Docker port-binds to 127.0.0.1 on the host
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
