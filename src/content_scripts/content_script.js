(function(){

    console.log("Injected content script into webpage...");
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