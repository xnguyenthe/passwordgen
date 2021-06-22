const SECRET_SALT = "sVp€r53cretS@1T";
const SECRET_IV = "5eCr3t-a1.vEe";

/** Use TextEncoder.encode() to encode a message
 * @param {string} message - message to encode
 * @returns {Uint8Array} Uint8Array representing the encoded message*/
function encode(message) {
    let enc = new TextEncoder();
    return enc.encode(message);
}
/**Use TextDecoder.decode() to decode ArrayBuffer back
 * @param {ArrayBuffer} message - array buffer to be decoded
 * @returns {DOMString} A DOMString which Javascript interprets as a regular string*/
function decode(message) {
    let dec = new TextDecoder();
    return dec.decode(message);
}

/**
Get some key material to use as input to the deriveKey method.
The key material is a password supplied by the user.
 @param {string} password - password
 @returns {Promise} Promise which fulfills with the imported key as CryptoKey object
*/
function getKeyMaterial(password) {
    let enc = new TextEncoder();
    return window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        {name: "PBKDF2"},
        false,
        ["deriveBits", "deriveKey"]
    );
}

/**
Given some key material and some random salt
derive an AES-GCM key using PBKDF2.
 @param {CryptoKey} keyMaterial - key material from which to derive a key
 @param {Uint8Array} salt - salt for the algorithm
 @returns {Promise} Promise fulfilling with a CryptoKey
*/
function getKey(keyMaterial, salt) {
    return window.crypto.subtle.deriveKey(
        {
            "name": "PBKDF2",
            salt: salt,
            "iterations": 100000,
            "hash": "SHA-256"
        },
        keyMaterial,
        { "name": "AES-GCM", "length": 256},
        true,
        [ "encrypt", "decrypt" ]
    );
}

/**
Derive a key from a password supplied by the user, and use the key
to encrypt the message.
 @param {string} password - password with which to encrypt the message
 @param {string} message - message to encrypt
 @returns {Promise} Promise which resolves with the encrypted message encoded as a hex string
*/
async function encrypt(password, message) {
    let keyMaterial = await getKeyMaterial(password);
    let salt = encode(SECRET_SALT);
    let key = await getKey(keyMaterial, salt);

    let iv = encode(SECRET_IV);
    let encodedMessage = encode(message);

    let ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encodedMessage
    );

    /** takes Uint*Array and decodes it as a Hex String
     * @param {Uint8Array} bytes - uint8array to be decoded
     * @returns {string} hex string*/
    function fromUint8ArrayToHexString(bytes){
        return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    }

    const encrypted_message = fromUint8ArrayToHexString(new Uint8Array(ciphertext));
    console.log(encrypted_message);
    return encrypted_message;
}

/**
Derive a key from a password supplied by the user, and use the key
to decrypt the ciphertext.
If the ciphertext was decrypted successfully, return the decrypted message.
If there was an error decrypting, throw an error.
@param {string} password - password with which to decrypt the message
@param {string} message encoded as a hex string
@returns {Promise} A promise which resolves with the decrypted message and rejects with an error if it couldn't be decrypted
*/
async function decrypt(password, message) {
    let keyMaterial = await getKeyMaterial(password);
    let salt = encode(SECRET_SALT);
    let key = await getKey(keyMaterial, salt);

    let iv = encode(SECRET_IV);

    /** takes the hex string and turns it into an uint8array
     * @param {string} a hex string
     * @returns {Uint8Array}*/
    function fromHexStringToUint8Array(hexString) {
        return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    }

    let uint8array = fromHexStringToUint8Array(message);
    let ciphertext = uint8array.buffer;

    try {
        let decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            ciphertext
        );

        console.log(decode(decrypted));
        return decode(decrypted);
    } catch (e) {
        throw new Error("Decryption error");
    }
}
