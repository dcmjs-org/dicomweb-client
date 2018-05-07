class DICOMwebClient {

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

  _httpGet(url, headers, responseType, progressCallback) {
    return new Promise( (resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('get', url, true);
      request.responseType = responseType;

      if (typeof(headers) === 'object') {
        Object.keys(headers).forEach(function (key) {
          request.setRequestHeader(key, headers[key]);
        });
      }

      // Event triggered when download starts
      request.onloadstart = function (event) {
        // console.log('download started: ', url)
      };

      // Event triggered when download ends
      request.onloadend = function (event) {
        // console.log('download finished')
      };

      // Handle response message
      request.onreadystatechange = function (event) {
        if (request.readyState === 4) {
          if (request.status === 200) {
            // console.log('request successfull');
            resolve(request.response);
          } else if (request.status === 204) {
            console.warn('empty response', request);
            resolve([]);
          } else {
            console.error('request failed: ', request);
            reject(request);
          }
        }
      };

      // Event triggered while download progresses
      if (typeof(progressCallback) === "function") {
          request.onprogress = progressCallback();
      }

      // request.onprogress = function (event) {
      //   const loaded = progress.loaded;
      //   let total;
      //   let percentComplete;

      //   if (progress.lengthComputable) {
      //     total = progress.total;
      //     percentComplete = Math.round((loaded / total) * 100);
      //   }
      //   return(percentComplete);

      //   // console.log('download progress: ', percentComplete, ' %');
      // };

      request.send();
    });
  }

  _httpGetApplicationJson(url, parameters={}, progressCallback) {
    if (typeof(parameters) === 'object') {
      if (!isEmptyObject(parameters)) {
          url += this._parseQueryParameters(parameters)
      }
    }
    const headers = {'Accept': 'application/dicom+json'};
    const responseType = 'json';
    return this._httpGet(url, headers, responseType);
  }

  _httpGetApplicationOctetStream(url, parameters={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(parameters)) {
          url += this._parseQueryParameters(parameters)
      }
    }
    const headers = {'Accept': 'multipart/related; type="application/octet-stream"'};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType);
  }

  _httpGetImageJpeg(url, parameters={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(parameters)) {
          url += this._parseQueryParameters(parameters)
      }
    }
    const headers = {'Accept': `multipart/related; type="image/jpeg"`};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType);
  }

  _httpGetImageJpeg2000(url, parameters={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(parameters)) {
          url += this._parseQueryParameters(parameters)
      }
    }
    const headers = {'Accept': `multipart/related; type="image/jp2"`};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType);
  }

  _httpGetImageJpegLs(url, parameters={}, progressCallback) {
    if (typeof(params) === 'object') {
      if (!isEmptyObject(parameters)) {
          url += this._parseQueryParameters(parameters)
      }
    }
    const headers = {'Accept': `multipart/related; type="image/x-jls"`};
    const responseType = 'arraybuffer';
    return this._httpGet(url, headers, responseType);
  }

  searchForStudies() {
    console.log('search for studies');
    const url = this.baseURL +
              '/studies';
    return(this._httpGetApplicationJson(url));
  }

  retrieveStudyMetadata(studyInstanceUID) {
    console.log(`retrieve metadata of study ${studyInstanceUID}`);
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/metadata';
    return(this._httpGetApplicationJson(url));
  }

  searchForSeries(studyInstanceUID) {
    console.log(`search series of study ${studyInstanceUID}`);
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/series';
    return(this._httpGetApplicationJson(url));
  }

  retrieveSeriesMetadata(studyInstanceUID, seriesInstanceUID) {
    console.log(`retrieve metadata of series ${seriesInstanceUID}`);
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/series/' + seriesInstanceUID +
              '/metadata';
    return(this._httpGetApplicationJson(url));
  }

  searchForInstances(studyInstanceUID, seriesInstanceUID) {
    console.log(`search for instances of series ${seriesInstanceUID}`);
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/series/' + seriesInstanceUID +
              '/instances';
    return(this._httpGetApplicationJson(url));
  }

  retrieveInstanceMetadata(studyInstanceUID, seriesInstanceUID, sopInstanceUID) {
    console.log(`retrieve metadata of instance ${sopInstanceUID}`);
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/series/' + seriesInstanceUID +
              '/instances/' + sopInstanceUID +
              '/metadata';
    return(this._httpGetApplicationJson(url));
  }

  retrieveInstanceFrames(studyInstanceUID, seriesInstanceUID, sopInstanceUID, frameNumbers, options={}) {
    console.log(`retrieve frames ${frameNumbers.toString()} of instance ${sopInstanceUID}`);
    const url = this.baseURL +
              '/studies/' + studyInstanceUID +
              '/series/' + seriesInstanceUID +
              '/instances/' + sopInstanceUID +
              '/frames/' + frameNumbers.toString();
    options.imageSubtype = options.imageSubtype || undefined;
    let func = this._httpGetApplicationOctetStream;
    if (options.imageSubtype) {
        if (options.imageSubtype === '') {
            func = this._httpGetImage;
        } else {
            console.error(`MIME type "image/${options.imageSubtype}" is not supported`)
        }
    }
    return(func(url).then((response) => {

      // TODO: parse multiframe/related
      console.error('frame retrieval is not yet implemented!')

    }));
  }

  storeInstances(studyInstanceUID) {
    console.error('storing instances is not yet implemented')
  }

}

export { DICOMwebClient };
