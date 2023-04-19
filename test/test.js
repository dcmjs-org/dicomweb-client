const { createSpy } = jasmine;
jasmine.getEnv().configure({ random: false });

function getTestDataInstance(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

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

let dwc = new DICOMwebClient.api.DICOMwebClient({
  url: 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs',
  retrieveRendered: false,
});
describe('dicomweb.api.DICOMwebClient', function() {
  //
  // Note: you can add the following for debugging tests locally
  //
  // beforeAll(function(done) {
  //   dwc = new DICOMwebClient.api.DICOMwebClient({
  //     url: 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs',
  //     retrieveRendered: false,
  //   });

  //   // Repeatedly call the reject endpoint until all studies are deleted
  //   const deleteStudies = async () => {
  //     const studies = await dwc.searchForStudies();
  //     console.log('studies', studies, 'studies.length', studies.length);

  //     if (studies.length === 0) {
  //       console.log('All studies deleted');
  //       done();
  //       return;
  //     }

  //     const promises = studies.map(study => {
  //       return fetch(
  //         `http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs/studies/${
  //           study['0020000D'].Value[0]
  //         }/reject/113039^DCM`,
  //         {
  //           method: 'POST',
  //         },
  //       );
  //     });

  //     await Promise.all(promises);
  //     console.log('Deleted', promises.length, 'studies');

  //     setTimeout(deleteStudies, 1000);
  //   };

  //   deleteStudies();
  // }, 30000);

  it('should have correct constructor name', function() {
    expect(dwc.constructor.name).toEqual('DICOMwebClient');
  });

  it('should find zero studies', async function() {
    const studies = await dwc.searchForStudies({});
    expect(studies.length).toBe(0);
  });

  it('should store one instance', async function() {
    // This is the HTTP server run by the Karma test
    // runner
    const url = 'http://localhost:9876/base/testData/sample.dcm';

    const arrayBuffer = await getTestDataInstance(url);
    const options = {
      datasets: [arrayBuffer],
    };

    await dwc.storeInstances(options);

    const studies = await dwc.searchForStudies();
    expect(studies.length).toBe(1);
  }, 5000);

  it('should store three more instances', async function() {
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

    const promises = datasets.map(dataset => {
      return dwc.storeInstances({ datasets: [dataset] });
    });

    await Promise.all(promises);
    const studies = await dwc.searchForStudies();
    expect(studies.length).toBe(4);
  }, 45000);

  it('should retrieve a single frame of an instance', async function() {
    // from sample.dcm
    const options = {
      studyInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969',
      seriesInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.117357550898198415937979788256',
      sopInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.325971588264730726076978589153',
      frameNumbers: '1',
    };

    const frames = dwc.retrieveInstance(options);
  });

  it('should retrieve a single instance', async function() {
    // from sample.dcm
    const options = {
      studyInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969',
      seriesInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.117357550898198415937979788256',
      sopInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.325971588264730726076978589153',
    };

    const instance = await dwc.retrieveInstance(options);

    expect(instance instanceof ArrayBuffer).toBe(true);
  });

  it('should retrieve an entire series as an array of instances', async function() {
    const options = {
      studyInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969',
      seriesInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.117357550898198415937979788256',
    };

    const instances = await dwc.retrieveSeries(options);

    expect(instances.length).toBe(1);
  });

  it('should retrieve an entire study as an array of instances', async function() {
    const options = {
      studyInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969',
    };

    const instances = await dwc.retrieveStudy(options);

    expect(instances.length).toBe(1);
  });

  it('should retrieve bulk data', async function() {
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

    expect(bulkData instanceof Array).toBe(true);
    expect(bulkData.length).toBe(1);
    expect(bulkData[0] instanceof ArrayBuffer).toBe(true);
  }, 15000);
});

describe('Request hooks', function() {
  let requestHook1Spy, requestHook2Spy, url, metadataUrl, request;

  beforeEach(function() {
    request = new XMLHttpRequest();
    url = 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs';
    metadataUrl =
      'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs/studies/999.999.3859744/series/999.999.94827453/instances/999.999.133.1996.1.1800.1.6.25/metadata';
    requestHook1Spy = createSpy('requestHook1Spy', function(request, metadata) {
      return request;
    }).and.callFake((request, metadata) => request);
    requestHook2Spy = createSpy('requestHook2Spy', function(request, metadata) {
      return request;
    }).and.callFake((request, metadata) => request);
  });

  it('invalid request hooks should be notified and ignored', async function() {
    /** Spy with invalid request hook signature */
    requestHook2Spy = createSpy('requestHook2Spy', function(request) {
      return request;
    }).and.callFake((request, metadata) => request);
    const dwc = new DICOMwebClient.api.DICOMwebClient({
      url,
      requestHooks: [requestHook1Spy, requestHook2Spy],
    });
    const metadata = {
      url: metadataUrl,
      method: 'get',
      headers: { Accept: 'application/dicom+json' },
    };
    request.open('GET', metadata.url);

    // Wrap the call to `dwc.retrieveInstanceMetadata()` in a try-catch block
    await dwc.retrieveInstanceMetadata({
      studyInstanceUID: '999.999.3859744',
      seriesInstanceUID: '999.999.94827453',
      sopInstanceUID: '999.999.133.1996.1.1800.1.6.25',
    });

    // The following line should not be reached if an error is thrown
    expect(requestHook1Spy).not.toHaveBeenCalledWith(request, metadata);
    expect(requestHook2Spy).not.toHaveBeenCalledWith(request, metadata);
  });

  it('valid request hooks should be called', async function() {
    const dwc = new DICOMwebClient.api.DICOMwebClient({
      url,
      requestHooks: [requestHook1Spy, requestHook2Spy],
    });
    const metadata = {
      url: metadataUrl,
      method: 'get',
      headers: { Accept: 'application/dicom+json' },
    };
    request.open('GET', metadata.url);
    await dwc.retrieveInstanceMetadata({
      studyInstanceUID: '999.999.3859744',
      seriesInstanceUID: '999.999.94827453',
      sopInstanceUID: '999.999.133.1996.1.1800.1.6.25',
    });
    expect(requestHook1Spy).toHaveBeenCalledWith(request, metadata);
    expect(requestHook2Spy).toHaveBeenCalledWith(request, metadata);
  });
});
