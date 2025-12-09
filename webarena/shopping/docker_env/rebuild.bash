arg="${1:-}"   # optional argument; empty string if not provided

docker stop shopping
docker container rm shopping
docker build --build-arg BUILD_DATE=$(date +%F) -t shopping-sentinel:latest .

# Get the machine hostname, lowercase
HOSTNAME="$(hostname -f).redmond.corp.microsoft.com"
HOSTNAME_LOWER="${HOSTNAME,,}"

if [[ "$arg" == "start" ]]; then
    docker run --rm --env-file .env -e SERVER_URL=$HOSTNAME_LOWER --name shopping -p 7770:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d shopping-sentinel
fi