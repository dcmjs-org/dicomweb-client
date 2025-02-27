import { multipartEncode, multipartDecode } from './message.js';



function isObject(obj) {
  return typeof obj === 'object' && obj !== null;
}

function isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

function areValidRequestHooks(requestHooks) {
  const isValid =
    Array.isArray(requestHooks) &&
    requestHooks.every(
      requestHook =>
        typeof requestHook === 'function' && requestHook.length === 2,
    );

  if (!isValid) {
    console.warn(
      'Request hooks should have the following signature: ' +
        'function requestHook(request, metadata) { return request; }',
    );
  }

  return isValid;
}

/**
 * @typedef {Object} Request
 * @property {XMLHttpRequest} [instance] - If specified, the request to use, otherwise one will be created.
 * @property {function(ProgressEvent):void} [progressCallback] - A callback function to handle progress events.
 * @property {string} [responseType] - The response type of the request.
 * @property {boolean} [withCredentials] - Whether to include credentials in the request.
 */

/**
 * @param {Request} request - Request options.
 */
const getRequestOptions = (request = {}) => ({
    instance: request.instance || new XMLHttpRequest(),
    progressCallback: request.progressCallback ||  false,
    withCredentials: request.withCredentials || false,
    responseType: request.responseType
})

const getFirstResult = result => result[0];

const MEDIATYPES = {
  DICOM: 'application/dicom',
  DICOM_JSON: 'application/dicom+json',
  OCTET_STREAM: 'application/octet-stream',
  PDF: 'application/pdf',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
};

/**
 * debugLog is a function that can be called with console.log arguments, and will
 * be conditionally displayed, only when debug logging is enabled.
 */
let debugLog = () => {};

/**
 * @typedef { import("../types/types").InstanceMetadata } InstanceMetadata
 */

/**
 * A callback with the request instance and metadata information
 * of the currently request being executed that should necessarily
 * return the given request optionally modified.
 * @typedef {function} RequestHook
 * @param {XMLHttpRequest} request - The original XMLHttpRequest instance.
 * @param {object} metadata - The metadata used by the request.
 */

/**
 * Class for interacting with DICOMweb RESTful services.
 */
class DICOMwebClient {
  /**
   * @constructor
   * @param {Object} options
   * @param {String} options.url - URL of the DICOMweb RESTful Service endpoint
   * @param {String=} options.qidoURLPrefix - URL path prefix for QIDO-RS
   * @param {String=} options.wadoURLPrefix - URL path prefix for WADO-RS
   * @param {String=} options.stowURLPrefix - URL path prefix for STOW-RS
   * @param {String=} options.username - Username
   * @param {String=} options.password - Password
   * @param {Object=} options.headers - HTTP headers
   * @param {Array.<RequestHook>=} options.requestHooks - Request hooks.
   * @param {Object=} options.verbose - print to console request warnings and errors, default true
   * @param {Object=} options.debug - print to the console debug level information/status updates.
   * @param {boolean|String} options.singlepart - retrieve singlepart for the named types.
   * The available types are:  bulkdata, video, image.  true means all.
   */
  constructor(options) {
    this.baseURL = options.url;
    if (!this.baseURL) {
      console.error('no DICOMweb base url provided - calls that require a URL will fail');
    }

    if ('username' in options) {
      this.username = options.username;
      if (!('password' in options)) {
        console.error(
          'no password provided to authenticate with DICOMweb service',
        );
      }
      this.password = options.password;
    }

    if ('qidoURLPrefix' in options) {
      debugLog(`use URL prefix for QIDO-RS: ${options.qidoURLPrefix}`);
      this.qidoURL = `${this.baseURL}/${options.qidoURLPrefix}`;
    } else {
      this.qidoURL = this.baseURL;
    }

    if ('wadoURLPrefix' in options) {
      debugLog(`use URL prefix for WADO-RS: ${options.wadoURLPrefix}`);
      this.wadoURL = `${this.baseURL}/${options.wadoURLPrefix}`;
    } else {
      this.wadoURL = this.baseURL;
    }

    if ('stowURLPrefix' in options) {
      debugLog(`use URL prefix for STOW-RS: ${options.stowURLPrefix}`);
      this.stowURL = `${this.baseURL}/${options.stowURLPrefix}`;
    } else {
      this.stowURL = this.baseURL;
    }

    if (options.singlepart) {
      debugLog('use singlepart', options.singlepart);
      this.singlepart = options.singlepart === true ? 'bulkdata,video,image' : options.singlepart;
    } else {
      this.singlepart = '';
    }

    if ('requestHooks' in options) {
      this.requestHooks = options.requestHooks;
    }

    // Headers to pass to requests.
    this.headers = options.headers || {};

    // Optional error interceptor callback to handle any failed request.
    this.errorInterceptor = options.errorInterceptor || (() => undefined);

    // Verbose - print to console request warnings and errors, default true
    this.verbose = options.verbose !== false;

    this.setDebug(options.debug);
 

  }

  /**
   * Allows setting the debug log information. 
   * Note this is different from verbose in that verbose is whether to include warning/error information, defaulting to true
   * 
   * @param {boolean} debugLevel 
   * @param {function} debugLogFunction to call with the debug output arguments. 
   */
  setDebug(debugLevel = false, debugLogFunction = null) {
    this.debugLevel = !!debugLevel;
    debugLog = debugLogFunction || debugLevel ? console.log : () => {};
  }

  /**
   * Gets debug flag
   * 
   * @returns true if debug logging is enabled
   */
  getDebug() {
    return this.debugLevel;
  }
 
  /**
   * Sets verbose flag.
   *
   * @param {Boolean} verbose
   */
  setVerbose(verbose) {
    this.verbose = verbose;
  }

  /**
   * Gets verbose flag.
   *
   * @return {Boolean} verbose
   */
  getVerbose() {
    return this.verbose;
  }

  static _parseQueryParameters(params = {}) {
    let queryString = '?';
    Object.keys(params).forEach((key, index) => {
      if (index !== 0) {
        queryString += '&';
      }
      queryString += `${key}=${encodeURIComponent(params[key])}`;
    });
    return queryString;
  }

  /**
   * Performs an HTTP request.
   *
   * @param {String} url
   * @param {String} method
   * @param {Object} headers
   * @param {Request} [request] - Request Options
   * @param {Array} [request.data] - Data that should be stored
   *  @return {*}
   * @private
   */
  _httpRequest(url, method, headers = {}, request = {}) {
    const { errorInterceptor, requestHooks } = this;
    return new Promise((resolve, reject) => {
      let requestInstance = request.instance ? request.instance : new XMLHttpRequest();

      requestInstance.open(method, url, true);
      if ('responseType' in request) {
        requestInstance.responseType = request.responseType;
      }

      if (typeof headers === 'object') {
        Object.keys(headers).forEach(key => {
          requestInstance.setRequestHeader(key, headers[key]);
        });
      }

      // now add custom headers from the user
      // (e.g. access tokens)
      const userHeaders = this.headers;
      Object.keys(userHeaders).forEach(key => {
        requestInstance.setRequestHeader(key, userHeaders[key]);
      });

      // Event triggered when upload starts
      requestInstance.onloadstart = function onloadstart() {
        debugLog('upload started: ', url)
      };

      // Event triggered when upload ends
      requestInstance.onloadend = function onloadend() {
        debugLog('upload finished')
      };

      // Handle response message
      requestInstance.onreadystatechange = () => {
        if (requestInstance.readyState === 4) {
          if (requestInstance.status === 200) {
            const contentType = requestInstance.getResponseHeader('Content-Type');
            // Automatically distinguishes between multipart and singlepart in an array buffer, and
            // converts them into a consistent type.
            if (contentType && contentType.indexOf('multipart') !== -1) {
              resolve(multipartDecode(requestInstance.response));
            } else if (requestInstance.responseType === 'arraybuffer') {
              resolve([requestInstance.response]);
            } else {
              resolve(requestInstance.response);
            }
          } else if (requestInstance.status === 202) {
            if (this.verbose) {
              console.warn('some resources already existed: ', requestInstance);
            }
            resolve(requestInstance.response);
          } else if (requestInstance.status === 204) {
            if (this.verbose) {
              console.warn('empty response for request: ', requestInstance);
            }
            resolve([]);
          } else {
            const error = new Error('request failed');
            error.request = requestInstance;
            error.response = requestInstance.response;
            error.status = requestInstance.status;
            if (this.verbose) {
              console.error('request failed: ', requestInstance);
              console.error(error);
              console.error(error.response);
            }

            errorInterceptor(error);

            reject(error);
          }
        }
      };

      // Event triggered while download progresses
      if ('progressCallback' in request) {
        if (typeof request.progressCallback === 'function') {
          requestInstance.onprogress = request.progressCallback;
        }
      }

      if (requestHooks && areValidRequestHooks(requestHooks)) {
        const combinedHeaders = Object.assign({}, headers, this.headers);
        const metadata = { method, url, headers: combinedHeaders };
        const pipeRequestHooks = functions => args =>
          functions.reduce((props, fn) => fn(props, metadata), args);
        const pipedRequest = pipeRequestHooks(requestHooks);
        requestInstance = pipedRequest(requestInstance);
      }

      // Add withCredentials to request if needed
      if ('withCredentials' in request) {
        if (request.withCredentials) {
          requestInstance.withCredentials = true;
        }
      }

      if ('data' in request) {
        requestInstance.send(request.data);
      } else {
        requestInstance.send();
      }
    });
  }

  /**
   * Performs an HTTP GET request.
   *
   * @param {String} url
   * @param {Object} headers
   * @param {Request} request - Request Options
   * @return {*}
   * @private
   */
  _httpGet(url, headers, request) {
    return this._httpRequest(url, 'get', headers, request);
  }

  /**
   * Performs an HTTP GET request that accepts a message with application/json
   * media type.
   *
   * @param {String} url
   * @param {Object} params
   * @param {Request} request - Request Options
   * @return {*}
   * @private
   */
  _httpGetApplicationJson(url, params = {}, request = {}) {
    let urlWithQueryParams = url;

    if (typeof params === 'object') {
      if (!isEmptyObject(params)) {
        urlWithQueryParams += DICOMwebClient._parseQueryParameters(params);
      }
    }
    const headers = { Accept: MEDIATYPES.DICOM_JSON };

    request.responseType = 'json';

    return this._httpGet(
      urlWithQueryParams,
      headers,
      request
    );
  }

  /**
   * Performs an HTTP GET request that accepts a message with application/pdf
   * media type.
   *
   * @param {String} url
   * @param {Object} params
   * @param {Request} request - Request Options
   * @return {*}
   * @private
   */
  _httpGetApplicationPdf(url, params = {}, request = {}) {
    let urlWithQueryParams = url;

    if (typeof params === 'object') {
      if (!isEmptyObject(params)) {
        urlWithQueryParams += DICOMwebClient._parseQueryParameters(params);
      }
    }
    const headers = { Accept: MEDIATYPES.PDF };

    request.responseType = 'json'

    return this._httpGet(
      urlWithQueryParams,
      headers,
      request,
    );
  }

  /**
   * Performs an HTTP GET request that accepts a message with an image
   media type.
   *
   * @param {String} url
   * @param {Object[]} mediaTypes
   * @param {Object} params
   * @param {Request} request - Request Options
   * @return {*}
   * @private
   */
  _httpGetImage(
    url,
    mediaTypes,
    params = {},
    request = {}
  ) {
    let urlWithQueryParams = url;

    if (typeof params === 'object') {
      if (!isEmptyObject(params)) {
        urlWithQueryParams += DICOMwebClient._parseQueryParameters(params);
      }
    }

    const supportedMediaTypes = [
      'image/',
      'image/*',
      'image/jpeg',
      'image/jp2',
      'image/gif',
      'image/png',
    ];

    const acceptHeaderFieldValue = DICOMwebClient._buildAcceptHeaderFieldValue(
      mediaTypes,
      supportedMediaTypes,
    );
    const headers = { Accept: acceptHeaderFieldValue };
    request.responseType = 'arraybuffer'

    return this._httpGet(
      urlWithQueryParams,
      headers,
      request,
    );
  }

  /**
   * Performs an HTTP GET request that accepts a message with a text
   media type.
   *
   * @param {String} url
   * @param {Object[]} mediaTypes
   * @param {Object} params
   * @param {Request} request - Request Options
   * @return {*}
   * @private
   */
  _httpGetText(
    url,
    mediaTypes,
    params = {},
    request = {}
  ) {
    let urlWithQueryParams = url;

    if (typeof params === 'object') {
      if (!isEmptyObject(params)) {
        urlWithQueryParams += DICOMwebClient._parseQueryParameters(params);
      }
    }

    const supportedMediaTypes = [
      'text/',
      'text/*',
      'text/html',
      'text/plain',
      'text/rtf',
      'text/xml',
    ];

    const acceptHeaderFieldValue = DICOMwebClient._buildAcceptHeaderFieldValue(
      mediaTypes,
      supportedMediaTypes,
    );
    const headers = { Accept: acceptHeaderFieldValue };
    request.responseType = 'arraybuffer';

    return this._httpGet(
      urlWithQueryParams,
      headers,
      request,
    );
  }

  /**
   * Performs an HTTP GET request that accepts a message with a video
   media type.
   *
   * @param {String} url
   * @param {Object[]} mediaTypes
   * @param {Object} params
   * @param {Request} request - Request Options
   * @return {*}
   * @private
   */
  _httpGetVideo(
    url,
    mediaTypes,
    params = {},
    request = {}
  ) {
    let urlWithQueryParams = url;

    if (typeof params === 'object') {
      if (!isEmptyObject(params)) {
        urlWithQueryParams += DICOMwebClient._parseQueryParameters(params);
      }
    }

    const supportedMediaTypes = [
      'video/',
      'video/*',
      'video/mpeg',
      'video/mp4',
      'video/H265',
    ];

    const acceptHeaderFieldValue = DICOMwebClient._buildAcceptHeaderFieldValue(
      mediaTypes,
      supportedMediaTypes,
    );
    const headers = { Accept: acceptHeaderFieldValue };
    request.responseType = 'arraybuffer';

    return this._httpGet(
      urlWithQueryParams,
      headers,
      request,
    );
  }

  /**
   * Asserts that a given media type is valid.
   *
   * @params {String} mediaType media type
   */
  static _assertMediaTypeIsValid(mediaType) {
    if (!mediaType) {
      throw new Error(`Not a valid media type: ${mediaType}`);
    }

    const sepIndex = mediaType.indexOf('/');
    if (sepIndex === -1) {
      throw new Error(`Not a valid media type: ${mediaType}`);
    }

    const mediaTypeType = mediaType.slice(0, sepIndex);
    const types = ['application', 'image', 'text', 'video'];
    if (!types.includes(mediaTypeType)) {
      throw new Error(`Not a valid media type: ${mediaType}`);
    }

    if (mediaType.slice(sepIndex + 1).includes('/')) {
      throw new Error(`Not a valid media type: ${mediaType}`);
    }
  }

  /**
   * Performs an HTTP GET request that accepts a multipart message with an image media type.
   *
   * @param {String} url - Unique resource locator
   * @param {Object[]} mediaTypes - Acceptable media types and optionally the UIDs of the
   corresponding transfer syntaxes
   * @param {Array} byteRange - Start and end of byte range
   * @param {Object} params - Additional HTTP GET query parameters
   * @param {Boolean} rendered - Whether resource should be requested using rendered media types
   * @param {Request} request - Request Options
   * @private
   * @returns {Promise<Array>} Content of HTTP message body parts
   */
  _httpGetMultipartImage(
    url,
    mediaTypes,
    byteRange,
    params,
    rendered = false,
    request = {}
  ) {
    const headers = {};
    let supportedMediaTypes;
    if (rendered) {
      supportedMediaTypes = [
        'image/jpeg',
        'image/gif',
        'image/png',
        'image/jp2',
      ];
    } else {
      supportedMediaTypes = {
        '1.2.840.10008.1.2.5': ['image/x-dicom-rle'],
        '1.2.840.10008.1.2.4.50': ['image/jpeg'],
        '1.2.840.10008.1.2.4.51': ['image/jpeg'],
        '1.2.840.10008.1.2.4.57': ['image/jpeg'],
        '1.2.840.10008.1.2.4.70': ['image/jpeg'],
        '1.2.840.10008.1.2.4.80': ['image/x-jls', 'image/jls'],
        '1.2.840.10008.1.2.4.81': ['image/x-jls', 'image/jls'],
        '1.2.840.10008.1.2.4.90': ['image/jp2'],
        '1.2.840.10008.1.2.4.91': ['image/jp2'],
        '1.2.840.10008.1.2.4.92': ['image/jpx'],
        '1.2.840.10008.1.2.4.93': ['image/jpx'],
      };

      if (byteRange) {
        headers.Range = DICOMwebClient._buildRangeHeaderFieldValue(byteRange);
      }
    }

    headers.Accept = DICOMwebClient._buildMultipartAcceptHeaderFieldValue(
      mediaTypes,
      supportedMediaTypes,
    );

    request.responseType = 'arraybuffer';

    return this._httpGet(url, headers, request);
  }

  /**
   * Performs an HTTP GET request that accepts a multipart message with a video media type.
   *
   * @param {String} url - Unique resource locator
   * @param {Object[]} mediaTypes - Acceptable media types and optionally the UIDs of the
   corresponding transfer syntaxes
   * @param {Array} byteRange - Start and end of byte range
   * @param {Object} params - Additional HTTP GET query parameters
   * @param {Boolean} rendered - Whether resource should be requested using rendered media types
   * @param {Request} request - Request Options
   * @private
   * @returns {Promise<Array>} Content of HTTP message body parts
   */
  _httpGetMultipartVideo(
    url,
    mediaTypes,
    byteRange,
    params,
    rendered = false,
    request = {}
  ) {
    const headers = {};
    let supportedMediaTypes;
    if (rendered) {
      supportedMediaTypes = [
        'video/',
        'video/*',
        'video/mpeg2',
        'video/mp4',
        'video/H265',
      ];
    } else {
      supportedMediaTypes = {
        '1.2.840.10008.1.2.4.100': ['video/mpeg2'],
        '1.2.840.10008.1.2.4.101': ['video/mpeg2'],
        '1.2.840.10008.1.2.4.102': ['video/mp4'],
        '1.2.840.10008.1.2.4.103': ['video/mp4'],
        '1.2.840.10008.1.2.4.104': ['video/mp4'],
        '1.2.840.10008.1.2.4.105': ['video/mp4'],
        '1.2.840.10008.1.2.4.106': ['video/mp4'],
      };

      if (byteRange) {
        headers.Range = DICOMwebClient._buildRangeHeaderFieldValue(byteRange);
      }
    }

    headers.Accept = DICOMwebClient._buildMultipartAcceptHeaderFieldValue(
      mediaTypes,
      supportedMediaTypes,
    );

    request.responseType = 'arraybuffer';

    return this._httpGet(url, headers, request);
  }

  /**
   * Performs an HTTP GET request that accepts a multipart message
   * with a application/dicom media type.
   *
   * @param {String} url - Unique resource locator
   * @param {Object[]} mediaTypes - Acceptable media types and optionally the UIDs of the
   corresponding transfer syntaxes
   * @param {Object} params - Additional HTTP GET query parameters
   * @param {Request} request - request options
   * @private
   * @returns {Promise<Array>} Content of HTTP message body parts
   */
  _httpGetMultipartApplicationDicom(
    url,
    mediaTypes,
    params,
    request = {}
  ) {
    const headers = {};
    const defaultMediaType = 'application/dicom';
    const supportedMediaTypes = {
      '1.2.840.10008.1.2.1': [defaultMediaType],
      '1.2.840.10008.1.2.5': [defaultMediaType],
      '1.2.840.10008.1.2.4.50': [defaultMediaType],
      '1.2.840.10008.1.2.4.51': [defaultMediaType],
      '1.2.840.10008.1.2.4.57': [defaultMediaType],
      '1.2.840.10008.1.2.4.70': [defaultMediaType],
      '1.2.840.10008.1.2.4.80': [defaultMediaType],
      '1.2.840.10008.1.2.4.81': [defaultMediaType],
      '1.2.840.10008.1.2.4.90': [defaultMediaType],
      '1.2.840.10008.1.2.4.91': [defaultMediaType],
      '1.2.840.10008.1.2.4.92': [defaultMediaType],
      '1.2.840.10008.1.2.4.93': [defaultMediaType],
      '1.2.840.10008.1.2.4.100': [defaultMediaType],
      '1.2.840.10008.1.2.4.101': [defaultMediaType],
      '1.2.840.10008.1.2.4.102': [defaultMediaType],
      '1.2.840.10008.1.2.4.103': [defaultMediaType],
      '1.2.840.10008.1.2.4.104': [defaultMediaType],
      '1.2.840.10008.1.2.4.105': [defaultMediaType],
      '1.2.840.10008.1.2.4.106': [defaultMediaType],
    };

    let acceptableMediaTypes = mediaTypes;
    if (!mediaTypes) {
      acceptableMediaTypes = [{ mediaType: defaultMediaType }];
    }

    headers.Accept = DICOMwebClient._buildMultipartAcceptHeaderFieldValue(
      acceptableMediaTypes,
      supportedMediaTypes,
    );

    request.responseType = 'arraybuffer';

    return this._httpGet(url, headers, request);
  }

  /**
   * Performs an HTTP GET request that accepts a multipart message
   * with a application/octet-stream, OR any of the equivalencies for that (eg
   * application/pdf etc)
   *
   * @param {String} url - Unique resource locator
   * @param {Object[]} mediaTypes - Acceptable media types and optionally the UIDs of the
   corresponding transfer syntaxes
   * @param {Array} byteRange start and end of byte range
   * @param {Object} params - Additional HTTP GET query parameters
   * @param {Request} request - Request Options
   * @private
   * @returns {Promise<Array>} Content of HTTP message body parts
   */
  _httpGetMultipartApplicationOctetStream(
    url,
    mediaTypes,
    byteRange,
    params,
    request = {}
  ) {
    const headers = {};
    const defaultMediaType = 'application/octet-stream';
    const supportedMediaTypes = {
      '1.2.840.10008.1.2.1': [...Object.values(MEDIATYPES)],
    };

    let acceptableMediaTypes = mediaTypes;
    if (!mediaTypes) {
      acceptableMediaTypes = [{ mediaType: defaultMediaType }];
    }

    if (byteRange) {
      headers.Range = DICOMwebClient._buildRangeHeaderFieldValue(byteRange);
    }

    headers.Accept = DICOMwebClient._buildMultipartAcceptHeaderFieldValue(
      acceptableMediaTypes,
      supportedMediaTypes,
    );

    request.responseType = 'arraybuffer'

    return this._httpGet(url, headers, request);
  }

  /**
   * Performs an HTTP POST request.
   *
   * @param {String} url - Unique resource locator
   * @param {Object} headers - HTTP header fields
   * @param {Array} data - Data that should be stored
   * @param {Request} request - Request Options
   * @private
   * @returns {Promise} Response
   */
  _httpPost(url, headers, data, request) {
    return this._httpRequest(url, 'post', headers, {
      ...request, data
    });
  }

  /**
   * Performs an HTTP POST request with content-type application/dicom+json.
   *
   * @param {String} url - Unique resource locator
   * @param {Object} headers - HTTP header fields
   * @param {Array} data - Data that should be stored
   * @param {Request} request - Request Options
   * @private
   * @returns {Promise} Response
   */
  _httpPostApplicationJson(url, data, request) {
    const headers = { 'Content-Type': MEDIATYPES.DICOM_JSON };
    return this._httpPost(
      url,
      headers,
      data,
      request,
    );
  }

  /**
   * Parses media type and extracts its type and subtype.
   *
   * @param {String} mediaType - HTTP media type (e.g. image/jpeg)
   * @private
   * @returns {String[]} Media type and subtype
   */
  static _parseMediaType(mediaType) {
    DICOMwebClient._assertMediaTypeIsValid(mediaType);

    return mediaType.split('/');
  }

  /**
   * Builds an accept header field value for HTTP GET request messages.
   *
   * @param {Object[]} mediaTypes - Acceptable media types
   * @param {Object[]} supportedMediaTypes - Supported media types
   * @return {*}
   * @private
   */
  static _buildAcceptHeaderFieldValue(mediaTypes, supportedMediaTypes) {
    if (!Array.isArray(mediaTypes)) {
      throw new Error('Acceptable media types must be provided as an Array');
    }

    const fieldValueParts = mediaTypes.map(item => {
      const { mediaType } = item;

      DICOMwebClient._assertMediaTypeIsValid(mediaType);
      if (!supportedMediaTypes.includes(mediaType)) {
        throw new Error(
          `Media type ${mediaType} is not supported for requested resource`,
        );
      }

      return mediaType;
    });

    return fieldValueParts.join(', ');
  }

  /**
   * Builds an accept header field value for HTTP GET multipart request
   * messages.  Will throw an exception if no media types are found which are acceptable,
   * but will only log a verbose level message when types are specified which are
   * not acceptable.  This allows requesting several types with having to know
   * whether they are all acceptable or not.
   *
   * @param {Object[]} mediaTypes - Acceptable media types
   * @param {Object[]} supportedMediaTypes - Supported media types
   * @private
   */
  static _buildMultipartAcceptHeaderFieldValue(
    mediaTypes,
    supportedMediaTypes,
  ) {
    if (!Array.isArray(mediaTypes)) {
      throw new Error('Acceptable media types must be provided as an Array');
    }

    if (!Array.isArray(supportedMediaTypes) && !isObject(supportedMediaTypes)) {
      throw new Error(
        'Supported media types must be provided as an Array or an Object',
      );
    }

    const fieldValueParts = [];

    mediaTypes.forEach(item => {
      const { transferSyntaxUID, mediaType } = item;
      DICOMwebClient._assertMediaTypeIsValid(mediaType);
      let fieldValue = `multipart/related; type="${mediaType}"`;

      if (isObject(supportedMediaTypes)) {
        // SupportedMediaTypes is a lookup table that maps Transfer Syntax UID
        // to one or more Media Types
        if (
          !Object.values(supportedMediaTypes)
            .flat(1)
            .includes(mediaType)
        ) {
          if (!mediaType.endsWith('/*') || !mediaType.endsWith('/')) {
            debugLog(
              `Media type ${mediaType} is not supported for requested resource`,
            );
            return;
          }
        }

        if (transferSyntaxUID) {
          if (transferSyntaxUID !== '*') {
            if (!Object.keys(supportedMediaTypes).includes(transferSyntaxUID)) {
              throw new Error(
                `Transfer syntax ${transferSyntaxUID} is not supported for requested resource`,
              );
            }

            const expectedMediaTypes = supportedMediaTypes[transferSyntaxUID];

            if (!expectedMediaTypes.includes(mediaType)) {
              const actualType = DICOMwebClient._parseMediaType(mediaType)[0];
              expectedMediaTypes.map(expectedMediaType => {
                const expectedType = DICOMwebClient._parseMediaType(
                  expectedMediaType,
                )[0];
                const haveSameType = actualType === expectedType;

                if (
                  haveSameType &&
                  (mediaType.endsWith('/*') || mediaType.endsWith('/'))
                ) {
                  return;
                }

                throw new Error(
                  `Transfer syntax ${transferSyntaxUID} is not supported for requested resource`,
                );
              });
            }
          }

          fieldValue += `; transfer-syntax=${transferSyntaxUID}`;
        }
      } else if (
        Array.isArray(supportedMediaTypes) &&
        !supportedMediaTypes.includes(mediaType)
      ) {
        if( this.verbose ) {
          console.warn(
            `Media type ${mediaType} is not supported for requested resource`,
          );
        }
        return;
      }

      fieldValueParts.push(fieldValue);
    });

    if( !fieldValueParts.length ) {
      throw new Error(`No acceptable media types found among ${JSON.stringify(mediaTypes)}`);
    }

    return fieldValueParts.join(', ');
  }

  /**
   * Builds a range header field value for HTTP GET request messages.
   *
   * @param {Array} byteRange - Start and end of byte range
   * @returns {String} Range header field value
   * @private
   */
  static _buildRangeHeaderFieldValue(byteRange = []) {
    if (byteRange.length === 1) {
      return `bytes=${byteRange[0]}-`;
    }
    if (byteRange.length === 2) {
      return `bytes=${byteRange[0]}-${byteRange[1]}`;
    }

    return 'bytes=0-';
  }

  /**
   * Gets types that are shared among acceptable media types.
   *
   * @param {Object[]} mediaTypes - Acceptable media types and optionally the UIDs of the
   corresponding transfer syntaxes
   * @private
   * @returns {String[]} Types that are shared among acceptable media types
   */
  static _getSharedMediaTypes(mediaTypes) {
    const types = new Set();

    if (!mediaTypes || !mediaTypes.length) {
      return types;
    }

    mediaTypes.forEach(item => {
      const { mediaType } = item;
      const type = DICOMwebClient._parseMediaType(mediaType)[0];
      types.add(`${type}/`);
    });

    return Array.from(types);
  }

  /**
   * Gets common base type of acceptable media types and asserts that only
   one type is specified. For example, ``("image/jpeg", "image/jp2")``
   will pass, but ``("image/jpeg", "video/mpeg2")`` will raise an
   exception.
   *
   * @param {Object[]} mediaTypes - Acceptable media types and optionally the UIDs of the
   corresponding transfer syntaxes
   * @private
   * @returns {String[]} Common media type, eg `image/` for the above example.
   */
  static _getCommonMediaType(mediaTypes) {
    if (!mediaTypes || !mediaTypes.length) {
      throw new Error('No acceptable media types provided');
    }

    const sharedMediaTypes = DICOMwebClient._getSharedMediaTypes(mediaTypes);
    if (sharedMediaTypes.length === 0) {
      throw new Error('No common acceptable media type could be identified.');
    } else if (sharedMediaTypes.length > 1) {
      throw new Error('Acceptable media types must have the same type.');
    }

    return sharedMediaTypes[0];
  }

  /**
   * Searches for DICOM studies.
   *
   * @param {Object} options
   * @param {Object} [options.queryParams] - HTTP query parameters
   * @param {Request} request - Request Options
   * @return {Object[]} Study representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2)
   */
  searchForStudies(options = {}) {
    debugLog('search for studies');
    let url = `${this.qidoURL}/studies`;
    if ('queryParams' in options) {
      url += DICOMwebClient._parseQueryParameters(options.queryParams);
    }
    const request = getRequestOptions(options.request)
    return this._httpGetApplicationJson(url, {}, request);
  }

  /**
   * Retrieves metadata for a DICOM study.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {Request} options.request - Request Options
   * @returns {Promise<InstanceMetadata[]>} Metadata elements in DICOM JSON format for each instance
                      belonging to the study
   */
  retrieveStudyMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error(
        'Study Instance UID is required for retrieval of study metadata',
      );
    }
    debugLog(`retrieve metadata of study ${options.studyInstanceUID}`);
    const url = `${this.wadoURL}/studies/${options.studyInstanceUID}/metadata`;
    const request =getRequestOptions(options.request)    
    return this._httpGetApplicationJson(url, {}, request);
  }

  /**
   * Searches for DICOM series.
   *
   * @param {Object} options
   * @param {String} [options.studyInstanceUID] - Study Instance UID
   * @param {Object} [options.queryParams] - HTTP query parameters
   * @param {Request} request - Request Options
   * @returns {Object[]} Series representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2a)
   */
  searchForSeries(options = {}) {
    let url = this.qidoURL;
    if ('studyInstanceUID' in options) {
      debugLog(`search series of study ${options.studyInstanceUID}`);
      url += `/studies/${options.studyInstanceUID}`;
    }
    url += '/series';
    if ('queryParams' in options) {
      url += DICOMwebClient._parseQueryParameters(options.queryParams);
    }
    
    const request = getRequestOptions(options.request)

    return this._httpGetApplicationJson(url, {}, request);
  }

  /**
   * Retrieves metadata for a DICOM series.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {Request} options.request - Request Options
   * @returns {Promise<InstanceMetadata[]>} Metadata elements in DICOM JSON format for each instance
                      belonging to the series
   */
  retrieveSeriesMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error(
        'Study Instance UID is required for retrieval of series metadata',
      );
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error(
        'Series Instance UID is required for retrieval of series metadata',
      );
    }

    debugLog(`retrieve metadata of series ${options.seriesInstanceUID}`);
    const url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${options.seriesInstanceUID}/metadata`;
    
    const request = getRequestOptions(options.request)
    return this._httpGetApplicationJson(url, {}, false, withCredentials);
  }

  /**
   * Searches for DICOM Instances.
   *
   * @param {Object} options
   * @param {String} [options.studyInstanceUID] - Study Instance UID
   * @param {String} [options.seriesInstanceUID] - Series Instance UID
   * @param {Object} [options.queryParams] - HTTP query parameters
   * @param {Request} [options.request] - Request Options
   * @returns {Object[]} Instance representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2b)
   */
  searchForInstances(options = {}) {
    let url = this.qidoURL;
    let withCredentials = false;
    if ('studyInstanceUID' in options) {
      url += `/studies/${options.studyInstanceUID}`;
      if ('seriesInstanceUID' in options) {
        debugLog(
          `search for instances of series ${options.seriesInstanceUID}`,
        );
        url += `/series/${options.seriesInstanceUID}`;
      } else {
        debugLog(
          `search for instances of study ${options.studyInstanceUID}`,
        );
      }
    } else {
      debugLog('search for instances');
    }
    url += '/instances';
    if ('queryParams' in options) {
      url += DICOMwebClient._parseQueryParameters(options.queryParams);
    }
    const request = getRequestOptions(options.request)
    return this._httpGetApplicationJson(url, {}, request);
  }

  /** Returns a WADO-URI URL for an instance
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {String} options.sopInstanceUID - SOP Instance UID
   * @returns {String} WADO-URI URL
   */
  buildInstanceWadoURIUrl(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required.');
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error('Series Instance UID is required.');
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error('SOP Instance UID is required.');
    }

    const contentType = options.contentType || MEDIATYPES.DICOM;
    const transferSyntax = options.transferSyntax || '*';
    const params = [];

    params.push('requestType=WADO');
    params.push(`studyUID=${options.studyInstanceUID}`);
    params.push(`seriesUID=${options.seriesInstanceUID}`);
    params.push(`objectUID=${options.sopInstanceUID}`);
    params.push(`contentType=${contentType}`);
    params.push(`transferSyntax=${transferSyntax}`);

    const paramString = params.join('&');

    return `${this.wadoURL}?${paramString}`;
  }

  /**
   * Retrieves metadata for a DICOM Instance.
   *
   * @param {Object} options object
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {String} options.sopInstanceUID - SOP Instance UID
   * @param {Request} request - Request Options
   * @returns {Promise<InstanceMetadata>} metadata elements in DICOM JSON format
   */
  retrieveInstanceMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error(
        'Study Instance UID is required for retrieval of instance metadata',
      );
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error(
        'Series Instance UID is required for retrieval of instance metadata',
      );
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error(
        'SOP Instance UID is required for retrieval of instance metadata',
      );
    }
    debugLog(`retrieve metadata of instance ${options.sopInstanceUID}`);
    const url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${options.seriesInstanceUID}/instances/${options.sopInstanceUID}/metadata`;
    
    const request = getRequestOptions(options.request)
    return this._httpGetApplicationJson(url, {}, request);
  }

  /**
   * Retrieves frames for a DICOM Instance.
   * @param {Object} options options object
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {String} options.sopInstanceUID - SOP Instance UID
   * @param {String} options.frameNumbers - One-based indices of Frame Items
   * @param {Request} options.request - Request Options
   * @returns {Array} frame items as byte arrays of the pixel data element
   */
  retrieveInstanceFrames(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error(
        'Study Instance UID is required for retrieval of instance frames',
      );
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error(
        'Series Instance UID is required for retrieval of instance frames',
      );
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error(
        'SOP Instance UID is required for retrieval of instance frames',
      );
    }
    if (!('frameNumbers' in options)) {
      throw new Error(
        'frame numbers are required for retrieval of instance frames',
      );
    }
    debugLog(
      `retrieve frames ${options.frameNumbers.toString()} of instance ${
        options.sopInstanceUID
      }`,
    );
    const url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${
      options.seriesInstanceUID
    }/instances/${
      options.sopInstanceUID
    }/frames/${options.frameNumbers.toString()}`;

    const { mediaTypes } = options;
    
    const request = getRequestOptions(options.request)

    if (!mediaTypes) {
      return this._httpGetMultipartApplicationOctetStream(
        url,
        false,
        false,
        false,
        request,
      );
    }

    const sharedMediaTypes = DICOMwebClient._getSharedMediaTypes(mediaTypes);
    if (sharedMediaTypes.length > 1) {
      /**
       * Enable request of frames that are stored either compressed
       * (image/* media type) or uncompressed (application/octet-stream
       * media type).
       */
      const supportedMediaTypes = {
        '1.2.840.10008.1.2.1': ['application/octet-stream'],
        '1.2.840.10008.1.2.5': ['image/x-dicom-rle'],
        '1.2.840.10008.1.2.4.50': ['image/jpeg'],
        '1.2.840.10008.1.2.4.51': ['image/jpeg'],
        '1.2.840.10008.1.2.4.57': ['image/jpeg'],
        '1.2.840.10008.1.2.4.70': ['image/jpeg'],
        '1.2.840.10008.1.2.4.80': ['image/x-jls', 'image/jls'],
        '1.2.840.10008.1.2.4.81': ['image/x-jls', 'image/jls'],
        '1.2.840.10008.1.2.4.90': ['image/jp2'],
        '1.2.840.10008.1.2.4.91': ['image/jp2'],
        '1.2.840.10008.1.2.4.92': ['image/jpx'],
        '1.2.840.10008.1.2.4.93': ['image/jpx'],
        '1.2.840.10008.1.2.4.201': ['image/jhc'],
        '1.2.840.10008.1.2.4.202': ['image/jhc'],
      };

      const headers = {
        Accept: DICOMwebClient._buildMultipartAcceptHeaderFieldValue(
          mediaTypes,
          supportedMediaTypes,
        ),
      };
      request.responseType = 'arraybuffer';
      return this._httpGet(url, headers, request);
    }

    const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);

    if (commonMediaType.startsWith('application')) {
      return this._httpGetMultipartApplicationOctetStream(
        url,
        mediaTypes,
        false,
        false,
        request,
      );
    }
    if (commonMediaType.startsWith('image')) {
      return this._httpGetMultipartImage(
        url,
        mediaTypes,
        false,
        false,
        false,
        request,
      );
    }
    if (commonMediaType.startsWith('video')) {
      return this._httpGetMultipartVideo(
        url,
        mediaTypes,
        false,
        false,
        false,
        request,
      );
    }

    throw new Error(
      `Media type ${commonMediaType} is not supported for retrieval of frames.`,
    );
  }

 /**
 * Element in mediaTypes parameter
 * @typedef {Object} MediaType
 * @param {String} [MediaType.mediaType] - ie 'image/jpeg', 'image/png'...
 */

  /**
   * Retrieves an individual, server-side rendered DICOM Instance.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {String} options.sopInstanceUID - SOP Instance UID
   * @param {MediaType[]} [options.mediaTypes] - Acceptable HTTP media types
   * @param {Object} [options.queryParams] - HTTP query parameters
   * @param {Request} [options.request] - Request Options - Request Options
   * @returns {Promise<ArrayBuffer>} Rendered DICOM Instance
   */
  retrieveInstanceRendered(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error(
        'Study Instance UID is required for retrieval of rendered instance',
      );
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error(
        'Series Instance UID is required for retrieval of rendered instance',
      );
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error(
        'SOP Instance UID is required for retrieval of rendered instance',
      );
    }

    let url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${options.seriesInstanceUID}/instances/${options.sopInstanceUID}/rendered`;

    const { mediaTypes, queryParams } = options;
    const headers = {};
    const request = getRequestOptions(options.request)

    if (!mediaTypes) {
      request.responseType = 'arraybuffer';
      if (queryParams) {
        url += DICOMwebClient._parseQueryParameters(queryParams);
      }
      return this._httpGet(
        url,
        headers,
        request,
      );
    }

    const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);
    if (commonMediaType.startsWith('image')) {
      return this._httpGetImage(
        url,
        mediaTypes,
        queryParams,
        request,
      );
    }
    if (commonMediaType.startsWith('video')) {
      return this._httpGetVideo(
        url,
        mediaTypes,
        queryParams,
        request
      );
    }
    if (commonMediaType.startsWith('text')) {
      return this._httpGetText(
        url,
        mediaTypes,
        queryParams,
        request,
      );
    }
    if (commonMediaType === MEDIATYPES.PDF) {
      return this._httpGetApplicationPdf(
        url,
        queryParams,
        request,
      );
    }

    throw new Error(
      `Media type ${commonMediaType} is not supported ` +
        'for retrieval of rendered instance.',
    );
  }

  /**
   * Retrieves a thumbnail of an DICOM Instance.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {String} options.sopInstanceUID - SOP Instance UID
   * @param {MediaType[]} [options.mediaTypes] - Acceptable HTTP media types
   * @param {Object} [options.queryParams] - HTTP query parameters
   * @param {Request} [options.request] - Request Options - Request Options
   * @returns {ArrayBuffer} Thumbnail
   */
  retrieveInstanceThumbnail(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error(
        'Study Instance UID is required for retrieval of rendered instance',
      );
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error(
        'Series Instance UID is required for retrieval of rendered instance',
      );
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error(
        'SOP Instance UID is required for retrieval of rendered instance',
      );
    }

    let url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${options.seriesInstanceUID}/instances/${options.sopInstanceUID}/thumbnail`;

    const { mediaTypes, queryParams } = options;
    const headers = {};
   
    const request = getRequestOptions(options.request)

    if (!mediaTypes) {
      request.responseType = 'arraybuffer';
      if (queryParams) {
        url += DICOMwebClient._parseQueryParameters(queryParams);
      }
      return this._httpGet(
        url,
        headers,
        request
      );
    }

    const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);
    if (commonMediaType.startsWith('image')) {
      return this._httpGetImage(
        url,
        mediaTypes,
        queryParams,
        request
      );
    }

    throw new Error(
      `Media type ${commonMediaType} is not supported ` +
        'for retrieval of rendered instance.',
    );
  }

  /**
   * Retrieves rendered frames for a DICOM Instance.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {String} options.sopInstanceUID - SOP Instance UID
   * @param {String} options.frameNumbers - One-based indices of Frame Items
   * @param {MediaType[]} [options.mediaTypes] - Acceptable HTTP media types
   * @param {Object} [options.queryParams] - HTTP query parameters
   * @param {Request} [options.request] - Request Options - Request Options
   * @returns {ArrayBuffer[]} Rendered Frame Items as byte arrays
   */
  retrieveInstanceFramesRendered(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error(
        'Study Instance UID is required for retrieval of rendered instance frames',
      );
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error(
        'Series Instance UID is required for retrieval of rendered instance frames',
      );
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error(
        'SOP Instance UID is required for retrieval of rendered instance frames',
      );
    }
    if (!('frameNumbers' in options)) {
      throw new Error(
        'frame numbers are required for retrieval of rendered instance frames',
      );
    }

    debugLog(
      `retrieve rendered frames ${options.frameNumbers.toString()} of instance ${
        options.sopInstanceUID
      }`,
    );
    let url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${
      options.seriesInstanceUID
    }/instances/${
      options.sopInstanceUID
    }/frames/${options.frameNumbers.toString()}/rendered`;

    const { mediaTypes, queryParams } = options;
    const headers = {};
    const request = getRequestOptions(options.request)

    if (!mediaTypes) {
      if (queryParams) {
        request.responseType = 'arraybuffer';
        url += DICOMwebClient._parseQueryParameters(queryParams);
      }
      return this._httpGet(url, headers, request);
    }

    const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);
    if (commonMediaType.startsWith('image')) {
      return this._httpGetImage(
        url,
        mediaTypes,
        queryParams,
        request
      );
    }
    if (commonMediaType.startsWith('video')) {
      return this._httpGetVideo(
        url,
        mediaTypes,
        queryParams,
        request
      );
    }

    throw new Error(
      `Media type ${commonMediaType} is not supported ` +
        'for retrieval of rendered frame.',
    );
  }

  /**
   * Retrieves thumbnail of frames for a DICOM Instance.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {String} options.sopInstanceUID - SOP Instance UID
   * @param {String} options.frameNumbers - One-based indices of Frame Items
   * @param {Object} [options.queryParams] - HTTP query parameters
   * @param {Request} [options.request] - Request Options - Request Options
   * @returns {ArrayBuffer[]} Rendered Frame Items as byte arrays
   */
  retrieveInstanceFramesThumbnail(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error(
        'Study Instance UID is required for retrieval of rendered instance frames',
      );
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error(
        'Series Instance UID is required for retrieval of rendered instance frames',
      );
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error(
        'SOP Instance UID is required for retrieval of rendered instance frames',
      );
    }
    if (!('frameNumbers' in options)) {
      throw new Error(
        'frame numbers are required for retrieval of rendered instance frames',
      );
    }

    console.debug(
      `retrieve rendered frames ${options.frameNumbers.toString()} of instance ${
        options.sopInstanceUID
      }`,
    );
    let url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${
      options.seriesInstanceUID
    }/instances/${
      options.sopInstanceUID
    }/frames/${options.frameNumbers.toString()}/thumbnail`;

    const { mediaTypes, queryParams } = options;
    const headers = {};
    const request = getRequestOptions(options.request);

    if (!mediaTypes) {
      request.responseType = 'arraybuffer';
      if (queryParams) {
        url += DICOMwebClient._parseQueryParameters(queryParams);
      }
      return this._httpGet(
        url,
        headers,
        request
      );
    }

    const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);
    if (commonMediaType.startsWith('image')) {
      return this._httpGetImage(
        url,
        mediaTypes,
        queryParams,
        request
      );
    }

    throw new Error(
      `Media type ${commonMediaType} is not supported ` +
        'for retrieval of rendered frame.',
    );
  }

  /**
   * Retrieves a DICOM Instance.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {String} options.sopInstanceUID - SOP Instance UID
   * @param {string[]} options.mediaTypes
   * @param {Request} options.request - Request Options
   * @returns {Promise<ArrayBuffer>} DICOM Part 10 file as Arraybuffer
   */
  retrieveInstance(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required');
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error('Series Instance UID is required');
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error('SOP Instance UID is required');
    }
    const url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${options.seriesInstanceUID}/instances/${options.sopInstanceUID}`;

    const { mediaTypes } = options;

    const request = getRequestOptions(options.request)

    if (!mediaTypes) {
      return this._httpGetMultipartApplicationDicom(
        url,
        false,
        false,
        request
      ).then(getFirstResult);
    }

    const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);
    if (commonMediaType === MEDIATYPES.DICOM) {
      return this._httpGetMultipartApplicationDicom(
        url,
        mediaTypes,
        false,
        request
      ).then(getFirstResult);
    }

    throw new Error(
      `Media type ${commonMediaType} is not supported for retrieval of instance.`,
    );
  }

  /**
   * Retrieves all DICOM Instances of a Series.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {String} options.seriesInstanceUID - Series Instance UID
   * @param {Request} options.request - Request Options
   * @returns {Promise<ArrayBuffer[]>} DICOM Instances
   */
  retrieveSeries(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required');
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error('Series Instance UID is required');
    }

    const url = `${this.wadoURL}/studies/${options.studyInstanceUID}/series/${options.seriesInstanceUID}`;

    const { mediaTypes } = options;
    const request = getRequestOptions(options.request)

    if (!mediaTypes) {
      return this._httpGetMultipartApplicationDicom(
        url,
        false,
        false,
        request
      );
    }

    const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);
    if (commonMediaType === MEDIATYPES.DICOM) {
      return this._httpGetMultipartApplicationDicom(
        url,
        mediaTypes,
        false,
        request
      );
    }

    throw new Error(
      `Media type ${commonMediaType} is not supported for retrieval of series.`,
    );
  }

  /**
   * Retrieves all DICOM Instances of a Study.
   *
   * @param {Object} options
   * @param {String} options.studyInstanceUID - Study Instance UID
   * @param {Request} options.request - Request Options
   * @returns {ArrayBuffer[]} DICOM Instances
   */
  retrieveStudy(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required');
    }

    const url = `${this.wadoURL}/studies/${options.studyInstanceUID}`;

    const { mediaTypes } = options;
    const request = getRequestOptions(options.request);

    if (!mediaTypes) {
      return this._httpGetMultipartApplicationDicom(
        url,
        false,
        false,
        request
      );
    }

    const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);
    if (commonMediaType === MEDIATYPES.DICOM) {
      return this._httpGetMultipartApplicationDicom(
        url,
        mediaTypes,
        false,
        request
      );
    }

    throw new Error(
      `Media type ${commonMediaType} is not supported for retrieval of study.`,
    );
  }

  /**
   * Retrieves and parses BulkData from a BulkDataURI location.
   * Decodes the multipart encoded data and returns the resulting data
   * as an ArrayBuffer.
   *
   * See http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.5.html
   *
   * @param {Object} options
   * @param {string} options.BulkDataURI to retrieve
   * @param {Array}  options.mediaTypes to use to fetch the URI
   * @param {string} options.byteRange to request a sub-range (only valid on single part)
   * @param {Request} options.request - Request Options
   * @returns {Promise<Array>} Bulkdata parts
   */
  retrieveBulkData(options) {
    if (!('BulkDataURI' in options)) {
      throw new Error('BulkDataURI is required.');
    }

    const url = options.BulkDataURI;
    const { mediaTypes, byteRange } = options;
    const request = getRequestOptions(options.request);

    if (this.singlepart.indexOf('bulkdata') !== -1) {
      request.responseType = 'arraybuffer';
      return this._httpGet(url, options.headers, request);
    }

    if (mediaTypes) {
      try {
        const commonMediaType = DICOMwebClient._getCommonMediaType(mediaTypes);

        if (commonMediaType==='image/') {
          return this._httpGetMultipartImage(
            url,
            mediaTypes,
            byteRange,
            false,
            false,
            progressCallback,
            withCredentials,
          );
        }
      } catch(e) {
        // No-op - this happens sometimes if trying to fetch the specific desired type but want to fallback to octet-stream
      }
    }

    // Just use the media types provided
    return this._httpGetMultipartApplicationOctetStream(
      url,
      mediaTypes,
      byteRange,
      false,
      request
    );
  }

  /**
   * Stores DICOM Instances.
   *
   * @param {Object} options
   * @param {ArrayBuffer[]} options.datasets - DICOM Instances in PS3.10 format
   * @param {String} [options.studyInstanceUID] - Study Instance UID
   * @param {Request} [options.request] - Request Options
   * @returns {Promise} Response message
   */
  storeInstances(options) {
    if (!('datasets' in options)) {
      throw new Error('datasets are required for storing');
    }

    let url = `${this.stowURL}/studies`;
    if ('studyInstanceUID' in options) {
      url += `/${options.studyInstanceUID}`;
    }

    const { data, boundary } = multipartEncode(options.datasets);
    const headers = {
      'Content-Type': `multipart/related; type="application/dicom"; boundary="${boundary}"`,
    };    

    const request = getRequestOptions(options.request);
    return this._httpPost(
      url,
      headers,
      data,
      request
    );
  }
}


export { DICOMwebClient };
export default DICOMwebClient;
