# Dockerfile
FROM shopping_final_0712

# Sets the port for the Adobe Commerce store URL 
ENV MAGENTO_PORT=80
ENV MAGENTO_URL=localhost

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
COPY events.jsonl.gz /var/www/html/events.jsonl.gz
COPY product_images.tar.gz /var/www/html/product_images.tar.gz
RUN tar -xzf /var/www/html/product_images.tar.gz -C /var/www/html/

# Copy scripts for installing the webarena.shopping package and interacting w/ the magento store
COPY pyproject.toml /var/www/html/pyproject.toml
RUN mkdir -p /var/www/html/webarena
COPY ../../__init__.py /var/www/html/webarena/__init__.py
RUN mkdir -p /var/www/html/webarena/shopping
COPY ../__init__.py /var/www/html/webarena/shopping/__init__.py
COPY ../events/ /var/www/html/webarena/shopping/events/
COPY ../utils/ /var/www/html/webarena/shopping/utils/
WORKDIR /var/www/html
RUN pip3 install . 

# Copy the sentinel server
COPY sentinel_api.py /var/www/html/sentinel_api.py
COPY fastapi.ini /etc/supervisor.d/fastapi.ini
