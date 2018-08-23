# now start dcm4chee archive and wait for it to startup
echo 'Starting dcm4chee Docker container'
docker-compose -f dcm4chee-docker-compose.yml up -d
until curl localhost:8008/dcm4chee-arc/aets; do echo waiting for archive...; sleep 1; done
echo ""
echo ""
echo "Archive started, ready to run tests..."
echo ""

# at this point DICOMweb server is running and ready for testing
echo 'Installing and running tests'
./node_modules/.bin/mochify

# now shut down the archive
echo 'Shutting down Docker container'
docker-compose -f dcm4chee-docker-compose.yml down
