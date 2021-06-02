//called when the preferences page is displayed (see popup_toggle_pages.js)
function displayCurrentDefaultPreferences(){
    browser.storage.local.get("preferences").then(result => {
        const pref = result.preferences;

        document.getElementById("defaults-profile_name").value = pref.profile;
        document.getElementById("defaults-constant").value = pref.constant;
        document.getElementById("defaults-lower_case-chckbx").checked = pref.encoding.lower;
        document.getElementById("defaults-upper_case-chckbx").checked = pref.encoding.upper;
        document.getElementById("defaults-numbers-chckbx").checked = pref.encoding.num;
        document.getElementById("defaults-special_chars-chckbx").checked = pref.encoding.special;

        document.getElementById("defaults-pwd_length").value = pref.length;
        document.getElementById("defaults-store_preferences-chckbx").checked = pref.save_preferences;
        document.getElementById("defaults-insert_pwd_into_content-chckbx").checked = pref.inject_into_content;
        document.getElementById("defaults-copy_pwd_to_clipboard-chckbx").checked = pref.copy_to_clipboard;
    });
}

function updatePreferencesHandler(event){
    const element = event.target;

    //alternatively, read all of their values at once and update them at once instead of one by one
    browser.storage.local.get("preferences")
        .then(result => {
            let prefs = result.preferences;

            prefs.profile = document.getElementById("defaults-profile_name").value;
            prefs.constant = document.getElementById("defaults-constant").value;
            prefs.encoding.lower = document.getElementById("defaults-lower_case-chckbx").checked;
            prefs.encoding.upper = document.getElementById("defaults-upper_case-chckbx").checked;
            prefs.encoding.num = document.getElementById("defaults-numbers-chckbx").checked;
            prefs.encoding.special = document.getElementById("defaults-special_chars-chckbx").checked;
            prefs.length = document.getElementById("defaults-pwd_length").value;
            prefs.save_preferences = document.getElementById("defaults-store_preferences-chckbx").checked;
            prefs.inject_into_content = document.getElementById("defaults-insert_pwd_into_content-chckbx").checked;
            prefs.copy_to_clipboard = document.getElementById("defaults-copy_pwd_to_clipboard-chckbx").checked;

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