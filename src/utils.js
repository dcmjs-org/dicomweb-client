function findSubstring(str, before, after) {
    const beforeIndex = str.lastIndexOf(before) + before.length;
    if (beforeIndex < before.length) {
        return(null);
    }
    if (after !== undefined) {
        const afterIndex = str.lastIndexOf(after);
        if (afterIndex < 0) {
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
    console.debug('Study Instance UID could not be dertermined from URI "' + uri + '"');
  }
  return(uid);
}


function getSeriesInstanceUIDFromUri(uri) {
  var uid = findSubstring(uri, "series/", "/instances");
  if (!uid) {
    var uid = findSubstring(uri, "series/");
  }
  if (!uid) {
    console.debug('Series Instance UID could not be dertermined from URI "' + uri + '"');
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
    console.debug('SOP Instance UID could not be dertermined from URI"' + uri + '"');
  }
  return(uid);
}


function getFrameNumbersFromUri(uri) {
  let numbers = findSubstring(uri, "/frames/");
  if (numbers === undefined) {
    console.debug('Frames Numbers could not be dertermined from URI"' + uri + '"');
  }
  return(numbers.split(','));
}

function stringToArray(string) {
  return Uint8Array.from(Array.from(string).map(letter => letter.charCodeAt(0)))
};

function multipartEncode(datasets, boundary) {
  const contentTypeString = 'Content-Type: application/dicom';
  const header = `\r\n--${boundary}\r\n${contentTypeString}\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;
  const headerArray = stringToArray(header);
  const footerArray = stringToArray(footer);
  const headerLength = headerArray.length;
  const footerLength = footerArray.length;

  let length = 0;

  // Calculate the total length for the final array
  const contentArrays = datasets.map(datasetBuffer => {
    const contentArray = new Uint8Array(datasetBuffer);
    const contentLength = contentArray.length;

    length += headerLength + contentLength + footerLength;

    return contentArray;
  })

  // Allocate the array
  const multipartArray = new Uint8Array(length);

  // Set the initial header
  multipartArray.set(headerArray, 0);

  // Write each dataset into the multipart array
  let position = 0;
  contentArrays.forEach(contentArray => {
    const contentLength = contentArray.length;

    multipartArray.set(headerArray, position);
    multipartArray.set(contentArray, position + headerLength);

    position += headerLength + contentArray.length;
  });

  multipartArray.set(footerArray, position);

  return multipartArray.buffer;
};

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

export {
  getStudyInstanceUIDFromUri,
  getSeriesInstanceUIDFromUri,
  getSOPInstanceUIDFromUri,
  getFrameNumbersFromUri,
  multipartEncode,
  guid
};
