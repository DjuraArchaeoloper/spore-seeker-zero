/* @ts-self-types="./spore_core_wasm.d.ts" */

/**
 * @param {number} parent_generation
 * @returns {number | undefined}
 */
function checked_child_generation(parent_generation) {
    const ret = wasm.checked_child_generation(parent_generation);
    return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
}
exports.checked_child_generation = checked_child_generation;

/**
 * @param {bigint} value
 * @returns {bigint | undefined}
 */
function checked_increment_u64(value) {
    const ret = wasm.checked_increment_u64(value);
    return ret[0] === 0 ? undefined : BigInt.asUintN(64, ret[1]);
}
exports.checked_increment_u64 = checked_increment_u64;

/**
 * @param {bigint} now
 * @returns {bigint | undefined}
 */
function checked_next_spore_at(now) {
    const ret = wasm.checked_next_spore_at(now);
    return ret[0] === 0 ? undefined : ret[1];
}
exports.checked_next_spore_at = checked_next_spore_at;

/**
 * @param {bigint} now
 * @returns {bigint | undefined}
 */
function checked_offer_expires_at(now) {
    const ret = wasm.checked_offer_expires_at(now);
    return ret[0] === 0 ? undefined : ret[1];
}
exports.checked_offer_expires_at = checked_offer_expires_at;

/**
 * @param {Uint8Array} secret
 * @returns {Uint8Array}
 */
function commit_spore_secret(secret) {
    const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.commit_spore_secret(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}
exports.commit_spore_secret = commit_spore_secret;

/**
 * @param {bigint} organism_number
 * @returns {string}
 */
function format_organism_name(organism_number) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.format_organism_name(organism_number);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}
exports.format_organism_name = format_organism_name;

/**
 * @param {string} metadata_base_uri
 * @param {bigint} organism_number
 * @returns {string}
 */
function format_organism_uri(metadata_base_uri, organism_number) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(metadata_base_uri, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.format_organism_uri(ptr0, len0, organism_number);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
exports.format_organism_uri = format_organism_uri;

/**
 * @param {Uint8Array} active_spore_commitment
 * @param {bigint} active_spore_expires_at
 * @param {bigint} now
 * @returns {boolean}
 */
function has_live_spore(active_spore_commitment, active_spore_expires_at, now) {
    const ptr0 = passArray8ToWasm0(active_spore_commitment, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.has_live_spore(ptr0, len0, active_spore_expires_at, now);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}
exports.has_live_spore = has_live_spore;

/**
 * @param {string} metadata_base_uri
 * @returns {boolean}
 */
function is_valid_metadata_base_uri(metadata_base_uri) {
    const ptr0 = passStringToWasm0(metadata_base_uri, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.is_valid_metadata_base_uri(ptr0, len0);
    return ret !== 0;
}
exports.is_valid_metadata_base_uri = is_valid_metadata_base_uri;

/**
 * Deterministic one-gene mutation. `slot` and `born_at` are explicit entropy inputs.
 * @param {Uint8Array} parent_genome
 * @param {Uint8Array} parent_organism
 * @param {Uint8Array} recipient_sgt_mint
 * @param {bigint} child_number
 * @param {bigint} slot
 * @param {bigint} born_at
 * @returns {Uint8Array}
 */
function mutate_child_genome(parent_genome, parent_organism, recipient_sgt_mint, child_number, slot, born_at) {
    const ptr0 = passArray8ToWasm0(parent_genome, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(parent_organism, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(recipient_sgt_mint, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.mutate_child_genome(ptr0, len0, ptr1, len1, ptr2, len2, child_number, slot, born_at);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v4;
}
exports.mutate_child_genome = mutate_child_genome;

/**
 * @param {Uint8Array} secret
 * @param {Uint8Array} commitment
 * @returns {boolean}
 */
function spore_secret_matches(secret, commitment) {
    const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(commitment, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.spore_secret_matches(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}
exports.spore_secret_matches = spore_secret_matches;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./spore_core_wasm_bg.js": import0,
    };
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
function decodeText(ptr, len) {
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

const wasmPath = `${__dirname}/spore_core_wasm_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
let wasmInstance = new WebAssembly.Instance(wasmModule, __wbg_get_imports());
let wasm = wasmInstance.exports;
wasm.__wbindgen_start();
