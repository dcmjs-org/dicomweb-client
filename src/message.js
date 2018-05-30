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

export { containsToken, findToken, identifyBoundary, uint8ArrayToString, stringToUint8Array };
