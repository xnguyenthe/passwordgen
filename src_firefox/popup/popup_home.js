/**
 * @typedef PasswordEncoding
 * @type {object}
 * @property {boolean} lower - lower case letters
 * @property {boolean} upper - upper case letters
 * @property {boolean} num - number characters
 * @property {boolean} special - special characters
 * */

/**
 * @typedef AllDefaultPreferences
 * @type {object}
 * @property {object} activeProfile - the preference object of the active profile
 * @property {array} allPreferencesArray - an array of all the profiles' preference objects, including the active profile
 * */

/**
 * @typedef DefaultPreferences
 * @type {object}
 * @property {string} profile - name of the profile, whose preference this is
 * @property {number} id - id of the profile; initialized at object creation as unix time
 * @property {number} length - preferred length for the generated password
 * @property {string} constant - salt for the creation of the generated password
 * @property {PasswordEncoding} encoding - encoding options in key value pairs
 * @property {boolean} save_preference - automatically save preferences for a given domain
 * @property {boolean} inject_into_content - automatically inject generated password into content page
 * @property {boolean} copy_to_clipboard - automatically copy generated passwprd to clipboard
 * @property {boolean} encrypt - encrypt profile
 * */

/**
 * @typedef IndividualPreference
 * @type {object}
 * @property {string} service - the name of the service
 * @property {string} domain - domain
 * @property {PasswordEncoding} encoding - password encoding
 * @property {number} length - length
 * @property {string} constant - constant
 * */
// -------------------- GLOBAL CONSTANTS ---------------------------------

//DO NOT CHANGE THE CHARACTER SET or hash number because the algorithm will start generating different passwords
/** the character set constant
 * @const {object}*/
const CHARACTER_SETS = {
    lower_case: "abcdefghijklmnopqrstuvwxyz",
    upper_case: "QWERTYUIOPASDFGHJKLZXCVBNM",
    numbers: "1234567890",
    special_chars: '~!@#$%^&*()_+{}:"|<>?[];\'\\,./'
};
/** the number of times to run the hashing function when generating the password
 * @const {number}*/
const HASH_N_TIMES = 1000;

let suffListData; //extracted suff list data from storage upon opening of the popup
let indiPrefDB; //DB object of the individual preferences upon opening of the popup

/**
 * An array of all the IndividualPreference objects of the active profile. Initialized as an empty array, in case we can't access the database.
 * @type {Array} */
let indiPrefs = [];

/** Filled with the IndividualPreference for the *domain* upon initialization (if it can be found in DB),
*   and updated with the preference for a *service* whenever the user changes the service field (if it can be found)
 *
 * @type {IndividualPreference}
*/
let preferenceForService = {};

/** @type {DefaultPreferences} */
let preferencesDefault = {};

/** Contains boolean information about whether a preference has been saved for either the domain or service individually, or both at the same time.
 * @type {object}*/
let isStored = {
    domain: false,
    service: false
};
// 4 different states - 2 obvious ones - when domain is saved, so is service, when domain is NOT saved, service is also (probably, but maybe not) not saved
// the next 2 states are cause by user input - either from a previous session (if he'd saved messenger.com as "facebook", but hadn't saved facebook.com as "facebook" yet),
// or in the present session
//domain    O  X  X  O (X means NOT stored, O means stored)
//service   O  X  O  X
//                ^  ^ caused by user input, when he changes the service field - he can either change it to smth that already exists, or not

/** object containing the encryption password for profiles that the user enters while the popup is open, and a method for getting the password of a specific profile
 * @typedef EncryptionPasswords
 * @type {object}
 * @property {Array} passwords - array of objects containing the profile_id and password
 * @property {function} getPasswordForID - a method for getting the password for the given ID
 * */
const encryptionPassword = {
    passwords: [], //contains {profile_id: id, password: password}
    getPasswordForID: function(id){
        let index = this.passwords.findIndex(el => el.profile_id == id);
        (index != -1) ? console.log(`${index}: ${this.passwords[index].password}`): null;
        return (index == -1)? undefined : this.passwords[index].password;
    }
}; //initialized when the password profile that is selected is encrypted, and the user enters a password

const DOM_domain_name = document.getElementById("home-domain-span");
const DOM_domain_main_part = document.getElementById("home-service_name-input");
const DOM_user_password = document.getElementById("home-user_password-input");
const DOM_checkbox_lower_case = document.getElementById("home-lower_case-chckbx");
const DOM_checkbox_upper_case = document.getElementById("home-upper_case-chckbx");
const DOM_checkbox_numbers = document.getElementById("home-numbers-chckbx");
const DOM_checkbox_special_chars = document.getElementById("home-special_chars-chckbx");
const DOM_constant = document.getElementById("home-constant-input-hidden");
const DOM_generated_password = document.getElementById("home-generated_password");
const DOM_password_length = document.getElementById("home-pwd_length");
const DOM_password_length_label = document.getElementById("home-pwd_length_value-span");
const DOM_store_preference = document.getElementById("home-save_this_preference");

const DOM_error = document.getElementById("error-content");

// -------------------------- HELPER FUNCTION DEFINITIONS --------------------------


/**
* Opens database
 * @returns {Promise} Promise object representing the IDBDatabase object.
* */
function openIndiPrefDB(){
    return new Promise((resolve, reject) => {
        const dbOpenRequest = window.indexedDB.open("IndiPref");

        dbOpenRequest.onerror = function(event){
            reject("Error occured while opening the database 'GeneratorRules': " + event.target.error);
        }

        dbOpenRequest.onsuccess = function (event){
            resolve(event.target.result); // return the database object
        }
    });

}

/*return a promise that resolves with an object that contains the preferences for the active profile, and an array containing the preferences of all profiles*/
/**
 * Gets all the default preferences from browser.storage,local
 *
 * @returns {AllDefaultPreferences}
 * */
function getDefaultPreferences(){
    console.log(`Getting default preferences of all profiles...`);
    return browser.storage.local.get(["profiles", "preferences"])
        .then(result => {
            let activeProfileId = result.profiles.activeProfile;
            let activeProfile = result.preferences.find(el => el.id == activeProfileId);
            console.log(`The active profile is ${activeProfileId}, here is the active profile:`);
            console.log(activeProfile);
            console.log(`Here are all the profiles: `);
            console.log(result.preferences);
            return {
                activeProfile: activeProfile,
                allPreferencesArray: result.preferences
            };
        });
}

/*  return (a promise that resolves with) the entire array of individual preferences for the given profile
*   if the profile does not exist in the database, return an empty array
* */

/**
 * Get all individual preferences for given profile.
 * @param {IDBDatabase} the opened database object
 * @param {DefaultPreferences} profilePreference - the profile, for which we want to get individual preferences
 * @param {string} decrypt_password - password for decryption in case the profile is encrypted
 * @returns {Array} An array of all the individual preference objects.
 * */
function getAllIndiPrefsForActiveProfile(db, profilePreference, decrypt_password){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["preferences"], "readonly");
        const objStore = transaction.objectStore("preferences");

        const request = objStore.get(profilePreference.id);
        request.onerror = function(event){
            console.log(`An error occured getting the indiPrefs for ${profilePreference.id}`);
            console.log(event.target.error);
            reject(event.target.error);
        }
        request.onsuccess = function(event){
            console.log(`The entire database result for ${profilePreference.id} is: `);
            console.log(event.target.result);
            const result = event.target.result;

            //if the key for the profile does NOT exist, return an empty array
            if(result === undefined){
                resolve([]);
                return;
            }
            // if(Object.keys(result).length == 0){
            //     resolve([]);
            // }

            //if encrypted then decrypt
            if(profilePreference.encrypt === true){
                console.log(`Decrypting with password: [${decrypt_password}]`);
                decrypt(decrypt_password, result)
                    .then(result => resolve(JSON.parse(result)))
                    .catch(error => reject(error));
            }
            else {
                resolve(result);
            }
        }
    });
}

/*return the preference object for domain if found, otherwise undefined*/
/**
 * get the preference object for the specific domain from the global indiPrefs array
 * @returns {(IndividualPreference|undefined)} returns the preference object if it was found, otherwise undefined
 * */
function getPrefForDomain(domain){
    console.log(`Getting preference for domain: ${domain}`);
    return indiPrefs.find(el => el.domain == domain);
}

/*return the first preference object of a given service if found, otherwise undefined*/
/**
 * get the first preference object for the specific service from the global indiPrefs array
 * @returns {(IndividualPreference|undefined)} returns the preference object if it was found, otherwise undefined
 * */
function getPrefForService(service){
    return indiPrefs.find(el => el.service == service);
}
/*return an array of all the services that have been saved in the database*/
/**
 * get the names of all the services from the global indiPrefs array
 * @returns {Array} an array of all service names
 * */
function getAllServices(){
    let services = [];
    indiPrefs.forEach(el => {
        if(!services.includes(el.service)){
            services.push(el.service);
        }
    });

    return services;
}

/**
 * Takes the current preferences for the domain and service, and saves them for the particular profile in the database as an IndividualPreference
 *
 * @returns {void}
 * */
async function storePrefInDB(){
    const preference = {};
    //preference.profile =
    preference.service = DOM_domain_main_part.value;
    preference.domain = DOM_domain_name.innerText; // unique and used as key
    preference.encoding = {
        lower: DOM_checkbox_lower_case.checked,
        upper: DOM_checkbox_upper_case.checked,
        num: DOM_checkbox_numbers.checked,
        special: DOM_checkbox_special_chars.checked
    };
    preference.length = DOM_password_length.value;
    preference.constant = DOM_constant.value; //get the constant here

    //put the preference for domain in the array
    const indexOfPref = indiPrefs.findIndex(el => el.domain == preference.domain);
    if(indexOfPref != -1){
        //update the existing preference
        indiPrefs[indexOfPref] = preference;
    }
    else {
        //preference does not exist, push it into the array
        indiPrefs.push(preference);
    }

    //change the preference for all the services with the same name in the array
    indiPrefs.forEach(el => {
        if(el.service == preference.service){
            el.encoding = preference.encoding;
            el.length = preference.length;
            el.constant = preference.constant;
        }
    });

    //sort the array by service and domain
    indiPrefs.sort((firstEl, secondEl) => {
        let serviceToService = firstEl.service.localeCompare(secondEl.service);
        if(serviceToService != 0){
            return serviceToService;
        }
        else {
            return firstEl.domain.localeCompare(secondEl.domain);
        }
    });

    let storeData = indiPrefs;
    //put the array in the database
    if(preferencesDefault.encrypt){
        console.log(`Encrypting the rules before saving in the database`);

        storeData = await encrypt(encryptionPassword.getPasswordForID(preferencesDefault.id), JSON.stringify(storeData));
    }

    try{
        const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
        const objStore = transaction.objectStore("preferences");

        objStore.put(storeData, preferencesDefault.id);

        transaction.oncomplete = function(){
            let service = (preference.service.length > 12)? preference.service.substr(0, 12) + '&hellip;' : preference.service;
            let domain = (preference.domain.length > 12)? preference.domain.substr(0, 12) + '&hellip;' : preference.domain;
            displayAlert(`Preference for the domain <strong>"${domain}"</strong> under the service <strong>"${service}"</strong> was saved.`, "success", 3);
        }
    }
    catch (e) {
        console.log(e);
    }
}

/**
* Should return the domain name (url without the protocol, path to file, parameters, or anchors) including port, if there is one
* for more info see: https://developer.mozilla.org/en-US/docs/Learn/Common_questions/What_is_a_URL#basics_anatomy_of_a_url
 *
 * @param {string} url - the full url
 * @returns {string} the url string without the protocol or the path
* */
function get_url_without_protocol_or_path(url){ //e.g.: https://www.mozilla.org/en-US/
    const urlWithoutProtocol = url.replace(/(^\w+:|^)\/\//, ''); //e.g.: www.mozilla.org/en-US/
    const authority = urlWithoutProtocol.match(/[\w.:-]+/)[0]; //e.g.: www.mozilla.org

    return authority; //e.g. www.google.com or an IP address like 192.168.0.1:8080 - MAY CONTAIN port
}

/**
* Get the main part of the domain - i.e. without the subdomains, and public suffix (suffix includes e.g. the top level domain)
* e.g. it'll take "www.developer.mozilla.org" and return "mozilla".
*
* If it happens to be an IP address, it'll leave it that be.
*
* @returns {string} For the purposes of this app, the name of the service
* */
function get_main_domain_or_ip(domain_or_ip){
    const domain_or_ip_without_port = domain_or_ip.split(":")[0]; // ip without port

    //check if it is an ip address - return it including the port
    const ip_array = domain_or_ip_without_port.split(".");
    if (ip_array.length == 4) {
        for (let i = 0; i < 4; i++) {
            if ( 0 <= ip_array[i] && ip_array[i] <= 255 && !isNaN(ip_array[i]) ) {
                return domain_or_ip; //or return domain_or_ip_without_port to get rid of the port
            }
        }
    }
    const hostName = domain_or_ip_without_port;

    //if the string contains an IP address, return the IP address
    let matchIPv4 = domain_or_ip_without_port.match(/(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(:\d{1,5})?/g);
    if(matchIPv4 != null){
        return matchIPv4[0];
    }

    let result = domain_or_ip_without_port;

    try {
        publicSuffixList.parse(suffListData, punycode.toASCII);
        var tmpDomain = publicSuffixList.getDomain(hostName); //this will return "{label}.{public suffix}" according to publicsuffixlist
        var sld = tmpDomain.substr(0, tmpDomain.indexOf(".")); //get rid of the public suffix

        result = sld;
    }
    catch (err){
        console.log("some error whilst trying to cut off the public suffix from the url: " + err);
    }

    //if you don't pass a url with a valid public suffix, it will return an empty string, so in that case we can use what we got from the tab url
    return result == "" ? domain_or_ip_without_port: result;
}

/*debug function*/
function displayIndiPrefContent(){
    var objStore = indiPrefDB.transaction("preferences").objectStore("preferences");
    objStore.getAll().onsuccess = function(event){
        console.log(event.target.result);
    }
}

/**
 * Generates the password from the inputs (user password, service name, contant) and preferences (encoding, length)
 *
 * @returns {Promise} A promise that represents the generated password
 * */
function generatePassword(){
    const service_name = DOM_domain_main_part.value;
    const user_password = DOM_user_password.value;
    const constant = DOM_constant.value;
    const password_length = DOM_password_length.value;

    /**
     * gets the selection of character sets from the inputs, maps the selection onto the global variable CHARACTER_SETS and returns
     * an object with the relevant information for the next function to use
     * @returns {object} result_set - object with an array of all the subsets, and a string of all the subsets concatenated
     * */
    function getCharacterSet(){
        let result_set = {
            subsets: [], //individual subset strings
            complete_set: "" //all subsets concatenated
        };

        const characters_sets_selection = [
            {selected: DOM_checkbox_lower_case.checked, set_name: "lower_case"},
            {selected: DOM_checkbox_upper_case.checked, set_name: "upper_case"},
            {selected: DOM_checkbox_numbers.checked, set_name: "numbers"},
            {selected: DOM_checkbox_special_chars.checked, set_name: "special_chars"},
            ];

        characters_sets_selection.forEach(el => {
            if(el.selected){
                result_set.subsets.push(CHARACTER_SETS[el.set_name]);
                result_set.complete_set += CHARACTER_SETS[el.set_name];
            }
        });

        return result_set;
    }

    /** takes a string and hashes it N times with the crypto.subtle.digest function
     * @param {string} message - string to encrypt
     * @param {number} N - number of times to run digest function
     * @returns {ArrayBuffer} - a 512 bit ArrayBuffer representing the digested message
     * */
    async function hashNTimes_SHA512(message, N){
        const msgBuffer = new TextEncoder('utf-8').encode(message);

        // hash the message N times
        let hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer);
        for (let i = 1; i < N; i++) {
            hashBuffer = await crypto.subtle.digest('SHA-512', hashBuffer);
        }

        // const hashArray = Array.from(new Int8Array(hashBuffer));
        return hashBuffer;
    }

    /** encode the array buffer with the given character set
     * @param {ArrayBuffer} array_buffer - the 512 bit array buffer that is the result of the hashNTimes_SHA512 function
     * @param {object} character_set_selection - the object that is the result of the getCharacterSet function
     * */
    function encode_with_character_set(array_buffer, character_set_selection){
        //turn array buffer into uint8array
        const hashArray = Array.from(new Uint8Array(array_buffer));
        console.log(hashArray);

        let encoded_result = "";

        /*To ensure that even with short password lengths (minimum 4), at least 1 character from each selected set is present we do the following:
        * 1 set selected: We simply encode using this one set, no problem.
        * 2 sets selected: 1st character from the first set, 2nd from the second set, the rest from the common set (i.e. the 2 subsets concatenated)
        * 3 sets selected: 1st char from 1st set, 2nd char from 2nd set, 3rd char from 3rd set, the rest from the common set
        * 4 sets selected: 1st char from 1st set, 2nd char from 2nd set, 3rd char from 3rd set, 4th char from 4th set, the rest from the common set
        *
        * as a result, if we choose all four sets and the pwd len is 4, all four characters will each from from a selected subset
        * */
        let i = 0;
        for (let k = 0; k < character_set_selection.subsets.length; k++) {
            const charSubsetMap = character_set_selection.subsets[k].split(''); //an array
            encoded_result += charSubsetMap[ hashArray[k] % charSubsetMap.length ];
            i++;
        }
        const charSetMap = character_set_selection.complete_set.split('');
        for (let k = i; k < hashArray.length; k++) {
            encoded_result += charSetMap[hashArray[k] % charSetMap.length];
        }

        return encoded_result;
    }

    return hashNTimes_SHA512(user_password + constant + service_name, HASH_N_TIMES)
        .then(array_buffer => {
            const char_set= getCharacterSet();
            console.log(`The character set is: ${char_set}`);

            let encoded_result = encode_with_character_set(array_buffer, char_set);
            console.log(`Here is my password: [${encoded_result}]`);

            encoded_result = encoded_result.substr(0, password_length);
            return encoded_result;
        });
}

/** Returns an array of possible service name options derived from the subdomains. For example:
 * developer.mozilla.org -> ["mozilla", "developer.mozilla"]
 * a.b.c.d.[publicsuffix] -> ["d", "c.d", "b.c.d", "a.b.c.d"]
 *
 * @param {string} domain - the domain that was already extracted beforehand during initialization
 * @returns {Array} - an array of possible service name options derived from the subdomains*/
function getSubdomainsOptions(domain){
    //if there is an ip address in there, just return the IP address
    let matchIpv4Address = domain.match(/(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(:\d{1,5})?/g);
    if(matchIpv4Address != null){
        return matchIpv4Address;
    }

    publicSuffixList.parse(suffListData, punycode.toASCII);
    var publicSuffix = publicSuffixList.getPublicSuffix(domain);

    var splittedDomain = domain.split("."); console.log(splittedDomain);
    var subdomains = splittedDomain.slice(0, splittedDomain.indexOf(publicSuffix)); // array of subdomains without public suffix

    var optionstring = new String();
    let result = [];
    for (var i = subdomains.length - 1; i >= 0; i--) {
        optionstring = subdomains[i] + optionstring;
        result.push(optionstring);
        optionstring = "." + optionstring;
    }
    // console.log(`The possible subdomains are: `);
    // console.log(result);
    return result;
}

/** sets the rest of the details of the UI after the data has been loaded, such as the Generate button, the pwd options container,
 * the stored indicator badges, the password slider length label, and the datalist for the service input
 *
 * @param {Array} allServicesArray - an array of all the service names for the active profile
 * @returns {void}*/
function displayUIDetails(allServicesArray){
    //disable saving in incognito mode
    if(browser.extension.inIncognitoContext){
        DOM_store_preference.checked = false;
        DOM_store_preference.disabled = true;
    }

    //"generate and save" button
    if(DOM_store_preference.checked){
        document.getElementById("home-generate_password-btn").innerText = "Generate & Save";
        document.getElementById("toggle-save-preference-btn").innerText = "bookmark_add";
    }
    else{
        document.getElementById("home-generate_password-btn").innerText = "Generate";
        document.getElementById("toggle-save-preference-btn").innerText = "bookmark_border";
    }

    document.getElementById("home-pwd_options").classList.remove("changed");
    document.getElementById("home-pwd_options").classList.remove("from_storage");

    //show "these are saved preferences" badges
    if(isStored.domain){
       document.getElementById("stored_domain-tag").style.display = "block";
    }
    else{
        document.getElementById("stored_domain-tag").style.display = "none";
    }
    if(isStored.service){
        document.getElementById("stored_service-tag").style.display = "block";
        document.getElementById("home-pwd_options").classList.add("from_storage");
    }
    else {
        document.getElementById("stored_service-tag").style.display = "none";
    }

    //add the password length label
    DOM_password_length_label.innerText = DOM_password_length.value;

    //create a datalist for the Service Input
    const datalist = document.getElementById("home-service_name-datalist");
    datalist.innerHTML = "";
    allServicesArray.forEach(service => {
        let option = document.createElement("option");
        option.value = service;
        datalist.append(option);
    });


    document.getElementById("home-update_warning-container").hidden = true;

}

// ----------------------- MAIN FUNCTION AND/OR EVENT HANDLERS DEFINITIONS ------------------------------
/**initialize the popup
 * @returns {void}*/
async function initialize(){
    console.log(`Initializing!`);

    DOM_user_password.value = "";
    DOM_generated_password.value = "";

    //catch the errors here too!
    suffListData = await browser.storage.local.get("publicsuffix").then(result => result.publicsuffix.data);
    try {
        if(indiPrefDB === undefined) {
            indiPrefDB = await openIndiPrefDB(); //this has to be in a try catch box in case of incognito mode
        }
    } catch (error) {
        console.log(error);
    }

    //get the active profile
    //determine if it's encrypted - if yes, show the encrypted page
    //if not just show the regular page
    const preferences = await getDefaultPreferences();
    preferencesDefault = preferences.activeProfile;
    console.log(preferences);
    fillProfileSelect(preferences.allPreferencesArray, preferences.activeProfile.id);

    //catch errors here too
    const activeTabUrl = await browser.tabs.query({currentWindow: true, active: true}).then(tabs => tabs[0].url);
    const domain = get_url_without_protocol_or_path(activeTabUrl);
    const service_name = get_main_domain_or_ip(domain);
    DOM_domain_name.innerText = domain;
    DOM_domain_main_part.value = service_name;

    if(preferencesDefault.encrypt == true && encryptionPassword.getPasswordForID(preferencesDefault.id) === undefined){
        //display the decryption password segment, hide the others
        document.getElementById("popup-home").hidden = true;
        document.getElementById("popup-encryption_pwd").hidden = false;
        document.getElementById("encryption_pwd-input").value = "";
        document.getElementById("encryption_pwd-input").focus();
        //await the input of the password, the rest is handled in an event handler
    }
    else {
        document.getElementById("popup-encryption_pwd").hidden = true;

        try {//in case indiPrefDB is undefined
            //nacitaj vsetky indiPref aktualneho profilu
            indiPrefs = await getAllIndiPrefsForActiveProfile(indiPrefDB, preferencesDefault, encryptionPassword.getPasswordForID(preferencesDefault.id));
        }catch (error){
            console.log(error);
        }

        fillUIWithPreferences();
    }
}

/** resumes the initialization process after the user enters his decryption password for the profile, if it was needed
 * @returns {void}*/
async function encryptionPasswordInputHandler(){
    const input = document.getElementById("encryption_pwd-input");
    const password = input.value;

    console.log(`This is the password we got: ${password}`);

    try {
        if(indiPrefDB !== undefined){ //only proceed if database is not undefined, otherwise it'd throw an error
            console.log(`Getting the preferences for ${preferencesDefault.profile} with id ${preferencesDefault.profile}`);
            indiPrefs = await getAllIndiPrefsForActiveProfile(indiPrefDB, preferencesDefault, password); //this will throw an error if decryption fails
        }

        encryptionPassword.passwords.push({profile_id: preferencesDefault.id, password: password});

        document.getElementById("popup-home").hidden = false;
        document.getElementById("popup-encryption_pwd").hidden = true;

        //insert the same password in the password field
        DOM_user_password.value = password;
        DOM_user_password.select();

        //fill the UI with the preferences that were decrypted
        fillUIWithPreferences();
    } catch(error){
        console.log(error);
        displayAlert("Decryption error", "danger", 3);
    }
}

/** Part of initialization. Gets the preferences from the global variables (indiPrefs and defaultPreferences),
 * which have been initialized and filled previously, so that it can fill the UI.
 * @returns {void}
 * */
async function fillUIWithPreferences() {
    // LOADING THE PREFERENCES
    //check if there is a preference for this domain, if not, load the default preferences
    const domain = DOM_domain_name.innerText;
    const service_name = DOM_domain_main_part.value;

    const prefFromDB = getPrefForDomain(domain);
    const prefDefault = preferencesDefault;

    if (prefFromDB === undefined) {
        console.log(`Preference for domain "${domain}" not found in DB.`);
        console.log(`Searching for preference for service "${service_name}" instead...`);

        isStored.domain = false;

        const prefForService = await getPrefForService(service_name);
        if (prefForService === undefined) {
            console.log(`Preferences for service "${service_name}" not found either. Using default preferences.`);
            setPasswordPreferencesInHomepageUI(prefDefault);
            isStored.service = false;
        } else {
            console.log(`Using stored preferences for service "${service_name}" found in DB.`);
            preferenceForService = prefForService;
            setPasswordPreferencesInHomepageUI(prefForService);
            isStored.service = true;
        }

    } else {
        preferenceForService = prefFromDB;

        isStored.domain = isStored.service = true;

        console.log(`Using stored preferences for domain "${domain}" found in DB.`);
        //if the preference is loaded from the database we MUST use the name of the service and the constant that had been stored with it
        DOM_domain_main_part.value = prefFromDB.service;
        setPasswordPreferencesInHomepageUI(prefFromDB);
    }
    DOM_store_preference.checked = prefDefault.save_preferences;

    //ADDING THE AUTOFILL
    const subdomainslist = getSubdomainsOptions(domain);
    const allServices = getAllServices();

    let serviceNameOptionsArray = subdomainslist.concat(allServices);
    //filter out duplicates
    serviceNameOptionsArray = serviceNameOptionsArray.filter((el, index, thisArray) => {
       return thisArray.indexOf(el) === index;
    });

    displayUIDetails(serviceNameOptionsArray);
}

/**Sets the inputs in the UI - password encoding and password length
 * @param {object} prefs - preference object containing the PasswordEncoding, constant and length*/
function setPasswordPreferencesInHomepageUI(prefs){
    DOM_constant.value = prefs.constant;

    DOM_checkbox_lower_case.checked = prefs.encoding.lower;
    DOM_checkbox_upper_case.checked = prefs.encoding.upper;
    DOM_checkbox_numbers.checked = prefs.encoding.num;
    DOM_checkbox_special_chars.checked = prefs.encoding.special;
    DOM_password_length.value = prefs.length;
    DOM_password_length_label.innerText = prefs.length;
}
/** fill the profile select in the UI with the names of the profiles and sets the active profile as selected
 * @param {Array} preferences - an array containing all the DefaultPreferences objects (each representing a profile)
 * @param {number} activeProfileId - the id of the active profile
 * */
function fillProfileSelect(preferences, activeProfileId){
    const select = document.getElementById("heading-profile_select");
    select.innerHTML = "";

    preferences.forEach(el => {
        let option = document.createElement("option");
        option.value = el.id;
        option.innerText = el.profile;
        if(el.id == activeProfileId){
            option.selected = true;
        }
        select.append(option);
    });
}

//take the error place and append some error elements with children
/** Takes an error message and displaus the error in the UI
 * @param {string} alert_text - alert message
 * @param {string} alert_type - type of alert - danger, success, warning, etc.
 * @param {number} display_time - the length of time to keep the alert displayed for
 * @returns {void}*/
function displayAlert(alert_text, alert_type, display_time){
    const alerts_container = document.getElementById("alerts-container");

    switch(alert_type){
        case "danger": css_type = "alert-danger"; break;
        case "success": css_type = "alert-success"; break;
        case "info": css_type = "alert-info"; break;
        case "warning": css_type = "alert-warning"; break;
    }

    const newAlert = document.createElement("div");
    const span = document.createElement("span");
    span.classList.add("close_alert-btn");
    span.innerHTML = "&times;";
    span.addEventListener("click", function(){this.parentElement.style.display='none'});

    newAlert.classList.add("alert", css_type);
    newAlert.innerHTML = alert_text;
    newAlert.appendChild(span);

    alerts_container.appendChild(newAlert);
    if(display_time !== undefined) {
        setTimeout(function () {
            newAlert.style.opacity = 0;
        }, display_time * 1000);
        setTimeout(function () {
            alerts_container.removeChild(newAlert)
        }, display_time * 1000 + 500);
    }
}

/** displays the warning container warning the user about a potential change in the saved preferences
 * @param {string} argument - argument can be either "change" or "no-change"
 * @returns {void} */
function displayPotentialChangeInStorageWarning(argument){
    if(argument == "change") {
        document.getElementById("home-update_warning-container").hidden = false;
    }
    else {
        document.getElementById("home-update_warning-container").hidden = true;
    }
}

/** Selects the text in the generated password input field and copies it to the clipboard
 * @returns {void}*/
function copyGeneratePwdToClipboard(){
    console.log(`Copying generated password to clipboard...`);
    DOM_generated_password.type = "text";
    DOM_generated_password.select();
    document.execCommand("copy");
    DOM_generated_password.type = "password";
}

/** Handles the user input - pressing enter key on the user input field, or pressing the generate button.
 * Calls the relevant functions such as generatePassword or displayError, etc.
 * @param {Event} event*/
function generatePasswordHandler(event){
    if(!event.isTrusted){
        return;
    }

    let invalidInput = false;
    if(DOM_user_password.value == ""){
        //notify about the error
        displayAlert("Pasword field is empty.", "danger", 3); invalidInput = true;
    }
    //validate password length - redundant because we're using the slider anyway
    if(isNaN(DOM_password_length.value)  || DOM_password_length.value < 4 || DOM_password_length.value > 64){
        displayAlert("Invalid password length. Password length must be a number in the range of 4 and 64.", "danger", 3); invalidInput = true;
    }
    //validate that at least one character set was chosen
    if(!DOM_checkbox_lower_case.checked && !DOM_checkbox_upper_case.checked
        && !DOM_checkbox_numbers.checked && !DOM_checkbox_special_chars.checked){
        displayAlert("No character set chosen.", "danger", 3); invalidInput = true;
    }
    if(DOM_domain_main_part.value == ""){
        displayError("Service field is empty.", "danger", 3); invalidInput = true;
    }

    if(invalidInput){
        return;
    }

    //generate and display password in the password field
    generatePassword().then(encoded_result => {
        DOM_generated_password.value = encoded_result;
        DOM_generated_password.select();

        if(preferencesDefault.inject_into_content) {
            console.log(`Inserting generated password into content page...`);
            browser.tabs.query({active: true, currentWindow: true})
                .then(tabs => {
                    browser.tabs.executeScript(tabs[0].id, {file: "/browser-polyfill.js"});
                    browser.tabs.executeScript(tabs[0].id, {file: "/content_scripts/content_script.js"}).then(array => {
                        browser.tabs.sendMessage(tabs[0].id, {
                            message: "inject",
                            password: encoded_result
                        });
                    });
                });
        }

        if(preferencesDefault.copy_to_clipboard){
            copyGeneratePwdToClipboard();
        }
    });

    //store if desired
    if(DOM_store_preference.checked && event.key !== 'Enter'){
        //store rule in database
        storePrefInDB();
    }

    //hide the note about potential change in stored pwd preference
    displayPotentialChangeInStorageWarning("no-change");

}

/** Handles the event, where the user changes the service name. Tries to get the individual preference for that service and changes the displayed settings accordingly.
 * @param {Event}
 * @returns {void}*/
async function changeInServiceNameHandler(event){
    console.log("Service name change handler...");

    //validate the service name?
    if(DOM_domain_main_part.value == ""){
        document.getElementById("stored_service-tag").style.display = "none";
        document.getElementById("home-pwd_options").classList.remove("from_storage");
        return;
    }

    console.log(`Service field changed to: ${DOM_domain_main_part.value}`);
    try {
        //const pref = await getPreferenceForServiceFromDatabase(DOM_domain_main_part.value);
        const pref = getPrefForService(DOM_domain_main_part.value);
        if(pref !== undefined){
            preferenceForService = pref;
            setPasswordPreferencesInHomepageUI(pref);
            DOM_store_preference.checked = false;
            document.getElementById("stored_service-tag").style.display = "block";
            document.getElementById("home-pwd_options").classList.add("from_storage");
        }
        else {
            document.getElementById("stored_service-tag").style.display = "none";
            document.getElementById("home-pwd_options").classList.remove("from_storage");
        }
    }
    catch (error){
        console.log(error);
    }
}

/*Check if by saving the new preferences, we would be changing any stored preferences for the given service*/
/** Handles the event of changing the displayed preferences. Checks whether saving the preferences as displayed in the UI would overwrite existing preferences for the service in the database.
 * If so it will display a warning via the potentialChangeInStorageWarning function.
 * @returns {void}*/
function potentialUpdateOfPreferencesHandler(){
    if(DOM_store_preference.checked){
        document.getElementById("home-generate_password-btn").innerText = "Generate & Save";
        document.getElementById("toggle-save-preference-btn").innerText = "bookmark_add";
    }
    else {
        document.getElementById("home-generate_password-btn").innerText = "Generate";
        document.getElementById("toggle-save-preference-btn").innerText = "bookmark_border";
    }

    //compare the preferences in the UI with
    if(preferenceForService === undefined || Object.keys(preferenceForService).length == 0){
        return;
    }

    if(DOM_store_preference.checked && (
        DOM_checkbox_lower_case.checked != preferenceForService.encoding.lower ||
        DOM_checkbox_upper_case.checked != preferenceForService.encoding.upper ||
        DOM_checkbox_numbers.checked != preferenceForService.encoding.num ||
        DOM_checkbox_special_chars.checked != preferenceForService.encoding.special ||
        DOM_password_length.value != preferenceForService.length ||
        DOM_constant.value != preferenceForService.constant)){
        displayPotentialChangeInStorageWarning("change");

        document.getElementById("home-pwd_options").classList.add("changed");
        document.getElementById("home-pwd_options").classList.remove("from_storage");
    }
    else {
        displayPotentialChangeInStorageWarning("no-change");
        document.getElementById("home-pwd_options").classList.remove("changed");
        document.getElementById("home-pwd_options").classList.add("from_storage");
    }
}

/**Handles the event of changing the profile. Sets the activeProfile in the browser.storage and reinitializes the popup.
 * @param {Event}
 * @returns {void}*/
function profileChangeHandler(event){
    const select = event.target;
    const newActiveProfileID = select.value;
    console.log(`New activeProfile ID will be: ${newActiveProfileID}`);

    //set the default profile to a new one, reload
    browser.storage.local.get("profiles").then(result => {
        let profiles = result.profiles;

        profiles.activeProfile = newActiveProfileID;

        console.log(profiles);
        browser.storage.local.set({profiles: profiles}).then(result => {
            showPopupHome();
            initialize();
        });
    });
}

let qrcode;
/** Displays the QR code from the text within the generated password input field.  */
function showQRCode(){
    if(DOM_generated_password.value == ""){
        return;
    }

    window.setTimeout(function(){
        if(qrcode_container.innerHTML != ""){
            underlay.hidden = true;
            qrcode_container.innerHTML = "";
            qrcode.clear();
        }
    }, 5000);

    const underlay = document.getElementById("qrcode-underlay");
    const qrcode_container = document.getElementById("qrcode");

    underlay.hidden = false;
    underlay.addEventListener("click", function (){
        underlay.hidden = true;
        qrcode.clear();
        qrcode_container.innerHTML = "";
    });

    qrcode = new QRCode(qrcode_container, {
        text: DOM_generated_password.value,
        width: 128,
        height: 128
    });
    // }


}

// ------------------------- FUNCTION CALLS AND EVENT LISTENERS ----------------------------
initialize();

document.getElementById("encryption_pwd-input").addEventListener("change", encryptionPasswordInputHandler);
document.getElementById("encryption_pwd-submit").addEventListener("click", encryptionPasswordInputHandler);

//event listeners for changes
DOM_user_password.addEventListener("keypress", function(e){
    if(e.key === 'Enter') {
        generatePasswordHandler(e);
    }
});
document.getElementById("home-generate_password-btn").addEventListener("click", generatePasswordHandler);
document.getElementById("toggle-show-pwd-btn").addEventListener("click", function(event){
    const span = event.target;
    if(DOM_generated_password.type == "password" && DOM_generated_password.value != "") {
        DOM_generated_password.type = "text";
        span.innerText = "visibility";
    }
    else {
        DOM_generated_password.type = "password";
        span.innerText = "visibility_off";
    }
});
DOM_password_length.oninput = function(){
    document.getElementById("home-pwd_length_value-span").innerText = this.value;
}

DOM_domain_main_part.addEventListener("change", changeInServiceNameHandler);
DOM_domain_main_part.addEventListener("keypress", function(event){
    if(event.key === 'Enter') {
        DOM_user_password.focus();
    }
});

document.querySelectorAll('#home-pwd_options input').forEach(e => {
  e.addEventListener("change", potentialUpdateOfPreferencesHandler);
});
DOM_store_preference.addEventListener("change", potentialUpdateOfPreferencesHandler);

document.getElementById("heading-profile_select").addEventListener("change", profileChangeHandler);

document.getElementById("home-qr_code-btn").addEventListener("click", showQRCode);

document.getElementById("copy-generated-pwd-btn").addEventListener("click", copyGeneratePwdToClipboard);
/*TO-DO:
* //handle change in service name - validate and then find in database to load the preferences if they exist
* //validate input - password and at least one character set
* //add the option selects in the service input and "search" function
* add user announcement once the rules are saved in the database
* //add another preference - copy generated password to clipboard or fill in the password field automatically
* //handle the change in password preferences - warn the user whether he's about to change the stored preferences for some password...
* //let user know when the password options are default and when they are from the stored rule
* add a restore button to the warning about change to restore the settings to the same
* //zavriet note o zmene hesla ked uz heslo zmenime
*
* let's say we save one for messenger.com under "facebook", then we go to facebook.com - it doesn't load the already existing preference for "facebook",
* because we're loading the preferences for domain instead of for service, the preference does not exist yet
* - it's a problem, because when we then save a new preference facebook, it will overwrite the existing preference for messenger.com filed under facebook
* just warn them about the change i guess - whenever we're about to save, just check whether that'll overwrite any rules
*
* Or we can load the preferences for service facebook even when there is no preference for domain facebook.com saved. Ofc the problem with this approach is that
* we're now searching by service names as well not just domains, which means that if there was abc.eu and abc.com that we wished to have separate passwords for, now
* it's going to load the same preferences for abc.com and abc.eu despite the fact that they have different domains. - ofc this might be better in the sense that it will
* alert the user to the fact that these domains are different and that he will need to save on of them under a separate service name.
* */
