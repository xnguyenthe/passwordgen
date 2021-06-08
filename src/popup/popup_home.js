// -------------------- GLOBAL CONSTANTS ---------------------------------

//DO NOT CHANGE THE CHARACTER SET or hash number because the algorithm will start generating different passwords
const CHARACTER_SETS = {
    lower_case: "abcdefghijklmnopqrstuvwxyz",
    upper_case: "QWERTYUIOPASDFGHJKLZXCVBNM",
    numbers: "1234567890",
    special_chars: '~!@#$%^&*()_+{}:"|<>?[];\'\\,./'
};
const HASH_N_TIMES = 1000;

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

let suffListData; //extracted suff list data from storage upon opening of the popup
let indiPrefDB; //DB object of the individual preferences upon opening of the popup

let indiPrefs = [];

/* Filled with the preferences for *domain* upon initialization (if it can be found),
*   and modified with the preferences for Service whenever the user changes the service field (if it can be found)
* data is taken from the indiPrefDB
*/
let preferenceForService = {};
let preferencesDefault = {};
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

// -------------------------- HELPER FUNCTION DEFINITIONS --------------------------

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
function getAllIndiPrefsForActiveProfile(db, profilePreference){
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

            }
            resolve(result);
        }
    });
}

/*return the preference object for domain if found, otherwise undefined*/
function getPrefForDomain(domain){
    return indiPrefs.find(el => el.domain == domain);
}

/*return the first preference object of a given service if found, otherwise undefined*/
function getPrefForService(service){
    return indiPrefs.find(el => el.service == service);
}
/*return an array of all the services that have been saved in the database*/
function getAllServices(){
    let services = [];
    indiPrefs.forEach(el => {
        if(!services.includes(el.service)){
            services.push(el.service);
        }
    });

    return services;
}

function storePrefInDB(){
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
    //change the preference for all the services with the same name in the array
    const indexOfPref = indiPrefs.findIndex(el => el.domain == preference.domain);
    if(indexOfPref != -1){
        //update the existing preference
        indiPrefs[indexOfPref] = preference;
    }
    else {
        //preference does not exist, push it into the array
        indiPrefs.push(preference);
    }

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
        if(serviceToService > 0){
            return 1;
        }
        else {
            return firstEl.domain.localeCompare(secondEl.domain);
        }
    });

    const storeData = indiPrefs;
    //put the array in the database
    if(preferencesDefault.encrypt){
        console.log(`Encrypting the rules before saving in the database`);
        //if it is to be encrypted then encrypt the storeData
    }

    const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    const objStore = transaction.objectStore("preferences");

    objStore.put(storeData, preferencesDefault.id);
}

/*
* Should return the domain name (url without the protocol, path to file, parameters, or anchors) including port, if there is one
* for more info see: https://developer.mozilla.org/en-US/docs/Learn/Common_questions/What_is_a_URL#basics_anatomy_of_a_url
* */
function get_url_without_protocol_or_path(url){ //e.g.: https://www.mozilla.org/en-US/
    const urlWithoutProtocol = url.replace(/(^\w+:|^)\/\//, ''); //e.g.: www.mozilla.org/en-US/
    const authority = urlWithoutProtocol.match(/[\w.:-]+/)[0]; //e.g.: www.mozilla.org

    return authority; //e.g. www.google.com or an IP address like 192.168.0.1:8080 - MAY CONTAIN port
}

/*
* Get the main part of the domain - i.e. without the subdomains, and public suffix (suffix includes e.g. the top level domain)
* e.g. it'll take "www.developer.mozilla.org" and return "mozilla".
*
* If it happens to be an IP address, it'll leave it that be.
*
* returns the so called "main part" (for the lack of a better term) of the domain, or the ip address if that's
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

//!! CAREFUL, we don't only update an existing value but should also change the value for all with the same service name
function storePreferenceForServiceInDB(){
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

    //find the all the entries that match with the same service name;

    const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    var objStore = transaction.objectStore("preferences");

    //update the preferences for every other domain that is also filed under the same service as the domain we're updating
    const index = objStore.index("service");
    const keyRange = IDBKeyRange.only(preference.service);
    index.openCursor(keyRange).onsuccess = function(event){
        const cursor = event.target.result;
        if(cursor){
            const prefToUpdate = cursor.value;
            if(prefToUpdate.domain != preference.domain) {
                prefToUpdate.encoding = preference.encoding;
                prefToUpdate.length = preference.length;
                prefToUpdate.constant = preference.constant;

                console.log(`Updating the preferences for the domain: ${prefToUpdate.domain}`);
                objStore.put(prefToUpdate);
            }
            cursor.continue();
        }
    }

    //update the preferences for the domain
    console.log(`Updating or storing the preference for ${preference.domain}`);
    objStore.put(preference);

}

function displayIndiPrefContent(){
    var objStore = indiPrefDB.transaction("preferences").objectStore("preferences");
    objStore.getAll().onsuccess = function(event){
        console.log(event.target.result);
    }
}

function generatePassword(){
    const service_name = DOM_domain_main_part.value;
    const user_password = DOM_user_password.value;
    const constant = DOM_constant.value;
    const password_length = DOM_password_length.value;

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


    function encode_with_character_set(array_buffer, character_set_selection){
        //turn array buffer into uint8array
        const hashArray = Array.from(new Uint8Array(array_buffer));
        console.log(hashArray);

        let encoded_result = "";

        /*To ensure that even with short password lengths (minimum 4), at least 1 character from each selected set is present we do the following:
        * 1 set selected: We simply encode using this one set, no problem.
        * 2 sets selected: 1st character from the first set, 2nd from the second set, the rest from the complete set (i.e. all the subsets concatenated)
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

/*
* Find an entry using domain as key in the database
* returns: Promise that resolves with an object returned by the database
*
* caution: if the object is NOT found, it will still successfully resolve but with undefined as the value
* */
function getPreferenceForDomainFromDatabase(domain){
    return new Promise((resolve, reject) => {
        if(indiPrefDB === undefined){
            resolve(undefined);
        }

        const transaction = indiPrefDB.transaction(["preferences"], "readonly");
        const objStore = transaction.objectStore("preferences");

        const request = objStore.get(domain);
        request.onerror = function(event){
            reject(event.target.error);
        }
        request.onsuccess = function(event){
            resolve(event.target.result);
        }
    });
}

function getPreferenceForServiceFromDatabase(service){
    return new Promise((resolve, reject) => {
        if(indiPrefDB === undefined){
            resolve(undefined);
        }

        const transaction = indiPrefDB.transaction(["preferences"], "readonly");
        const objStore = transaction.objectStore("preferences");

        console.log(`searching in the index for ${service}`);

        const index = objStore.index("service");
        const getReq = index.get(service);
        getReq.onerror = function(event){
            reject(event.target.error);
        }
        getReq.onsuccess = function(event){
            resolve(event.target.result);
        }
    });
}

function getAllServiceNames(){
    return new Promise((resolve, reject) => {
        if(indiPrefDB === undefined){
            resolve([]);
        }

        const transaction = indiPrefDB.transaction(["preferences"], "readonly");
        const objStore = transaction.objectStore("preferences");

        console.log(`Getting all service names... `);
        const result = [];

        const index = objStore.index("service");
        const getReq = index.openCursor(null, "nextunique");
        getReq.onerror = function(event){
            reject(event.target.error);
        }
        getReq.onsuccess = function(event){
            const cursor = event.target.result;
            if(cursor) {
                result.push(cursor.key);
                cursor.continue();
            }
            else{
                resolve(result);
            }
        }
    });
}

function getSubdomainsOptions(domain, service_name){
    var splittedDomain = domain.split(".");
    var subdomains = splittedDomain.slice(0, splittedDomain.indexOf(service_name)); // array of subdomains without public suffix

    var optionstring = new String();
    let result = [];
    for (var i = subdomains.length - 1; i >= 0; i--) {
        optionstring = subdomains[i] + optionstring;
        result.push(optionstring);
        optionstring = "." + optionstring;
    }
    return result;
}

function displayUIDetails(allServicesArray){
    //"generate and save" button
    if(DOM_store_preference.checked){
        document.getElementById("home-generate_password-btn").innerText = "Generate & Save";
        document.getElementById("toggle-save-preference-btn").innerText = "bookmark_add";
    }
    else{
        document.getElementById("home-generate_password-btn").innerText = "Generate";
        document.getElementById("toggle-save-preference-btn").innerText = "bookmark_border";
    }

    //show "these are saved preferences" badges
    if(isStored.domain){
        // console.log(`displaying stored domain tag`)
       document.getElementById("stored_domain-tag").style.display = "inline";
    }
    if(isStored.service){
        // console.log(`displaying stored service tag`)
        document.getElementById("stored_service-tag").style.display = "block";
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
}


// ----------------------- MAIN FUNCTION AND/OR EVENT HANDLERS DEFINITIONS ------------------------------
function setPasswordPreferencesInHomepageUI(prefs){
    DOM_constant.value = prefs.constant;

    DOM_checkbox_lower_case.checked = prefs.encoding.lower;
    DOM_checkbox_upper_case.checked = prefs.encoding.upper;
    DOM_checkbox_numbers.checked = prefs.encoding.num;
    DOM_checkbox_special_chars.checked = prefs.encoding.special;
    DOM_password_length.value = prefs.length;
    DOM_password_length_label.innerText = prefs.length;
}

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

//load the database with rules and load the pub suffix list
//load the preferences
async function initialize(){
    console.log(`Initializing!`);

    //catch the errors here too!
    suffListData = await browser.storage.local.get("publicsuffix").then(result => result.publicsuffix.data);
    try {
        indiPrefDB = await openIndiPrefDB(); //this has to be in a try catch box in case of incognito mode
    } catch (error) {
        console.log(error);
    }

    //get the active profile
    //determine if it's encrypted - if yes, show the encrypted page
    //if not just show the regular page
    const preferences = await getDefaultPreferences();
    preferencesDefault = preferences.activeProfile;
    console.log(preferences);
    if(preferencesDefault.encrypt == true){

    }
    else {

    }

    fillProfileSelect(preferences.allPreferencesArray, preferences.activeProfile.id);


    //fill the user select in html document
    try {
        indiPrefs = await getAllIndiPrefsForActiveProfile(indiPrefDB, preferencesDefault);
    }catch (error){
        console.log(error);
    }


    //catch errors here too
    const activeTabUrl = await browser.tabs.query({currentWindow: true, active: true}).then(tabs => tabs[0].url);
    const domain = get_url_without_protocol_or_path(activeTabUrl);
    DOM_domain_name.innerText = domain;
    const service_name = get_main_domain_or_ip(domain);
    DOM_domain_main_part.value = service_name;

    // LOADING THE PREFERENCES
    //check if there is a preference for this domain, if not, load the default preferences
    const prefFromDB = getPrefForDomain(domain);
    const prefDefault = preferencesDefault;

    if(prefFromDB === undefined){
        console.log(`Preference for domain "${domain}" not found in DB.`);
        console.log(`Searching for preference for service "${service_name}" instead...`);

        isStored.domain = false;

        const prefForService = await getPrefForService(service_name);
        if(prefForService === undefined){
            console.log(`Preferences for service "${service_name}" not found either. Using default preferences.`);
            setPasswordPreferencesInHomepageUI(prefDefault);
            isStored.service = false;
        }
        else{
            console.log(`Using stored preferences for service "${service_name}" found in DB.`);
            preferenceForService = prefForService;
            setPasswordPreferencesInHomepageUI(prefForService);
            isStored.service = true;
        }

    }
    else {
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
    console.log(`Subdomains options: `);
    console.log(subdomainslist, service_name);

    const allServicesArray = getAllServices();

    displayUIDetails(allServicesArray);
}

//take the error place and append some error elements with children
function displayError(error_text){
    const errors_container = document.getElementById("errors-container");

    const myError = document.createElement("div");
    const span = document.createElement("span");
    span.classList.add("close_alert-btn");
    span.innerHTML = "&times;";
    span.addEventListener("click", function(){this.parentElement.style.display='none'});

    myError.classList.add("alert", "alert-danger");
    myError.appendChild(span);
    myError.appendChild(document.createTextNode(error_text));

    errors_container.appendChild(myError);
    setTimeout(function(){myError.style.opacity = 0;}, 3000);
    setTimeout(function(){errors_container.removeChild(myError)}, 4000);
}

function displayPotentialChangeInStorageWarning(argument){
    if(argument == "change") {
        document.getElementById("home-update_warning-container").hidden = false;
    }
    else {
        document.getElementById("home-update_warning-container").hidden = true;
    }
}

function copyGeneratePwdToClipboard(){
    console.log(`Copying generated password to clipboard...`);
    DOM_generated_password.type = "text";
    DOM_generated_password.select();
    document.execCommand("copy");
    DOM_generated_password.type = "password";
}

function generatePasswordHandler(event){
    if(!event.isTrusted){
        return;
    }

    let invalidInput = false;
    if(DOM_user_password.value == ""){
        //notify about the error
        displayError("Pasword field is empty."); invalidInput = true;
    }
    //validate password length - redundant because we're using the slider anyway
    if(isNaN(DOM_password_length.value)  || DOM_password_length.value < 4 || DOM_password_length.value > 64){
        displayError("Invalid password length. Password length must be a number in the range of 4 and 64."); invalidInput = true;
    }
    //validate that at least one character set was chosen
    if(!DOM_checkbox_lower_case.checked && !DOM_checkbox_upper_case.checked
        && !DOM_checkbox_numbers.checked && !DOM_checkbox_special_chars.checked){
        displayError("No character set chosen."); invalidInput = true;
    }
    if(DOM_domain_main_part.value == ""){
        displayError("Service field is empty."); invalidInput = true;
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
    if(DOM_store_preference.checked){
        //store rule in database
        //storePreferenceForServiceInDB();
        storePrefInDB();
    }

    //hide the note about potential change in stored pwd preference
    displayPotentialChangeInStorageWarning("no-change");

}

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
function showQRCode(){
    if(DOM_generated_password.value == ""){
        return;
    }

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

    // window.setTimeout(function(){
    //     qrcode_container.innerHTML = "";
    //     underlay.hidden = true;
    //     }, 5000);
}

// ------------------------- FUNCTION CALLS AND EVENT LISTENERS ----------------------------
initialize();

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
DOM_store_preference.addEventListener("click", potentialUpdateOfPreferencesHandler);

document.getElementById("heading-profile_select").addEventListener("change", profileChangeHandler);

document.getElementById("home-qr_code-btn").addEventListener("click", showQRCode);

document.getElementById("copy-generated-pwd-btn").addEventListener("click", copyGeneratePwdToClipboard);
/*TO-DO:
* handle change in service name - validate and then find in database to load the preferences if they exist
* //validate input - password and at least one character set
* add the option selects in the service input and "search" function
* add user announcement once the rules are saved in the database
* add another preference - copy generated password to clipboard or fill in the password field automatically
* handle the change in password preferences - warn the user whether he's about to change the stored preferences for some password...
* let user know when the password options are default and when they are from the stored rule
* add a restore button to the warning about change to restore the settings to the same
* zavriet note o zmene hesla ked uz heslo zmenime
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

//TODO: deal with incognito mode
//TODO: localize!!!
