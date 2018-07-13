var test = require('tape');

var dicomweb = require('../build/dicomweb-client.js');

test('timing test', function (t) {

  t.plan(1); // plan for one test evaluation

  var dwc = new dicomweb.api.DICOMwebClient({
    url: 'http://localhost:8080/dcm4chee-arc/aets/DCM4CHEE/rs',
  });

  /* this fails for node because there is no XMLHttpRequest...
  dwc.searchForStudies().then(console.log);
  */

  t.equal(dwc.constructor.name,"DICOMwebClient");

});
