# Dockerfile
FROM shopping_final_0712

# Sets the port for the Adobe Commerce store URL 
ENV MAGENTO_PORT=80
ENV MAGENTO_URL=localhost

ARG SHOPPING_PATH="/webarena/shopping"
ARG DOCKER_PATH="${SHOPPING_PATH}/docker_env"

# Install system dependencies
RUN apk update
RUN apk update --no-cache \
    bash \
    curl \
    unzip \
    wget

# Install Python 3 and pip
RUN apk update python3
RUN apk update --no-cache build-base python3-dev
RUN python3 -m ensurepip

# Install required Python packages
RUN pip3 install --no-cache --upgrade pip setuptools && pip3 install mysql-connector-python fastapi uvicorn requests openai beautifulsoup4

# Copy events and product images
COPY ${DOCKER_PATH}/events.jsonl.gz /var/www/html/events.jsonl.gz
COPY ${DOCKER_PATH}/product_images.tar.gz /var/www/html/product_images.tar.gz
RUN tar -xzf /var/www/html/product_images.tar.gz -C /var/www/html/

# Copy scripts for installing the webarena.shopping package and interacting w/ the magento store
COPY ${DOCKER_PATH}/pyproject.toml /var/www/html/pyproject.toml
RUN mkdir -p /var/www/html/webarena/shopping/events 
RUN mkdir -p /var/www/html/webarena/shopping/utils

COPY webarena/__init__.py /var/www/html/webarena/__init__.py
COPY ${SHOPPING_PATH}/__init__.py /var/www/html/webarena/shopping/__init__.py
COPY ${SHOPPING_PATH}/events/ /var/www/html/webarena/shopping/events/
COPY ${SHOPPING_PATH}/utils/ /var/www/html/webarena/shopping/utils/

WORKDIR /var/www/html
RUN pip3 install . 

# Copy the sentinel server
COPY ${DOCKER_PATH}/sentinel_api.py /var/www/html/sentinel_api.py
COPY ${DOCKER_PATH}/fastapi.ini /etc/supervisor.d/fastapi.ini