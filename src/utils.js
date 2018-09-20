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

  // TODO: Currently this only encodes the first dataset
  const part10Buffer = datasets[0];
  const headerArray = stringToArray(header);
  const contentArray = new Uint8Array(part10Buffer);
  const footerArray = stringToArray(footer);
  const length = headerArray.length + contentArray.length + footerArray.length;
  const multipartArray = new Uint8Array(length);

  console.warn('CONTENTARRAY');
  console.warn(contentArray.length);

  multipartArray.set(headerArray, 0);
  multipartArray.set(contentArray, headerArray.length);
  multipartArray.set(footerArray, headerArray.length + contentArray.length);

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
