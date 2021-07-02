const REDIRECT_URL = browser.identity.getRedirectURL();
const CLIENT_ID = "986394819940-iti4sheoj3v11e9j8qblrc0t00u2it31.apps.googleusercontent.com"; //OAUth client ID - from google's developer console
const SCOPES = ["https://www.googleapis.com/auth/drive.file"]; //full list of scopes: https://developers.google.com/identity/protocols/oauth2/scopes
const AUTH_URL =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=token` + // response_type=token <- we're using the implicit grant flow here
    `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}`;

const VALIDATION_BASE_URL="https://www.googleapis.com/oauth2/v3/tokeninfo";


/**
* Takes the redirect URI and extracts the token. Stores (caches) the token in window.localStorage.
 * @param {string} redirectUri - the redirect URI containing the access token after the user has authorised our app
* @returns {string} the extracted token
*/
function extractAccessToken(redirectUri) {
    let m = redirectUri.match(/[#?](.*)/);

    console.log(redirectUri);

    if (!m || m.length < 1)
        return null;
    let params = new URLSearchParams(m[1].split("#")[0]);
    if(!params.get("access_token")){
        throw "Authorisation Failure: No Access token received.";
    }

    localStorage.setItem("accessToken", params.get("access_token"));
    return params.get("access_token");
}

/**
 Validate the token given as argument.
 Returns a promise that resolves with the valid token. Or rejects with an error.
 This follows essentially the process here:
 https://developers.google.com/identity/protocols/OAuth2UserAgent#tokeninfo-validation
 - make a GET request to the validation URL, including the access token
 - if the response is 200, and contains an "aud" property, and that property
 matches the clientID, then the response is valid
 - otherwise it is not valid
 Note that the Google page talks about an "audience" property, but in fact
 it seems to be "aud".

 @param {string} accessToken - the access token
 @returns {Promise} a Promise which resolves with the valid access token, or rejects if the the token is invalid
 */
function validate(accessToken) {

    const validationURL = `${VALIDATION_BASE_URL}?access_token=${accessToken}`;
    const validationRequest = new Request(validationURL, {
        method: "GET"
    });

    function checkResponse(response) {
        return new Promise((resolve, reject) => {
            if (response.status != 200) {
                reject("Token validation error");
            }
            response.json().then((json) => {
                //e
                console.log("validation response is:");
                console.log(json);
                //ed

                if (json.aud && (json.aud === CLIENT_ID)) {
                    //e
                    console.log(`successfully validated the token`);
                    //ed
                    resolve(accessToken);
                } else {
                    reject("Token validation error, the client ID does NOT match!");
                }
            });
        });
    }

    return fetch(validationRequest).then(checkResponse);
}

/** use browser.identity.launchWebAuthFlow to launch the authentication flow at the specified authorization url
 * @returns {Promise} - If the extension is authorized successfully, this will be fulfilled with a string containing the redirect URL. The URL will include a parameter that either is an access token or can be exchanged for an access token, using the documented flow for the particular service provider. */
function launchAuthFlow(){
    return browser.identity.launchWebAuthFlow({
        interactive: true,
        url: AUTH_URL
    });
}

/**
  checks if there is a token in window.localStorage. If there is, validate the token, if the token is invalid, launch web auth flow again to get a new token
 If there is no toekn in window.localStorage. launch web auth flow to get a token then validate it.

 @returns {Promise} a promise which fulfills with the valid token
*/
function getAccessToken(){
    //d
    console.log("getting access token...");
    //ed

    if(localStorage.getItem("accessToken") && localStorage.getItem("accessToken") != ""){
        //d
        console.log(`validating stored token: ${localStorage.getItem("accessToken")}`);
        //ed
        return validate(localStorage.getItem("accessToken"))
            .catch(()=>{
                return launchAuthFlow().then(extractAccessToken).then(validate);
            });
    }
    else {
        return launchAuthFlow().then(extractAccessToken).then(validate);
    }
}

/** Gets access token and uses it to list all of the files that this app has access to and sorts them by modified time
 * @returns {Array} an array of all the files*/
function listFiles(){
    function sendRequestToAPI(accessToken){

        const queryString = "name = 'passwordgen.txt'";
        const requestURL = `https://www.googleapis.com/drive/v3/files?orderBy=modifiedByMeTime&q=${encodeURIComponent(queryString)}`; //https://developers.google.com/drive/api/v3/reference/files/list
        const requestHeaders = new Headers();
        requestHeaders.append('Authorization', 'Bearer ' + accessToken);
        //requestHeaders.append('Accept', 'application/json');

        const driveRequest = new Request(requestURL, {
            method: "GET",
            headers: requestHeaders
        });

        return fetch(driveRequest).then((response) => {
            if (response.status === 200) {
                return response.json();
            } else {
                throw response.status;
            }
        });
    }

    return getAccessToken()
        .then(sendRequestToAPI)
        .then(responsejson => {
            return responsejson.files;
        })
        .catch(error => console.log(error));
}

/**File name to put to drive
 * @const {string}*/
const FILE_NAME = "passwordgen.txt";

/**
 * Takes the content and sends it to google drive. If there are no files in the drive which belong to this app, it will create a new one. If there already is a file,
 * it will update that file. See more at: https://developers.google.com/drive/api/v3/reference/files/create
 * Will throw an error if the authorization process fails.
 * @param {object} content - json object, which is then stringified and put to drive
 * @returns {Promise} A promise as a result of using fetch which should resolve with the file id in the drive.
 * */
async function putFileToDrive(content){

    //if getting the access token fails (for example user aborts authorization), it'll throw an error "Error: User cancelled or denied access."
    //i.e., this async function puFileToDrive will also abort and throw that error
    const accessToken = await getAccessToken();
    const files_in_drive = await listFiles();

    //this random hex string is used as a boundary in the multipart request body - just so we decrease the chance of the content containing "--boundary" and messing up the request
    const randomString = Math.random().toString(16).substr(2, 8);
    const boundary = `boundary${randomString}`;

    console.log(`PasswordGen's files in drive are: `);
    console.log(files_in_drive);

    if(files_in_drive.length == 0){
        //create a new file
        const requestURL = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
        const requestHeaders = new Headers();
        requestHeaders.append('Authorization', 'Bearer ' + accessToken);
        requestHeaders.append('Content-Type', `multipart/related;boundary=${boundary}`);

        const requestBody =
            `--${boundary}\n` +
            'Content-Type: application/json;charset=UTF-8\n\n' +
            `{"name": "${FILE_NAME}"}\n` +
            `--${boundary}\n` +
            'Content-Type: text/plain\n\n' +
            JSON.stringify(content, null, 4) + '\n' +
            `--${boundary}--`;

        const driveRequest = new Request(requestURL, {
            method: "POST",
            headers: requestHeaders,
            body: requestBody
        });

        console.log("Creating a new file in Google Drive");
        return fetch(driveRequest).then((response) => {
            if (response.status === 200) {
                let resp = response.json();
                console.log(resp);
                return resp;
            } else {
                throw response.status;
            }
        });
    }
    else {
        //update an existing file
        const fileToUpdateID = files_in_drive[0].id;

        console.log(`Updating the existing file named ${files_in_drive[0].name} with id "${fileToUpdateID}"`);

        const requestURL = `https://www.googleapis.com/upload/drive/v3/files/${fileToUpdateID}?uploadType=multipart`;
        const requestHeaders = new Headers();
        requestHeaders.append('Authorization', 'Bearer ' + accessToken);
        requestHeaders.append('Content-Type', `multipart/related;boundary=${boundary}`);

        const requestBody =
            `--${boundary}\n` +
            'Content-Type: application/json;charset=UTF-8\n\n' +
            `{"name": "${FILE_NAME}"}\n` +
            `--${boundary}\n` +
            'Content-Type: text/plain\n\n' +
            JSON.stringify(content, null, 4) + '\n' +
            `--${boundary}--`;

        const driveRequest = new Request(requestURL, {
            method: "PATCH",
            headers: requestHeaders,
            body: requestBody
        });

        return fetch(driveRequest).then((response) => {
            if (response.status === 200) {
                let resp = response.json();
                console.log(resp);
                return resp;
            } else {
                console.log(response);
                throw response.status;
            }
        });
    }
}

/** Gets the contents of the newest file from drive.
 * Will throw an error if authorization fails.
 * @returns {Promise} promise which resolves with the text content of the file or an empty object*/
async function getFileFromDrive(){
    const accessToken = await getAccessToken();
    const files_in_drive = await listFiles();

    if(files_in_drive.length != 0){
        const fileToGetID = files_in_drive[0].id;
        const requestURL = `https://www.googleapis.com/drive/v3/files/${fileToGetID}?alt=media`;
        const requestHeaders = new Headers();
        requestHeaders.append('Authorization', 'Bearer ' + accessToken);
        //requestHeaders.append('Accept', 'application/json');

        const driveRequest = new Request(requestURL, {
            method: "GET",
            headers: requestHeaders
        });

        console.log("Fetching file from Google Drive...");
        return fetch(driveRequest).then((response) => {
            if (response.status === 200) {
                return response.text();
            } else {
                throw response.status;
            }
        });
    }
    else {
        console.log("No file found in Drive, returning empty object...");
        throw "No back-up file found";
    }
}
