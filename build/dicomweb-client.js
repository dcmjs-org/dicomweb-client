(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.DICOMwebClient = {})));
}(this, (function (exports) { 'use strict';

  function _typeof(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

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
    var str = '';

    for (var i = offset; i < offset + limit; i++) {
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
    var arr = new Uint8Array(str.length);

    for (var i = 0, j = str.length; i < j; i++) {
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
    var parts = header.split('\r\n');

    for (var i = 0; i < parts.length; i++) {
      if (parts[i].substr(0, 2) === '--') {
        return parts[i];
      }
    }
  }
  /**
   * Checks whether a given token is contained by a message at a given offset.
   * @param {Uint8Array} message message content
   * @param {Uint8Array} token substring that should be present
   * @param {Number} offset offset in message content from where search should start
   * @returns {Boolean} whether message contains token at offset
   */


  function containsToken(message, token) {
    var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

    if (offset + token.length > message.length) {
      return false;
    }

    var index = offset;

    for (var i = 0; i < token.length; i++) {
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


  function findToken(message, token) {
    var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var maxSearchLength = arguments.length > 3 ? arguments[3] : undefined;
    var searchLength = message.length;

    if (maxSearchLength) {
      searchLength = Math.min(offset + maxSearchLength, message.length);
    }

    for (var i = offset; i < searchLength; i++) {
      // If the first value of the message matches
      // the first value of the token, check if
      // this is the full token.
      if (message[i] === token[0]) {
        if (containsToken(message, token, i)) {
          return i;
        }
      }
    }

    return -1;
  }
  /**
   * @typedef {Object} MultipartEncodedData
   * @property {ArrayBuffer} data The encoded Multipart Data
   * @property {String} boundary The boundary used to divide pieces of the encoded data
   */

  /**
   * Encode one or more DICOM datasets into a single body so it can be
   * sent using the Multipart Content-Type.
   *
   * @param {ArrayBuffer[]} datasets Array containing each file to be encoded in the multipart body, passed as ArrayBuffers.
   * @param {String} [boundary] Optional string to define a boundary between each part of the multipart body. If this is not specified, a random GUID will be generated.
   * @return {MultipartEncodedData} The Multipart encoded data returned as an Object. This contains both the data itself, and the boundary string used to divide it.
   */


  function multipartEncode(datasets) {
    var boundary = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : guid();
    var contentType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'application/dicom';
    var contentTypeString = "Content-Type: ".concat(contentType);
    var header = "\r\n--".concat(boundary, "\r\n").concat(contentTypeString, "\r\n\r\n");
    var footer = "\r\n--".concat(boundary, "--");
    var headerArray = stringToUint8Array(header);
    var footerArray = stringToUint8Array(footer);
    var headerLength = headerArray.length;
    var footerLength = footerArray.length;
    var length = 0; // Calculate the total length for the final array

    var contentArrays = datasets.map(function (datasetBuffer) {
      var contentArray = new Uint8Array(datasetBuffer);
      var contentLength = contentArray.length;
      length += headerLength + contentLength + footerLength;
      return contentArray;
    }); // Allocate the array

    var multipartArray = new Uint8Array(length); // Set the initial header

    multipartArray.set(headerArray, 0); // Write each dataset into the multipart array

    var position = 0;
    contentArrays.forEach(function (contentArray) {
      var contentLength = contentArray.length;
      multipartArray.set(headerArray, position);
      multipartArray.set(contentArray, position + headerLength);
      position += headerLength + contentArray.length;
    });
    multipartArray.set(footerArray, position);
    return {
      data: multipartArray.buffer,
      boundary: boundary
    };
  }
  /**
   * Decode a Multipart encoded ArrayBuffer and return the components as an Array.
   *
   * @param {ArrayBuffer} response Data encoded as a 'multipart/related' message
   * @returns {Array} The content
   */

  function multipartDecode(response) {
    var message = new Uint8Array(response);
    /* Set a maximum length to search for the header boundaries, otherwise
       findToken can run for a long time
    */

    var maxSearchLength = 1000; // First look for the multipart mime header

    var separator = stringToUint8Array('\r\n\r\n');
    var headerIndex = findToken(message, separator, 0, maxSearchLength);

    if (headerIndex === -1) {
      throw new Error('Response message has no multipart mime header');
    }

    var header = uint8ArrayToString(message, 0, headerIndex);
    var boundaryString = identifyBoundary(header);

    if (!boundaryString) {
      throw new Error('Header of response message does not specify boundary');
    }

    var boundary = stringToUint8Array(boundaryString);
    var boundaryLength = boundary.length;
    var components = [];
    var offset = headerIndex + separator.length; // Loop until we cannot find any more boundaries

    var boundaryIndex;

    while (boundaryIndex !== -1) {
      // Search for the next boundary in the message, starting
      // from the current offset position
      boundaryIndex = findToken(message, boundary, offset); // If no further boundaries are found, stop here.

      if (boundaryIndex === -1) {
        break;
      } // Extract data from response message, excluding "\r\n"


      var spacingLength = 2;
      var length = boundaryIndex - offset - spacingLength;
      var data = response.slice(offset, offset + length); // Add the data to the array of results

      components.push(data); // Move the offset to the end of the current section,
      // plus the identified boundary

      offset += length + spacingLength + boundaryLength;
    }

    return components;
  }
  /**
   * Create a random GUID
   *
   * @return {string}
   */


  function guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  function isEmptyObject(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
  }

  var getFirstResult = function getFirstResult(result) {
    return result[0];
  };

  var MIMETYPES = {
    DICOM: 'application/dicom',
    DICOM_JSON: 'application/dicom+json',
    OCTET_STREAM: 'application/octet-stream',
    JPEG: 'image/jpeg',
    PNG: 'image/png'
  };
  /**
  * Class for interacting with DICOMweb RESTful services.
  */

  var DICOMwebClient =
  /*#__PURE__*/
  function () {
    /**
    * @constructor
    * @param {Object} options (choices: "url", "username", "password", "headers")
    */
    function DICOMwebClient(options) {
      _classCallCheck(this, DICOMwebClient);

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
        console.log("use URL prefix for QIDO-RS: ".concat(options.qidoURLPrefix));
        this.qidoURL = this.baseURL + '/' + options.qidoURLPrefix;
      } else {
        this.qidoURL = this.baseURL;
      }

      if ('wadoURLPrefix' in options) {
        console.log("use URL prefix for WADO-RS: ".concat(options.wadoURLPrefix));
        this.wadoURL = this.baseURL + '/' + options.wadoURLPrefix;
      } else {
        this.wadoURL = this.baseURL;
      }

      if ('stowURLPrefix' in options) {
        console.log("use URL prefix for STOW-RS: ".concat(options.stowURLPrefix));
        this.stowURL = this.baseURL + '/' + options.stowURLPrefix;
      } else {
        this.stowURL = this.baseURL;
      }

      this.headers = options.headers || {};
    }

    _createClass(DICOMwebClient, [{
      key: "_httpRequest",
      value: function _httpRequest(url, method, headers) {
        var _this = this;

        var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
        return new Promise(function (resolve, reject) {
          var request = new XMLHttpRequest();
          request.open(method, url, true);

          if ('responseType' in options) {
            request.responseType = options.responseType;
          }

          if (_typeof(headers) === 'object') {
            Object.keys(headers).forEach(function (key) {
              request.setRequestHeader(key, headers[key]);
            });
          } // now add custom headers from the user
          // (e.g. access tokens)


          var userHeaders = _this.headers;
          Object.keys(userHeaders).forEach(function (key) {
            request.setRequestHeader(key, userHeaders[key]);
          }); // Event triggered when upload starts

          request.onloadstart = function (event) {//console.log('upload started: ', url)
          }; // Event triggered when upload ends


          request.onloadend = function (event) {//console.log('upload finished')
          }; // Handle response message


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
                var error = new Error('request failed');
                error.request = request;
                error.response = request.response;
                error.status = request.status;
                console.error(error);
                console.error(error.response);
                reject(error);
              }
            }
          }; // Event triggered while download progresses


          if ('progressCallback' in options) {
            if (typeof options.progressCallback === 'function') {
              request.onprogress = options.progressCallback;
            }
          } // request.onprogress = function (event) {
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
    }, {
      key: "_httpGet",
      value: function _httpGet(url, headers, responseType, progressCallback) {
        return this._httpRequest(url, 'get', headers, {
          responseType: responseType,
          progressCallback: progressCallback
        });
      }
    }, {
      key: "_httpGetApplicationJson",
      value: function _httpGetApplicationJson(url) {
        var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var progressCallback = arguments.length > 2 ? arguments[2] : undefined;

        if (_typeof(params) === 'object') {
          if (!isEmptyObject(params)) {
            url += DICOMwebClient._parseQueryParameters(params);
          }
        }

        var headers = {
          'Accept': MIMETYPES.DICOM_JSON
        };
        var responseType = 'json';
        return this._httpGet(url, headers, responseType, progressCallback);
      }
    }, {
      key: "_httpGetByMimeType",
      value: function _httpGetByMimeType(url, mimeType, params) {
        var responseType = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'arraybuffer';
        var progressCallback = arguments.length > 4 ? arguments[4] : undefined;

        if (_typeof(params) === 'object') {
          if (!isEmptyObject(params)) {
            url += DICOMwebClient._parseQueryParameters(params);
          }
        }

        var headers = {
          'Accept': "multipart/related; type=\"".concat(mimeType, "\"")
        };
        return this._httpGet(url, headers, responseType, progressCallback);
      }
    }, {
      key: "_httpPost",
      value: function _httpPost(url, headers, data, progressCallback) {
        return this._httpRequest(url, 'post', headers, {
          data: data,
          progressCallback: progressCallback
        });
      }
    }, {
      key: "_httpPostApplicationJson",
      value: function _httpPostApplicationJson(url, data, progressCallback) {
        var headers = {
          'Content-Type': MIMETYPES.DICOM_JSON
        };
        return this._httpPost(url, headers, data, progressCallback);
      }
      /**
       * Searches for DICOM studies.
       * @param {Object} options options object
       * @return {Array} study representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2)
       */

    }, {
      key: "searchForStudies",
      value: function searchForStudies() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        console.log('search for studies');
        var url = this.qidoURL + '/studies';

        if ('queryParams' in options) {
          url += DICOMwebClient._parseQueryParameters(options.queryParams);
        }

        return this._httpGetApplicationJson(url);
      }
      /**
       * Retrieves metadata for a DICOM study.
       * @param {Object} options options object
       * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the study
       */

    }, {
      key: "retrieveStudyMetadata",
      value: function retrieveStudyMetadata(options) {
        if (!('studyInstanceUID' in options)) {
          throw new Error('Study Instance UID is required for retrieval of study metadata');
        }

        console.log("retrieve metadata of study ".concat(options.studyInstanceUID));
        var url = this.wadoURL + '/studies/' + options.studyInstanceUID + '/metadata';
        return this._httpGetApplicationJson(url);
      }
      /**
       * Searches for DICOM series.
       * @param {Object} options options object
       * @returns {Array} series representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2a)
       */

    }, {
      key: "searchForSeries",
      value: function searchForSeries() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        var url = this.qidoURL;

        if ('studyInstanceUID' in options) {
          console.log("search series of study ".concat(options.studyInstanceUID));
          url += '/studies/' + options.studyInstanceUID;
        }

        url += '/series';

        if ('queryParams' in options) {
          url += DICOMwebClient._parseQueryParameters(options.queryParams);
        }

        return this._httpGetApplicationJson(url);
      }
      /**
       * Retrieves metadata for a DICOM series.
       * @param {Object} options options object
       * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the series
       */

    }, {
      key: "retrieveSeriesMetadata",
      value: function retrieveSeriesMetadata(options) {
        if (!('studyInstanceUID' in options)) {
          throw new Error('Study Instance UID is required for retrieval of series metadata');
        }

        if (!('seriesInstanceUID' in options)) {
          throw new Error('Series Instance UID is required for retrieval of series metadata');
        }

        console.log("retrieve metadata of series ".concat(options.seriesInstanceUID));
        var url = this.wadoURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/metadata';
        return this._httpGetApplicationJson(url);
      }
      /**
       * Searches for DICOM instances.
       * @param {Object} options options object
       * @returns {Array} instance representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2b)
       */

    }, {
      key: "searchForInstances",
      value: function searchForInstances() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        var url = this.qidoURL;

        if ('studyInstanceUID' in options) {
          url += '/studies/' + options.studyInstanceUID;

          if ('seriesInstanceUID' in options) {
            console.log("search for instances of series ".concat(options.seriesInstanceUID));
            url += '/series/' + options.seriesInstanceUID;
          } else {
            console.log("search for instances of study ".concat(options.studyInstanceUID));
          }
        } else {
          console.log('search for instances');
        }

        url += '/instances';

        if ('queryParams' in options) {
          url += DICOMwebClient._parseQueryParameters(options.queryParams);
        }

        return this._httpGetApplicationJson(url);
      }
      /** Returns a WADO-URI URL for an instance
       * @param {Object} options options object
       * @returns {String} WADO-URI URL
       */

    }, {
      key: "buildInstanceWadoURIUrl",
      value: function buildInstanceWadoURIUrl(options) {
        if (!('studyInstanceUID' in options)) {
          throw new Error('Study Instance UID is required.');
        }

        if (!('seriesInstanceUID' in options)) {
          throw new Error('Series Instance UID is required.');
        }

        if (!('sopInstanceUID' in options)) {
          throw new Error('SOP Instance UID is required.');
        }

        var contentType = options.contentType || MIMETYPES.DICOM;
        var transferSyntax = options.transferSyntax || '*';
        var params = [];
        params.push('requestType=WADO');
        params.push("studyUID=".concat(options.studyInstanceUID));
        params.push("seriesUID=".concat(options.seriesInstanceUID));
        params.push("objectUID=".concat(options.sopInstanceUID));
        params.push("contentType=".concat(contentType));
        params.push("transferSyntax=".concat(transferSyntax));
        var paramString = params.join('&');
        return "".concat(this.wadoURL, "?").concat(paramString);
      }
      /**
       * Retrieves metadata for a DICOM instance.
       *
       * @param {Object} options object
       * @returns {Object} metadata elements in DICOM JSON format
       */

    }, {
      key: "retrieveInstanceMetadata",
      value: function retrieveInstanceMetadata(options) {
        if (!('studyInstanceUID' in options)) {
          throw new Error('Study Instance UID is required for retrieval of instance metadata');
        }

        if (!('seriesInstanceUID' in options)) {
          throw new Error('Series Instance UID is required for retrieval of instance metadata');
        }

        if (!('sopInstanceUID' in options)) {
          throw new Error('SOP Instance UID is required for retrieval of instance metadata');
        }

        console.log("retrieve metadata of instance ".concat(options.sopInstanceUID));
        var url = this.wadoURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/instances/' + options.sopInstanceUID + '/metadata';
        return this._httpGetApplicationJson(url);
      }
      /**
       * Retrieves frames for a DICOM instance.
       * @param {Object} options options object
       * @returns {Array} frame items as byte arrays of the pixel data element
       */

    }, {
      key: "retrieveInstanceFrames",
      value: function retrieveInstanceFrames(options) {
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

        console.log("retrieve frames ".concat(options.frameNumbers.toString(), " of instance ").concat(options.sopInstanceUID));
        var url = this.wadoURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/instances/' + options.sopInstanceUID + '/frames/' + options.frameNumbers.toString();
        var mimeType = options.mimeType ? "".concat(options.mimeType) : MIMETYPES.OCTET_STREAM;
        return this._httpGetByMimeType(url, mimeType).then(multipartDecode);
      }
      /**
       * Retrieves rendered frames for a DICOM instance.
       * @param {Object} options options object
       * @returns {Array} frame items as byte arrays of the pixel data element
       */

    }, {
      key: "retrieveInstanceFramesRendered",
      value: function retrieveInstanceFramesRendered(options) {
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

        console.log("retrieve rendered frames ".concat(options.frameNumbers.toString(), " of instance ").concat(options.sopInstanceUID));
        var url = this.wadoURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/instances/' + options.sopInstanceUID + '/frames/' + options.frameNumbers.toString() + '/rendered';
        var headers = {}; // The choice of an acceptable media type depends on a variety of things:
        // http://dicom.nema.org/medical/dicom/current/output/chtml/part18/chapter_6.html#table_6.1.1-3

        if ('mimeType' in options) {
          headers['Accept'] = options.mimeType;
        }

        var responseType = 'arraybuffer';
        return this._httpGet(url, headers, responseType);
      }
      /**
       * Retrieves a DICOM instance.
       * @param {Object} options options object
       * @returns {Arraybuffer} DICOM Part 10 file as Arraybuffer
       */

    }, {
      key: "retrieveInstance",
      value: function retrieveInstance(options) {
        if (!('studyInstanceUID' in options)) {
          throw new Error('Study Instance UID is required');
        }

        if (!('seriesInstanceUID' in options)) {
          throw new Error('Series Instance UID is required');
        }

        if (!('sopInstanceUID' in options)) {
          throw new Error('SOP Instance UID is required');
        }

        var url = this.wadoURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/instances/' + options.sopInstanceUID;
        return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode).then(getFirstResult);
      }
      /**
       * Retrieves a set of DICOM instance for a series.
       * @param {Object} options options object
       * @returns {Arraybuffer[]} Array of DICOM Part 10 files as Arraybuffers
       */

    }, {
      key: "retrieveSeries",
      value: function retrieveSeries(options) {
        if (!('studyInstanceUID' in options)) {
          throw new Error('Study Instance UID is required');
        }

        if (!('seriesInstanceUID' in options)) {
          throw new Error('Series Instance UID is required');
        }

        var url = this.wadoURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID;
        return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode);
      }
      /**
       * Retrieves a set of DICOM instance for a study.
       * @param {Object} options options object
       * @returns {Arraybuffer[]} Array of DICOM Part 10 files as Arraybuffers
       */

    }, {
      key: "retrieveStudy",
      value: function retrieveStudy(options) {
        if (!('studyInstanceUID' in options)) {
          throw new Error('Study Instance UID is required');
        }

        var url = this.wadoURL + '/studies/' + options.studyInstanceUID;
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

    }, {
      key: "retrieveBulkData",
      value: function retrieveBulkData(options) {
        if (!('BulkDataURI' in options)) {
          throw new Error('BulkDataURI is required.');
        }

        return this._httpGetByMimeType(options.BulkDataURI, MIMETYPES.OCTET_STREAM).then(multipartDecode).then(getFirstResult);
      }
      /**
       * Stores DICOM instances.
       *
       * @param {Object} options options object
       */

    }, {
      key: "storeInstances",
      value: function storeInstances(options) {
        if (!('datasets' in options)) {
          throw new Error('datasets are required for storing');
        }

        var url = "".concat(this.stowURL, "/studies");

        if ('studyInstanceUID' in options) {
          url += "/".concat(options.studyInstanceUID);
        }

        var _multipartEncode = multipartEncode(options.datasets),
            data = _multipartEncode.data,
            boundary = _multipartEncode.boundary;

        var headers = {
          'Content-Type': "multipart/related; type=application/dicom; boundary=".concat(boundary)
        };
        return this._httpPost(url, headers, data, options.progressCallback);
      }
    }], [{
      key: "_parseQueryParameters",
      value: function _parseQueryParameters() {
        var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        var queryString = '?';
        Object.keys(params).forEach(function (key, index) {
          if (index !== 0) {
            queryString += '&';
          }

          queryString += key + '=' + encodeURIComponent(params[key]);
        });
        return queryString;
      }
    }]);

    return DICOMwebClient;
  }();

  function findSubstring(str, before, after) {
    var beforeIndex = str.lastIndexOf(before) + before.length;

    if (beforeIndex < before.length) {
      return null;
    }

    if (after !== undefined) {
      var afterIndex = str.lastIndexOf(after);

      if (afterIndex < 0) {
        return null;
      } else {
        return str.substring(beforeIndex, afterIndex);
      }
    }

    return str.substring(beforeIndex);
  }

  function getStudyInstanceUIDFromUri(uri) {
    var uid = findSubstring(uri, "studies/", "/series");

    if (!uid) {
      uid = findSubstring(uri, "studies/");
    }

    if (!uid) {
      console.debug('Study Instance UID could not be dertermined from URI "' + uri + '"');
    }

    return uid;
  }

  function getSeriesInstanceUIDFromUri(uri) {
    var uid = findSubstring(uri, "series/", "/instances");

    if (!uid) {
      uid = findSubstring(uri, "series/");
    }

    if (!uid) {
      console.debug('Series Instance UID could not be dertermined from URI "' + uri + '"');
    }

    return uid;
  }

  function getSOPInstanceUIDFromUri(uri) {
    var uid = findSubstring(uri, "/instances/", "/frames");

    if (!uid) {
      uid = findSubstring(uri, "/instances/", "/metadata");
    }

    if (!uid) {
      uid = findSubstring(uri, "/instances/");
    }

    if (!uid) {
      console.debug('SOP Instance UID could not be dertermined from URI"' + uri + '"');
    }

    return uid;
  }

  function getFrameNumbersFromUri(uri) {
    var numbers = findSubstring(uri, "/frames/", "/rendered");

    if (!numbers) {
      numbers = findSubstring(uri, "/frames/");
    }

    if (numbers === undefined) {
      console.debug('Frames Numbers could not be dertermined from URI"' + uri + '"');
    }

    return numbers.split(',');
  }

  var version = '0.3.2';

  var api = {
    DICOMwebClient: DICOMwebClient
  };
  var utils = {
    getStudyInstanceUIDFromUri: getStudyInstanceUIDFromUri,
    getSeriesInstanceUIDFromUri: getSeriesInstanceUIDFromUri,
    getSOPInstanceUIDFromUri: getSOPInstanceUIDFromUri,
    getFrameNumbersFromUri: getFrameNumbersFromUri
  };

  exports.api = api;
  exports.utils = utils;
  exports.version = version;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=dicomweb-client.js.map
