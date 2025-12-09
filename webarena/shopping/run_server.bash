while true; do
    if [ -z "$(docker ps --filter "name=shopping" --format '{{.Names}}')" ]; then
        sleep 5
        
        HOSTNAME="$(hostname -f).redmond.corp.microsoft.com"
        HOSTNAME_LOWER="${HOSTNAME,,}"

        echo "Starting shopping container..."
        docker run --rm --env-file docker_env/.env -e SERVER_URL=$HOSTNAME_LOWER --name shopping -p 7770:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d shopping-sentinel
        # Wait for the container to stop
        docker wait shopping

        echo "Container exited. Restarting..."
    else
        echo "Shopping container is already running. Retrying in 5 seconds..."
        sleep 5
    fi
done