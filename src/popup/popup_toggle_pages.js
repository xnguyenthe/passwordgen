/** Click event Handler: Show the About page, and hide the Home and Default Settings pages*/
function showPopupAbout(event){
    if(document.getElementById("popup-about").hidden) {
        document.getElementById("popup-home").hidden = true;
        document.getElementById("popup-about").hidden = false;
        document.getElementById("popup-defaults").hidden = true;
    }
}

/** Click Event handler: Show the Dafault Settings page and hide the About and Home pages*/
function showPopupDefaults(event){
    if(document.getElementById("popup-defaults").hidden) {
        document.getElementById("popup-home").hidden = true;
        document.getElementById("popup-about").hidden = true;
        document.getElementById("popup-defaults").hidden = false;

        displayCurrentDefaultPreferences();
    }
}

/** Click Event handler: Show the Home page and hide the About and Default Settings pages*/
function showPopupHome(event){
    if(document.getElementById("popup-home").hidden) {
        document.getElementById("popup-home").hidden = false;
        document.getElementById("popup-about").hidden = true;
        document.getElementById("popup-defaults").hidden = true;

        initialize();
    }
}

document.getElementById("btn-show-about").addEventListener("click", showPopupAbout);
document.getElementById("btn-show-defaults").addEventListener("click", showPopupDefaults);
document.getElementById("heading_logo").addEventListener("click", showPopupHome);
document.getElementById("btn-show-settings").addEventListener("click", function(){
    browser.runtime.openOptionsPage();
});
