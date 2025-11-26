arg="${1:-}"   # optional argument; empty string if not provided

docker stop forum
docker container rm forum
docker build --build-arg BUILD_DATE=$(date +%F) -t postmill-sentinel:latest .

if [[ "$arg" == "start" ]]; then
    docker run --name forum -p 9999:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d postmill-sentinel
fi
