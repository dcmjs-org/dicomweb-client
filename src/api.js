import {
  containsToken,
  findToken,
  identifyBoundary,
  uint8ArrayToString,
  stringToUint8Array,
  multipartEncode,
  multipartDecode,
} from './message.js';

function isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

const getFirstResult = result => result[0];

const MIMETYPES = {
  DICOM: 'application/dicom',
  DICOM_JSON: 'application/dicom+json',
  OCTET_STREAM: 'application/octet-stream',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
};

/**
* Class for interacting with DICOMweb RESTful services.
*/
class DICOMwebClient {
  /**
  * @constructor
  * @param {Object} options (choices: "url", "username", "password", "headers")
  */
  constructor(options) {
    this.baseURL = options.url;
    if (!this.baseURL) {
      console.error('no DICOMweb base url provided - calls will fail');
    }

    if ('username' in options) {
      this.username = options.username;
      if (!('password' in options)) {
        console.error('no password provided to authenticate with DICOMweb service');
      }
      this.password = options.password;
    }

    if ('qidoURLPrefix' in options) {
      console.log(`use URL prefix for QIDO-RS: ${options.qidoURLPrefix}`);
      this.qidoURL = `${this.baseURL}/${options.qidoURLPrefix}`;
    } else {
      this.qidoURL = this.baseURL;
    }

    if ('wadoURLPrefix' in options) {
      console.log(`use URL prefix for WADO-RS: ${options.wadoURLPrefix}`);
      this.wadoURL = `${this.baseURL}/${options.wadoURLPrefix}`;
    } else {
      this.wadoURL = this.baseURL;
    }

    if ('stowURLPrefix' in options) {
      console.log(`use URL prefix for STOW-RS: ${options.stowURLPrefix}`);
      this.stowURL = `${this.baseURL}/${options.stowURLPrefix}`;
    } else {
      this.stowURL = this.baseURL;
    }

    this.headers = options.headers || {};
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

  _httpRequest(url, method, headers, options = {}) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(method, url, true);
      if ('responseType' in options) {
        request.responseType = options.responseType;
      }

      if (typeof (headers) === 'object') {
        Object.keys(headers).forEach((key) => {
          request.setRequestHeader(key, headers[key]);
        });
      }

      // now add custom headers from the user
      // (e.g. access tokens)
      const userHeaders = this.headers;
      Object.keys(userHeaders).forEach((key) => {
        request.setRequestHeader(key, userHeaders[key]);
      });

      // Event triggered when upload starts
      request.onloadstart = function (event) {
        // console.log('upload started: ', url)
      };

      // Event triggered when upload ends
      request.onloadend = function (event) {
        // console.log('upload finished')
      };

      // Handle response message
      request.onreadystatechange = function (event) {
        if (request.readyState === 4) {
          if (request.status === 200) {
            resolve(request.response);
          } else if (request.status === 202) {
            console.warn('some resources already existed: ', request);
            resolve(request.response);
          } else if (request.status === 204) {
            console.warn('empty response for request: ', request);
            resolve([]);
          } else {
            console.error('request failed: ', request);
            const error = new Error('request failed');
            error.request = request;
            error.response = request.response;
            error.status = request.status;
            console.error(error);
            console.error(error.response);

            reject(error);
          }
        }
      };

      // Event triggered while download progresses
      if ('progressCallback' in options) {
        if (typeof (options.progressCallback) === 'function') {
          request.onprogress = options.progressCallback;
        }
      }

      // request.onprogress = function (event) {
      //   const loaded = progress.loaded;
      //   let total;
      //   let percentComplete;
      //   if (progress.lengthComputable) {
      //     total = progress.total;
      //     percentComplete = Math.round((loaded / total) * 100);
      //   j
      //   // console.log('download progress: ', percentComplete, ' %');
      //   return(percentComplete);
      // };

      if ('data' in options) {
        request.send(options.data);
      } else {
        request.send();
      }
    });
  }

  _httpGet(url, headers, responseType, progressCallback) {
    return this._httpRequest(url, 'get', headers, { responseType, progressCallback });
  }

  _httpGetApplicationJson(url, params = {}, progressCallback) {
    if (typeof (params) === 'object') {
      if (!isEmptyObject(params)) {
        url += DICOMwebClient._parseQueryParameters(params);
      }
    }
    const headers = { Accept: MIMETYPES.DICOM_JSON };
    const responseType = 'json';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetByMimeType(url, mimeType, params, responseType = 'arraybuffer', progressCallback) {
    if (typeof (params) === 'object') {
      if (!isEmptyObject(params)) {
        url += DICOMwebClient._parseQueryParameters(params);
      }
    }

    const headers = {
      Accept: `multipart/related; type="${mimeType}"`,
    };

    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpPost(url, headers, data, progressCallback) {
    return this._httpRequest(url, 'post', headers, { data, progressCallback });
  }

  _httpPostApplicationJson(url, data, progressCallback) {
    const headers = { 'Content-Type': MIMETYPES.DICOM_JSON };
    return this._httpPost(url, headers, data, progressCallback);
  }

  /**
   * Searches for DICOM studies.
   * @param {Object} options options object
   * @return {Array} study representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2)
   */
  searchForStudies(options = {}) {
    console.log('search for studies');
    let url = `${this.qidoURL
    }/studies`;
    if ('queryParams' in options) {
      url += DICOMwebClient._parseQueryParameters(options.queryParams);
    }
    return (this._httpGetApplicationJson(url));
  }

  /**
   * Retrieves metadata for a DICOM study.
   * @param {Object} options options object
   * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the study
   */
  retrieveStudyMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required for retrieval of study metadata');
    }
    console.log(`retrieve metadata of study ${options.studyInstanceUID}`);
    const url = `${this.wadoURL
    }/studies/${options.studyInstanceUID
    }/metadata`;
    return (this._httpGetApplicationJson(url));
  }

  /**
   * Searches for DICOM series.
   * @param {Object} options options object
   * @returns {Array} series representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2a)
   */
  searchForSeries(options = {}) {
    let url = this.qidoURL;
    if ('studyInstanceUID' in options) {
      console.log(`search series of study ${options.studyInstanceUID}`);
      url += `/studies/${options.studyInstanceUID}`;
    }
    url += '/series';
    if ('queryParams' in options) {
      url += DICOMwebClient._parseQueryParameters(options.queryParams);
    }
    return (this._httpGetApplicationJson(url));
  }

  /**
   * Retrieves metadata for a DICOM series.
   * @param {Object} options options object
   * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the series
   */
  retrieveSeriesMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required for retrieval of series metadata');
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error('Series Instance UID is required for retrieval of series metadata');
    }

    console.log(`retrieve metadata of series ${options.seriesInstanceUID}`);
    const url = `${this.wadoURL
    }/studies/${options.studyInstanceUID
    }/series/${options.seriesInstanceUID
    }/metadata`;
    return (this._httpGetApplicationJson(url));
  }

  /**
   * Searches for DICOM instances.
   * @param {Object} options options object
   * @returns {Array} instance representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2b)
   */
  searchForInstances(options = {}) {
    let url = this.qidoURL;
    if ('studyInstanceUID' in options) {
      url += `/studies/${options.studyInstanceUID}`;
      if ('seriesInstanceUID' in options) {
        console.log(`search for instances of series ${options.seriesInstanceUID}`);
        url += `/series/${options.seriesInstanceUID}`;
      } else {
        console.log(`search for instances of study ${options.studyInstanceUID}`);
      }
    } else {
      console.log('search for instances');
    }
    url += '/instances';
    if ('queryParams' in options) {
      url += DICOMwebClient._parseQueryParameters(options.queryParams);
    }
    return (this._httpGetApplicationJson(url));
  }

  /** Returns a WADO-URI URL for an instance
   * @param {Object} options options object
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

    const contentType = options.contentType || MIMETYPES.DICOM;
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
   * Retrieves metadata for a DICOM instance.
   *
   * @param {Object} options object
   * @returns {Object} metadata elements in DICOM JSON format
   */
  retrieveInstanceMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required for retrieval of instance metadata');
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error('Series Instance UID is required for retrieval of instance metadata');
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error('SOP Instance UID is required for retrieval of instance metadata');
    }
    console.log(`retrieve metadata of instance ${options.sopInstanceUID}`);
    const url = `${this.wadoURL
    }/studies/${options.studyInstanceUID
    }/series/${options.seriesInstanceUID
    }/instances/${options.sopInstanceUID
    }/metadata`;

    return this._httpGetApplicationJson(url);
  }

  /**
   * Retrieves frames for a DICOM instance.
   * @param {Object} options options object
   * @returns {Array} frame items as byte arrays of the pixel data element
   */
  retrieveInstanceFrames(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required for retrieval of instance frames');
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error('Series Instance UID is required for retrieval of instance frames');
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error('SOP Instance UID is required for retrieval of instance frames');
    }
    if (!('frameNumbers' in options)) {
      throw new Error('frame numbers are required for retrieval of instance frames');
    }
    console.log(`retrieve frames ${options.frameNumbers.toString()} of instance ${options.sopInstanceUID}`);
    const url = `${this.wadoURL
    }/studies/${options.studyInstanceUID
    }/series/${options.seriesInstanceUID
    }/instances/${options.sopInstanceUID
    }/frames/${options.frameNumbers.toString()}`;

    const mimeType = options.mimeType ? `${options.mimeType}` : MIMETYPES.OCTET_STREAM;

    return this._httpGetByMimeType(url, mimeType).then(multipartDecode);
  }

  /**
   * Retrieves rendered frames for a DICOM instance.
   * @param {Object} options options object
   * @returns {Array} frame items as byte arrays of the pixel data element
   */
  retrieveInstanceFramesRendered(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required for retrieval of rendered instance frames');
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error('Series Instance UID is required for retrieval of rendered instance frames');
    }
    if (!('sopInstanceUID' in options)) {
      throw new Error('SOP Instance UID is required for retrieval of rendered instance frames');
    }
    if (!('frameNumbers' in options)) {
      throw new Error('frame numbers are required for retrieval of rendered instance frames');
    }

    console.log(`retrieve rendered frames ${options.frameNumbers.toString()} of instance ${options.sopInstanceUID}`);
    const url = `${this.wadoURL
    }/studies/${options.studyInstanceUID
    }/series/${options.seriesInstanceUID
    }/instances/${options.sopInstanceUID
    }/frames/${options.frameNumbers.toString()
    }/rendered`;

    const headers = {};
    // The choice of an acceptable media type depends on a variety of things:
    // http://dicom.nema.org/medical/dicom/current/output/chtml/part18/chapter_6.html#table_6.1.1-3
    if ('mimeType' in options) {
      headers.Accept = options.mimeType;
    }

    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType);
  }

  /**
   * Retrieves a DICOM instance.
   * @param {Object} options options object
   * @returns {Arraybuffer} DICOM Part 10 file as Arraybuffer
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
    const url = `${this.wadoURL
    }/studies/${options.studyInstanceUID
    }/series/${options.seriesInstanceUID
    }/instances/${options.sopInstanceUID}`;

    return this._httpGetByMimeType(url, MIMETYPES.DICOM)
      .then(multipartDecode)
      .then(getFirstResult);
  }

  /**
   * Retrieves a set of DICOM instance for a series.
   * @param {Object} options options object
   * @returns {Arraybuffer[]} Array of DICOM Part 10 files as Arraybuffers
   */
  retrieveSeries(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required');
    }
    if (!('seriesInstanceUID' in options)) {
      throw new Error('Series Instance UID is required');
    }
    const url = `${this.wadoURL
    }/studies/${options.studyInstanceUID
    }/series/${options.seriesInstanceUID}`;

    return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode);
  }

  /**
   * Retrieves a set of DICOM instance for a study.
   * @param {Object} options options object
   * @returns {Arraybuffer[]} Array of DICOM Part 10 files as Arraybuffers
   */
  retrieveStudy(options) {
    if (!('studyInstanceUID' in options)) {
      throw new Error('Study Instance UID is required');
    }

    const url = `${this.wadoURL
    }/studies/${options.studyInstanceUID}`;

    return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode);
  }

  /**
   * Retrieves and parses BulkData from a BulkDataURI location.
   * Decodes the multipart encoded data and returns the resulting data
   * as an ArrayBuffer.
   *
   * See http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.5.html
   *
   * @param {Object} options options object
   * @return {Promise}
   */
  retrieveBulkData(options) {
    if (!('BulkDataURI' in options)) {
      throw new Error('BulkDataURI is required.');
    }

    return this._httpGetByMimeType(options.BulkDataURI, MIMETYPES.OCTET_STREAM)
      .then(multipartDecode)
      .then(getFirstResult);
  }

  /**
   * Stores DICOM instances.
   *
   * @param {Object} options options object
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
      'Content-Type': `multipart/related; type=application/dicom; boundary=${boundary}`,
    };

    return this._httpPost(url, headers, data, options.progressCallback);
  }
}

export { DICOMwebClient };
