//called when the preferences page is displayed (see popup_toggle_pages.js)
/** Get the values of the inputs in the Default Settings of Popup, and set the DefaultPreferences for the relevant profile in browser.storage.local accordingly*/
function displayCurrentDefaultPreferences(){
    browser.storage.local.get(["preferences", "profiles"]).then(result => {
        const prefs = result.preferences;
        let activeProfile = result.profiles.activeProfile;

        let activeProfileIndex = prefs.findIndex(el => el.id == activeProfile);

        document.getElementById("defaults-profile_name").value = prefs[activeProfileIndex].profile;
        document.getElementById("defaults-constant").value = prefs[activeProfileIndex].constant;

        document.getElementById("defaults-lower_case-chckbx").checked = prefs[activeProfileIndex].encoding.lower;
        document.getElementById("defaults-upper_case-chckbx").checked = prefs[activeProfileIndex].encoding.upper;
        document.getElementById("defaults-numbers-chckbx").checked = prefs[activeProfileIndex].encoding.num;
        document.getElementById("defaults-special_chars-chckbx").checked = prefs[activeProfileIndex].encoding.special;

        document.getElementById("defaults-pwd_length").value = prefs[activeProfileIndex].length;
        document.getElementById("defaults-store_preferences-chckbx").checked = prefs[activeProfileIndex].save_preferences;
        document.getElementById("defaults-insert_pwd_into_content-chckbx").checked = prefs[activeProfileIndex].inject_into_content;
        document.getElementById("defaults-copy_pwd_to_clipboard-chckbx").checked = prefs[activeProfileIndex].copy_to_clipboard;
    });
}

/** Get DefaultPreferences for the relevant profile from browser.storage.local and set the inputs in the Default Settings in popup*/
function updatePreferencesHandler(event){
    const element = event.target;

    //validate input
    const PROFILE_NAME_MAX_LEN = 20;
    const CONSTANT_MAX_LEN = 100;

    let profile_name = document.getElementById("defaults-profile_name").value;
    let constant = document.getElementById("defaults-constant").value;

    let length = parseInt(document.getElementById("defaults-pwd_length").value);
    document.getElementById("defaults-pwd_length").value = length; //in case it was a decimal number

    if(profile_name.length > PROFILE_NAME_MAX_LEN){
        displayError("Profile name character limit: 20");
        document.getElementById("defaults-profile_name").value = profile_name.substr(0, PROFILE_NAME_MAX_LEN);
    }
    if(constant.length > CONSTANT_MAX_LEN){
        displayError("Constant character limit: 100");
        document.getElementById("defaults-constant").value = constant.substr(0, CONSTANT_MAX_LEN);
    }
    if(isNaN(length) || length < 4 || length > 64){
        // displayError("Password length must be an integer in the range of 4 and 64.");
        document.getElementById("defaults-pwd_length").value = 64;
    }
    if(!document.getElementById("defaults-lower_case-chckbx").checked &&
        !document.getElementById("defaults-upper_case-chckbx").checked &&
        !document.getElementById("defaults-numbers-chckbx").checked &&
        !document.getElementById("defaults-special_chars-chckbx").checked ){
        // displayError("At least one character set must be selected.");
        if(element.type == "checkbox"){
            element.checked = true;
        }
    }


    //update the storage with the new values
    browser.storage.local.get(["preferences", "profiles"])
        .then(result => {
            let prefs = result.preferences;
            let activeProfile = result.profiles.activeProfile;

            let activeProfileIndex = prefs.findIndex(el => el.id == activeProfile);

            prefs[activeProfileIndex].profile = document.getElementById("defaults-profile_name").value;
            prefs[activeProfileIndex].constant = document.getElementById("defaults-constant").value;
            prefs[activeProfileIndex].encoding.lower = document.getElementById("defaults-lower_case-chckbx").checked;
            prefs[activeProfileIndex].encoding.upper = document.getElementById("defaults-upper_case-chckbx").checked;
            prefs[activeProfileIndex].encoding.num = document.getElementById("defaults-numbers-chckbx").checked;
            prefs[activeProfileIndex].encoding.special = document.getElementById("defaults-special_chars-chckbx").checked;
            prefs[activeProfileIndex].length = document.getElementById("defaults-pwd_length").value;
            prefs[activeProfileIndex].save_preferences = document.getElementById("defaults-store_preferences-chckbx").checked;
            prefs[activeProfileIndex].inject_into_content = document.getElementById("defaults-insert_pwd_into_content-chckbx").checked;
            prefs[activeProfileIndex].copy_to_clipboard = document.getElementById("defaults-copy_pwd_to_clipboard-chckbx").checked;

            browser.storage.local.set({preferences: prefs})
                .catch(error => console.log(error));
        });

    // browser.storage.local.get("preferences")
    //     .then(result => {
    //         const preferences = result.preferences;
    //
    //         switch (element.name){
    //             case "lower-case": preferences.encoding.lower = element.checked; break;
    //             case "upper-case": preferences.encoding.upper = element.checked; break;
    //             case "numbers": preferences.encoding.num = element.checked; break;
    //             case "special-chars": preferences.encoding.special = element.checked; break;
    //             case "pwd-length": preferences.length = element.value; break;
    //             case "store-preferences": preferences.save_preferences = element.checked; break;
    //         }
    //
    //         browser.storage.local.set({preferences: preferences})
    //             .catch(error => console.log(error));
    //     });

}

document.querySelectorAll(".defaults-input").forEach(el => {
    el.addEventListener("change", updatePreferencesHandler);
});