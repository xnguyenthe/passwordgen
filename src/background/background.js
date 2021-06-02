function logError(error){
    console.log(error);
}

/* Initialize Individual Rules Database "IndiPref", create relevant ObjectStore
*  returns a promise which resolves with the IDBDatabase object on success and an error on error
*/
function initIndiPrefDB() {
    return new Promise((resolve, reject) => {
        var dbOpenReq = window.indexedDB.open("IndiPref");

        dbOpenReq.onerror = function (event) {
            reject("Database 'IndiPref' open request error: " + dbOpenReq.error);
        }

        dbOpenReq.onupgradeneeded = function (event) {
            var db = dbOpenReq.result;
            var objStore = db.createObjectStore("preferences", {keyPath: "domain"});

            /*objects stored in this IDBObjectStore will have the following format:
            * { service: "mozilla",
            *   domain: "mozilla.org",
            *   encoding: {
            *       lower: true,
            *       upper: true,
            *       num: false,
            *       special: true
            *   },
            *   length: 64,
            *   constant: "my Constant"
            *  }
            * */
            objStore.createIndex("service", "service");
        }

        dbOpenReq.onsuccess = function (event) {
            resolve(dbOpenReq.result);
        }

    });
}

/*  Checks browse.storage.local for the public suffix data to see if the data is there or if it's up-to-date
*   New data is fetched and stored in broswer.storage.local if the data does NOT exist yet, or if it's > 1 month old
*
*   returns nothing
* */
function initPublicSuffDataStorage(){

    //fetch data and fill browser.storage.local with it
    function fillPublicSuffixStorage(){
        fetch("https://publicsuffix.org/list/public_suffix_list.dat")
            .then(response => {
                //handle xmlhttp error, e.g. code 400
                if(!response.ok){
                    throw Error("Failed to fetch the public suffix list: " + response.statusText);
                }
                return response.text();
            })
            .then(data => {
                const publicsuffix = {
                    data: data,
                    timestamp: String(new Date().getMonth() + 1) + " " + String(new Date().getFullYear())
                };
                browser.storage.local.set({publicsuffix: publicsuffix});
            })
            .catch(logError);
    }

    browser.storage.local.get("publicsuffix")
        .then(result => {
            //if the returned object is empty, it means the publicsuffix key has not been defined
            //if not defined we'll fill it
            if(Object.keys(result).length == 0){
                fillPublicSuffixStorage();
            }
            else {
                var currentDate = String(new Date().getMonth() + 1) + " " + String(new Date().getFullYear());
                const listversionDate = result.publicsuffix.timestamp;
                if (typeof listversionDate == 'undefined' || listversionDate.localeCompare(currentDate) != 0) {
                    fillPublicSuffixStorage();
                }
            }
        })
        .catch(logError);
}

/*
*   Initialize Default Preferences object in the browser.storage
*/
function initDefaultPreferences() {
    const preference = {
        //maybe add a name here, preferences might be an array with multiple preferences per user
        profile: "Profile_Name",
        length: "64",
        constant: "ChAnge_ME!!!",
        encoding: {"lower" : true, "upper": true, "num": true, "special": true},
        save_preferences: false,
        inject_into_content: true,
        copy_to_clipboard: true,
        encrypt: false,
        enc_salt: {},
        id: Date.now()
    }

    const profiles = {
        //or use a separate object for profiles
        //or instead use a variable called active profile which store the index of the preference
        activeProfile: preference.id,
        profileToStorageLookup: [
            {profile_id: preference.id, storage_id: preference.id} //this will only be if we use smth else as the user's id for identification in the storage
        ]
    }

    var p = browser.storage.local.get();
    p.then((prefObj) => {
            //if retrieved object has no keys (if no preferences are stored), then set default preferences
            if ( !prefObj.hasOwnProperty("preferences") ) {
                browser.storage.local.set({preferences: preference})
                    .catch(logError);
            }

            if( !prefObj.hasOwnProperty("profiles") ){
                browser.storage.local.set({profiles: profiles})
                    .catch(logError);
            }

    }).catch(logError);
}

/*
    Initialize the public suffix DB or update it
*/
function initExtension() {
    initPublicSuffDataStorage();
    initDefaultPreferences();

    initIndiPrefDB();
}



browser.runtime.onInstalled.addListener(initExtension);