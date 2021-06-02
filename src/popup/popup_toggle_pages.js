function showPopupAbout(event){
    if(document.getElementById("popup-about").hidden) {
        document.getElementById("popup-home").hidden = true;
        document.getElementById("popup-about").hidden = false;
        document.getElementById("popup-defaults").hidden = true;
    }
}

function showPopupDefaults(event){
    if(document.getElementById("popup-defaults").hidden) {
        document.getElementById("popup-home").hidden = true;
        document.getElementById("popup-about").hidden = true;
        document.getElementById("popup-defaults").hidden = false;

        displayCurrentDefaultPreferences();
    }
}

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
