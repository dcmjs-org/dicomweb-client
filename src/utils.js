function findSubstring(str, before, after) {
  const beforeIndex = str.lastIndexOf(before) + before.length;
  if (beforeIndex < before.length) {
    return null;
  }
  if (after !== undefined) {
    const afterIndex = str.lastIndexOf(after);
    if (afterIndex < 0) {
      return null;
    }
    return str.substring(beforeIndex, afterIndex);
  }
  return str.substring(beforeIndex);
}

function getStudyInstanceUIDFromUri(uri) {
  let uid = findSubstring(uri, "studies/", "/series");
  if (!uid) {
    uid = findSubstring(uri, "studies/");
  }
  if (!uid) {
    console.debug(
      `Study Instance UID could not be dertermined from URI "${uri}"`
    );
  }
  return uid;
}

function getSeriesInstanceUIDFromUri(uri) {
  let uid = findSubstring(uri, "series/", "/instances");
  if (!uid) {
    uid = findSubstring(uri, "series/");
  }
  if (!uid) {
    console.debug(
      `Series Instance UID could not be dertermined from URI "${uri}"`
    );
  }
  return uid;
}

function getSOPInstanceUIDFromUri(uri) {
  let uid = findSubstring(uri, "/instances/", "/frames");
  if (!uid) {
    uid = findSubstring(uri, "/instances/", "/metadata");
  }
  if (!uid) {
    uid = findSubstring(uri, "/instances/");
  }
  if (!uid) {
    console.debug(`SOP Instance UID could not be dertermined from URI"${uri}"`);
  }
  return uid;
}

function getFrameNumbersFromUri(uri) {
  let numbers = findSubstring(uri, "/frames/", "/rendered");
  if (!numbers) {
    numbers = findSubstring(uri, "/frames/");
  }
  if (numbers === undefined) {
    console.debug(`Frames Numbers could not be dertermined from URI"${uri}"`);
  }
  return numbers.split(",");
}

export {
  getStudyInstanceUIDFromUri,
  getSeriesInstanceUIDFromUri,
  getSOPInstanceUIDFromUri,
  getFrameNumbersFromUri
};
