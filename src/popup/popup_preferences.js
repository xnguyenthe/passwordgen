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

    //alternatively, read all of their values at once and update them at once instead of one by one
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