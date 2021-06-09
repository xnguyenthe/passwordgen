const SECRET_SALT = "sVp€r53cretS@1T";
const SECRET_IV = "5eCr3t-a1.vEe";

function encode(message) {
    let enc = new TextEncoder();
    return enc.encode(message);
}

function decode(message) {
    let dec = new TextDecoder();
    return dec.decode(message);
}

/*
Get some key material to use as input to the deriveKey method.
The key material is a password supplied by the user.
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

/*
Given some key material and some random salt
derive an AES-GCM key using PBKDF2.
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

/*
Derive a key from a password supplied by the user, and use the key
to encrypt the message.
Update the "ciphertextValue" box with a representation of part of
the ciphertext.
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

    function fromUint8ArrayToHexString(bytes){
        return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    }

    const encrypted_message = fromUint8ArrayToHexString(new Uint8Array(ciphertext));
    console.log(encrypted_message);
    return encrypted_message;
}

/*
Derive a key from a password supplied by the user, and use the key
to decrypt the ciphertext.
If the ciphertext was decrypted successfully,
update the "decryptedValue" box with the decrypted value.
If there was an error decrypting,
update the "decryptedValue" box with an error message.
*/
async function decrypt(password, message) {
    let keyMaterial = await getKeyMaterial(password);
    let salt = encode(SECRET_SALT);
    let key = await getKey(keyMaterial, salt);

    let iv = encode(SECRET_IV);

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
