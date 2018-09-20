describe('dicomweb.api.DICOMwebClient', function () {
  const dwc = new DICOMwebClient.api.DICOMwebClient({
    url: 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs',
  });

  it('should have correct constructor name', function() {
    chai.expect(dwc.constructor.name).to.equal('DICOMwebClient');
  });

  it('should find zero studies', function() {
    return dwc.searchForStudies().then(studies => {
      chai.expect(studies).to.have.length(0);
    });
  });

  it('should store one instance', function(done) {
    this.timeout(5000);

    // This is the HTTP server run by the Karma test
    // runner
    const url = 'http://localhost:9876/base/testData/sample.dcm';
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = function (oEvent) {
      const arrayBuffer = this.response;
      if (arrayBuffer) {
        const options = {
          datasets: [arrayBuffer]
        };

        dwc.storeInstances(options).then(function() {
          done();
        }, done);
      }
    };

    xhr.send();
  });

  it('should find one study', function() {
    return dwc.searchForStudies().then(studies => {
      chai.expect(studies).to.have.length(1);
    });
  });
});
