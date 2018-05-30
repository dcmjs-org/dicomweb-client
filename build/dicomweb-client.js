(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.DICOMwebClient = {})));
}(this, (function (exports) { 'use strict';

/**
 * Converts a Uint8Array to a String.
 * @param {Uint8Array} array that should be converted
 * @param {Number} offset array offset in case only subset of array items should be extracted (default: 0)
 * @param {Number} limit maximum number of array items that should be extracted (defaults to length of array)
 * @returns {String}
 */
function uint8ArrayToString(arr, offset, limit) {
  offset = offset || 0;
  limit = limit || arr.length - offset;
  let str = '';
  for (let i = offset; i < offset + limit; i++) {
    str += String.fromCharCode(arr[i]);
  }
  return str;
}


/**
 * Converts a String to a Uint8Array.
 * @param {String} str string that should be converted
 * @returns {Uint8Array}
 */
function stringToUint8Array(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0, j = str.length; i < j; i++) {
    arr[i] = str.charCodeAt(i);
  }
  return arr;
}


/**
 * Identifies the boundary in a multipart/related message header.
 * @param {String} header message header
 * @returns {String} boundary
 */
function identifyBoundary(header) {
  const parts = header.split('\r\n');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].substr(0, 2) === '--') {
      return parts[i];
    }
  }
}


/**
 * Checks whether a given token is contained by a message at a given offset.
 * @param {Uint8Array} message message content
 * @param {Uint8Array} token substring that should be present
 * @param {String} offset offset in message content from where search should start
 * @returns {Boolean} whether message contains token at offset
 */
function containsToken(message, token, offset) {
  if (message + token.length > message.length) {
    return false;
  }
  let index = offset;
  for (let i = 0; i < token.length; i++) {
    if (token[i] !== message[index++]) {
      return false;
    }
  }
  return true;
}


/**
 * Finds a given token in a message at a given offset.
 * @param {Uint8Array} message message content
 * @param {Uint8Array} token substring that should be found
 * @param {String} offset message body offset from where search should start
 * @returns {Boolean} whether message has a part at given offset or not
 */
function findToken(message, token, offset) {
  offset = offset || 0;
  for (let i = offset; i < message.length; i++) {
    if (token[0] === message[i]) {
      if (containsToken(message, token, i)) {
        return i;
      }
    }
  }
  return -1;
}

function isEmptyObject (obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
* Class for interacting with DICOMweb RESTful services.
*/
class DICOMwebClient {

  /**
  * @constructor
  * @param {Object} options (choices: "url", "username", "password")
  */
  constructor(options) {
    this.baseURL = options.url;
    if ('username' in options) {
      this.username = options.username;
      if (!('password' in options)) {
        console.error('no password provided to authenticate with DICOMweb service');
      }
      this.password = options.password;
    }
  }

  static _parseQueryParameters(params={}) {
    let queryString = '?';
    Object.keys(params).forEach(function (key, index) {
      if (index !== 0) {
        queryString += '&';
      }
      queryString += key + '=' + window.encodeURIComponent(params[key]);
    });
    return queryString
  }

  _httpRequest(url, method, headers, responseType, progressCallback) {
    return new Promise( (resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(method, url, true);
      request.responseType = responseType;

      if (typeof(headers) === 'object') {
        Object.keys(headers).forEach(function (key) {
          request.setRequestHeader(key, headers[key]);
        });
      }

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
            reject(request);
          }
        }
      };

      // Event triggered while download progresses
      if (typeof(progressCallback) === 'function') {
          request.onprogress = progressCallback();
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

      request.send();
    });
  }

  _httpGet(url, headers, responseType, progressCallback) {
    return this._httpRequest(url, 'get', headers, responseType, progressCallback);
  }

  _httpGetApplicationJson(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params);
      }
    }
    const headers = {'Accept': 'application/dicom+json'};
    const responseType = 'json';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetApplicationOctetStream(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params);
      }
    }
    const headers = {'Accept': 'multipart/related; type="application/octet-stream"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetImageJpeg(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params);
      }
    }
    const headers = {'Accept': 'multipart/related; type="image/jpeg"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetImageJpeg2000(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params);
      }
    }
    const headers = {'Accept': 'multipart/related; type="image/jp2"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetImageJpegLs(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params);
      }
    }
    const headers = {'Accept': 'multipart/related; type="image/x-jls"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpPost(url, headers, responseType, progressCallback) {
    return this._httpRequest(url, 'post', headers, responseType, progressCallback);
  }

  _httpPostApplicationDicom(url, progressCallback) {
    const headers = {
      'Content-Type': 'application/dicom',
      'Accept': 'application/dicom+json'
    };
    const responseType = 'json';
    return this._httpPost(url, headers, responseType, progressCallback);
  }

  /**
   * Searches for DICOM studies.
   * @param {Object} queryParams optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
   * @return {Array} study representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2)
   */
  searchForStudies(queryParams={}) {
    console.log('search for studies');
    let url = this.baseURL +
              '/studies';
    if (queryParams) {
        url += DICOMwebClient._parseQueryParameters(queryParams);
    }
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Retrieves metadata for a DICOM study.
   * @param {String} studyInstanceUID Study Instance UID
   * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the study
   */
  retrieveStudyMetadata(studyInstanceUID, queryParams={}) {
    console.log(`retrieve metadata of study ${studyInstanceUID}`);
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/metadata';
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Searches for DICOM series.
   * @param {Object} options optional DICOM identifiers (choices: "studyInstanceUID")
   * @param {Object} queryParams optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
   * @returns {Array} series representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2a)
   */
  searchForSeries(options={}, queryParams={}) {
    console.log(`search series of study ${options.studyInstanceUID}`);
    let url = this.baseURL;
    if ('studyInstanceUID' in options) {
        url += '/studies/' + options.studyInstanceUID;
    }
    url += '/series';
    if (options.queryParams) {
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
  retrieveSeriesMetadata(studyInstanceUID, seriesInstanceUID) {
    console.log(`retrieve metadata of series ${seriesInstanceUID}`);
    if (studyInstanceUID === undefined) {
      console.error('Study Instance UID is required for retrieval of series metadata');
    }
    if (seriesInstanceUID === undefined) {
      console.error('Series Instance UID is required for retrieval of series metadata');
    }
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/series/' + seriesInstanceUID +
              '/metadata';
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Searches for DICOM instances.
   * @param {Object} options optional DICOM identifiers (choices: "studyInstanceUID", "seriesInstanceUID")
   * @param {Object} queryParams optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
   * @returns {Array} instance representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2b)
   */
  searchForInstances(options={}, queryParams={}) {
    let url = this.baseURL;
    if ('studyInstanceUID' in options) {
      url += '/studies/' + options.studyInstanceUID;
      if ('seriesInstanceUID' in options) {
        console.log(`search for instances of series ${options.seriesInstanceUID}`);
        url += '/series/' + options.seriesInstanceUID;
      } else {
        console.error('study needs to be specified when searching for instances of a given series');
      }
    } else {
      console.log('search for instances');
    }
    url += '/instances';
    if (queryParams) {
        url += DICOMwebClient._parseQueryParameters(queryParams);
    }
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Retrieves metadata for a DICOM instance.
   * @param {String} studyInstanceUID Study Instance UID
   * @param {String} seriesInstanceUID Series Instance UID
   * @param {String} sopInstanceUID SOP Instance UID
   * @returns {Object} metadata elements in DICOM JSON format
   */
  retrieveInstanceMetadata(studyInstanceUID, seriesInstanceUID, sopInstanceUID) {
    console.log(`retrieve metadata of instance ${sopInstanceUID}`);
    if (studyInstanceUID === undefined) {
      console.error('Study Instance UID is required for retrieval of instance metadata');
    }
    if (seriesInstanceUID === undefined) {
      console.error('Series Instance UID is required for retrieval of instance metadata');
    }
    if (sopInstanceUID === undefined) {
      console.error('SOP Instance UID is required for retrieval of instance metadata');
    }
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/series/' + seriesInstanceUID +
              '/instances/' + sopInstanceUID +
              '/metadata';
    return(this._httpGetApplicationJson(url));
  }

  /**
   * Retrieves frames for a DICOM instance.
   * @param {String} studyInstanceUID Study Instance UID
   * @param {String} seriesInstanceUID Series Instance UID
   * @param {String} sopInstanceUID SOP Instance UID
   * @param {Array} frameNumbers one-based index of frames
   * @param {Object} options options (key "imageSubtype" to specify MIME image subtypes)
   * @returns {Array} frame items as byte arrays of the pixel data element
   */
  retrieveInstanceFrames(studyInstanceUID, seriesInstanceUID, sopInstanceUID, frameNumbers, options={}) {
    console.log(`retrieve frames ${frameNumbers.toString()} of instance ${sopInstanceUID}`);
    if (studyInstanceUID === undefined) {
      console.error('Study Instance UID is required for retrieval of instance frames');
    }
    if (seriesInstanceUID === undefined) {
      console.error('Series Instance UID is required for retrieval of instance frames');
    }
    if (sopInstanceUID === undefined) {
      console.error('SOP Instance UID is required for retrieval of instance frames');
    }
    if (frameNumbers === undefined) {
      console.error('frame numbers are required for retrieval of instance frames');
    }
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/series/' + seriesInstanceUID +
              '/instances/' + sopInstanceUID +
              '/frames/' + frameNumbers.toString();
    options.imageSubtype = options.imageSubtype || undefined;
    var func = this._httpGetApplicationOctetStream;
    if (options.imageSubtype) {
        if (options.imageSubtype === 'jpeg') {
            func = this._httpGetImageJpeg;
        } else if (options.imageSubtype === 'x-jls') {
            func = this._httpGetImageJpeg2000;
        } else if (options.imageSubtype === 'jp2') {
            func = this._httpGetImageJpeg2000;
        } else {
            console.error(`MIME type "image/${options.imageSubtype}" is not supported`);
        }
    }

    // FIXME
    return(this._httpGetImageJpeg(url).then((response) => {
      const message = new Uint8Array(response);

      // First look for the multipart mime header
      let separator = stringToUint8Array('\r\n\r\n');
      const headerIndex = findToken(message, separator);
      if (headerIndex === -1) {
        console.error('response message has no multipart mime header');
      }
      const header = uint8ArrayToString(message, 0, headerIndex);

      const boundary = identifyBoundary(header);
      if (!boundary) {
        console.error('header of response message does not specify boundary');
      }

      var frames = [];
      var offset = headerIndex + separator.length;
      for (let i = 0; i < frameNumbers.length; i++) {
        let boundaryIndex = findToken(message, boundary, offset);
        let length = boundaryIndex - offset - 2; // exclude "\r\n"

        // Extract pixel data from response message
        let pixels = response.slice(offset, offset + length);
        frames.push(pixels);

        offset += length + 2;
      }
      return frames;

    }));
  }

  /**
   * Stores DICOM instances.
   * @param {String} studyInstanceUID Study Instance UID (optional)
   */
  storeInstances(studyInstanceUID) {
    let url = this.baseURL;
    if (studyInstanceUID !== undefined) {
      url += '/studies/' + studyInstanceUID;
    }
    console.error('storing instances is not yet implemented');
  }

}

function findSubstring(str, before, after) {
    const beforeIndex = str.lastIndexOf(before) + before.length;
    if (beforeIndex < before.length) {
        console.warn(`substring not found in "${str}"`);
        return(null);
    }
    if (after !== undefined) {
        const afterIndex = str.lastIndexOf(after);
        if (afterIndex < 0) {
            console.warn(`substring not found in "${str}"`);
            return(null);
        } else{
            return(str.substring(beforeIndex, afterIndex));
        }
    }
    return(str.substring(beforeIndex));
}


function getStudyInstanceUIDFromUri(uri) {
  var uid = findSubstring(uri, "studies/", "/series");
  if (!uid) {
    var uid = findSubstring(uri, "studies/");
  }
  if (!uid) {
    console.warn('Study Instance UID could not be dertermined from URI "' + uri + '"');
  }
  return(uid);
}


function getSeriesInstanceUIDFromUri(uri) {
  var uid = findSubstring(uri, "series/", "/instances");
  if (!uid) {
    var uid = findSubstring(uri, "series/");
  }
  if (!uid) {
    console.warn('Series Instance UID could not be dertermined from URI"' + uri + '"');
  }
  return(uid);
}


function getSOPInstanceUIDFromUri(uri) {
  var uid = findSubstring(uri, "/instances/", "/frames");
  if (!uid) {
    var uid = findSubstring(uri, "/instances/", "/metadata");
  }
  if (!uid) {
    var uid = findSubstring(uri, "/instances/");
  }
  if (!uid) {
    console.warn('SOP Instance UID could not be dertermined from URI"' + uri + '"');
  }
  return(uid);
}


function getFrameNumbersFromUri(uri) {
  let numbers = findSubstring(uri, "/frames/");
  if (numbers === undefined) {
    console.warn('Frames Numbers could not be dertermined from URI"' + uri + '"');
  }
  return(numbers.split(','));
}

let api = {
  DICOMwebClient,
};
let utils = {
  getStudyInstanceUIDFromUri,
  getSeriesInstanceUIDFromUri,
  getSOPInstanceUIDFromUri,
  getFrameNumbersFromUri
};

exports.api = api;
exports.utils = utils;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=dicomweb-client.js.map
