import { pointSchema, colorsSchema } from '../../schema.js';

/**
 * @template T
 * @param {import('../../lib/schema.js').Schema<T>} $
 */
export const torus = $ => ({
  tilesPerChunk: pointSchema($),
  chunksPerLevel: pointSchema($),
  colors: colorsSchema($),
});
