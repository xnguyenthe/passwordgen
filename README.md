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
