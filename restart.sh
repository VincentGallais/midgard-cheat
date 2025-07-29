#!/bin/bash
docker-compose -f docker-compose.yml down --remove-orphans
./build.sh BusinessDev-Funbridge
docker-compose -f docker-compose.yml up --detach
cat seed.sql | docker exec -i midgard-postgres psql -U postgres -f-