// ------------------ GLOBAL VARIABLES
const MAX_FILE_SIZE = 5;
let indiPrefDB;

let allPreferencesArray;
let tempAllPreferencesArray;

let allProfilesDefaults;

// --------------------- HELPER FUNCTIONS ------------------------------
/*return a promise that resolves with an object that contains the preferences for the active profile, and an array containing the preferences of all profiles*/
function getDefaultPreferences(){
    return browser.storage.local.get(["profiles", "preferences"])
        .then(result => {
            let activeProfileId = result.profiles.activeProfile;
            let activeProfile = result.preferences.find(el => el.id === activeProfileId);
            return {
                activeProfile: activeProfile,
                allPreferencesArray: result.preferences
            };
        });
}

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

/**/
function getPreferencesFromDB(){
    return new Promise((resolve) => {
        const transaction = indiPrefDB.transaction(["preferences"], "readonly");
        const objStore = transaction.objectStore("preferences");

        const index = objStore.index("service");

        index.getAll().onsuccess = function(event){
            resolve(event.target.result);
        }
    });
}

function getAllPrefsForProfileFromDB(db, storage_id){
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["preferences"], "readonly");
        const objStore = transaction.objectStore("preferences");

        console.log(`getting preferences for ${storage_id} from DB`);
        const request = objStore.get(storage_id);

        request.onerror = function(event){
            reject(event.target.error);
        }

        request.onsuccess = function(event){
            console.log(`Success!`);
            console.log(event.target.result);
            resolve(event.target.result);
        }

    });
}

function insertDefaultSettings(defaults){
    browser.storage.local.set({preferences: defaults});
}

function insertIndiPrefsIntoDB(indiPrefsArray){
    const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    const objStore = transaction.objectStore("preferences");

    /*TODO encrypt if needed*/
    const dataToStore = allPreferencesArray;
    if(allProfilesDefaults.activeProfile.encrypt){

    }
    objStore.put(dataToStore, allProfilesDefaults.activeProfile.id);

    //check each preference for its data validity adn reject any that are invalid
    //i.e. encoding - at least one has to be true, domain must be a valid url,
    //length must be a number within bounds, constant a not empty string, service a not empty string and a valid pdl
    // indiPrefsArray.forEach(pref => {
    //     objStore.put(pref);
    // });
    //
    // reloadDatabaseAndDisplay();
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
    //setTimeout(function(){myError.style.opacity = 0;}, 3000);
    //setTimeout(function(){errors_container.removeChild(myError)}, 4000);
}

function validateService(){

}

function validateLength(){

}

function validateEncoding(){

}

function validateConstant(){

}

function validateDomain(){

}

function isValidImportedJSON(object){
    //import object must have 2 keys: default_preferences and individual_preferences
    //defaults must contain:

    function isValidEncoding(encoding){
        if(encoding.lower === undefined || typeof encoding.lower !== "boolean" ||
            encoding.upper === undefined || typeof encoding.upper !== "boolean" ||
            encoding.num === undefined || typeof encoding.num !== "boolean" ||
            encoding.special === undefined || typeof encoding.special !== "boolean"){
            displayError("Encoding values have to be boolean");
            return false;
        }
        if(!encoding.lower && !encoding.upper && !encoding.num && !encoding.special){
            displayError("At least one encoding option has to be chosen");
            return false;
        }
        return true;
    }

    //check that the object has the 2 important keys
    if( !object.hasOwnProperty("default_preferences") || !object.hasOwnProperty("individual_preferences")){
        displayError("Missing default_preferences or individual_preferences");
        return false;
    }

    //check default preferences
    if(typeof object.default_preferences !== 'object' || object.default_preferences === null || Array.isArray(object.default_preferences)){
        displayError("default_preferences must be an object");
        return false;
    }
    const defaults = object.default_preferences;
    if(!defaults.hasOwnProperty("profile") ||
        !defaults.hasOwnProperty("length") ||
        !defaults.hasOwnProperty("constant") ||
        !defaults.hasOwnProperty("encoding") ||
        !defaults.hasOwnProperty("save_preferences")){
        displayError("default_preferences missing one of the properties");
        return false;
    }
    if(typeof defaults.profile !== 'string'){
        displayError("Profile needs to be a string");
        return false;
    }
    if(isNaN(defaults.length) || defaults.length < 4 || defaults.length > 64){
        displayError("Length not a number or out of bounds");
        return false;
    }
    if(defaults.constant){    }
    if(!isValidEncoding(defaults.encoding)){
        return false;
    }
    if(typeof defaults.save_preferences !== "boolean"){
        displayError("save preferences must be true or false");
        return false;
    }

    //check individual preferences
    if(!Array.isArray(object.individual_preferences)){
        return false;
    }
    const indiPrefs = object.individual_preferences;
    for(let i = 0; i < indiPrefs.length; i++){
        let pref = indiPrefs[i];
        if(typeof pref !== 'object' || pref === null || Array.isArray(pref)){
            return false;
        }
        if(!pref.hasOwnProperty("service") ||
            !pref.hasOwnProperty("domain") ||
            !pref.hasOwnProperty("constant") ||
            !pref.hasOwnProperty("encoding") ||
            !pref.hasOwnProperty("length")){
            return false;
        }
        if(typeof pref.service !== 'string'){ // !!!!!!!!!!!!!!!! check the validity of "pdl"
            return false;
        }
        if(typeof pref.domain !== 'string'){ //!!!!!!!!!!!!! check the validity of the domain too, needs to be a valid url
            return false;
        }
        if(!isValidEncoding(pref.encoding)){
            return false;
        }
        if(isNaN(pref.length) || pref.length < 4 || pref.length > 64){
            return false;
        }
        if(pref.constant){

        }
    }

    return true;
}

// ------------------------ MODiFYING THE TABLE ----------------------------

/*sort the preferences array by service first and then by domain*/
function sortAllPreferencesArray(){
    allPreferencesArray.sort((firstEl, secondEl) => {
        let serviceToService = firstEl.service.localeCompare(secondEl.service);
        if(serviceToService > 0){
            return 1;
        }
        else {
            return firstEl.domain.localeCompare(secondEl.domain);
        }
    });
}

/* Change the password settings of all the preference objects filed under a particular service*/
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
                case "password_length": el.value = len = (isNaN(el.value) || el.value < 4 || el.value > 64) ? 64 : el.value; break;
                case "lower_case": encoding.lower = el.checked; break;
                case "upper_case": encoding.upper = el.checked; break;
                case "numbers": encoding.num = el.checked; break;
                case "special_chars": encoding.special = el.checked; break;
                case "constant": constant = el.value.trim();
            }
        }
    });

    //validate password length

    //validate constant

    console.log(`The new preferences for ${service} are: [len:${len}, lower:${encoding.lower}, upper:${encoding.upper}, num:${encoding.num}, special:${encoding.special}, constant:${constant}]`);

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
    //load all the database objects of this service and update them accordingly
    // const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    // const objStore = transaction.objectStore("preferences");
    //
    // const index = objStore.index("service");
    // const keyRange = IDBKeyRange.only(service);
    // index.openCursor(keyRange).onsuccess = function(event){
    //     const cursor = event.target.result;
    //     if(cursor){
    //         const prefToUpdate = cursor.value;
    //
    //         prefToUpdate.encoding = encoding;
    //         prefToUpdate.length = len;
    //         prefToUpdate.constant = constant;
    //
    //         console.log(`Updating the preferences for the domain: ${prefToUpdate.domain}`);
    //         objStore.put(prefToUpdate);
    //         cursor.continue();
    //     }
    // }
}

/* Change all preferences under a particular service to a new service name. If the new service name already exists, it will also rewrite all the
* password preferences to match those of the existing service with the name we're changing to. */
function changeServiceName(event){
    const input = event.target;
    const service = input.dataset.service;
    const new_service_name = input.value;

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


    //load all the database objects of this service and update them accordingly
    // const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    // const objStore = transaction.objectStore("preferences");
    //
    // const index = objStore.index("service");
    // const keyRange = IDBKeyRange.only(service);
    // index.openCursor(keyRange).onsuccess = function(event){
    //     const cursor = event.target.result;
    //     if(cursor){
    //         const prefToUpdate = cursor.value;
    //
    //         prefToUpdate.service = new_service_name;
    //
    //         //if the new name already exists we have to change the preferences to match the preferences for that service
    //         if(newServiceNameAlreadyExists){
    //             prefToUpdate.length = newServiceNamePreference.length;
    //             prefToUpdate.encoding = newServiceNamePreference.encoding;
    //             prefToUpdate.constant = newServiceNamePreference.constant;
    //         }
    //
    //         console.log(`Updating the preferences for the domain: ${prefToUpdate.domain}`);
    //         objStore.put(prefToUpdate);
    //         cursor.continue();
    //     }
    // }

    //redraw the table
    //reloadDatabaseAndDisplay();
}

/* Delete all preferences filed under a particular service. */
function deleteService(event){
    const service = event.target.dataset.service;

    //get the indexes of all the services
    allPreferencesArray.every((pref, index, array) => {
        let strcmp = pref.service.localeCompare(service);
        if(strcmp <= 0) {
            if (strcmp === 0) {
                console.log(`Deleting the entry for domain ${pref.domain}`);

                array.splice(index, 1);
            }
            return true;
        }
        else { //break the loop when we've gone past the specified service - we can do this bcs the array is ordered by service and domain
            return false;
        }
    });

    displayPreferences(allPreferencesArray);


    // const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    // const objStore = transaction.objectStore("preferences");
    //
    // const index = objStore.index("service");
    // const keyRange = IDBKeyRange.only(service);
    // index.openCursor(keyRange).onsuccess = function(event){
    //     const cursor = event.target.result;
    //     if(cursor){
    //         const prefToDelete = cursor.value;
    //
    //         objStore.delete(prefToDelete.domain);
    //         cursor.continue();
    //     }
    // }

    //redraw the table
    //reloadDatabaseAndDisplay();
}

/* Eject domain from the service it's filed under. This means changing the service name for the domain. */
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

    //get the object from the database and chnage the
    // const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    // const objStore = transaction.objectStore("preferences");
    //
    // const request = objStore.get(domain);
    // request.onsuccess = function(event){
    //     const pref = event.target.result;
    //
    //     pref.service = pref.domain;
    //
    //     objStore.put(pref);
    // }
    //
    // reloadDatabaseAndDisplay();
}

/*Delete the preference for a specific domain*/
function deleteDomain(event){
    const domain = event.target.dataset.domain;
    console.log(`deleting domain: ${domain}`);

    const elIndexToDelete = allPreferencesArray.findIndex(pref => pref.domain === domain);
    allPreferencesArray.splice(elIndexToDelete, 1);

    displayPreferences(allPreferencesArray);

    // const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    // const objStore = transaction.objectStore("preferences");
    //
    // objStore.delete(domain);
    //
    // reloadDatabaseAndDisplay();
}

function deleteAllStoredPreferences(){
    allPreferencesArray = [];
    displayPreferences(allPreferencesArray);

    // const transaction = indiPrefDB.transaction(["preferences"], "readwrite");
    // const objStore = transaction.objectStore("preferences");
    //
    // objStore.clear();
    // reloadDatabaseAndDisplay();
}

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

function displayPreferences(prefArray){
    const table = document.getElementById("table");
    table.innerHTML = "";

    const tableHead = table.createTHead();
    const headRow = tableHead.insertRow();

    const tableHeadings = [
        `<span id="toggle-all-domains-rows" class="material-icons pointer">expand_less</span>`,
        "Service",
        "Length",
        "a-z",
        "A-Z",
        "0-9",
        "$#@",
        "Constant",
        "",
    ];

    tableHeadings.forEach(heading => {
        let th = document.createElement("th");
        th.innerHTML = heading;
        headRow.append(th);
    });

    document.getElementById("toggle-all-domains-rows").addEventListener("click", toggleAllDomainsRows);

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

function saveModifiedTable(){
    console.log(`saving the modified preferences into the database`);
    insertIndiPrefsIntoDB(allPreferencesArray);
}

// async function reloadDatabaseAndDisplay(){
//     const prefs = await getPreferencesFromDB();
//     allPreferencesArray = prefs;
//     displayPreferences(prefs);
// }

// --------------------------- EXPORTING AND IMPORTING ------------------------------
async function exportPreferences() {
    const downLoadsPermitted = await browser.permissions.contains({permissions: ["downloads"]});
    if(!downLoadsPermitted){
        console.log(`Downloads Permitted is: ${downLoadsPermitted}`);
        displayError("Please permit downloads in the permissions tab.");
        return;
    }

    const defaults = await browser.storage.local.get("preferences");
    const indiPrefs = await getPreferencesFromDB();

    const exportObject = {
        default_preferences: defaults.preferences,
        individual_preferences: indiPrefs
    };

    document.getElementById("database-result").innerHTML = JSON.stringify(exportObject, null, 4);

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

function importSettings(event){
    const input_file = event.target;
    const  file = input_file.files[0];
    if (file == null) {
        return;
    }

    if (file.type != "application/json") {
        displayError("Not a JSON file.")
        return;
    }

    if (file.size > (MAX_FILE_SIZE * 1024 * 1024)) {
        displayError("File too large");
        return;
    }

    var reader = new FileReader();
    reader.readAsText(file);

    reader.onload = function(event){
        const content = event.target.result;
        document.getElementById("database-result").innerHTML = content;

        try {
            let importedJSON = JSON.parse(content);

            if(!isValidImportedJSON(importedJSON)){
                displayError("Invalid format of preferences.")
                return;
            }

            //fill the default preferences
            insertDefaultSettings(importedJSON.default_preferences);

            //pass it to the function that will put the objects int the database
            insertIndiPrefsIntoDB(importedJSON.individual_preferences);
        }
        catch (error){
            displayError("Error parsing the JSON file.");
            console.log(error);
            return;
        }
    }
}
// ------------------------------- SYNCING WITH GOOGLE DRIVE -----------------------------

async function getExportObject(){
    const defaults = await browser.storage.local.get("preferences");
    const indiPrefs = await getPreferencesFromDB();

    return {
        default_preferences: defaults.preferences,
        individual_preferences: indiPrefs
    };
}

function uploadToGDrive(){
    //prepare the content to upload
    //stringify it
    browser.permissions.request({origins: ["*://www.googleapis.com/*"]}).then(permission => {
            getExportObject().then(putFileToDrive);
        }
    );
}

function downloadFromGDrive(){
    browser.permissions.request({origins: ["*://www.googleapis.com/*"]}).then(permission => {
            getFileFromDrive().then( content => {
                console.log(content);

                try {
                    let importedJSON = JSON.parse(content);

                    if(!isValidImportedJSON(importedJSON)){
                        displayError("Invalid format of preferences.")
                        return;
                    }

                    //fill the default preferences
                    insertDefaultSettings(importedJSON.default_preferences);

                    //pass it to the function that will put the objects int the database
                    insertIndiPrefsIntoDB(importedJSON.individual_preferences);
                }
                catch (error){
                    displayError("Error parsing the JSON file.");
                    console.log(error);
                    return;
                }
            });
        }
    );
}


async function initialize(){
    const IDBDatabeObject = await openIndiPrefDB();
    indiPrefDB = IDBDatabeObject;

    //get the active profile or whatever, decide which profile to get it from
    const allProfilesDefaultPreferences = await getDefaultPreferences();
    allProfilesDefaults = allProfilesDefaultPreferences;

    allPreferencesArray = tempAllPreferencesArray = await getAllPrefsForProfileFromDB(indiPrefDB, allProfilesDefaultPreferences.activeProfile.id);

    displayPreferences(tempAllPreferencesArray);
}

initialize();

document.getElementById("export-btn").addEventListener("click", exportPreferences);
document.getElementById("import-btn").addEventListener("change", importSettings);
document.getElementById("delete-all-btn").addEventListener("click", deleteAllStoredPreferences);
document.getElementById("upload-to-gdrive-btn").addEventListener("click", uploadToGDrive);
document.getElementById("download-from-gdrive-btn").addEventListener("click", downloadFromGDrive);
document.getElementById("save_changes-btn").addEventListener("click", saveModifiedTable);

/*
* Bugs: first domain in the domain row, if there are multiple domains - the eject and delete buttons don't work - they don't have event listeners attached
*
* TODO:
*  validate the service name and the constant when editing the table
* */