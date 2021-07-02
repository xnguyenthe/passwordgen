(function(){

    console.log("Injected content script into webpage...");

    /** Message Handler. Injects the generated password from Popup into any empty password fields on the website.
     * @param {object} message - message contains 2 keys - message.message contains the message (should be "inject"), and message.password contains the password to inject
     * @returns {void}*/
    function injectIntoPasswordField(message){
        if(message.message = "inject") {
            console.log("Inserting password into any empty password fields...");
            document.querySelectorAll("input[type=password]").forEach(input => {
                if(input.value == ""){
                    input.value = message.password;
                }
            });
        }
    }

    browser.runtime.onMessage.addListener(injectIntoPasswordField);
})();