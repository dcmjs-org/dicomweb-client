const { expect } = chai;

function getTestDataInstance(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = function() {
      const arrayBuffer = this.response;
      if (arrayBuffer) {
        resolve(arrayBuffer);
      } else {
        reject(new Error('Something went wrong...'));
      }
    };

    xhr.send();
  });
}

describe('dicomweb.api.DICOMwebClient', function () {
  const dwc = new DICOMwebClient.api.DICOMwebClient({
    url: 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs',
  });

  it('should have correct constructor name', function() {
    expect(dwc.constructor.name).to.equal('DICOMwebClient');
  });

  it('should find zero studies', async function() {
    const studies = await dwc.searchForStudies();

    expect(studies).to.have.length(0);
  });

  it('should store one instance', async function() {
    this.timeout(5000);

    // This is the HTTP server run by the Karma test
    // runner
    const url = 'http://localhost:9876/base/testData/sample.dcm';

    const arrayBuffer = await getTestDataInstance(url);
    const options = {
      datasets: [arrayBuffer]
    };

    await dwc.storeInstances(options);
  });

  it('should find one study', async function() {
    const studies = await dwc.searchForStudies();
    expect(studies).to.have.length(1);
  });

  it('should store two instances', async function() {
    this.timeout(10000);

    // This is the HTTP server run by the Karma test
    // runner
    const url1 = 'http://localhost:9876/base/testData/sample2.dcm';
    const url2 = 'http://localhost:9876/base/testData/sample3.dcm';
    const url3 = 'http://localhost:9876/base/testData/US-PAL-8-10x-echo.dcm';

    const instancePromises = [
      getTestDataInstance(url1),
      getTestDataInstance(url2),
      getTestDataInstance(url3),
    ];

    const datasets = await Promise.all(instancePromises);

    const options = {
      datasets
    };

    await dwc.storeInstances(options);
  });

  it('should find four studes', async function() {
    const studies = await dwc.searchForStudies();

    expect(studies).to.have.length(4);
  });

  it('should retrieve a single frame of an instance', async function() {
    // from sample.dcm
    const options = {
      studyInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969',
      seriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.117357550898198415937979788256',
      sopInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.325971588264730726076978589153',
      frameNumbers: '1'
    };

    const frames = dwc.retrieveInstance(options);
  });

  it('should retrieve a single instance', async function() {
    // from sample.dcm
    const options = {
      studyInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969',
      seriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.117357550898198415937979788256',
      sopInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.325971588264730726076978589153'
    };

    const instance = await dwc.retrieveInstance(options);

    expect(instance).to.be.an('arraybuffer');
  });

  it('should retrieve an entire series as an array of instances', async function() {
    const options = {
      studyInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969',
      seriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.117357550898198415937979788256',
    };

    const instances = await dwc.retrieveSeries(options);

    expect(instances).to.have.length(1);
  });

  it('should retrieve an entire study as an array of instances', async function() {
    const options = {
      studyInstanceUID: '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969',
    };

    const instances = await dwc.retrieveStudy(options);

    expect(instances).to.have.length(1);
  });

  it('should retrieve bulk data', async function() {
    this.timeout(15000)
    const options = {
      studyInstanceUID: '999.999.3859744',
      seriesInstanceUID: '999.999.94827453',
      sopInstanceUID: '999.999.133.1996.1.1800.1.6.25',
    };

    const metadata = await dwc.retrieveInstanceMetadata(options);

    // TODO: Check why metadata is an array of objects, not just an object
    const bulkDataOptions = {
      BulkDataURI: metadata[0]['00281201'].BulkDataURI,
    };

    const bulkData = await dwc.retrieveBulkData(bulkDataOptions);

    expect(bulkData).to.be.an('arraybuffer');
  });
});
