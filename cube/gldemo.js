// @ts-check

import { mat4 } from 'gl-matrix';

import { compileProgram } from './glkit.js';

/** @callback layback
 * @param {TileSheet<number>} tileSheet
 * @param {Layer} layer
 * @returns {void}
 */

/** @template [T = any] @callback tileMaker @param {tileable<T>} tiles @return TileSheet<T> */

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

  // link our singular demo program ; as things progress, we could potentially
  // have multiple programs to do things like:
  // - change out the fragment shader for one that adds more/different effects
  //   (lighting, distortion, scan lines, whatever)
  // - change out the vertex shader if there's drastically different data
  //   shaping needs (e.g. implicit location based on array index, rather than
  //   x/y data explicitly encoded)
  // - or even more broadly, if we end up with other modes of drawing for
  //   things that aren't tiles, like to grid lines, line art, or other
  //   geometric shapes
  const prog = await compileProgram(gl, ...[
    './gldemo.vert.glsl',
    './gldemo.frag.glsl',
  ].map(name => ({
    name,
    source: fetch(name).then(res => res.text())
  })));

  gl.useProgram(prog);

  // NOTE: somewhere around here is where most frameworks reify something
  // around a program and its uniform/attribute location

  /** @param {string} name */
  const mustGetUniform = name => {
    const loc = gl.getUniformLocation(prog, name);
    if (loc == null) throw new Error(`no such uniform ${name}`);
    return loc;
  };

  /** @param {string} name */
  const mustGetAttr = name => {
    const loc = gl.getAttribLocation(prog, name);
    if (loc == null) throw new Error(`no such attribute ${name}`);
    return loc;
  };

  const uni_sheet = mustGetUniform('sheet'); // sampler2D
  const uni_transform = mustGetUniform('transform'); // mat4
  const uni_perspective = mustGetUniform('perspective'); // mat4
  const uni_nowhere = mustGetUniform('nowhere'); // vec4
  const uni_stride = mustGetUniform('stride'); // uint

  const attr_spin = mustGetAttr('spin'); // float
  const attr_size = mustGetAttr('size'); // float
  const attr_layerID = mustGetAttr('layerID'); // int

  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

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

  const perspective = mat4.identity(new Float32Array(16));

  /** @returns {Promise<number>} */
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(t => resolve(t)))
  for (
    let t = await nextFrame(), lastT = t; ;
    lastT = t, t = await nextFrame()
  ) {
    // @ts-ignore
    const dt = lastT - t; // TODO animate things and un-ignore

    const texCache = makeTextureUnitCache(gl, gl.TEXTURE_2D_ARRAY);

    /// update global uniforms
    const { width, height } = $world;
    const perspLeft = 0, perspTop = 0, perspRight = width, perspBottom = height;
    mat4.ortho(perspective,
      perspLeft,
      perspRight,
      perspBottom,
      perspTop,
      0, Number.EPSILON);

    gl.uniformMatrix4fv(uni_perspective, false, perspective);

    // NOTE: this just needs to be set to any point outside of camera view, so
    // that the vertex shader can use it to cull points
    gl.uniform4f(uni_nowhere, -1, -1, -1, 0);

    gl.viewport(0, 0, width, height);

    /// per frame drawing pass
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.vertexAttrib1f(attr_size, cellSize);

    // TODO at some point, it'll be worth it to cull layers that don't
    // intersect perspective, but for now we just use leave GL's vertex culling

    const transform = new Float32Array(16);
    for (const { layers } of facets) {
      for (const layer of layers) {
        if (!layer.visible) continue;

        const { top, left, width, length, indexType } = layer;
        const tex = texCache.get(layer.texture);

        mat4.fromTranslation(transform, [cellSize * left, cellSize * top, 0]);
        gl.uniformMatrix4fv(uni_transform, false, transform);

        gl.uniform1i(uni_sheet, tex);
        gl.uniform1i(uni_stride, width);

        layer.bindVertexAttribs(attr_spin, attr_layerID);
        gl.drawElements(gl.POINTS, length, indexType, 0);
      }
    }
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

/** @callback drawback
 * @param {OffscreenCanvasRenderingContext2D} ctx
 * @returns {void}
 */

/**
 * @template TileID
 * @typedef {object} TileSheet
 * @prop {WebGLTexture} texture
 * @prop {number} size
 * @prop {(id: TileID) => number} getLayerID
 */

/**
 * @template TileID
 * @typedef {Iterator<{id: TileID, draw: drawback}|[id: TileID, draw: drawback]>} tileable
 */

/**
 * @template TileID
 * @param {WebGL2RenderingContext} gl
 * @param {tileable<TileID>} tiles
 * @param {object} [params]
 * @param {number} [params.tileSize]
 * @param {number} [params.mipLevels]
 * @returns {TileSheet<TileID>}
 */
function makeTileSheet(gl, tiles, {
  tileSize = 256,
  mipLevels,
} = {}) {

  const pot = Math.log(tileSize) / Math.log(2);
  if (pot !== Math.floor(pot))
    throw new Error(`tileSize must be a power-of-two, got: ${tileSize}`);
  const levels = mipLevels || pot - 1;

  const maxTileSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (tileSize > maxTileSize)
    throw new Error(`tileSize:${tileSize} exceeds maximum supported texture size: ${maxTileSize}`);

  const maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);

  /** @type {Map<TileID, number>} */
  const index = new Map();

  /** @type {drawback[]} */
  const draws = [];

  while (index.size < maxLayers) {
    const res = tiles.next();
    if (res.done) break;
    const { value } = res;
    const [id, draw] = Array.isArray(value) ? value : [value.id, value.draw];

    if (index.has(id))
      throw new Error(`duplicate tile id ${id}`);

    const layer = index.size;
    index.set(id, layer);
    draws.push(draw);
  }

  const texture = gl.createTexture();
  if (!texture) throw new Error('unable to create gl texture');

  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);

  const size = draws.length;
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, tileSize, tileSize, size);

  draws.forEach((draw, layer) => {
    const canvas = new OffscreenCanvas(tileSize, tileSize);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('unable to get offscreen canvas 2d context');

    ctx.clearRect(0, 0, tileSize, tileSize);
    draw(ctx);
    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY, 0,
      0, 0, layer,
      tileSize, tileSize, 1,
      gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  });

  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);

  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return {
    get texture() { return texture },
    get size() { return size },
    getLayerID(id) {
      const i = index.get(id);
      return i === undefined ? 0 : i + 1;
    },
  };
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {object} params
 * @param {WebGLTexture} params.texture
 * @param {number} [params.left]
 * @param {number} [params.top]
 * @param {number} params.width
 * @param {number} params.height
 */
function makeLayer(gl, {
  texture,
  left = 0, top = 0,
  width, height,
}) {

  // TODO do we complect within or without?
  //   1. makeSparseLayer vs makeDenseLayer
  //   2. sans/with spin
  //   3. sans/with scale
  //   4. sans/with animation (for each of loc, spin, scale, id)

  // TODO further indirection between layer and gpu buffers allowing:
  // - N chunks of the same logical layer to be packed into M < N buffers
  // - N layer(s) to be fragmented into M > N buffers
  // - sub-region invalidation to avoid recopying old data / only copy new data

  // NOTE: we can also choose to interleave/pack data into a single buffer if desired
  const indexBuffer = gl.createBuffer();
  const spinBuffer = gl.createBuffer();
  const tileBuffer = gl.createBuffer();

  const cap = width * height;
  const spinData = new Float32Array(cap);
  const tileData = new Uint16Array(cap);
  const index = makeElementIndex(cap <= 256 ? new Uint8Array(cap) : new Uint16Array(cap));

  return {
    visible: true,

    get texture() { return texture },

    get left() { return left },
    get top() { return top },
    get width() { return width },
    get height() { return height },

    get length() { return index.length },

    get indexType() {
      const bytes = index.elementByteSize;
      if (bytes == 1)
        return gl.UNSIGNED_BYTE;
      if (bytes == 2)
        return gl.UNSIGNED_SHORT;
      if (bytes == 4 && gl.getExtension('OES_element_index_uint'))
        return gl.UNSIGNED_INT;
      throw new Error(`unsupported index.elementByteSize: ${bytes}`);
    },

    clear() {
      spinData.fill(0);
      tileData.fill(0);
      index.clear();
    },

    /**
     * @param {number} x
     * @param {number} y
     * @param {{layerID: number, spin?: number}} data
     */
    set(x, y, { layerID, spin = 0 }) {
      if (x < 0 || y < 0 || x >= width || y >= height)
        throw new Error(`point: ${JSON.stringify({ x, y })} outside of layer bounds: ${JSON.stringify({ width, height })}`);
      const id = Math.floor(y - top) * width + Math.floor(x - left);
      tileData[id] = layerID;
      spinData[id] = spin;
      if (layerID === 0) index.delete(id);
      else index.add(id);
    },

    send() {
      gl.bindBuffer(gl.ARRAY_BUFFER, spinBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, spinData, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, tileData, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index.buffer, gl.STATIC_DRAW);
    },

    /**
     * @param {number} attr_spin
     * @param {number} attr_layerID
     */
    bindVertexAttribs(attr_spin, attr_layerID) {
      gl.enableVertexAttribArray(attr_spin);
      gl.bindBuffer(gl.ARRAY_BUFFER, spinBuffer);
      gl.vertexAttribPointer(attr_spin, 1, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(attr_layerID);
      gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
      gl.vertexAttribIPointer(attr_layerID, 1, gl.UNSIGNED_SHORT, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    },

  };
}

/** @param {Uint8Array | Uint16Array | Uint32Array} elements */
export function makeElementIndex(elements) {
  let length = 0;

  /** @param {number} id */
  function find(id) {
    let lo = 0, hi = length;
    let sanity = elements.length;
    while (lo < hi) {
      if (--sanity < 0) throw new Error('find loop exeeded iteration budget');
      const mid = Math.floor(lo / 2 + hi / 2);
      const q = elements[mid];
      if (q === id) return mid;
      else if (q < id) lo = mid + 1;
      else if (q > id) hi = mid;
    }
    return lo;
  }

  return {
    *[Symbol.iterator]() {
      for (let i = 0; i < length; i++) yield elements[i];
    },

    get elementByteSize() { return elements.BYTES_PER_ELEMENT },
    get buffer() { return elements.buffer },
    get length() { return length },

    clear() {
      elements.fill(0);
      length = 0;
    },

    // TODO has(id)

    /** @param {number} id */
    add(id) {
      const eli = find(id);
      if (eli < length && elements[eli] === id) return;
      if (length === elements.length) throw new Error('element index full');
      if (eli > length + 1) throw new Error('inconeivable find result index');
      if (eli < length)
        elements.copyWithin(eli + 1, eli, length);
      length++;
      elements[eli] = id;
    },

    /** @param {number} id */
    delete(id) {
      const eli = find(id);
      if (eli < length && elements[eli] === id) {
        elements.copyWithin(eli, eli + 1);
        length--;
      }
    },

  };
}

/** @typedef {ReturnType<makeLayer>} Layer */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} kind
 */
export function makeTextureUnitCache(gl, kind) {
  /** @type {WeakMap<WebGLTexture, number>} */
  let cache = new WeakMap();
  let next = 0;

  return {
    /** @param {WebGLTexture} texture */
    get(texture) {
      let unit = cache.get(texture);
      if (unit === undefined) {
        // TODO reuse lower numbers from prior cache holes
        unit = next++;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(kind, texture);
      }
      return unit;
    }
  };
}

/** @typedef {ReturnType<makeTextureUnitCache>} TextureUnitCache */
