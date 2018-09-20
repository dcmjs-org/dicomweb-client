# Clear any previous data from the last test run
rm -rf /tmp/dcm4chee-arc/db

# now start dcm4chee archive and wait for it to startup
echo 'Starting dcm4chee Docker container'
docker-compose -f dcm4chee-docker-compose.yml up -d || { exit 1; }

until curl localhost:8008/dcm4chee-arc/aets; do echo waiting for archive...; sleep 1; done
echo ""
echo ""
echo "Archive started, ready to run tests..."
echo ""

# at this point DICOMweb server is running and ready for testing
echo 'Installing and running tests'
./node_modules/karma/bin/karma start karma.conf.js --browsers ChromeHeadless_without_security --single-run

# Store the exit code from mochify
exit_code=$?

# now shut down the archive
echo 'Shutting down Docker container'
docker-compose -f dcm4chee-docker-compose.yml down

# Exit with the exit code from Mochify
exit "$exit_code"
