# Dockerfile
FROM postmill-populated-exposed-withimg

# Install Python and postgresql bindings
RUN apk upgrade --no-cache python3
RUN apk add --no-cache build-base python3-dev postgresql-dev
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools && pip3 install psycopg2 fastapi uvicorn

# (Optional) install vim
RUN apk add --no-cache vim

# Prepare the database
COPY prepare_database.sql /var/www/html/prepare_database.sql
COPY dump_table.py /var/www/html/dump_table.py
USER postgres
ENV PGDATA=/usr/local/pgsql/data

# Start Postgres, run SQL, stop Postgres
RUN pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start \
    && python3 dump_table.py submissions > submissions.jsonl \
    && python3 dump_table.py comments > comments.jsonl \
    && psql -d postmill -f /var/www/html/prepare_database.sql \
    && pg_ctl -D "$PGDATA" -m fast -w stop 
USER root

# Generate votes
COPY gen_votes.py /var/www/html/gen_votes.py
RUN python3 gen_votes.py < submissions.jsonl > submission_votes.jsonl
RUN python3 gen_votes.py < comments.jsonl > comment_votes.jsonl
RUN sort -d submission_votes.jsonl > .submission_votes.jsonl && mv .submission_votes.jsonl submission_votes.jsonl
RUN sort -d comment_votes.jsonl > .comment_votes.jsonl && mv .comment_votes.jsonl comment_votes.jsonl

# Merge everything
COPY merge.py /var/www/html/merge.py
RUN python3 merge.py | gzip > /var/www/html/events.jsonl.gz

# Patch Postmill
COPY SubmissionPage.php /var/www/html/src/Pagination/SubmissionPage.php

# Bust the cache daily
ARG BUILD_DATE=None
RUN echo "Build date: $BUILD_DATE" > /build_date

# Shift all times forward (do this later to reduce the time needed to rebuild)
COPY shift_times.sql /var/www/html/shift_times.sql
USER postgres
RUN pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start \
    && psql -d postmill -f /var/www/html/shift_times.sql \
    && pg_ctl -D "$PGDATA" -m fast -w stop 
USER root

# Copy the sentinel server
COPY sentinel_api.py /var/www/html/sentinel_api.py
COPY fastapi.ini /etc/supervisor.d/fastapi.ini
