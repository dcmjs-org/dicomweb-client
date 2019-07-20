import { DICOMwebClient } from "./api.js";
import {
  getStudyInstanceUIDFromUri,
  getSeriesInstanceUIDFromUri,
  getSOPInstanceUIDFromUri,
  getFrameNumbersFromUri
} from "./utils.js";

const api = {
  DICOMwebClient
};
const utils = {
  getStudyInstanceUIDFromUri,
  getSeriesInstanceUIDFromUri,
  getSOPInstanceUIDFromUri,
  getFrameNumbersFromUri
};

export { default as version } from "./version.js";

export { api, utils };
