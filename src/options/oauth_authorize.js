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


/*
+ Takes the redirect URI and extracts the token.
+ Stores (caches) the token in window.localStorage\
+ returns: extracted token
*/
function extractAccessToken(redirectUri) {
    let m = redirectUri.match(/[#?](.*)/);
    //d
    console.log("This is the regex match result for the redirectURI:");
    console.log(m);
    //ed
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

function launchAuthFlow(){
    return browser.identity.launchWebAuthFlow({
        interactive: true,
        url: AUTH_URL
    });
}

/*
  Returns an access token
  1. check if there is a token in the browser memory
  + there is a token
     1.A validate the token
       + the token is valid - return the token
       + the token is invalid - jump to 1.B.1
  + there is no token cached
     1.B.1 launch the authentication flow to get a token
     1.B.2 get a token from the redirect URI
     1.B.3 validate the token and then return it
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

function listFiles(){
    function sendRequestToAPI(accessToken){

        const queryString = "name = 'passwordgen.txt'";
        const requestURL = `https://www.googleapis.com/drive/v3/files?orderBy=modifiedByMeTime&q=${encodeURIComponent(queryString)}`;
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

const FILE_NAME = "passwordgen.txt";

async function putFileToDrive(content){

    const accessToken = await getAccessToken();
    const files_in_drive = await listFiles();

    console.log(`PasswordGen's files in drive are: `);
    console.log(files_in_drive);

    if(files_in_drive.length == 0){
        //create a new file
        const requestURL = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
        const requestHeaders = new Headers();
        requestHeaders.append('Authorization', 'Bearer ' + accessToken);
        requestHeaders.append('Content-Type', 'multipart/related;boundary=boundary');

        const requestBody =
            '--boundary\n' +
            'Content-Type: application/json;charset=UTF-8\n\n' +
            `{"name": "${FILE_NAME}"}\n` +
            '--boundary\n' +
            'Content-Type: text/plain\n\n' +
            JSON.stringify(content, null, 4) + '\n' +
            '--boundary--';

        const driveRequest = new Request(requestURL, {
            method: "POST",
            headers: requestHeaders,
            body: requestBody
        });

        console.log("Creating a new file in Google Drive");
        return fetch(driveRequest).then((response) => {
            if (response.status === 200) {
                return response.json();
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
        requestHeaders.append('Content-Type', 'multipart/related;boundary=boundary');

        const requestBody =
            '--boundary\n' +
            'Content-Type: application/json;charset=UTF-8\n\n' +
            `{"name": "${FILE_NAME}"}\n` +
            '--boundary\n' +
            'Content-Type: text/plain\n\n' +
            JSON.stringify(content, null, 4) + '\n' +
            '--boundary--';

        const driveRequest = new Request(requestURL, {
            method: "PATCH",
            headers: requestHeaders,
            body: requestBody
        });

        return fetch(driveRequest).then((response) => {
            if (response.status === 200) {
                return response.json();
            } else {
                throw response.status;
            }
        });
    }
}

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
        return {};
    }
}
