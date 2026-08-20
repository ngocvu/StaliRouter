docker stop stalirouter 2>/dev/null || docker stop 9router 2>/dev/null || true
docker rm stalirouter 2>/dev/null || docker rm 9router 2>/dev/null || true
docker build -t stalirouter .
docker run -d --name stalirouter -p 20128:20128 --env-file .env \
  -v stalirouter-data:/app/data -e DATA_DIR=/app/data stalirouter
