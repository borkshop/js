// @ts-check

import {
  compileTileProgram,
  makeTileRenderer,
  makeTileSheet,
  makeLayer,
} from './gltiles.js';
/** @template T @typedef {import("./gltiles.js").tileable<T>} tileable */
/** @template T @typedef {import("./gltiles.js").TileSheet<T>} TileSheet */
/** @typedef {import("./gltiles.js").Layer} Layer */

/** @callback layback
 * @param {TileSheet<number>} tileSheet
 * @param {Layer} layer
 * @returns {void}
 */

/** @template [T = any]
 * @callback tileMaker
 * @param {tileable<T>} tiles
 * @return TileSheet<T>
 */

/** @typedef {object} TileWorld
 * @prop {tileMaker} makeTileSheet
 * @prop {(dims: FacetDims) => Facet} makeFacet
 */

/** @typedef {object} FacetDims
 * @prop {number} x
 * @prop {number} y
 * @prop {number} width
 * @prop {number} height
 */

/** @typedef {object} Facet
 * @prop {(sheet: TileSheet<unknown>, offset?: {x: number, y: number}) => Layer} makeLayer
 */

/**
 * @param {object} param
 * @param {HTMLCanvasElement} param.$world
 * @param {number} [param.tileSize]
 * @param {number} [param.cellSize]
 * @param {(world: TileWorld) => void} param.build
 */
export default async function demo({
  $world,
  tileSize = 256,
  cellSize = 64,
  build,
}) {
  const gl = $world.getContext('webgl2');
  if (!gl) throw new Error('No GL For You!');

  sizeToParent($world);

  const tileRend = makeTileRenderer(gl, await compileTileProgram(gl));

  /** @type {TileSheet<unknown>[]} */
  const sheets = [];

  /** @type {{dims: FacetDims, layers: Layer[]}[]} */
  const facets = [];

  build({
    makeTileSheet(tiles) {
      const tileSheet = makeTileSheet(gl, tiles, { tileSize });
      sheets.push(tileSheet);
      return tileSheet;
    },

    makeFacet(dims) {
      /** @type {Layer[]} */
      const layers = [];
      facets.push({ dims, layers });
      return {
        makeLayer({ texture }, offset = { x: 0, y: 0 }) {
          const { x, y, width, height } = dims;
          const layer = makeLayer(gl, {
            texture,
            cellSize,
            left: x + offset.x,
            top: y + offset.y,
            width, height
          });
          layers.push(layer);
          return layer;
        },
      };
    },
  });

  /** @returns {Promise<number>} */
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(t => resolve(t)))
  for (
    let t = await nextFrame(), lastT = t; ;
    lastT = t, t = await nextFrame()
  ) {
    // TODO animate things via const dt = lastT - t;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    tileRend.draw(function*() {
      for (const { layers } of facets) {
        for (const layer of layers) {
          if (layer.visible) yield layer;
        }
      }
    }());
  }

}

/** @param {HTMLCanvasElement} $canvas */
function sizeToParent($canvas, update = () => { }) {
  const $cont = $canvas.parentElement;
  if ($cont) {
    const resize = () => {
      const { clientWidth, clientHeight, } = $cont;
      $canvas.width = clientWidth;
      $canvas.height = clientHeight;
      update();
    };
    $cont.ownerDocument.defaultView?.addEventListener('resize', () => resize());
    resize();
  }
}
