import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const wasmurl = path.resolve(
  __dirname,
  'libav-5.1.6.1.1-vp9-opus.wasm.wasm'
);
export const wasmurl_thr = path.resolve(
  __dirname,
  'libav-5.1.6.1.1-vp9-opus.thr.wasm'
);
