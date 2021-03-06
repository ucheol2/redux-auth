import axios from 'axios';
import * as C from "./constants";
import extend from "extend";
import {
  getApiUrl,
  retrieveData,
  persistData,
  getTokenFormat,
  getSessionEndpointKey
} from "./session-storage";

const isApiRequest = function(url) {
  return (url.match(getApiUrl(getSessionEndpointKey())));
};

/**
 * Add access token as a bearer token in accordance to RFC 6750
 *
 * @param {string} accessToken
 * @param {object} headers
 * @returns {object} New extended headers object, with Authorization property
 */
export function addAuthorizationHeader(accessToken, headers) {
  return Object.assign({}, headers, {
    Authorization: `Bearer ${accessToken}`
  });
}

function getAuthHeaders(url) {
  if (isApiRequest(url)) {
    // fetch current auth headers from storage
    const currentHeaders = retrieveData(C.SAVED_CREDS_KEY) || {},
        nextHeaders = {};

    // bust IE cache
    nextHeaders["If-Modified-Since"] = "Mon, 26 Jul 1997 05:00:00 GMT";

    // set header for each key in `tokenFormat` config
    for (let key in getTokenFormat()) {
      nextHeaders[key] = currentHeaders[key];
    }

    return addAuthorizationHeader(currentHeaders['access-token'], nextHeaders);
  } else {
    return {};
  }
}

function updateAuthCredentials(resp) {
  // check config apiUrl matches the current response url
  if (isApiRequest(resp.config.url)) {
    // set header for each key in `tokenFormat` config
    const newHeaders = {};

    // set flag to ensure that we don't accidentally nuke the headers
    // if the response tokens aren't sent back from the API
    let blankHeaders = true;

    //console.log('axiauth resp', resp);
    // set header key + val for each key in `tokenFormat` config
    for (let key in getTokenFormat()) {
      newHeaders[key] = resp.headers[key];
    }
    if (!!newHeaders['access-token']) {
      blankHeaders = false;
    }

    // persist headers for next request
    if (!blankHeaders) {
      persistData(C.SAVED_CREDS_KEY, newHeaders);
    }
  }

  return resp;
}

export default function (options={}) {
  if (!options.headers) {
    options.headers = {}
  }
  extend(options.headers, getAuthHeaders(options.url));
  //console.log('axiauth req headers', options.headers);
  return axios(options)
  .then(resp => updateAuthCredentials(resp))
  .catch(e => {
    if (e.response.status !== 401) {
      updateAuthCredentials(e.response);
    }
    throw e;
  });
}
