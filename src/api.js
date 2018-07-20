import * as Ajv from "ajv";

import 'xhr2';

const ajv = new Ajv.default({ allErrors:true, removeAdditional:'all' })
import wadoRsRetrieveMetadata from '../schema/WADO-RS-RetrieveMetadata.json'

ajv.addSchema(wadoRsRetrieveMetadata, 'wadoRsRetrieveMetadata');

import {
  containsToken, findToken, identifyBoundary,
  uint8ArrayToString, stringToUint8Array
} from './message.js';

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
        console.error('no password provided to authenticate with DICOMweb service')
      }
      this.password = options.password;
    }
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
      if ('progressCallback' in options) {
        if (typeof(options.progressCallback) === 'function') {
          request.onprogress = options.progressCallback();
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
    const headers = {'Accept': 'application/dicom+json'};
    const responseType = 'json';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetApplicationOctetStream(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params)
      }
    }
    const headers = {'Accept': 'multipart/related; type="application/octet-stream"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetImageJpeg(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params)
      }
    }
    const headers = {'Accept': 'multipart/related; type="image/jpeg"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetImageJpeg2000(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params)
      }
    }
    const headers = {'Accept': 'multipart/related; type="image/jp2"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpGetImageJpegLs(url, params={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params)
      }
    }
    const headers = {'Accept': 'multipart/related; type="image/x-jls"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType, progressCallback);
  }

  _httpPost(url, headers, data, progressCallback) {
    return this._httpRequest(url, 'post', headers, {data, progressCallback});
  }

  _httpPostApplicationDicom(url, data, progressCallback) {
    const headers = {'Content-Type': 'application/dicom'};
    return this._httpPost(url, headers, data, progressCallback);
  }

  _httpPostApplicationJson(url, data, progressCallback) {
    const headers = {'Content-Type': 'application/dicom+json'};
    return this._httpPost(url, headers, data, progressCallback);
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
    const schemaName = 'wadoRsRetrieveMetadata';

    const valid = ajv.validate(schemaName, {
      studyInstanceUID,
      queryParams
    });

    if (!valid) {
      throw new Error(`Invalid Arguments: ${ajv.errorsText()}`);
    }

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
    const valid = ajv.validate(schemaName, {
      studyInstanceUID,
      seriesInstanceUID,
      queryParams
    });

    if (!valid) {
      throw new Error(`Invalid Arguments: ${ajv.errorsText()}`);
    }

    console.log(`retrieve metadata of series ${seriesInstanceUID}`);    
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
    const valid = ajv.validate(schemaName, {
      studyInstanceUID,
      seriesInstanceUID,
      sopInstanceUID,
      queryParams
    });

    if (!valid) {
      throw new Error(`Invalid Arguments: ${ajv.errorsText()}`);
    }

    console.log(`retrieve metadata of instance ${sopInstanceUID}`);
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
   * @param {Object} options optionial parameters (key "imageSubtype" to specify MIME image subtypes)
   * @returns {Array} frame items as byte arrays of the pixel data element
   */
  retrieveInstanceFrames(studyInstanceUID, seriesInstanceUID, sopInstanceUID, frameNumbers, options={}) {
    console.log(`retrieve frames ${frameNumbers.toString()} of instance ${sopInstanceUID}`);
    if (studyInstanceUID === undefined) {
      console.error('Study Instance UID is required for retrieval of instance frames')
    }
    if (seriesInstanceUID === undefined) {
      console.error('Series Instance UID is required for retrieval of instance frames')
    }
    if (sopInstanceUID === undefined) {
      console.error('SOP Instance UID is required for retrieval of instance frames')
    }
    if (frameNumbers === undefined) {
      console.error('frame numbers are required for retrieval of instance frames')
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
            console.error(`MIME type "image/${options.imageSubtype}" is not supported`)
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
   * @param {Array} datasets DICOM datasets of instances that should be stored in DICOM JSON format
   * @param {Object} options optional parameters (key "studyInstanceUID" to only store instances of a given study)
   */
  storeInstances(datasets, options={}) {
    let url = this.baseURL;
    if ('studyInstanceUID' in options) {
      url += '/studies/' + options.studyInstanceUID;
    }
    console.error('storing instances is not yet implemented')
  }

}

export { DICOMwebClient };
