import { toTypeScriptNotation } from '../lib/schema-typescript.js';
import { wholeWorldSchema } from '../schema.js';

const type = wholeWorldSchema(toTypeScriptNotation);
process.stdout.write(`\
/**
 * Generated by scripts/gen/whole-world-ts.js:
 * @typedef {${type}} WholeWorldDescription
 */
`);