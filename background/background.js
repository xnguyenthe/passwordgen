/*******************************************************************************
Copyright © 2018 Daniel Kubica

This file is part of PasswordGen.

   PasswordGen is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   PasswordGen is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with PasswordGen.  If not, see <http://www.gnu.org/licenses/>.
********************************************************************************
                 GitHub: https://github.com/DanKub/PasswordGen
*******************************************************************************/


var suffListDB;
var genRulesDB;

var preferences = {
    length: "86",
    constant: "ChAnge_ME!!!",
    base64: true,
    hex: false,
    time: "0",
    store: true,
    use_stored: true
}

/*
Put Public Suffix List data into IndexedDB
*/
function putSuffListDataToDB(data) {
    var transaction = suffListDB.transaction(["pubsufflist"], "readwrite");
    var objStoreReq = transaction.objectStore("pubsufflist");
    objStoreReq.put(data, "psl");

    transaction = suffListDB.transaction(["listversion"], "readwrite");
    objStoreReq = transaction.objectStore("listversion");
    var currentDate = String(new Date().getMonth() + 1) + " " + String(new Date().getFullYear());
    objStoreReq.put(currentDate, "pslversion");
}

/*
Download Public Suffix List and put it to IndexedDB
*/
function getSuffList() {
    var suffListPath = "https://publicsuffix.org/list/public_suffix_list.dat";
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", suffListPath, true);
    xmlHttp.responseType = "text";
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            putSuffListDataToDB(xmlHttp.response);
        }
    }
    xmlHttp.send(null);
}

/*
Check if locally stored Public Suffix List isn't older than 1 month.
In case that it's older, update list with new version from web.
*/
function updateSuffList() {
    var currentDate = String(new Date().getMonth() + 1) + " " + String(new Date().getFullYear());

    var transaction = suffListDB.transaction(["listversion"], "readonly");
    var objStoreReq = transaction.objectStore("listversion").get("pslversion");

    objStoreReq.onsuccess = function (event) {
        var listversionDate = objStoreReq.result;
        if (listversionDate.localeCompare(currentDate) != 0) {
            console.log("Downloading new version of Public Suffix List to local IndexedDB");
            getSuffList();
        }
    }
    objStoreReq.onerror = function (event) {
        console.error("Can't retrieve Public Suffix List version from IndexedDB");
        console.error(objStoreReq.error);
    }
}

/*
Initialize PubSuffList Database before first use
*/
function initSuffListDB() {
    var dbOpenReq = window.indexedDB.open("PubSuffList");
    var dbUpgraded = false;

    dbOpenReq.onerror = function (event) {
        console.error("Database 'PubSuffList' open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onupgradeneeded = function (event) {
        var db = dbOpenReq.result;
        db.createObjectStore("pubsufflist");
        db.createObjectStore("listversion");
        if (db.version > 0) {
            dbUpgraded = true;
        }
    }

    dbOpenReq.onsuccess = function (event) {
        suffListDB = dbOpenReq.result;

        // Init DB in first start
        if (dbUpgraded) {
            console.log("Downloading Public Suffix List to local IndexedDB");
            getSuffList();
        } else {
            //Check if Public Suffix List is no older than 1 month
            updateSuffList();
        }
    }
}

/*
Initialize GeneratorRules Database before first use
*/
function initGenRulesDB() {
    var dbOpenReq = window.indexedDB.open("GeneratorRules");

    dbOpenReq.onerror = function (event) {
        console.error("Database 'GeneratorRules' open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onupgradeneeded = function (event) {
        var db = dbOpenReq.result;
        var objStore = db.createObjectStore("rules");
        objStore.createIndex("domain", "domain");
        objStore.createIndex("pwdLength", "pwdLength");
        objStore.createIndex("b64Enc", "b64Enc");
        objStore.createIndex("hexEnc", "hexEnc");
        objStore.createIndex("pdl", "pdl");
        objStore.createIndex("childs", "childs");
        objStore.createIndex("parent", "parent");
    }

    dbOpenReq.onsuccess = function (event) {
        genRulesDB = dbOpenReq.result;
    }
}

/*
Initialize Generator preferences to default values
*/
function initPreferences() {
    var p = browser.storage.local.get();
    p.then(
        function (prefObj) {
            //if retrieved object has no keys (if no preferences are stored), then set default preferences
            if (Object.keys(prefObj).length == 0) {
                var p = browser.storage.local.set(preferences);
                p.then(null, function (err) { console.error(err); });
            }
        },
        function (err) {
            console.error(err);
        }
    );
}


initSuffListDB();
initGenRulesDB();
initPreferences();