/**
 * AbortSignal support of request options. These tests use a fake
 * XMLHttpRequest and need no DICOMweb server.
 */
class FakeXMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.response = null;
    this.responseType = '';
    this.sent = false;
    this.aborted = false;
  }

  open() {
    this.readyState = 1;
  }

  setRequestHeader() {}

  getResponseHeader() {
    return null;
  }

  getAllResponseHeaders() {
    return '';
  }

  send() {
    this.sent = true;
  }

  abort() {
    this.aborted = true;
    this.readyState = 4;
    this.status = 0;
    if (this.onreadystatechange) {
      this.onreadystatechange();
    }
  }

  respond(status, response) {
    this.readyState = 4;
    this.status = status;
    this.response = response;
    this.onreadystatechange();
  }
}

describe('Request abort signal', function() {
  const url = 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs';
  const frameOptions = {
    studyInstanceUID: '1.2.3',
    seriesInstanceUID: '1.2.3.4',
    sopInstanceUID: '1.2.3.4.5',
    frameNumbers: [1],
  };
  let errorInterceptor;

  beforeEach(function() {
    errorInterceptor = jasmine.createSpy('errorInterceptor');
  });

  it('rejects without sending when the signal is already aborted', async function() {
    const dwc = new DICOMwebClient.api.DICOMwebClient({ url, errorInterceptor, verbose: false });
    const instance = new FakeXMLHttpRequest();
    const controller = new AbortController();
    controller.abort();
    let error;
    try {
      await dwc.retrieveInstanceFrames({
        ...frameOptions,
        request: { instance, signal: controller.signal },
      });
    } catch (e) {
      error = e;
    }
    expect(error.name).toBe('AbortError');
    expect(instance.sent).toBe(false);
    expect(errorInterceptor).not.toHaveBeenCalled();
  });

  it('aborts an in-flight request and rejects with the abort reason', async function() {
    const dwc = new DICOMwebClient.api.DICOMwebClient({ url, errorInterceptor, verbose: false });
    const instance = new FakeXMLHttpRequest();
    const controller = new AbortController();
    const reason = new Error('tile no longer needed');
    const promise = dwc.retrieveInstanceFrames({
      ...frameOptions,
      request: { instance, signal: controller.signal },
    });
    expect(instance.sent).toBe(true);
    controller.abort(reason);
    let error;
    try {
      await promise;
    } catch (e) {
      error = e;
    }
    if (controller.signal.reason !== undefined) {
      expect(error).toBe(reason);
    } else {
      /** Browsers without AbortSignal.reason (Chrome < 98) reject with AbortError */
      expect(error.name).toBe('AbortError');
    }
    expect(instance.aborted).toBe(true);
    expect(errorInterceptor).not.toHaveBeenCalled();
  });

  it('aborts the request returned by request hooks', async function() {
    const replacement = new FakeXMLHttpRequest();
    const requestHook = jasmine
      .createSpy('requestHook', function(request, metadata) {
        return request;
      })
      .and.callFake(() => replacement);
    const dwc = new DICOMwebClient.api.DICOMwebClient({
      url,
      verbose: false,
      errorInterceptor,
      requestHooks: [requestHook],
    });
    const controller = new AbortController();
    const promise = dwc.retrieveInstanceFrames({
      ...frameOptions,
      request: { instance: new FakeXMLHttpRequest(), signal: controller.signal },
    });
    expect(requestHook.calls.mostRecent().args[1].signal).toBe(
      controller.signal,
    );
    controller.abort();
    let error;
    try {
      await promise;
    } catch (e) {
      error = e;
    }
    expect(error.name).toBe('AbortError');
    expect(replacement.aborted).toBe(true);
  });

  it('does not pass a signal to request hooks when none is given', async function() {
    const requestHook = jasmine
      .createSpy('requestHook', function(request, metadata) {
        return request;
      })
      .and.callFake(request => request);
    const dwc = new DICOMwebClient.api.DICOMwebClient({
      url,
      verbose: false,
      requestHooks: [requestHook],
    });
    const instance = new FakeXMLHttpRequest();
    const promise = dwc.retrieveInstanceFrames({
      ...frameOptions,
      request: { instance },
    });
    expect('signal' in requestHook.calls.mostRecent().args[1]).toBe(false);
    instance.respond(200, new ArrayBuffer(0));
    await promise;
  });

  it('ignores an abort after the request has completed', async function() {
    const dwc = new DICOMwebClient.api.DICOMwebClient({ url, errorInterceptor, verbose: false });
    const instance = new FakeXMLHttpRequest();
    instance.responseType = 'arraybuffer';
    const controller = new AbortController();
    const promise = dwc.retrieveInstanceFrames({
      ...frameOptions,
      request: { instance, signal: controller.signal },
    });
    const frame = new ArrayBuffer(4);
    instance.respond(200, frame);
    const frames = await promise;
    controller.abort();
    expect(frames[0]).toBe(frame);
    expect(instance.aborted).toBe(false);
  });
});

describe('Request abort signal cleanup', function() {
  const url = 'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs';
  const frameOptions = {
    studyInstanceUID: '1.2.3',
    seriesInstanceUID: '1.2.3.4',
    sopInstanceUID: '1.2.3.4.5',
    frameNumbers: [1],
  };

  it('rejects and releases the signal when send throws', async function() {
    const dwc = new DICOMwebClient.api.DICOMwebClient({ url, verbose: false });
    const instance = new FakeXMLHttpRequest();
    const sendError = new Error('send failed');
    instance.send = () => {
      throw sendError;
    };
    const controller = new AbortController();
    const removeSpy = spyOn(
      controller.signal,
      'removeEventListener',
    ).and.callThrough();
    let error;
    try {
      await dwc.retrieveInstanceFrames({
        ...frameOptions,
        request: { instance, signal: controller.signal },
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBe(sendError);
    expect(removeSpy).toHaveBeenCalledWith('abort', jasmine.any(Function));
  });

  it('rejects when the errorInterceptor throws', async function() {
    const dwc = new DICOMwebClient.api.DICOMwebClient({
      url,
      verbose: false,
      errorInterceptor: () => {
        throw new Error('interceptor failed');
      },
    });
    const instance = new FakeXMLHttpRequest();
    const controller = new AbortController();
    const promise = dwc.retrieveInstanceFrames({
      ...frameOptions,
      request: { instance, signal: controller.signal },
    });
    try {
      instance.respond(500, null);
    } catch (e) {
      /** The interceptor's error propagates from the event handler */
    }
    let error;
    try {
      await promise;
    } catch (e) {
      error = e;
    }
    expect(error.status).toBe(500);
  });
});
