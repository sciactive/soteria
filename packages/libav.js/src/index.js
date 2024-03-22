const imports = require('./libav-vp9-opus.js');
const wasmurls = require('./wasmurl.js');

exports = { ...imports, ...wasmurls };
