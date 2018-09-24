import {
  containsToken,
  findToken,
  identifyBoundary,
  uint8ArrayToString,
  stringToUint8Array,
  multipartEncode,
  multipartDecode
} from './message.js';

function isEmptyObject (obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

const getFirstResult = result => result[0];

const MIMETYPES = {
  DICOM: 'application/dicom',
  DICOM_JSON: 'application/dicom+json',
  OCTET_STREAM: 'application/octet-stream'
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
      console.error('DICOMweb base url provided - calls will fail')
    }

    if ('username' in options) {
      this.username = options.username;
      if (!('password' in options)) {
        console.error('no password provided to authenticate with DICOMweb service')
      }
      this.password = options.password;
    }

    this.headers = options.headers || {};
  }

  static _parseQueryParameters(params={}) {
    let queryString = '?';
    Object.keys(params).forEach(function (key, index) {
      if (index !== 0) {
        queryString += '&'
      }
      queryString += key + '=' + window.encodeURIComponent(params[key]);
    });
    return queryString
  }

  _httpRequest(url, method, headers, options={}) {
    return new Promise( (resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(method, url, true);
      if ('responseType' in options) {
        request.responseType = options.responseType;
      }

      if (typeof(headers) === 'object') {
        Object.keys(headers).forEach(function (key) {
          request.setRequestHeader(key, headers[key]);
        });
      }

      // now add custom headers from the user
      // (e.g. access tokens)
      const userHeaders = this.headers;
      Object.keys(userHeaders).forEach(function (key) {
        request.setRequestHeader(key, userHeaders[key]);
      });

      // Event triggered when upload starts
      request.onloadstart = function (event) {
        //console.log('upload started: ', url)
      };

      // Event triggered when upload ends
      request.onloadend = function (event) {
        //console.log('upload finished')
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
            error.status = status;
            console.error(error);
            console.error(error.response);
            console.error(window.location);

            reject(error);
          }
        }
      };

      // Event triggered while download progresses
      if ('progressCallback' in options) {
        if (typeof(options.progressCallback) === 'function') {
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
    return this._httpRequest(url, 'get', headers, {responseType, progressCallback});
  }

  _httpGetApplicationJson(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params)
      }
    }
    const headers = {'Accept': MIMETYPES.DICOM_JSON};
    const responseType = 'json';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetByMimeType(url, mimeType, params, responseType='arraybuffer', progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
        url += DICOMwebClient._parseQueryParameters(params)
      }
    }

    const headers = {
      'Accept': `multipart/related; type="${mimeType}"`
    };

    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpPost(url, headers, data, progressCallback) {
    return this._httpRequest(url, 'post', headers, {data, progressCallback});
  }

  _httpPostApplicationJson(url, data, progressCallback) {
    const headers = {'Content-Type': MIMETYPES.DICOM_JSON};
    return this._httpPost(url, headers, data, progressCallback);
  }

  /**
   * Searches for DICOM studies.
   * @param {Object} options options object - "queryParams" optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
   * @return {Array} study representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2)
   */
  searchForStudies(options={}) {
    console.log('search for studies');
    let url = this.baseURL +
              '/studies';
    if ('queryParams' in options) {
        url += DICOMwebClient._parseQueryParameters(options.queryParams);
    }
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Retrieves metadata for a DICOM study.
   * @param {String} studyInstanceUID Study Instance UID
   * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the study
   */
  retrieveStudyMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      console.error('Study Instance UID is required for retrieval of study metadata')
    }
    console.log(`retrieve metadata of study ${options.studyInstanceUID}`);
    const url = this.baseURL +
              '/studies/' + options.studyInstanceUID +
              '/metadata';
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Searches for DICOM series.
   * @param {Object} options optional DICOM identifiers (choices: "studyInstanceUID")
   * @param {Object} queryParams optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
   * @returns {Array} series representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2a)
   */
  searchForSeries(options={}) {
    let url = this.baseURL;
    if ('studyInstanceUID' in options) {
      console.log(`search series of study ${options.studyInstanceUID}`);
      url += '/studies/' + options.studyInstanceUID;
    }
    url += '/series';
    if ('queryParams' in options) {
        url += DICOMwebClient._parseQueryParameters(options.queryParams);
    }
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Retrieves metadata for a DICOM series.
   * @param {String} studyInstanceUID Study Instance UID
   * @param {String} seriesInstanceUID Series Instance UID
   * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the series
   */
  retrieveSeriesMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      console.error('Study Instance UID is required for retrieval of series metadata')
    }
    if (!('seriesInstanceUID' in options)) {
      console.error('Series Instance UID is required for retrieval of series metadata')
    }

    console.log(`retrieve metadata of series ${options.seriesInstanceUID}`);
    const url = this.baseURL +
      '/studies/' + options.studyInstanceUID +
      '/series/' + options.seriesInstanceUID +
      '/metadata';
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Searches for DICOM instances.
   * @param {Object} options optional DICOM identifiers (choices: "studyInstanceUID", "seriesInstanceUID")
   * @param {Object} queryParams optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
   * @returns {Array} instance representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2b)
   */
  searchForInstances(options={}) {
    let url = this.baseURL;
    if ('studyInstanceUID' in options) {
      url += '/studies/' + options.studyInstanceUID;
      if ('seriesInstanceUID' in options) {
        console.log(`search for instances of series ${options.seriesInstanceUID}`);
        url += '/series/' + options.seriesInstanceUID;
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
    return(this._httpGetApplicationJson(url));
  }

  /** Returns a WADO-URI URL for an instance
   *
   * @param {Object} options
   * @returns {String} WADO-URI URL
   */
  buildInstanceWadoURIUrl(options) {
    if (!('studyInstanceUID' in options)) {
      console.error('Study Instance UID is required.')
    }
    if (!('seriesInstanceUID' in options)) {
      console.error('Series Instance UID is required.')
    }
    if (!('sopInstanceUID' in options)) {
      console.error('SOP Instance UID is required.')
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

    return `${this.baseURL}?${paramString}`;
  }

  /**
   * Retrieves metadata for a DICOM instance.
   * @param {String} studyInstanceUID Study Instance UID
   * @param {String} seriesInstanceUID Series Instance UID
   * @param {String} sopInstanceUID SOP Instance UID
   * @returns {Object} metadata elements in DICOM JSON format
   */
  retrieveInstanceMetadata(options) {
    if (!('studyInstanceUID' in options)) {
      console.error('Study Instance UID is required for retrieval of instance metadata')
    }
    if (!('seriesInstanceUID' in options)) {
      console.error('Series Instance UID is required for retrieval of instance metadata')
    }
    if (!('sopInstanceUID' in options)) {
      console.error('SOP Instance UID is required for retrieval of instance metadata')
    }
    console.log(`retrieve metadata of instance ${options.sopInstanceUID}`);
    const url = this.baseURL +
      '/studies/' + options.studyInstanceUID +
      '/series/' + options.seriesInstanceUID +
      '/instances/' + options.sopInstanceUID +
      '/metadata';

    return this._httpGetApplicationJson(url);
  }

  /**
   * Retrieves frames for a DICOM instance.
   * @param {String} studyInstanceUID Study Instance UID
   * @param {String} seriesInstanceUID Series Instance UID
   * @param {String} sopInstanceUID SOP Instance UID
   * @param {Array} frameNumbers one-based index of frames
   * @param {Object} options optional parameters (key "imageSubtype" to specify MIME image subtypes)
   * @returns {Array} frame items as byte arrays of the pixel data element
   */
  retrieveInstanceFrames(options) {
    if (!('studyInstanceUID' in options)) {
      console.error('Study Instance UID is required for retrieval of instance metadata')
    }
    if (!('seriesInstanceUID' in options)) {
      console.error('Series Instance UID is required for retrieval of instance metadata')
    }
    if (!('sopInstanceUID' in options)) {
      console.error('SOP Instance UID is required for retrieval of instance metadata')
    }
    if (!('frameNumbers' in options)) {
      console.error('frame numbers are required for retrieval of instance frames')
    }
    console.log(`retrieve frames ${options.frameNumbers.toString()} of instance ${options.sopInstanceUID}`)
    const url = this.baseURL +
      '/studies/' + options.studyInstanceUID +
      '/series/' + options.seriesInstanceUID +
      '/instances/' + options.sopInstanceUID +
      '/frames/' + options.frameNumbers.toString();


    // TODO: Easier if user just provided mimetype directly? What is the benefit of adding 'image/'?
    const mimeType = options.imageSubType ? `image/${options.imageSubType}` : MIMETYPES.OCTET_STREAM;

    return this._httpGetByMimeType(url, mimeType).then(multipartDecode);
  }

  /**
   * Retrieves a DICOM instance.
   *
   * @param {String} studyInstanceUID Study Instance UID
   * @param {String} seriesInstanceUID Series Instance UID
   * @param {String} sopInstanceUID SOP Instance UID
   * @returns {Arraybuffer} DICOM Part 10 file as Arraybuffer
   */
  retrieveInstance(options) {
    if (!('studyInstanceUID' in options)) {
      console.error('Study Instance UID is required')
    }
    if (!('seriesInstanceUID' in options)) {
      console.error('Series Instance UID is required')
    }
    if (!('sopInstanceUID' in options)) {
      console.error('SOP Instance UID is required')
    }
    const url = this.baseURL +
      '/studies/' + options.studyInstanceUID +
      '/series/' + options.seriesInstanceUID +
      '/instances/' + options.sopInstanceUID;

    return this._httpGetByMimeType(url, MIMETYPES.DICOM)
        .then(multipartDecode)
        .then(getFirstResult);
  }

  /**
   * Retrieves a set of DICOM instance for a series.
   *
   * @param {String} studyInstanceUID Study Instance UID
   * @param {String} seriesInstanceUID Series Instance UID
   * @returns {Arraybuffer[]} Array of DICOM Part 10 files as Arraybuffers
   */
  retrieveSeries(options) {
    if (!('studyInstanceUID' in options)) {
      console.error('Study Instance UID is required')
    }
    if (!('seriesInstanceUID' in options)) {
      console.error('Series Instance UID is required')
    }
    const url = this.baseURL +
      '/studies/' + options.studyInstanceUID +
      '/series/' + options.seriesInstanceUID;

    return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode);
  }

  /**
   * Retrieves a set of DICOM instance for a study.
   *
   * @param {String} studyInstanceUID Study Instance UID
   * @returns {Arraybuffer[]} Array of DICOM Part 10 files as Arraybuffers
   */
  retrieveStudy(options) {
    if (!('studyInstanceUID' in options)) {
      console.error('Study Instance UID is required')
    }

    const url = this.baseURL +
      '/studies/' + options.studyInstanceUID;

    return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode);
  }

  /**
   * Retrieve and parse BulkData from a BulkDataURI location.
   * Decodes the multipart encoded data and returns the resulting data
   * as an ArrayBuffer.
   *
   * See http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.5.html
   *
   * @param {Object} options
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
   * @param {Array} datasets DICOM datasets of instances that should be stored in DICOM JSON format
   * @param {Object} options optional parameters (key "studyInstanceUID" to only store instances of a given study)
   */
  storeInstances(options) {
    if (!('datasets' in options)) {
      console.error('datasets are required for storing')
    }

    let url = `${this.baseURL}/studies`;
    if ('studyInstanceUID' in options) {
      url += `/${options.studyInstanceUID}`;
    }

    const { data, boundary } = multipartEncode(options.datasets);
    const headers = {
      'Content-Type': `multipart/related; type=application/dicom; boundary=${boundary}`
    };

    return this._httpPost(url, headers, data, options.progressCallback);
  }
}

export { DICOMwebClient };
