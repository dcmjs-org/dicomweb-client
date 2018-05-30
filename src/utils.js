function findSubstring(str, before, after) {
    const beforeIndex = str.lastIndexOf(before) + before.length;
    if (beforeIndex < before.length) {
        console.warn(`substring not found in "${str}"`)
        return(null);
    }
    if (after !== undefined) {
        const afterIndex = str.lastIndexOf(after);
        if (afterIndex < 0) {
            console.warn(`substring not found in "${str}"`)
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


export {
  getStudyInstanceUIDFromUri, getSeriesInstanceUIDFromUri,
  getSOPInstanceUIDFromUri, getFrameNumbersFromUri
};
