# PasswordGen

a deterministic password generator. Create different secure passwords for different web domains, whilst using only one master password. No passwords or personal information is saved.

This project is built using Webextensions API for Firefox. It uses the webextension-polyfill for compatibility with chrome.

## Installation

This program in the development stage. The extension is not yet available in the add-ions store and can only be installed temporarily and locally.

1. Download this repository.
2. Open Firefox
3. Enter "about:addons" into the address bar
4. Click on the settings/gear icon and select "Debug addons".
5. Click "Install a temporary addon".
6. Navigate to the root folder of this project, which you downloaded in the first step. Navigate to the folder src/ and select the manifest.json file.
7. The extension is now installed temporarily and available in the toolbar.

## PasswordGen rundown

The extension is split into 2 parts. The Popup window (available from the toolbar) and the Management page.

### Popup

Here you can generate the passwords and change the default behaviour of the extension. You can save preferences for certain domains, as well as turn the generated password into a QR code to be scanned by a phone.

It should be pretty self-explanatory.

### Management page

Here you can create or delete profiles, encrypt or decrypt the profiles and manage the various preferences save for this profile. Furthermore it is possible to export the preferences for the specific profile to a file, or back it up to Google Drive.
Conversely, it is possible to import settings from a file or download a back-up from Google Drive.

The rest should be self/explanatory.

## User guide

### How to generate a password

1. visit any website
2. click on the popup
3. Enter your master password and hit Enter or click on the Generate button

### How to save a preference for a domain
If you need to save a preference for a domain that is different from the default settings, or you want to save the domain under a different service name than the given one, you can do so by:

1. Clicking on the bookmark icon next to the Generate button. Then you'll see the button show "Generate & Save".
2. Enter you master password and then click the "Generate & Save" button. Once you click it, it'll automatically save a preference for that particular domain.

### How to change the default settings
The default settings are loaded whenever there is no saved preference for a particular domain or service. To change these default setting do:

1. Click on the tweaking icon to the right and above the password options. 
2. A new page will open. You can change the profile name, default constant, password options, and what happens when after a password is generated.

### How to manage my saved preferences
To manage your saved preferences, you need to use the Management Page.

1. Click on the gear icon at the bottom of the popup.
2. Change any settings as desired.

### How to encrypt a profile
If you wish to add further security to the storage area, you can opt to encrypt the storage area in the Management Page.

1. Check the encrypt profile checkbox
2. Enter an encryption password
3. Click Enter

Once you've encrypted your profile, you'll need to supply this encryption/decryption password whenever you want to access this profile, whether in the popup window or in the Management page.
It is recommended that you use the same password as your master password, for the ease of use. This password is never stored. It is merely used to encrypt and decrypt the storage area. 

## Differences in Firefox and Chrome

+ chrome does not allow downloads to be an optional permission, so in the chrome version it is moved to permissions in the manifest.json file
+ more to come