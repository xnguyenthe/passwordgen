// ------------------ GLOBAL VARIABLES ----------------------------
const MAX_FILE_SIZE = 10;
const MAX_CONSTANT_LENGTH = 100;
const MAX_PROFILE_NAME_LENGTH = 20;
const MAX_SERVICE_NAME_LENGTH = 253;

const ALERT_DISPLAY_TIME_SHORT = 5;
const ALERT_DISPLAY_TIME_LONG = 10;

/**@type {IDBDatabase}*/
let indiPrefDB;

/** array of IndividualPreference objects
 * @type {Array}*/
let allPreferencesArray = [];
// let tempAllPreferencesArray;

/** all the default preferences of all the profiles
 * @type {AllDefaultPreferences}*/
let allProfilesDefaults;

/** @type{EncryptionPasswords}*/
let encryptionPassword = {
    passwords: [], //contains {profile_id: id, password: password}
    getPasswordForID: function(id){
        let index = this.passwords.findIndex(el => el.profile_id == id);
        console.log(index);
        return (index == -1)? undefined : this.passwords[index].password;
    }
}; //initialized when the password profile that is selected is encrypted, and the user enters a password

// --------------------- HELPER FUNCTIONS ------------------------------
/** Get the default preferences of all profiles
 * @returns {Promise} A promise which resolves with AllDefaultPreferences - an object containing the active profile's default preferences and an array of all profiles' default preferences*/
function getDefaultPreferences(){
    return browser.storage.local.get(["profiles", "preferences"])
        .then(result => {
            let activeProfileId = result.profiles.activeProfile;
            let activeProfile = result.preferences.find(el => el.id == activeProfileId);
            return {
                activeProfile: activeProfile,
                allProfiles: result.preferences
            };
        });
}
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

/*debugging function*/
function getEntireDB(){
    return new Promise((resolve) => {
        const transaction = indiPrefDB.transaction(["preferences"], "readonly");
        const objStore = transaction.objectStore("preferences");

        let object = {};
        objStore.openCursor().onsuccess = function(event){
            let cursor = event.target.result;
            if(cursor){
                object[cursor.key] = cursor.value;

                cursor.continue();
            }
            else{
                console.log(object);
                resolve(object);
            }
        }
    });
}

/**
 * Get all the IndividialPreference objects from the db, decrypt them if needed.
 * @param {IDBDatabase} db
 * @param {number} storage_id - the id, which serves as the key in the database
 * @param {boolean} encrypted - boolean value showing whether the profile is encrypted or not
 * @param {string} password - the password with which to decrypt the data if needed
 * @returns {Promise} Promise which represents the JSON Array of IndividualPreference objects*/
function getAllPrefsForProfileFromDB(db, storage_id, encrypted, password){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["preferences"], "readonly");
        const objStore = transaction.objectStore("preferences");

        console.log(`getting preferences for ${storage_id} from DB`);
        const request = objStore.get(storage_id);

        request.onerror = function(event){
            reject(event.target.error);
        }

        request.onsuccess = function(event){
            console.log(`Preferences for ${storage_id} are:`);
            console.log(event.target.result);
            if(event.target.result === undefined){
                resolve([]);
            }
            else{
                let prefs = event.target.result;
                if(encrypted){
                    console.log(`Decrypting with password ${password}`);
                    decrypt(password, prefs)
                        .then(result => resolve(JSON.parse(result)))
                        .catch(error => reject(error));
                }
                else {
                    resolve(prefs);
                }
            }
        }
    });
}
/** Deletes the entry, given by its key, from the database.
 * @param {number} storage_id - id of the entry to delete - this entry represents the entire set of individual preferences of a profile
 * @returns {Promise} A promise representing the string "done"*/
function deleteEntryForProfileFromDB(storage_id){
    return new Promise((resolve, reject) => {
        const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
        const objStore = transaction.objectStore("preferences");

        objStore.openCursor().onsuccess = function(event){
            var cursor = event.target.result;
            if (cursor) {
                if(cursor.key == storage_id){
                    cursor.delete();
                }
                cursor.continue();
            }
            else {
                resolve("done");
            }
        }
    });
}

/** Set the default preferences for the active profile (in browser.storage.local).
 * @param {DefaultPreferences} defaults - the new default preferences the active profile
 * @returns {void}*/
function insertDefaultSettings(defaults){
    //default settings for active profile
    //get active profile
    //update the active profile in storage preferences
    const activeProfileID = allProfilesDefaults.activeProfile.id;
    browser.storage.local.get("preferences").then(result => {
        const prefs = result.preferences;

        const index = prefs.findIndex(el => el.id == activeProfileID);
        // prefs[index].profile = defaults.profile;
        prefs[index].length = defaults.length;
        prefs[index].encoding = defaults.encoding;
        prefs[index].save_preferences = defaults.save_preferences;
        prefs[index].inject_into_content = defaults.inject_into_content;
        prefs[index].copy_to_clipboard = defaults.copy_to_clipboard;

        browser.storage.local.set({preferences: prefs});
    });
}

//this is for updating the database after changes have been made in the table in the UI
/** Take the array of IndividualPreference objects and put them all into the database. Encrypt them before putting them in the database if needed.
 * This functions accesses the global variable allProfileDefaults and encryptionPassword and indiPrefDB.
 * @param {Array} array of IndividualPreference
 * @returns {IDBRequest} An IDBRequest object on which subsequent events related to this operation are fired.*/
async function refillIndiPrefsOfProfileInDB(indiPrefsArray){
    //get the storageid
    const storage_id = allProfilesDefaults.activeProfile.id;

    let dataToStore = indiPrefsArray;
    if(allProfilesDefaults.activeProfile.encrypt){
        console.log(`Encrypting data for the database using password for profile ${allProfilesDefaults.activeProfile.id}`);
        dataToStore = await encrypt(encryptionPassword.getPasswordForID(allProfilesDefaults.activeProfile.id), JSON.stringify(dataToStore));
    }

    const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    const objStore = transaction.objectStore("preferences");
    return objStore.put(dataToStore, storage_id);

    //check each preference for its data validity adn reject any that are invalid
    //i.e. encoding - at least one has to be true, domain must be a valid url,
    //length must be a number within bounds, constant a not empty string, service a not empty string and a valid pdl
    // indiPrefsArray.forEach(pref => {
    //     objStore.put(pref);
    // });
    //
    // reloadDatabaseAndDisplay();
}

//this is for importing into the database
/** Gets the array of all IndividualPreference of the active profile from the DB, then takes a new Array of IndividualPreference objects
 * and puts them one by in the original array. If a preference exists, it gets updated, if not, it is pushed in. Sorts the updated array and then puts it back in the database.
 * @param {Array} array of IndividualPreference
 * @returns {IDBRequest} An IDBRequest object on which subsequent events related to this operation are fired.*/
async function putIndiPrefsForProfileInDB(indiPrefsArray){
    //first get them all out
    try {
        let id = allProfilesDefaults.activeProfile.id;
        let encrypt = allProfilesDefaults.activeProfile.encrypt;
        let prefs = await getAllPrefsForProfileFromDB(indiPrefDB, id, encrypt, encryptionPassword.getPasswordForID(id));

        indiPrefsArray.forEach(indiPref => {
            let indexFound = prefs.findIndex(el => el.domain == indiPref.domain);

            if(indexFound == -1){ //does NOT exist in the database, add it
                prefs.push(indiPref);
            }
            else{
                prefs[indexFound] = indiPref;
            }

        });

        //sort the array by service and domain
        prefs.sort((firstEl, secondEl) => {
            let serviceToService = firstEl.service.localeCompare(secondEl.service);
            if(serviceToService != 0){
                return serviceToService;
            }
            else {
                return firstEl.domain.localeCompare(secondEl.domain);
            }
        });

        console.log(prefs);
        return refillIndiPrefsOfProfileInDB(prefs);
    }
    catch (e) {
        console.log(e);
    }
}

//take the error place and append some error elements with children
/** Takes an alert message and displays the alert of a specified type in the UI in a specified place
 * @param {string} alert_text - alert message
 * @param {string} alert_placement - tell the function where to place the alert: all-profiles, decrypt-profile, encrypt-profile, export, import, etc
 * @param {string} alert_type - the type of alert - danger (red), success (green), warning (yellow), etc.
 * @param {number} display_time - the length of time the alert will remain displayed for in seconds
 * @returns {void}*/
function displayAlert(alert_text, alert_placement, alert_type,  display_time){
    let alerts_container = document.getElementById("errors-container");
    let css_type = "alert-danger";

    switch(alert_placement){
        case "all-profiles": alerts_container = document.getElementById("all_profiles-alert-container"); break;
        case "decrypt-profile": alerts_container = document.getElementById("decrypt_profile-alert-container"); break;
        case "encrypt-profile": alerts_container = document.getElementById("encrypt_profile-alert-container"); break;
        case "export": alerts_container = document.getElementById("export-alert-container"); break;
        case "import": alerts_container = document.getElementById("import-alert-container"); break;
    }

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
    newAlert.appendChild(span);
    newAlert.appendChild(document.createTextNode(alert_text));

    alerts_container.appendChild(newAlert);

    if(display_time !== undefined){
        setTimeout(function(){newAlert.style.opacity = 0;}, display_time * 1000);
        setTimeout(function(){alerts_container.removeChild(newAlert)}, display_time*1000 + 500);
    }
}

/** Validates the object, whether it complies with the format of our export/import objects.
 * @param {object} imported data
 * @returns {object}  return the validated object or null if we reject it completely*/
function validateImportedJSON(object){
    //import object must have 2 keys: default_preferences and individual_preferences
    //{
    //  default_preferences: {
    //      profile: "Profile Name",
    //      length: 50,
    //      ...
    //  },
    //  individual_preferences: [
    //      {
    //          service: mozilla
    //          domain: developer.mozilla.org,
    //          ...
    //      },
    //      ...
    //  ]
    // }

    /** validates the PasswordEncoding object itself - if it has the correct format/structure
     * @param {PasswordEncoding} encoding - the object containing the key value pairs for encoding
     * @returns {boolean} true if the object is valid*/
    function isValidEncodingObject(encoding){
        if(encoding.lower === undefined || typeof encoding.lower !== "boolean" ||
            encoding.upper === undefined || typeof encoding.upper !== "boolean" ||
            encoding.num === undefined || typeof encoding.num !== "boolean" ||
            encoding.special === undefined || typeof encoding.special !== "boolean"){
            // displayError("Encoding values have to be boolean", "import", 3);
            return false;
        }
        return true;
    }

    /** validates the encoding values - at least one value has to be true
     * @param {PasswordEncoding} encoding - the object containing the key value pairs for encoding
     * @returns {boolean} true if at least one value is true, otherwise false*/
    function isValidEncoding(encoding){
        if(!encoding.lower && !encoding.upper && !encoding.num && !encoding.special){
            // displayError("At least one encoding option has to be chosen");
            return false;
        }
        return true;
    }

    /** checks the validity of the domain string
     * @param {string} domain - the domain
     * @return {boolean} True if the domain is valid, false otherwise*/
    function isValidDomain(domain){
        //allows punycode notation too
        // let domainRegExp = new RegExp("^((?=[a-z0-9-]{1,63}\.)(xn--)?[a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,63}$", "i"); //from https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch08s15.html

        // return domainRegExp.test(domain);
        let validDomain =  /^((?=[a-z0-9-]{1,63}\.)(xn--)?[a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,63}(:\d{1,5})?$/i.test(domain); //with optional ports
        let validIpv4Address = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(:\d{1,5})?$/.test(domain); // ip address with optional ports

        if(!validDomain && !validIpv4Address){
            return false;
        }
        return true;
    }

    /** checks the validity of the service name - the trimmed string has to be shorter than X
     * @param {string} service - the service name
     * @returns {boolean} true is valid, otherwise false*/
    function isValidServiceName(service){
        //in theory we're allowing the service name to be anything - it doesn't have to have the structure of a domain name
        //but we want to impose at least some character limit, so we'll do 253 bcs that's the max lenth of a full domain name
        //https://webmasters.stackexchange.com/questions/16996/maximum-domain-name-length
        if(service.length > MAX_SERVICE_NAME_LENGTH || service.length < 1){
            return false;
        }
        return true;
    }

    /** checks the length of the constant, cannot be longer than max value
     * @param {string} constant - the constant
     * @returns {boolean} true is valid, otherwise false*/
    function isValidConstant(constant){
        if(constant.length > MAX_CONSTANT_LENGTH){
            return false;
        }
        return true;
    }

    /** checks the validity of length - has to be a number in range of 4 and 64
     * @param {(string|number)} length - the length
     * @returns {boolean} true is valid, otherwise false*/
    function isValidLength(length){
        if(length < 4 || length > 64){
            return false;
        }
        return true;
    }

    //check that the object has the 2 important keys
    if( !object.hasOwnProperty("default_preferences") || !object.hasOwnProperty("individual_preferences")){
        displayAlert("Missing default_preferences or individual_preferences", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }

    //check default preferences
    if(typeof object.default_preferences !== 'object' || object.default_preferences === null || Array.isArray(object.default_preferences)){
        displayAlert("'default_preferences' must be an object", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }
    const defaults = object.default_preferences;
    if(!defaults.hasOwnProperty("profile") ||
        !defaults.hasOwnProperty("length") ||
        !defaults.hasOwnProperty("constant") ||
        !defaults.hasOwnProperty("encoding") ||
        !defaults.hasOwnProperty("save_preferences") ||
        !defaults.hasOwnProperty("inject_into_content") ||
        !defaults.hasOwnProperty("copy_to_clipboard")
    ){
        displayAlert("default_preferences missing one of the properties", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }
    //maybe we could trim profile, or not
    if(typeof defaults.profile !== 'string' || defaults.profile.length > MAX_PROFILE_NAME_LENGTH || defaults.profile.length < 1){
        displayAlert("Profile name needs to be a string between 1 and 20 characters long", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }
    defaults.length = Number.parseInt(defaults.length);
    if(isNaN(defaults.length) || defaults.length < 4 || defaults.length > 64){
        displayAlert("Default length has to be an integer in range of 4 and 64.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }
    if(typeof defaults.profile !== 'string' || defaults.constant.length > MAX_CONSTANT_LENGTH){
        displayAlert("Default constant must a string of at most 100 characters long.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }
    if(!isValidEncodingObject(defaults.encoding)){
        displayAlert("Default encoding object has the wrong format.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }
    if(typeof defaults.save_preferences !== "boolean" ||
        typeof defaults.inject_into_content !== "boolean" ||
        typeof defaults.copy_to_clipboard !== "boolean"){
        displayAlert("save_preferences, inject_into_content, copy_to_clipboard must be true or false", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }

    //check individual preferences
    if(!Array.isArray(object.individual_preferences)){
        displayAlert("individual_preferences must be an array.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return null;
    }

    //delete any individual preference that is not valid... or fix it... and display an error message about it
    const indiPrefs = object.individual_preferences;
    let rejectedPrefsArray = []; //contains domains of rejected preferences
    for(let i = 0; i < indiPrefs.length; i++){
        let pref = indiPrefs[i];
        let reject = false;

        if(typeof pref !== 'object' || pref === null || Array.isArray(pref)){
            reject = true;
        }
        if(!pref.hasOwnProperty("service") ||
            !pref.hasOwnProperty("domain") ||
            !pref.hasOwnProperty("constant") ||
            !pref.hasOwnProperty("encoding") ||
            !pref.hasOwnProperty("length")){
            console.log(`properties are wrong for domain: ${pref.domain}`);
            reject = true;
        }
        else {
            if(typeof pref.service !== 'string' || !isValidServiceName(pref.service)){
                console.log(`service is wrong: ${pref.service}`);
                reject = true;
            }
            if(typeof pref.domain !== 'string' || ! isValidDomain(pref.domain)){
                console.log(`domain is wrong: ${pref.service}`);
                reject = true;
            }
            if(!isValidEncodingObject(pref.encoding) || !isValidEncoding(pref.encoding)){
                console.log(`encoding object format or validity is wrong for domain: ${pref.domain}`);
                reject = true;
            }
            pref.length = Number.parseInt(pref.length);
            if(isNaN(pref.length) || pref.length < 4 || pref.length > 64){
                console.log(`length is wrong: ${pref.length} for domain ${pref.domain}`);
                reject = true;
            }
            if(!isValidConstant(pref.constant)){
                console.log(`constant is wrong: ${pref.service} for domain ${pref.domain}`);
                reject = true;
            }
        }

        if(reject){
            (pref.hasOwnProperty("domain"))? rejectedPrefsArray.push(pref.domain) : null;
            indiPrefs.splice(i--, 1);
        }
    }

    if(rejectedPrefsArray.length > 0){
        displayAlert(`Preferences removed for incorrect data: ${rejectedPrefsArray.join(', ')}; total: ${rejectedPrefsArray.length}`, "import", "warning");
    }

    return object;
}

// ----------------------- PROFILES MANAGEMENT -----------------------------

/** validates the porfile name - name has to be shorter than 20 characters long
 * @returns {boolean} */
function isProfileNameValid(name){
    if(name.length > MAX_PROFILE_NAME_LENGTH){
        return false;
    }

    //could also check for duplicitous names, if we cared at all that is...
    return true;
}

/** Event Handler. Creates a profile (if the total number of profiles is less than 10.) and adds it to the relevant browser.storage.local.
 * After tge creation of the profile, it calles the initialize() function.
 * @returns {void} */
async function addProfile(){
    //check if there are more than 10 profiles
    //create a new profile in preferences, and also a new entry in profiles
    const new_preference = {
        //maybe add a name here, preferences might be an array with multiple preferences per user
        profile: "Profile_Name",
        length: "64",
        constant: "ChAnge_ME!!!",
        encoding: {"lower" : true, "upper": true, "num": true, "special": true},
        save_preferences: false,
        inject_into_content: true,
        copy_to_clipboard: false,
        encrypt: false,
        enc_salt: {},
        id: Date.now()
    }

    await browser.storage.local.get(["preferences", "profiles"]).then(result => {
        const prefs = result.preferences;
        const profiles = result.profiles;

        prefs.push(new_preference);
        profiles.profileToStorageLookup.push({profile_id: new_preference.id, storage_id: new_preference.id});

        browser.storage.local.set({preferences: prefs, profiles: profiles});
    });

    //create a new database entry for this profile
    try{
        const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
        const objStore = transaction.objectStore("preferences");

        console.log(`Adding new  record in the database for ${new_preference.id}`);
        objStore.put([], new_preference.id);
    }catch(error){
        console.log(error);
    }

    initialize();
}

/*debugging function*/
function logStorageContents(){
    browser.storage.local.get(result => console.log(result));
}

/** Event handler. Changes the name of the profile. then calls the initialize() function
 * @param {Event} event- event that was fired. The target should contain the id of the profile to modify in its dataset.
 * @returns {void}*/
function changeProfileName(event){
    const input = event.target;

    const profile_id = input.dataset.id;
    let new_profile_name = input.value.trim();

    if(!isProfileNameValid(new_profile_name)){
        displayAlert("Profile name can be at most 20 characters long", "all-profiles", "warning", ALERT_DISPLAY_TIME_SHORT);
        // input.value = input.dataset.name;
        new_profile_name = input.value = input.value.substr(0, MAX_PROFILE_NAME_LENGTH);
        // return;
    }

    console.log(`Profile with ID ${profile_id} to change its name to [${new_profile_name}]`);

    browser.storage.local.get("preferences").then(result => {
        const prefs = result.preferences;

        const indexToBeChanged = prefs.findIndex(el => el.id == profile_id);

        prefs[indexToBeChanged].profile = new_profile_name;

        browser.storage.local.set({preferences: prefs});
    }).then(() => {
        initialize();
    });
}

/** Event Handler. Deletes the profile. After deletion calls initialize().
 * @param {Event} event - an event whose target containes in its dataset the id of the profile to delete.
 * @returns {void}*/
async function deleteProfile(event){
    const deleteIcon = event.target;
    const profileID_toDelete = deleteIcon.dataset.id;

    if(!confirm(`Are you sure you want to delete the profile "${deleteIcon.dataset.name}"?`)){
        return;
    }


    //get the id of the profile
    //if it's the last profile only delete the database entry
    if(allProfilesDefaults.allProfiles.length < 2) {
        //delete all the database entries, set the default preferences back to default
        console.log(`Only 1 profile left, changing the default settings of the profile back to default.`)
        await browser.storage.local.get("preferences").then(result => {
            const prefs = result.preferences;

            const indexInProfileList = prefs.findIndex(el => el.id == profileID_toDelete);
            prefs[indexInProfileList].length = 64;
            prefs[indexInProfileList].constant = "ChAnge_ME!!!";
            prefs[indexInProfileList].encoding = {"lower" : true, "upper": true, "num": true, "special": true};
            prefs[indexInProfileList].save_preferences = false;
            prefs[indexInProfileList].inject_into_content = true;
            prefs[indexInProfileList].copy_to_clipboard = false;
            prefs[indexInProfileList].encrypt = false;
            prefs[indexInProfileList].enc_salt = {};


            browser.storage.local.set({preferences: prefs});
        });

        try{
            const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
            const objStore = transaction.objectStore("preferences");

            objStore.openCursor().onsuccess = function(event){
                var cursor = event.target.result;
                if (cursor) {
                    if(cursor.key == profileID_toDelete){
                        console.log(`Only emptying the preference contents for ${profileID_toDelete}, because it's the last profile`);
                        cursor.update([]);
                    }
                    cursor.continue();
                }
            }

            transaction.oncomplete = function(){
                initialize();
            }
        }catch (e) {
            console.log(e);
        }
    }
    else {
        await browser.storage.local.get(["preferences", "profiles"]).then(result => {
            const prefs = result.preferences;
            const profiles = result.profiles;

            //if we're deleting an activeProfile, change activeProfile to the first in the array
            if(profileID_toDelete == profiles.activeProfile){
                console.log(`Deleteing active profile ${profiles.activeProfile}: changing active profile to ${prefs[0].id}`);
                profiles.activeProfile = prefs[0].id;
            }
            const indexInLookup = profiles.profileToStorageLookup.findIndex(el => el.profile_id == profileID_toDelete);
            profiles.profileToStorageLookup.splice(indexInLookup, 1);

            const indexInProfileList = prefs.findIndex(el => el.id == profileID_toDelete);
            prefs.splice(indexInProfileList, 1);

            browser.storage.local.set({preferences: prefs, profiles: profiles});
        });

        //delete the database entry
        try{
            await deleteEntryForProfileFromDB(profileID_toDelete)
        }catch (e) {
            console.log(e);
        }

        initialize();
    }
}

/** Takes all the DefaultPreferences objects of all profiles, and then displas the names of all the profiles in the UI as text input fields.
 * This function accesses the allProfilesDefaults global variable.
 * @returns {void}*/
function displayProfiles(){
    let allProfiles = allProfilesDefaults.allProfiles;
    console.log(`These are all the profiles: `);
    console.log(allProfiles);

    const DOM_all_profiles = document.getElementById("all-profiles");
    DOM_all_profiles.innerHTML = "";

    allProfiles.forEach(profile => {
        let div = document.createElement("div");
        div.classList.add("all_profiles-profile-container")
        let input = document.createElement("input");
        input.value = profile.profile;
        input.dataset.id = profile.id;
        input.dataset.name = profile.profile;
        input.addEventListener("change", changeProfileName);
        div.append(input);
        if(profile.encrypt == true){
            let span = document.createElement("span");
            span.classList.add("material-icons");
            span.innerText = "lock";
            div.append(span);
        }

        let span = document.createElement("span");
        span.innerText = "delete";
        span.classList.add("pointer", "material-icons");
        span.dataset.id = profile.id;
        span.dataset.name = profile.profile;
        span.addEventListener("click", deleteProfile);

        DOM_all_profiles.append(div, span);
    });

    //add the input field and button for adding a new profile
    if(allProfiles.length < 10){
        // let input = document.createElement("input");
        // input.type = "text";
        // input.placeholder = "New Profile";
        // input.id = "create_profile-btn";
        let span = document.createElement("span");
        span.classList.add("material-icons", "pointer");
        span.addEventListener("click", addProfile);
        span.innerText = "person_add";

        DOM_all_profiles.append(span);
    }
}

// ------------------------ MODiFYING THE TABLE ----------------------------
function activateSaveChangesButton(){
    document.getElementById("save_changes-btn").classList.add("changed");
}

/** Sort the global variable allPreferencesArray array by service first and then by domain
 * @returns {void}*/
function sortAllPreferencesArray(){
    allPreferencesArray.sort((firstEl, secondEl) => {
        let serviceToService = firstEl.service.localeCompare(secondEl.service);
        if(serviceToService != 0){
            return serviceToService;
        }
        else {
            return firstEl.domain.localeCompare(secondEl.domain);
        }
    });
}

/** Change the password settings of all the IndividualPreference objects filed under a particular service. This function modifies the allPreferencesArray global variable.
 * @param {Event} event - event whose target contains the name of the service to be modified in its dataset attribute
 * @returns {void}
 * */
function changePasswordSettings(event){
    const input = event.target;
    const service = input.dataset.service;

    //get the preferences from UI
    let len, constant;
    let encoding = {
        lower: true,
        upper: true,
        num: true,
        special: true
    };
    document.querySelectorAll(".change-pwd-option").forEach(el => {
        if(el.dataset.service == service){
            switch (el.name){
                case "password_length": el.value = len = (isNaN(parseInt(el.value)) || el.value < 4 || el.value > 64) ? 64 : parseInt(el.value); break;
                case "lower_case": encoding.lower = el.checked; break;
                case "upper_case": encoding.upper = el.checked; break;
                case "numbers": encoding.num = el.checked; break;
                case "special_chars": encoding.special = el.checked; break;
                case "constant": constant = el.value = (el.value.length > MAX_CONSTANT_LENGTH)? el.value.substr(0, MAX_CONSTANT_LENGTH) : el.value; break;
            }
        }
    });

    //if the user tried to uncheck all the checkboxes, re-check the last one that was unchecked
    if(!encoding.lower && !encoding.upper && !encoding.num && !encoding.special){
        if(input.type == "checkbox"){
            input.checked = true;
            switch(input.name){
                case "lower_case": encoding.lower = true; break;
                case "upper_case": encoding.upper = true; break;
                case "numbers": encoding.num = true; break;
                case "special_chars": encoding.special = true; break;
            }
        }
    }

    // console.log(`The new preferences for ${service} are: [len:${len}, lower:${encoding.lower}, upper:${encoding.upper}, num:${encoding.num}, special:${encoding.special}, constant:${constant}]`);

    //change password settings for all the entries of a certain service
    allPreferencesArray.every(pref => {
        let strcmp = pref.service.localeCompare(service);
        if(strcmp <= 0) {
            if (strcmp === 0) {
                console.log(`Changing the preferences for domain ${pref.domain}`);
                pref.encoding = encoding;
                pref.length = len;
                pref.constant = constant;
            }
            return true;
        }
        else { //break the loop when we've gone past the specified service - we can do this bcs the array is ordered by service and domain
            return false;
        }
    });

    activateSaveChangesButton();
}

/** Change all IndividualPreferences under a particular service to a new service name. If the new service name already exists, it will also rewrite all the
 * password preferences to match those of the existing service with the name we're changing to. Afterwards calls sortAllPreferencesArray() and displayPreferences().
 * This function modifies the allPreferencesArray global variable.
 * @param {Event} event - event whose target contains the name of the service to be modified in its dataset attribute, and has the new name as its value
 * @returns {void}
 * */
function changeServiceName(event){
    const input = event.target;
    const service = input.dataset.service;
    const new_service_name = input.value;

    //validate wervice name
    if(new_service_name > MAX_SERVICE_NAME_LENGTH){
        displayAlert(`Maximum service name length is ${MAX_SERVICE_NAME_LENGTH} characaters`);
        new_service_name = input.value = input.value.substr(0, MAX_SERVICE_NAME_LENGTH);
    }

    //check if the new service name we're changing to already exists
    const newServiceNamePreference = allPreferencesArray.find(pref => {
        return pref.service == new_service_name;
    }); //return the first preference object that has the same service name as new_service_name, otherwise undefined

    let newServiceNameAlreadyExists = false;
    if(newServiceNamePreference !== undefined){
        newServiceNameAlreadyExists = true;
    }

    //find each service that matches the old name, change it to the new name
    allPreferencesArray.every(pref => {
        let strcmp = pref.service.localeCompare(service);
        if(strcmp <= 0) {
            if (strcmp === 0) {
                console.log(`Changing the service_name for domain ${pref.domain}`);
                pref.service = new_service_name;

                //if the new name already exists we have to change the preferences to match the preferences for that service
                if(newServiceNameAlreadyExists){
                    pref.length = newServiceNamePreference.length;
                    pref.encoding = newServiceNamePreference.encoding;
                    pref.constant = newServiceNamePreference.constant;
                }
            }
            return true;
        }
        else { //break the loop when we've gone past the specified service - we can do this bcs the array is ordered by service and domain
            return false;
        }
    });

    //sort the array again
    sortAllPreferencesArray();

    displayPreferences(allPreferencesArray);

    activateSaveChangesButton();
}

/** Delete all IndividualPreferences filed under a particular service. This function modifies the allPreferencesArray global variable. Afterwards calls displayPreferences().
 * @param {Event} event - event whose target contains the service name to be deleted in its dataset attribute
 * @returns {void}*/
function deleteService(event){
    const service = event.target.dataset.service;

    for(let i = 0; i < allPreferencesArray.length; i++){
        let strcmp = allPreferencesArray[i].service.localeCompare(service);
        if(strcmp <= 0) {
            if (strcmp === 0) {
                console.log(`Deleting the entry for the service: ${allPreferencesArray[i].service}, domain: ${allPreferencesArray[i].domain}`);

                allPreferencesArray.splice(i--, 1);
            }
        }
        else {
            break;
        }
    }

    displayPreferences(allPreferencesArray);
    activateSaveChangesButton();
}

/** Eject domain from the service it's filed under. This means changing the service name for the domain. Then calls the sortAllPreferencesArray() and displayPreferences().
 * This function modifies the allPreferencesArray global variable.
 * @param {Event} event - event whose target contains the service name and the domain of the IndividualPreference in its dataset attribute
 * @returns {void}*/
function ejectDomain(event){
    const el = event.target;
    console.log(`Ejecting ${el.dataset.domain}`);

    //ejecting means changing the service name for this domain to that of the domain
    //e.g. service: mozilla, domain: mozilla.org => service: mozilla.org
    //check whether the domain and service are not already the same (service: mozilla.org, domain: mozilla.org), if so return
    if(el.dataset.domain == el.dataset.service){
        return;
    }
    const domain = el.dataset.domain;

    const elIndexToChange = allPreferencesArray.findIndex(pref => pref.domain === domain);
    allPreferencesArray[elIndexToChange].service = allPreferencesArray[elIndexToChange].domain;

    sortAllPreferencesArray();

    displayPreferences(allPreferencesArray);
    activateSaveChangesButton();
}

/** Delete the IndividualPreference for a specific domain. This function modifies the allPreferencesArray global variable. Afterwards calls displayPreferences()
 * @param {Event} event - event whose target contains the domain to be deleted in its dataset
 * @returns {void}*/
function deleteDomain(event){
    const domain = event.target.dataset.domain;
    console.log(`deleting domain: ${domain}`);

    const elIndexToDelete = allPreferencesArray.findIndex(pref => pref.domain === domain);
    allPreferencesArray.splice(elIndexToDelete, 1);

    displayPreferences(allPreferencesArray);
    activateSaveChangesButton();
}

/** Delete all IndividualPreference objects from the array. This means reassigning an empty array to the global variable allPreferencesArray. Afterwards calls displayPreferences()
 * @returns {void}*/
function deleteAllStoredPreferences(){
    allPreferencesArray = [];
    displayPreferences(allPreferencesArray);
    activateSaveChangesButton();
}

/** Displays or hides the associated domains row.
 * @param {Event} event - the event whose target is the button that was clicked
 * @returns {void}*/
function toggleDomainsRow(event){
    const plus = event.target;
    const nextRow = plus.parentElement.parentElement.nextElementSibling;

    if(plus.textContent == "add"){
        //display the row
        nextRow.hidden = false;
        plus.innerText = "remove";
    }
    else {
        //hide the row
        nextRow.hidden = true;
        plus.innerText = "add";
    }
}

/** Displays or hides all the associated domains rows.
 * @param {Event} event - the event whose target is the button that was clicked
 * @returns {void}*/
function toggleAllDomainsRows(event){
    const expand = event.target;

    if(expand.textContent == "expand_more"){
        //display the row
        document.querySelectorAll(".associated-domains-row").forEach(el => {
            el.hidden = false;
        });
        document.querySelectorAll(".expand-domains-row").forEach(plus => plus.innerText = "remove");
        expand.innerText = "expand_less";
    }
    else {
        //hide the row
        document.querySelectorAll(".associated-domains-row").forEach(el => el.hidden = true);
        document.querySelectorAll(".expand-domains-row").forEach(plus => plus.innerText = "add");
        expand.innerText = "expand_more";
    }
}

/** Takes an array of IndividualPreference objects and displays them as a formatted table.
 * @param {Array} prefArray - an array of IndividualPreference objects*/
function displayPreferences(prefArray){
    const table = document.getElementById("table");
    table.innerHTML = "";

    const tableHead = table.createTHead();
    const headRow = tableHead.insertRow();

    const tableHeadings = [
        `<span id="toggle-all-domains-rows" class="material-icons pointer">expand_less</span>`,
        "Service",
        "n",
        "abc",
        "ABC",
        "012",
        "$#@",
        "Constant",
        `<span id="delete-all-preferences-btn" class="material-icons pointer">delete</span>`,
    ];

    tableHeadings.forEach(heading => {
        let th = document.createElement("th");
        th.innerHTML = heading;
        headRow.append(th);
    });

    document.getElementById("toggle-all-domains-rows").addEventListener("click", toggleAllDomainsRows);
    document.getElementById("delete-all-preferences-btn").addEventListener("click", deleteAllStoredPreferences);

    const tableBody = document.createElement("tbody");
    let service = "";
    for(let i = 0; i < prefArray.length; i++) {
        const pref = prefArray[i];

        //--------- Service and password preferences row
        let row = tableBody.insertRow();
        row.classList.add("preferences-row");

        //navigation +
        let td = row.insertCell();
        let plus = document.createElement("span");
        plus.innerText = "remove";
        plus.classList.add("pointer", "material-icons", "md-18", "expand-domains-row");
        plus.addEventListener("click", toggleDomainsRow);
        td.append(plus);

        //service
        td = row.insertCell();
        let input = document.createElement("input");
        input.type = "text";
        input.value = pref.service;
        input.classList.add("change-service-name");
        input.dataset.service = pref.service;
        input.name = "service";
        input.addEventListener("change", changeServiceName);
        td.append(input);

        //pwd length
        td = row.insertCell();
        input = document.createElement("input");
        input.classList.add("number");
        input.value = pref.length;
        input.classList.add("change-pwd-option");
        input.dataset.service = pref.service;
        input.name = "password_length";
        input.addEventListener("change", changePasswordSettings);
        td.append(input);

        //pwd lower case
        td = row.insertCell();
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = pref.encoding.lower;
        input.classList.add("change-pwd-option");
        input.dataset.service = pref.service;
        input.name = "lower_case";
        input.addEventListener("change", changePasswordSettings);
        td.append(input);
        td.classList.add("lower-column");

        //pwd upper case
        td = row.insertCell();
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = pref.encoding.upper;
        input.classList.add("change-pwd-option");
        input.dataset.service = pref.service;
        input.name = "upper_case";
        input.addEventListener("change", changePasswordSettings);
        td.append(input);
        td.classList.add("upper-column");

        //pwd numbers
        td = row.insertCell();
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = pref.encoding.num;
        input.classList.add("change-pwd-option");
        input.dataset.service = pref.service;
        input.name = "numbers";
        input.addEventListener("change", changePasswordSettings);
        td.append(input);
        td.classList.add("num-column");

        //pwd special
        td = row.insertCell();
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = pref.encoding.special;
        input.classList.add("change-pwd-option");
        input.dataset.service = pref.service;
        input.name = "special_chars";
        input.addEventListener("change", changePasswordSettings);
        td.append(input);
        td.classList.add("special-column");

        //pwd constant
        td = row.insertCell();
        input = document.createElement("input");
        input.type = "text";
        input.value = pref.constant;
        input.classList.add("change-pwd-option");
        input.dataset.service = pref.service;
        input.name = "constant";
        input.addEventListener("change", changePasswordSettings);
        td.append(input);

        //delete service
        td = row.insertCell();
        let span = document.createElement("span");
        span.classList.add("material-icons", "pointer");
        span.innerText = "delete";
        span.dataset.service = pref.service;
        span.addEventListener("click", deleteService);
        td.append(span);

        // tableBody.append(row);

        //------- Associated domains row
        row = tableBody.insertRow();
        row.classList.add("associated-domains-row");
        td = row.insertCell();
        td.colSpan = "9"; //the entire row will be a single cell

        td.innerHTML += `domains:<br><span class="material-icons md-18">subdirectory_arrow_right</span> ${pref.domain} `;

        //eject button
        let ejectspan = document.createElement("span");
        ejectspan.classList.add("material-icons", "md-18", "pointer", "eject-domain");
        ejectspan.innerText = "eject";
        ejectspan.dataset.domain = pref.domain;
        ejectspan.dataset.service = pref.service;
        // ejectspan.addEventListener("click", ejectDomain);
        //delete button
        let deletespan = document.createElement("span");
        deletespan.classList.add("material-icons", "md-18", "pointer", "delete-domain");
        deletespan.innerText = "delete_outline";
        deletespan.dataset.domain = pref.domain;
        // deletespan.addEventListener("click", deleteDomain);
        td.append(ejectspan, deletespan);
        for(let k = i+1; k < prefArray.length; k++){
            if(prefArray[k].service == prefArray[i].service) {
                td.innerHTML += `<br><span class="material-icons md-18">subdirectory_arrow_right</span> ${prefArray[k].domain} `;
                //eject button
                let eject = document.createElement("span");
                eject.classList.add("material-icons", "md-18", "pointer", "eject-domain");
                eject.innerText = "eject";
                eject.dataset.domain = prefArray[k].domain;
                eject.dataset.service = prefArray[k].service;
                // eject.addEventListener("click", ejectDomain);
                //delete button
                let del = document.createElement("span");
                del.classList.add("material-icons", "md-18", "pointer", "delete-domain");
                del.innerText = "delete_outline";
                del.dataset.domain = prefArray[k].domain;
                // del.addEventListener("click", deleteDomain);

                td.append(eject, del);

                i++;
            }
            else {
                break;
            }
        }
    }

    // table.append(tableHead);
    table.append(tableBody);

    document.querySelectorAll(".eject-domain").forEach(el => {
        el.addEventListener("click", ejectDomain);
    });
    document.querySelectorAll(".delete-domain").forEach(el => {
        el.addEventListener("click", deleteDomain);
    });
}

/** calls the refillIndiPrefsOfProfileInDB() function and passes it the allPreferencesArray global variable in order to save the preferences back in the database.
 * @returns {void}*/
function saveModifiedTable(){
    console.log(`saving the modified preferences into the database`);
    refillIndiPrefsOfProfileInDB(allPreferencesArray);
    document.getElementById("save_changes-btn").classList.remove("changed");
}

// --------------------------- EXPORTING AND IMPORTING ------------------------------

/** Gets the data to be exported, namely the default preferences of the profile, and its individual preferences. This function accesses the
 * allProfilesDefaults and allPreferencesArray global variables. Returns them in a new object.
 * @returns {$object} object containing the keys default_preferences and individual_preferences containing the aforementioned data.*/
async function getExportData(){
    // const defaults = await browser.storage.local.get("preferences");
    // const indiPrefs = await getPreferencesFromDB();

    return {
        default_preferences: allProfilesDefaults.activeProfile,
        individual_preferences: allPreferencesArray
    };
}

function insertImportedPreferencesIntoTable(indiPrefsArray){
    //get the global indiPrefs variable
    //insert the data in it
    //reload the table with the inserted data and highlight/activate the save button

    //allPreferencesArray
    indiPrefsArray.forEach(indiPref => {
        let indexFound = allPreferencesArray.findIndex(el => el.domain == indiPref.domain);

        if(indexFound == -1){ //does NOT exist, add it to the array
            allPreferencesArray.push(indiPref);
        }
        else{
            allPreferencesArray[indexFound] = indiPref;
        }

    });

    //sort the array by service and domain
    sortAllPreferencesArray();
    displayPreferences(allPreferencesArray);
    activateSaveChangesButton();
}

/** Uses browser,downloads to download the export object as a json object. Encrypts the data if necessary.
 * @returns {void}*/
async function exportPreferences() {
    const downLoadsPermitted = await browser.permissions.contains({permissions: ["downloads"]});
    if(!downLoadsPermitted){
        console.log(`Downloads Permitted is: ${downLoadsPermitted}`);
        displayAlert("Please permit downloads in the permissions tab.", "export", "danger", ALERT_DISPLAY_TIME_SHORT );
        return;
    }

    const exportObject = {};
    const exportData = await getExportData();
    //see the checkbox whether the user wants to encrypt
    //if yes, prompt the password
    //then stringify the exportobject and have it encrypted
    const exportEncrypted = document.getElementById("encrypt_export-checkbox").checked;
    if(exportEncrypted){
        const password_for_encryption = document.getElementById("export_file_encryption_pwd-input").value;

        //await encryption here
        if(password_for_encryption != null && password_for_encryption != "") {
            let encryptedData = await encrypt(password_for_encryption, JSON.stringify(exportData));
            console.log(encryptedData);

            exportObject.encrypted = true;
            exportObject.data = encryptedData;
        }
        else{
            displayAlert("You must enter an encryption password.", "export", "danger", ALERT_DISPLAY_TIME_SHORT);
            return;
        }


    }
    else{
        exportObject.data = exportData;
    }

    //document.getElementById("database-result").innerHTML = JSON.stringify(exportData, null, 4);

    const blob = new Blob([JSON.stringify(exportObject, null, 4)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);

    browser.downloads.download({
        url: url,
        filename: "pwdgen_settings.json"
    }).then(id => {
        console.log(`Download of item ${id} started`);
    }).catch(error => {
        console.log(error);
    });
}

/** Takes the data of the supplied file and checks the validity of the data. Then calls the insertDefaultSettings() to update the default setting of the profile,
 * and putIndiPrefsForProfileInDB() or insertImportedPreferencesIntoTable() to update individual preferences..
 * @param {Event} event - event whose target is the input with the file
 * @return {void}*/
function importSettings(event){
    const input_file = event.target;
    const  file = input_file.files[0];
    if (file == null) {
        return;
    }

    if (file.type != "application/json") {
        displayAlert("Not a JSON file.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return;
    }

    if (file.size > (MAX_FILE_SIZE * 1024 * 1024)) {
        displayAlert("File too large", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
        return;
    }

    var reader = new FileReader();
    reader.readAsText(file);

    reader.onload = async function(event){
        const content = event.target.result;

        try {
            let importedJSON = JSON.parse(content);


            let data;
            if(importedJSON.hasOwnProperty("encrypted") && importedJSON.encrypted == true){
                console.log(`data is encrypted... ${importedJSON.data}`);
                //decrypt the data first
                // let password = window.prompt("Enter a password to decrypt the message");

                document.getElementById("import_file_decryption_pwd-container").hidden = false;
                document.getElementById("import_file_decryption_pwd-input").value = "";
                document.getElementById("import_file_decryption_pwd-submit").addEventListener("click", importDataAfterDecryptionPwdInput);

                async function importDataAfterDecryptionPwdInput(){
                    const password = document.getElementById("import_file_decryption_pwd-input").value;
                    document.getElementById("import_file_decryption_pwd-container").hidden = true;
                    document.getElementById("import_file_decryption_pwd-submit").removeEventListener("click", importDataAfterDecryptionPwdInput);

                    if(password != null && password != "") {
                        try {
                            let decryptedData = await decrypt(password, importedJSON.data);
                            data = JSON.parse(decryptedData);
                        }
                        catch (e) {
                            displayAlert("Decryption error!", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
                            return;
                        }
                    }
                    else{
                        displayAlert("You must supply a decryption password.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
                        return;
                    }

                    data = validateImportedJSON(data);
                    if(data == null){
                        displayAlert("Imported data is corrupted.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
                        return;
                    }

                    insertDefaultSettings(data.default_preferences);
                    insertImportedPreferencesIntoTable(data.individual_preferences);
                }

            }
            else {
                data = importedJSON.data;

                // if(!isValidImportedJSON(data)){
                //     return;
                // }
                data = validateImportedJSON(data);
                if(data == null){
                    displayAlert("Imported data is corrupted.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
                    return;
                }

                // document.getElementById("database-result").innerHTML = JSON.stringify(data, null, 4);

                //update the default preferences for the active profile
                insertDefaultSettings(data.default_preferences);
                //update the IndividualPreferences in the database (for the active profile)
                // putIndiPrefsForProfileInDB(data.individual_preferences).then(e => {
                //     initialize();
                // });
                //or insert the data into the table, and not into the database directly
                insertImportedPreferencesIntoTable(data.individual_preferences);
            }
        }
        catch (error){
            displayAlert("Error parsing the JSON file.", "import", "danger",  ALERT_DISPLAY_TIME_SHORT);
            console.log(error);
            return;
        }
    }
}
// ------------------------------- SYNCING WITH GOOGLE DRIVE -----------------------------

/** Gets the export object and uploads it to Google Drive using the putFileToDrive() function. Encrypts the data beforehand if needed.
 * @returns {void}*/
function uploadToGDrive(){
    //prepare the content to upload
    //stringify it
    browser.permissions.request({origins: ["*://www.googleapis.com/*"]}).then(async function(permission){
        const exportObject = {};
        const exportData = await getExportData();

        const exportEncrypted = document.getElementById("encrypt_export-checkbox").checked;
        if(exportEncrypted){
            const password_for_encryption = document.getElementById("export_file_encryption_pwd-input").value;

            //await encryption here
            if(password_for_encryption != null && password_for_encryption != "") {
                let encryptedData = await encrypt(password_for_encryption, JSON.stringify(exportData));
                console.log(encryptedData);

                exportObject.encrypted = true;
                exportObject.data = encryptedData;
            }
            else{
                displayAlert("You must supply an encryption password", "export", "danger", ALERT_DISPLAY_TIME_SHORT);
                return;
            }

        }
        else{
            exportObject.data = exportData;
        }

        putFileToDrive(exportObject)
            .then(response => {
                displayAlert(`Successfully backed up file to Google Drive. File name: ${response.name}`, "export", "success", ALERT_DISPLAY_TIME_SHORT);
            })
            .catch(error => {
                console.log(error);
                displayAlert(`Could not back up file to Google Drive. ${error}`, "export", "danger", ALERT_DISPLAY_TIME_LONG);
            });
    });
}
/** Downloads data from drive using the getFileFromDrive function. Validates the data and the updates the relevant storage places.
 * @returns {void}*/
function downloadFromGDrive(){
    browser.permissions.request({origins: ["*://www.googleapis.com/*"]}).then(function(permission){

            getFileFromDrive()
                .then(async function(content){
                    // console.log(content);

                    try {
                        let importedJSON = JSON.parse(content);

                        let data;
                        if(importedJSON.hasOwnProperty("encrypted") && importedJSON.encrypted == true){
                            console.log(`data is encrypted... ${importedJSON.data}`);
                            //decrypt the data first
                            // let password = prompt("Enter a password to decrypt the message");

                            document.getElementById("import_file_decryption_pwd-container").hidden = false;
                            document.getElementById("import_file_decryption_pwd-input").value = "";
                            document.getElementById("import_file_decryption_pwd-submit").addEventListener("click", importDataAfterDecryptionPwdInput);

                            async function importDataAfterDecryptionPwdInput(){
                                const password = document.getElementById("import_file_decryption_pwd-input").value;

                                if(password != null && password != "") {
                                    try {
                                        let decryptedData = await decrypt(password, importedJSON.data);
                                        data = JSON.parse(decryptedData);

                                        //hide the password prompt now
                                        document.getElementById("import_file_decryption_pwd-container").hidden = true;
                                        document.getElementById("import_file_decryption_pwd-submit").removeEventListener("click", importDataAfterDecryptionPwdInput);
                                    } catch (e) {
                                        displayAlert("Decryption error!", "import", "danger",  ALERT_DISPLAY_TIME_SHORT);
                                        return;
                                    }
                                }
                                else{
                                    displayAlert("You must supply a decryption password.", "import", "danger", ALERT_DISPLAY_TIME_SHORT);
                                    return;
                                }

                                data = validateImportedJSON(data);
                                if(data == null){
                                    displayAlert("Invalid data.", "import", "danger",  ALERT_DISPLAY_TIME_SHORT);
                                    return;
                                }

                                insertDefaultSettings(data.default_preferences);
                                insertImportedPreferencesIntoTable(data.individual_preferences);
                            }
                        }
                        else {
                            data = importedJSON.data;

                            data = validateImportedJSON(data);
                            if(data == null){
                                displayAlert("Invalid data.", "import", "danger",  ALERT_DISPLAY_TIME_SHORT);
                                return;
                            }

                            //fill the default preferences
                            insertDefaultSettings(data.default_preferences);
                            //insert the data into the table, not into the database directly, and let the user save the changes manually
                            insertImportedPreferencesIntoTable(data.individual_preferences);
                        }
                    }
                    catch (error){
                        displayAlert(`Error parsing the JSON file. ${error}`, "import", "danger",  ALERT_DISPLAY_TIME_SHORT);
                        console.log(error);
                        return;
                    }
                })
                .catch(error => {
                    displayAlert(`Could not retrieve file from Google Drive: ${error}`, "import", "danger", ALERT_DISPLAY_TIME_LONG);
                });
        }
    );
}

//--------------------- MAIN FUNCTION AND EVENT HANDLERS -------------------------

/** Event Handler. Resumes the initialization process by decrypting the storage of the active profile in order to display the individual preferences etc.
 * @returns {void}*/
async function decryptionPasswordInputHandler(){
    const input = document.getElementById("profile_decryption_pwd-input");
    const password = input.value;

    console.log(`This is the password we got: ${password}`);

    try {
        console.log(`Getting the preferences for ${allProfilesDefaults.activeProfile.profile}`);
        allPreferencesArray = await getAllPrefsForProfileFromDB(indiPrefDB, allProfilesDefaults.activeProfile.id, allProfilesDefaults.activeProfile.encrypt, password);

        encryptionPassword.passwords.push({profile_id: allProfilesDefaults.activeProfile.id, password: password});
        document.getElementById("profile_decryption_password-container").hidden = true;
        document.getElementById("individual_preferences_section").hidden = false;

        document.getElementById("encrypt-profile-checkbox").checked = true;
        displayPreferences(allPreferencesArray);
    } catch(error){
        displayAlert(`Decryption error. ${error}`, "decrypt-profile", "danger", ALERT_DISPLAY_TIME_SHORT);
        console.log(error);
    }
}

/** Fills the select element in the HTML document with the options representing all the prrfiles.
 * @param {Array} profilesArray - an array DefaultPreferences objects
 * @param {number} activeProfileID - the id of the active profile
 * @returns {void}*/
function displayProfileSelect(profilesArray, activeProfileID){
    const select = document.getElementById("profile-select");
    select.innerHTML = "";

    profilesArray.forEach(profile => {
        let option = document.createElement("option");
        option.value = profile.id;
        option.innerText = profile.profile;
        if(profile.id == activeProfileID){
            option.selected = true;
        }
        select.append(option);
    });
}

/** Event Handler. Changes the active profile to a new one, when the user chooses another profile from the profile select. Afterwards calls initialize()
 * @param {Event} event - event whose target contains the id of the profile to change the active profile to as its value.
 * @returns {void}*/
function changeActiveProfileHandler(event){
    const select = event.target;
    const newActiveProfileID = select.value;
    console.log(`New activeProfile ID will be: ${newActiveProfileID}`);

    //set the default profile to a new one, reload
    browser.storage.local.get("profiles").then(result => {
        let profiles = result.profiles;

        profiles.activeProfile = newActiveProfileID;

        console.log(profiles);
        browser.storage.local.set({profiles: profiles}).then(result => {
            initialize();
        });
    });
}

/** Encrypts or decrypts the profile by changing its encrypt boolean value in the DefaultPreferences and also encrypts or decrypts its database entry. This function
 * accesses the global variables allProfilesDefaults.activeProfile and encryptionPassword. Afterwards calls initialize()
 * @param {Event} event - event whose target is the checkbox indicating either to encrypt or decrypt
 * @returns {void}
 * */
async function toggleEncryptProfile(event){
    const checkbox = event.target;
    let id = allProfilesDefaults.activeProfile.id;

    //ak sifrujeme, nastavime v profile encrypt na true, zavolame si obsah celej databazy daneho profilu, zasifrujeme, vlozime naspat, init(?)
    //encrypt the profile
    if(checkbox.checked){
        // let password = prompt("Enter a password for encryption");

        document.getElementById("profile_encryption_pwd-container").hidden = false;
        document.getElementById("profile_encryption_pwd-input").value = "";
        document.getElementById("profile_encryption_pwd-submit").addEventListener("click", encryptProfileAfterPwdInput);

        async function encryptProfileAfterPwdInput(){
            const password = document.getElementById("profile_encryption_pwd-input").value;
            document.getElementById("profile_encryption_pwd-container").hidden = true;
            document.getElementById("profile_encryption_pwd-submit").removeEventListener("click", encryptProfileAfterPwdInput);

            if(password == null || password == ""){
                displayAlert("No encryption password supplied.", "encrypt-profile", "danger", ALERT_DISPLAY_TIME_SHORT);
                checkbox.checked = false;
                return;
            }

            //musime upravit default preferences;
            allProfilesDefaults.activeProfile.encrypt = true;
            browser.storage.local.get("preferences").then(result => {
                let prefs = result.preferences;

                let index = prefs.findIndex(pref => pref.id == id);
                prefs[index].encrypt = true;
                //initialize salts here if necessary

                browser.storage.local.set({preferences: prefs});
            });

            encryptionPassword.passwords.push({profile_id: id, password: password});

            //vyberieme z databazy
            let indiprefs = await getAllPrefsForProfileFromDB(indiPrefDB, id, false, "");
            console.log(indiprefs);

            refillIndiPrefsOfProfileInDB(indiprefs);

            displayAlert("Encrypted!", "encrypt-profile", "success", ALERT_DISPLAY_TIME_SHORT);
        }
    }
    //decrypt the profile
    else {
        allProfilesDefaults.activeProfile.encrypt = false;
        browser.storage.local.get("preferences").then(result => {
            let prefs = result.preferences;

            let index = prefs.findIndex(pref => pref.id == id);
            prefs[index].encrypt = false;

            browser.storage.local.set({preferences: prefs});
        });

        let indiprefs = await getAllPrefsForProfileFromDB(indiPrefDB, id, true, encryptionPassword.getPasswordForID(id));
        await refillIndiPrefsOfProfileInDB(indiprefs);

        initialize();

        displayAlert("Decrypted!", "encrypt-profile", "success", ALERT_DISPLAY_TIME_SHORT);
    }

    //pokial odsifrujeme zoberiem existujuce heslo, ktore pouzivatel uz zadal, vyberieme obsah celej databazy, odsifrujeme a vlozime naspat ako JSON, init(?)
}

function toggleEncryptFileBeforeExport(){
    let encrypt = document.getElementById("encrypt_export-checkbox").checked;

    if(encrypt){
        document.getElementById("export_file_encryption_pwd-input").value = "";
        document.getElementById("export_file_encryption_pwd-row").style.display = "grid";
    }
    else{
        document.getElementById("export_file_encryption_pwd-row").style.display = "none";
    }
}

/** Initialize the options page. Get the default preferences of all profiles, display all profiles, display the profile select, and display the table etc.
 * @returns {void}*/
async function initialize(){
    document.getElementById("save_changes-btn").classList.remove("changed");
    document.getElementById("profile_encryption_pwd-container").hidden = true;
    // document.getElementById("export_file_encryption_pwd-container").hidden = true;
    document.getElementById("import_file_decryption_pwd-container").hidden = true;
    document.getElementById("export_file_encryption_pwd-row").style.display = "none";


    //open the preferences - fill the preferences tab
    const allProfilesDefaultPreferences = await getDefaultPreferences();
    allProfilesDefaults = allProfilesDefaultPreferences;

    displayProfiles();

    if(indiPrefDB === undefined) {
        const IDBDatabeObject = await openIndiPrefDB();
        indiPrefDB = IDBDatabeObject;
    }

    //zobraz select pre profilovu cast
    //prepinanie aktivneho profilu profilov pre select
    //export a import sa deje pre urcity akvitny profil
    displayProfileSelect(allProfilesDefaults.allProfiles, allProfilesDefaults.activeProfile.id);

    //if profile is encrypted, ask for the decryption password, if not, carry on displaying the preference table
    if(allProfilesDefaults.activeProfile.encrypt == true && encryptionPassword.getPasswordForID(allProfilesDefaults.activeProfile.id) === undefined){
        //display the dialog for getting the password
        document.getElementById("profile_decryption_password-container").hidden = false;
        document.getElementById("individual_preferences_section").hidden = true;

        document.getElementById("profile_decryption_pwd-input").value = "";
        document.getElementById("profile_decryption_pwd-input").focus();
    }
    else {
        document.getElementById("profile_decryption_password-container").hidden = true;
        document.getElementById("individual_preferences_section").hidden = false;
        document.getElementById("encrypt-profile-checkbox").checked = allProfilesDefaults.activeProfile.encrypt;
        let id = allProfilesDefaults.activeProfile.id;
        allPreferencesArray = tempAllPreferencesArray = await getAllPrefsForProfileFromDB(indiPrefDB, id, allProfilesDefaults.activeProfile.encrypt, encryptionPassword.getPasswordForID(id));
        displayPreferences(tempAllPreferencesArray);
    }


}

initialize();

document.getElementById("export-btn").addEventListener("click", exportPreferences);
document.getElementById("import-btn").addEventListener("change", importSettings);
// document.getElementById("delete-all-btn").addEventListener("click", deleteAllStoredPreferences);
document.getElementById("upload-to-gdrive-btn").addEventListener("click", uploadToGDrive);
document.getElementById("download-from-gdrive-btn").addEventListener("click", downloadFromGDrive);

document.getElementById("save_changes-btn").addEventListener("click", saveModifiedTable);
document.getElementById("restore_changes-btn").addEventListener("click", initialize);

document.getElementById("profile_decryption_pwd-submit").addEventListener("click", decryptionPasswordInputHandler);
document.getElementById("profile_decryption_pwd-input").addEventListener("change", decryptionPasswordInputHandler);

document.getElementById("profile-select").addEventListener("change", changeActiveProfileHandler);

document.getElementById("encrypt-profile-checkbox").addEventListener("change", toggleEncryptProfile);

document.getElementById("encrypt_export-checkbox").addEventListener("click", toggleEncryptFileBeforeExport);


/*
* Bugs: first domain in the domain row, if there are multiple domains - the eject and delete buttons don't work - they don't have event listeners attached
*
* */