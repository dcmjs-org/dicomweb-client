const chai = require('chai');

const dicomweb = require('../build/dicomweb-client.js');

describe('dicomweb.api.DICOMwebClient', function (t) {

  const dwc = new dicomweb.api.DICOMwebClient({
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

  // TODO: add the stow part

  /*it('should find one study', function() {
    return dwc.searchForStudies().then(studies => {
      chai.expect(studies).to.have.length(1);
    });
  });*/

});
