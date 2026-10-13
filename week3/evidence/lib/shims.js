// Runtime shims for the A03 verification harness.
//
// JavaScriptCore (jsc) and Node disagree about which web and console globals
// exist, so the harness supplies the minimum needed to run the real data.js
// and script.js outside a browser. Nothing here is part of the application.

var A03_RAW_PRINT = typeof print === 'function' ? print : function () {};
var a03Print = function (text) { A03_RAW_PRINT(String(text)); };

if (typeof console === 'undefined') {
    var console = {
        log: function () { a03Print(Array.prototype.join.call(arguments, ' ')); },
        error: function () { a03Print('ERR ' + Array.prototype.join.call(arguments, ' ')); }
    };
}

function a03BytesFromChars(chars) {
    var bytes = new Uint8Array(chars.length);
    for (var i = 0; i < chars.length; i++) {
        bytes[i] = chars.charCodeAt(i) & 0xFF;
    }
    return bytes;
}

var A03_U_ITEM_BYTES = a03BytesFromChars(A03_U_ITEM);

function TextDecoder(label) { this.label = label; }
TextDecoder.prototype.decode = function (buffer) {
    var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    var out = '';
    var chunk = [];
    for (var i = 0; i < bytes.length; i++) {
        chunk.push(String.fromCharCode(A03_WIN1252[bytes[i]]));
        if (chunk.length > 8192) { out += chunk.join(''); chunk = []; }
    }
    return out + chunk.join('');
};

function fetch(url) {
    if (url === 'u.item') {
        return Promise.resolve({
            ok: true, status: 200,
            arrayBuffer: function () { return Promise.resolve(A03_U_ITEM_BYTES.buffer); },
            text: function () { return Promise.resolve(A03_U_ITEM); }
        });
    }
    if (url === 'u.data') {
        return Promise.resolve({
            ok: true, status: 200,
            arrayBuffer: function () { return Promise.resolve(a03BytesFromChars(A03_U_DATA).buffer); },
            text: function () { return Promise.resolve(A03_U_DATA); }
        });
    }
    return Promise.resolve({ ok: false, status: 404 });
}

// The real script.js assigns window.onload at top level but nothing in the
// verification sections calls it, so an inert object is enough.
if (typeof window === 'undefined') {
    var window = {};
}
