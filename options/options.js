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


var in_pwd_length = document.getElementById("in_pwd_length");
var in_constant = document.getElementById("in_constant");
var rb_base64 = document.getElementById("rb_base64");
var rb_hex = document.getElementById("rb_hex");
var in_time = document.getElementById("in_time");

var cb_store = document.getElementById("cb_store");
var cb_use_stored = document.getElementById("cb_use_stored");
var btn_del_all_rules = document.getElementById("btn_del_all_rules");
var table = document.getElementById("table_stored_rules");
var btn_export = document.getElementById("btn_export");
var in_import = document.getElementById("in_import");

var genRulesDB;

var minPwdLen = 1;
var maxPwdLen = 86;
var minTime = 0;
var maxTime = 60;
var maxConstantLen = 100;
var maxFileSize = 10; // Max size of imported file in MB


/*
Store the currently selected settings using browser.storage.local.
*/
function savePreferences() {
    var preferences = {
        length: in_pwd_length.value,
        constant: in_constant.value,
        base64: rb_base64.checked,
        hex: rb_hex.checked,
        time: in_time.value,
        store: cb_store.checked,
        use_stored: cb_use_stored.checked
    }
    var p = browser.storage.local.set(preferences);
    p.then(null, onError);
}

/*
On opening the options page, fetch stored settings and update the UI with them.
*/
function loadPreferences() {
    var p = browser.storage.local.get();
    p.then(updateUI, onError);
}

/*
Update the options UI with the settings values retrieved from storage
*/
function updateUI(item) {
    in_pwd_length.value = item.length;
    in_constant.value = item.constant;
    rb_base64.checked = item.base64;
    rb_hex.checked = item.hex;
    in_time.value = item.time;
    cb_store.checked = item.store;
    cb_use_stored.checked = item.use_stored;

    loadTableRules();
}

function onError(err) {
    console.error(err);
}

/*
Show Generator rules from GenRules DB in UI
*/
function loadTableRules() {
    var transaction = genRulesDB.transaction(["rules"], "readonly");
    var objStore = transaction.objectStore("rules");
    var index = objStore.index("pdl");
    var reqCursor = index.openCursor();

    clearUIRulesTable();
    reqCursor.onsuccess = function () {
        var cursor = reqCursor.result;
        if (cursor) {
            // If rule contains children -> Parent rule
            if (cursor.value.childs) {
                // First insert parent rule into the table
                insertNewTableEntry(cursor.value.domain, Number(cursor.value.pwdLength), cursor.value.b64Enc == "true", cursor.value.hexEnc == "true", cursor.value.pdl, cursor.value.parent != null);

                var reqPdl = index.getAll(cursor.value.pdl);
                reqPdl.onsuccess = function () {
                    // Put all parent children into the table
                    for (var i = 0; i < cursor.value.childs.length; i++) {
                        for (var j = 0; j < reqPdl.result.length; j++) {
                            if (cursor.value.childs[i] == reqPdl.result[j].domain) {
                                insertNewTableEntry(reqPdl.result[j].domain, Number(reqPdl.result[j].pwdLength), reqPdl.result[j].b64Enc == "true", reqPdl.result[j].hexEnc == "true", reqPdl.result[j].pdl, reqPdl.result[j].parent != null);
                            }
                        }
                    }
                }
            }

            // If the rule doesn't have a parent rule
            else if (cursor.value.parent == null) {
                insertNewTableEntry(cursor.value.domain, Number(cursor.value.pwdLength), cursor.value.b64Enc == "true", cursor.value.hexEnc == "true", cursor.value.pdl, cursor.value.parent != null);
            }
            cursor.continue();
        }

        //Okay, so if parent - write out the parent and all its children so they're all contiguously grouped
        //if not a parent but also not a child (no relatives), then write it out
        //if a child, then skip (bcs they've all been written out with their respective parent)
        //cursor is iterating the items asynchronously
    }
}

/*
Delete all rules from UI table
*/
function clearUIRulesTable() {
    for (var i = table.rows.length - 1; i > 0; i--) {
        table.deleteRow(i);
    }
}

/*
Password length validation
*/
function validatePwdLen(pwdLen) {
    pwdLen = pwdLen.replace(/\D+/g, "");
    if (pwdLen < 1) {
        pwdLen = minPwdLen;
    }
    else if (pwdLen > maxPwdLen) {
        pwdLen = maxPwdLen;
    }
    return pwdLen;
}

/*
Parent Domain Level validation
*/
function validatePdl(pdl) {
    // Remove all invalid characters
    pdl = pdl.replace(/[^A-Za-z0-9.-]/g, "");
    // Remove all dots and dashes from the beginning
    pdl = pdl.replace(/^(\.+)|^(-+)/g, "");
    // Reduce 2 or more dashes in a row only to 1 dash
    pdl = pdl.replace(/-{2,}/g, "-");
    // After dash can't be dot
    pdl = pdl.replace(/\-./g, ".");
    // Reduce 2 or more dots in a row only to 1 dot
    pdl = pdl.replace(/\.{2,}/g, ".");
    // Remove all dots and dashes from the end
    pdl = pdl.replace(/(\.|-)+$/g, "");

    return pdl;
}

/*
Update children rules in UI table after some parent preference was changed
*/
function updateUIChildRules(ruleChilds, parentNode) {
    for (var i = 0; i < ruleChilds.length; i++) {
        for (var j = 1; j < table.rows.length; j++) {
            if (table.rows[j].children[0].firstChild.data == ruleChilds[i]) {
                table.rows[j].children[1].firstChild.value = parentNode.cells[1].firstChild.value;
                table.rows[j].children[2].firstChild.checked = parentNode.cells[2].firstChild.checked;
                table.rows[j].children[3].firstChild.checked = parentNode.cells[3].firstChild.checked;
                table.rows[j].children[4].firstChild.value = parentNode.cells[4].firstChild.value;
            }
        }
    }
}

/*
Update stored generator rule in DB after user change some preference through UI table
*/
function updateStoredRule(event) {
    var node = event.target;
    // Go to table row element which was modified
    while (node.nodeName != "TR") {
        node = node.parentElement;
    }

    node.cells[1].firstChild.value = validatePwdLen(node.cells[1].firstChild.value);
    node.cells[4].firstChild.value = validatePdl(node.cells[4].firstChild.value);

    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var rulesObjStore = transaction.objectStore("rules");
    var indexDomain = rulesObjStore.index("domain");

    var reqDomain = indexDomain.get(node.cells[0].firstChild.data);
    reqDomain.onsuccess = function () {
        var storedRule = reqDomain.result;

        //Ak zaznam ktory idem menit nema deti
        // If rule which should be changed contains children
        if (storedRule.childs == null) {
            //Ak nema deti a ma rodica, tak zmenim iba dany (detsky) zaznam a oddelim ho od hlavneho stromu ako novy strom
            // If rule doesn't have children and have some parent -> Change only this (children) rule and detach it from parent rule
            if (storedRule.parent) {
                rulesObjStore.put({
                    domain: node.cells[0].firstChild.data,
                    pwdLength: node.cells[1].firstChild.value,
                    b64Enc: String(node.cells[2].firstChild.checked),
                    hexEnc: String(node.cells[3].firstChild.checked),
                    pdl: node.cells[0].firstChild.data, // Change from PDL to Domain name
                }, node.cells[0].firstChild.data);

                // Zmena UI tabulky - zmeneny zaznam vymazem od rodica a hodim ho pod tabulku
                // UI table change - remove modified rule from parent and put it below table
                insertNewTableEntry(node.cells[0].firstChild.data, Number(node.cells[1].firstChild.value), node.cells[2].firstChild.checked, node.cells[3].firstChild.checked, node.cells[0].firstChild.data, false);
                node.remove();

                // Odstranenie zaznamu od rodica (nakolko zo zmeneneho zaznamu je teraz samostatny strom)
                // vyziadam si jeho rodica a odstranim ho odtial
                // Remove modified rule from parent (modified rule will be separated)
                var reqParentDomain = indexDomain.get(storedRule.parent);
                reqParentDomain.onsuccess = function () {
                    var storedParentRule = reqParentDomain.result;
                    var parentChilds = storedParentRule.childs;
                    parentChilds.splice(parentChilds.indexOf(storedRule.domain), 1);

                    // Ak rodic po vymazani childa obsahuje este ine deti
                    // If parent of deleted rule contains some other children
                    if (storedParentRule.childs.length > 0) {
                        rulesObjStore.put({
                            domain: storedParentRule.domain,
                            pwdLength: storedParentRule.pwdLength,
                            b64Enc: storedParentRule.b64Enc,
                            hexEnc: storedParentRule.hexEnc,
                            pdl: storedParentRule.pdl,
                            childs: storedParentRule.childs,
                        }, storedParentRule.domain);
                    }
                    // Ak to bol posledny detsky zaznam, tak vymaz property 'childs'
                    // If deleted rule was last children rule, remove 'childs' attribute from parent rule
                    else {
                        rulesObjStore.put({
                            domain: storedParentRule.domain,
                            pwdLength: storedParentRule.pwdLength,
                            b64Enc: storedParentRule.b64Enc,
                            hexEnc: storedParentRule.hexEnc,
                            pdl: storedParentRule.pdl,
                        }, storedParentRule.domain);
                    }
                }
            }

            //Ak zaznam, ktory idem menit nema deti ani rodica
            // If rule, which will be modified, it does not have children neither parent
            else {
                rulesObjStore.put({
                    domain: node.cells[0].firstChild.data,
                    pwdLength: node.cells[1].firstChild.value,
                    b64Enc: String(node.cells[2].firstChild.checked),
                    hexEnc: String(node.cells[3].firstChild.checked),
                    pdl: node.cells[4].firstChild.value,
                }, node.cells[0].firstChild.data);
            }
        }

        // Zaznam ktory idem menit MA DETI. Treba ich vsetky zmenit podla rodica (aktualneho zaznamu).
        // Rule which will be modified has children. All children should be changed according to parent rule (current rule)
        else {
            // Zmena aktualneho (rodicovskeho) zaznamu, ktory user zmenil cez GUI
            // Current (parent) rule modification which was modified by user through GUI
            rulesObjStore.put({
                domain: node.cells[0].firstChild.data,
                pwdLength: node.cells[1].firstChild.value,
                b64Enc: String(node.cells[2].firstChild.checked),
                hexEnc: String(node.cells[3].firstChild.checked),
                pdl: node.cells[4].firstChild.value,
                childs: storedRule.childs,
            }, node.cells[0].firstChild.data);

            updateUIChildRules(storedRule.childs, node); // Modification of children rules/rows in GUI table

            // Zmena detskych zaznamov v DB
            // Modification of children rules in DB
            for (var i = 0; i < storedRule.childs.length; i++) {
                rulesObjStore.put({
                    domain: storedRule.childs[i],
                    pwdLength: node.cells[1].firstChild.value,
                    b64Enc: String(node.cells[2].firstChild.checked),
                    hexEnc: String(node.cells[3].firstChild.checked),
                    pdl: node.cells[4].firstChild.value,
                    parent: storedRule.domain,
                }, storedRule.childs[i]);
            }
        }
    }
}

/*
Remove specific stored generator rule from DB
*/
function deleteStoredRule(event) {
    var node = event.target;
    // Go to table row element which was modified
    while (node.nodeName != "TR") {
        node = node.parentElement;
    }

    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var rulesObjStore = transaction.objectStore("rules");
    var indexDomain = rulesObjStore.index("domain");

    var reqDomain = indexDomain.get(node.cells[0].firstChild.data);
    reqDomain.onsuccess = function () {
        // Ak zaznam, ktory chcem vymazat je rodic
        // If rule which should be removed is parent
        if (reqDomain.result.childs) {
            for (var i = 0; i < reqDomain.result.childs.length; i++) {
                rulesObjStore.delete(reqDomain.result.childs[i]); // Delete children rules from DB

                for (var j = 1; j < table.rows.length; j++) {
                    if (table.rows[j].children[0].firstChild.data == reqDomain.result.childs[i]) {
                        table.rows[j].remove(); // Delete children rules/rows from GUI table
                    }
                }
            }
            rulesObjStore.delete(reqDomain.result.domain); // Delete parent rule from DB
            node.remove(); // Delete parent rule from GUI table
        }

        // Ak zaznam ktory chcem vymazat je dieta
        // If rule wich should be removed is child
        else if (reqDomain.result.parent) {
            // Detsky zaznam bude vymazany a v jeho rodicovi ho teda musim odstranit zo zoznamu deti
            // Children rule will be removed -> it should be also removed from parent rule
            var reqParentDomain = indexDomain.get(reqDomain.result.parent);
            reqParentDomain.onsuccess = function () {
                var storedParentRule = reqParentDomain.result;
                var parentChilds = storedParentRule.childs;
                parentChilds.splice(parentChilds.indexOf(reqDomain.result.domain), 1);

                // Ak rodic po vymazani childa obsahuje este ine deti
                // If parent of deleted rule contains some other children
                if (storedParentRule.childs.length > 0) {
                    rulesObjStore.put({
                        domain: storedParentRule.domain,
                        pwdLength: storedParentRule.pwdLength,
                        b64Enc: storedParentRule.b64Enc,
                        hexEnc: storedParentRule.hexEnc,
                        pdl: storedParentRule.pdl,
                        childs: storedParentRule.childs,
                    }, storedParentRule.domain);
                }
                // Ak to bol posledny detsky zaznam, tak vymaz property 'childs'
                // If deleted rule was last child rule, remove 'childs' attribute from parent rule
                else {
                    rulesObjStore.put({
                        domain: storedParentRule.domain,
                        pwdLength: storedParentRule.pwdLength,
                        b64Enc: storedParentRule.b64Enc,
                        hexEnc: storedParentRule.hexEnc,
                        pdl: storedParentRule.pdl,
                    }, storedParentRule.domain);
                }
                rulesObjStore.delete(reqDomain.result.domain); // Delete rule from DB
            }
            node.remove(); // Delete rule/row node from GUI table
        }

        // Zaznam nema rodica ani dieta
        // Rule doesn't have parent neither child
        else {
            rulesObjStore.delete(reqDomain.result.domain);
            node.remove();
        }
    }
}

/*
Delete all rules/rows from GeneratorRules DB
*/
function deleteAllStoredRules() {
    if (confirm(browser.i18n.getMessage("options_confirm_del_all_rules"))) {
        clearUIRulesTable();
        var transaction = genRulesDB.transaction(["rules"], "readwrite");
        var rulesObjStore = transaction.objectStore("rules");
        rulesObjStore.clear();
    }
    else {
        console.log("Rules deleting was canceled by user");
    }
}

/*
Insert new row/generator rule from DB into UI table
*/
function insertNewTableEntry(domain, pwdLength, base64Check, hexCheck, pdl, isChild) {
    var row = table.insertRow();
    var domainCell = row.insertCell();
    var pwdLengthCell = row.insertCell();
    var base64Cell = row.insertCell();
    var hexCell = row.insertCell();
    var pdlCell = row.insertCell();
    var delIconCell = row.insertCell();

    var radioBase64Input = document.createElement("input");
    radioBase64Input.setAttribute("type", "radio");
    radioBase64Input.setAttribute("name", "encoding_row" + row.rowIndex);
    var radioHexInput = radioBase64Input.cloneNode(true);

    if (isChild) {
        domainCell.setAttribute("class", "children");
    }

    delIconCell.setAttribute("style", "text-align: center;");

    var pdlCellInput = document.createElement("input");
    pdlCellInput.type = "text";

    var pwdLengthCellInput = document.createElement("input");
    pwdLengthCellInput.type = "text";

    var delIcon = document.createElement("i");
    delIcon.className = "material-icons";
    delIcon.innerText = "delete";
    delIcon.addEventListener("click", deleteStoredRule);

    domainCell.textContent = domain;
    pwdLengthCellInput.value = pwdLength;
    radioBase64Input.checked = base64Check;
    radioHexInput.checked = hexCheck;
    pdlCellInput.value = pdl;

    pwdLengthCell.appendChild(pwdLengthCellInput);
    base64Cell.appendChild(radioBase64Input);
    hexCell.appendChild(radioHexInput);
    pdlCell.appendChild(pdlCellInput);
    delIconCell.appendChild(delIcon);
}

/*
Open GeneratorRules DB
*/
function openGenRulesDB() {
    var dbOpenReq = window.indexedDB.open("GeneratorRules");

    dbOpenReq.onerror = function () {
        console.error("Database open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onsuccess = function () {
        genRulesDB = dbOpenReq.result;
    }
}

/*
Write all preferences and stored rules from DB  to JSON file and download it to user device.
*/
function exportSettings() {
    var retrievePrefs = browser.storage.local.get(); // Get preferences from local storage
    retrievePrefs.then(
        function (preferences) {
            var exportObject = {};
            exportObject.preferences = preferences; // Insert retrieved preferences into exportable object

            var transaction = genRulesDB.transaction(["rules"], "readonly");
            var objStore = transaction.objectStore("rules");
            var index = objStore.index("domain");
            var reqAllRules = index.getAll();

            reqAllRules.onsuccess = function () {
                exportObject.rules = reqAllRules.result;    //  Insert retrieved rules from DB into exportable object
                var blob = new Blob([JSON.stringify(exportObject, null, 4)], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                browser.runtime.getPlatformInfo().then(info => {
                    var downloading;
                    if (info.os == "android") {
                        downloading = browser.downloads.download(
                            {
                                url: url,
                                filename: "passgen_settings.json",
                            }
                        );
                    }
                    else {
                        downloading = browser.downloads.download(
                            {
                                url: url,
                                filename: "passgen_settings.json",
                                incognito: true,
                                saveAs: true
                            }
                        );
                    }
                    downloading.then(null, onError);
                });
            }
        }, onError);
}

/*
Load all preferences & generator rules from JSON file to the database and local storage.
*/
function importSettings() {
    var file = in_import.files[0];
    if (file == null) {
        return;
    }

    if (file.type != "application/json") {
        alert(browser.i18n.getMessage("options_alert_not_json_file"));
        return;
    }

    if (file.size > (maxFileSize * 1024 * 1024)) {
        alert(browser.i18n.getMessage("options_alert_file_large"));
        return;
    }

    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function (event) {

        if (isValidJson(event.target.result)) {
            var importObj = JSON.parse(event.target.result);

            browser.storage.local.set(importObj.preferences); // Load and set preferences from imported file

            var transaction = genRulesDB.transaction(["rules"], "readwrite");
            var objStore = transaction.objectStore("rules");
            var clearReq = objStore.clear();
            clearReq.onsuccess = function () {

                // Load all generator rules from imported file into DB
                for (var i = 0; i < importObj.rules.length; i++) {
                    objStore.put(importObj.rules[i], importObj.rules[i].domain).onerror = function (err) {
                        console.error(err)
                    }
                }
                updateUI(importObj.preferences);
                in_import.value = null;
            }
        }
        else {
            return;
        }
    }
}

/*
Verify whether JSON file is valid before data will be written into database.
*/
function isValidJson(data) {
    try {
        var obj = JSON.parse(data);

        // Check Generator Preferences validity
        if (obj.preferences.length == undefined ||
            obj.preferences.constant == undefined ||
            obj.preferences.base64 == undefined ||
            obj.preferences.hex == undefined ||
            obj.preferences.time == undefined ||
            obj.preferences.store == undefined ||
            obj.preferences.use_stored == undefined) {
            alert(browser.i18n.getMessage("options_alert_invalid_preference_name"));
            return false;
        }
        if (typeof (obj.preferences.length) != "string" ||
            typeof (obj.preferences.constant) != "string" ||
            typeof (obj.preferences.base64) != "boolean" ||
            typeof (obj.preferences.hex) != "boolean" ||
            typeof (obj.preferences.time) != "string" ||
            typeof (obj.preferences.store) != "boolean" ||
            typeof (obj.preferences.use_stored) != "boolean") {
            alert(browser.i18n.getMessage("options_alert_invalid_preference_type"));
            return false;
        }
        if (!obj.preferences.length.match(/^[0-9]+$/)) {
            alert(browser.i18n.getMessage("options_alert_invalid_pwd_len") + obj.preferences.length);
            return false;
        }
        if (parseInt(obj.preferences.length, 10) < minPwdLen || parseInt(obj.preferences.length, 10) > maxPwdLen) {
            alert(browser.i18n.getMessage("options_alert_invalid_pwd_len") + obj.preferences.length);
            return false;
        }
        if (!obj.preferences.time.match(/^[0-9]+$/)) {
            alert(browser.i18n.getMessage("options_alert_invalid_time") + obj.preferences.time);
            return false;
        }
        if (parseInt(obj.preferences.time, 10) < minTime || parseInt(obj.preferences.time, 10) > maxTime) {
            alert(browser.i18n.getMessage("options_alert_invalid_time") + obj.preferences.time);
            return false;
        }
        if (obj.preferences.constant.length > maxConstantLen) {
            alert(browser.i18n.getMessage("options_alert_invalid_const_len"));
            return false;
        }

        // Check Stored Rules Validity
        for (var i = 0; i < obj.rules.length; i++) {
            if (obj.rules[i].domain == undefined ||
                obj.rules[i].pwdLength == undefined ||
                obj.rules[i].b64Enc == undefined ||
                obj.rules[i].hexEnc == undefined ||
                obj.rules[i].pdl == undefined) {
                alert(browser.i18n.getMessage("options_alert_invalid_json"));
                return false;
            }
            if (obj.rules[i].domain == null ||
                obj.rules[i].pwdLength == null ||
                obj.rules[i].b64Enc == null ||
                obj.rules[i].hexEnc == null ||
                obj.rules[i].pdl == null) {
                alert(browser.i18n.getMessage("options_alert_invalid_json"));
                return false;
            }
            if (!obj.rules[i].pwdLength.match(/^[0-9]+$/)) {
                alert(browser.i18n.getMessage("options_alert_invalid_pwd_len") + obj.rules[i].pwdLength);
                return false;
            }
            if (parseInt(obj.rules[i].pwdLength, 10) < minPwdLen || parseInt(obj.rules[i].pwdLength, 10) > maxPwdLen) {
                alert(browser.i18n.getMessage("options_alert_invalid_pwd_len") + obj.rules[i].pwdLength);
                return false;
            }
            if (!(obj.rules[i].b64Enc == "true" || obj.rules[i].b64Enc == "false")) {
                alert(browser.i18n.getMessage("options_alert_invalid_base64_enc"));
                return false;
            }
            if (!(obj.rules[i].hexEnc == "true" || obj.rules[i].hexEnc == "false")) {
                alert(browser.i18n.getMessage("options_alert_invalid_hex_enc"));
                return false;
            }
        }
    } catch (error) {
        alert(browser.i18n.getMessage("options_alert_invalid_json"));
        return false;
    }
    return true;
}

/*
Translate UI to corresponding locale (EN or SK)
*/
function UILocalisation() {
    document.getElementById("p_gen_prefs").textContent = browser.i18n.getMessage("options_p_gen_prefs");
    document.getElementById("lbl_pwd_length").textContent = browser.i18n.getMessage("options_lbl_pwd_length");
    document.getElementById("lbl_const").textContent = browser.i18n.getMessage("options_lbl_const");
    document.getElementById("lbl_enc").textContent = browser.i18n.getMessage("options_lbl_enc");
    document.getElementById("lbl_time").textContent = browser.i18n.getMessage("options_lbl_time");
    document.getElementById("p_storage_settings").textContent = browser.i18n.getMessage("options_p_storage_settings");
    document.getElementById("lbl_store").textContent = browser.i18n.getMessage("options_lbl_store");
    document.getElementById("lbl_use_stored").textContent = browser.i18n.getMessage("options_lbl_use_stored");
    document.getElementById("btn_del_all_rules").textContent = browser.i18n.getMessage("options_btn_del_all_rules");
    document.getElementById("p_import").textContent = browser.i18n.getMessage("options_p_import");
    document.getElementById("p_export").textContent = browser.i18n.getMessage("options_p_export");
    document.getElementById("p_stored_rules").textContent = browser.i18n.getMessage("options_p_stored_rules");
    document.getElementById("th_domain").textContent = browser.i18n.getMessage("options_th_domain");
    document.getElementById("th_pwd_length").textContent = browser.i18n.getMessage("options_th_pwd_length");
    document.getElementById("th_base64").textContent = browser.i18n.getMessage("options_th_base64");
    document.getElementById("th_hex").textContent = browser.i18n.getMessage("options_th_hex");
    document.getElementById("th_pdl").textContent = browser.i18n.getMessage("options_th_pdl");
    document.getElementById("th_del").textContent = browser.i18n.getMessage("options_th_del");
}


openGenRulesDB();
UILocalisation();

document.addEventListener("change", savePreferences);
document.addEventListener("load", loadPreferences());
table.addEventListener("change", updateStoredRule);
btn_export.addEventListener("click", exportSettings);
in_import.addEventListener("change", importSettings);
btn_del_all_rules.addEventListener("click", deleteAllStoredRules);
