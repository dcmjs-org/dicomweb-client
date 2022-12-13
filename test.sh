#!/bin/bash

set -ueEo pipefail

DOCKER_COMPOSE_FILE='dcm4chee-docker-compose.yml'
watch='0'

optstring=':w'

while getopts ${optstring} arg; do
  case ${arg} in
    w)
      watch='1'
      ;;
    ?)
      echo "Invalid option: -${OPTARG}"
      exit 2
      ;;
  esac
done


function start () {
    echo 'Starting containers'
    docker compose -f ${DOCKER_COMPOSE_FILE} up -d || { exit 1; }
}

function stop () {
    echo 'Stopping containers'
    docker compose -f ${DOCKER_COMPOSE_FILE} down
    echo 'Removing containers and volumes'
    docker compose -f ${DOCKER_COMPOSE_FILE} rm -svf
}

trap 'stop' EXIT

start

echo 'Waiting for containers to be up and running...'
for i in {1..20}
do curl -s localhost:9999/dcm4chee-arc/aets && break || echo '.'; sleep 2
done

echo 'Containers are running, running tests...'

# at this point DICOMweb server is running and ready for testing
echo 'Installing and running tests'
if [ "${watch}" -eq "1" ]
then
    ./node_modules/karma/bin/karma start karma.conf.js \
        --browsers Chrome_without_security
else
    echo 'Watching tests...'
    ./node_modules/karma/bin/karma start karma.conf.js \
        --browsers Chrome_without_security \
        --single-run
fi

exit_code=$?

stop

# Exit with the exit code from tests
exit "${exit_code}"
