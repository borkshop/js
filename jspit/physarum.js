import {mortonKey} from 'cdom/tiles';
import {atHeading, stepParticles} from './particles';
import {toRad, parseAngle, parsePercent} from './units';

// TODO reconcile particle engine with with domgeon movement

/**
 * @typedef {import('cdom/tiles').Rect} Rect
 * @typedef {import('cdom/tiles').Point} Point
 * @typedef {import('cdom/tiles').TileSpec} TileSpec
 * @typedef {import('cdom/tiles').TileGrid} TileGrid
 */

export default class {
  /** @type {TileGrid} */
  grid

  /** @type {HTMLElement} */
  status

  nParticles = -1
  depositAmt = 0.2
  decay = 0.01
  ordinalMoves = true
  diffuse = [
    {x:  0, y:  0},
    {x:  0, y:  1},
    {x:  1, y:  1},
    {x:  1, y:  0},
    {x:  1, y: -1},
    {x:  0, y: -1},
    {x: -1, y: -1},
    {x: -1, y:  0},
    {x: -1, y:  1},
  ]

  sense = [-Math.PI/4, 0, Math.PI/4]
  quant = 0.3333
  showSensors = false

  bounce = [-Math.PI/4, Math.PI/4]

  /** @type {Object<string, number|number[]>} */
  turns = {
    // turn left if better
    '1,0,0': -Math.PI/4,
    '2,0,0': -Math.PI/4,
    '2,0,1': -Math.PI/4,
    '2,1,0': -Math.PI/4,
    '2,1,1': -Math.PI/4,

    // turn right if better
    '0,0,1': Math.PI/4,
    '0,0,2': Math.PI/4,
    '0,1,2': Math.PI/4,
    '1,0,2': Math.PI/4,
    '1,1,2': Math.PI/4,

    // turn randomly if straight is worse
    '1,0,1': [-Math.PI/4, Math.PI/4],
    '2,1,2': [-Math.PI/4, Math.PI/4],
    '2,0,2': [-Math.PI/4, Math.PI/4],

    // default to straight ahead
  }

  tick = NaN
  rate = 100
  singleStep = false

  /**
   * @param {import('cdom/domgeon').DOMgeon} dmg
   * @param {HTMLElement} status
   */
  constructor(dmg, status) {
    this.grid = dmg.grid;
    this.status = status;
    dmg.animParts.push({
      // TODO configurable / dynamic rate similar to dla
      every: () => this.rate, then: () => {
        this.step();
        return !this.singleStep;
      },
    });
    this.reset();
  }

  /** @return {void} */
  reset() {
    // TODO provide this sort of tile probing directly out of TileGrid
    const test = this.grid.createTile({
      id: 'sizeTest',
      text: 'X',
    });
    this.grid.viewPoint = {x: 0, y: 0};
    const rect = this.grid.viewport;
    if (!isFinite(rect.w) || !isFinite(rect.h)) {
      throw new Error('unable to determine grid tile/viewport size');
    }
    test.parentNode?.removeChild(test);

    const notes = [`tick:${this.tick = 0}`];

    // fill trail cells randomly
    // TODO something more like a uniform distribution ala catan
    const {x, y, w, h} = rect;
    const oldTrail = this.grid.queryTiles({className: 'trail'});
    for (let ax=x, i=0; i<w; ax++, i++) for (let ay=y, j=0; j<h; ay++, j++) {
      const pos = {x: ax, y: ay};
      /** @type {TileSpec} */
      const spec = {
        className: 'trail',
        pos,
        text: '·',
        data: {value: `${Math.random() * 100}%`}
      };
      const tile = oldTrail.shift();
      if (tile) this.grid.updateTile(tile, spec);
      else this.grid.createTile(spec);
    }
    while (oldTrail.length) {
      const tile = oldTrail.shift();
      if (tile) tile.parentNode?.removeChild(tile);
    }

    // kill all prior particles and spawn new ones
    for (const p of this.grid.queryTiles({
      className: ['particle', 'live'],
    })) this.grid.updateTile(p, {className: 'ghost'});
    const r = Math.min(w, h) / 2;
    let nParticles = Math.floor(r * Math.PI);
    for (let i = 0; i < nParticles; ++i) {
      const θ = i / nParticles * 2 * Math.PI;
      const {x, y} = atHeading({x:0, y:0}, θ, r);
      const h = θ - Math.PI;
      /** @type {TileSpec} */
      const spec = {
        pos: {x, y},
        className: ['particle', 'live'],
        // text: '↑',
        text: '🌲',
        data: {heading: `${h}rad`},
      };
      const ghost = this.grid.queryTile({className: 'ghost'});
      const tile = ghost
        ? this.grid.updateTile(ghost, spec)
        : this.grid.createTile(spec);
      tile.title = `#${tile.id} from origin: ${θ/Math.PI}π heading ${h/Math.PI}π`
    }

    // create particle sensor displays
    if (this.showSensors) {
      const sensors = this.grid.queryTiles({className: 'sense'});
      for (const p of this.grid.queryTiles({
        className: ['particle', 'live'],
      })) {
        const pos = this.grid.getTilePosition(p);
        const h = toRad(parseAngle(this.grid.getTileData(p, 'heading')));
        let note = `@[${Math.round(100*pos.x)/100}, ${Math.round(100*pos.y)/100}]`;
        note = `${note} θ=${Math.round(100 * h/Math.PI)/100}π`;
        for (const [i, dh] of Object.entries(this.sense)) {
          const θ = h+dh;
          const at = atHeading(pos, θ)
          /** @type {TileSpec} */
          const spec = {
            pos: at,
            className: 'sense',
            text: `${i}`,
            data: {'for': p.id, sensed: null},
          };

          const prior = sensors.pop();
          const sensor = prior
            ? this.grid.updateTile(prior, spec)
            : this.grid.createTile(spec);
          sensor.title = `#${sensor.id}[for=${sensor.dataset['for']}]`;
        }
        notes.push(p.title = `#${p.id}(${note})`);
      }
    }
    this.status.innerText = `${notes.join(' ')}`;
    // TODO initial particle notes
  }

  step() {
    /** @type {string[]} */
    const notes = [`tick:${++this.tick}`];
    stepParticles({
      grid: this.grid,
      stepLimit: 0, // immortal for now
      ordinalMoves: this.ordinalMoves,
      update: (grid, ps) => {
        for (const p of ps) {
          const pos = grid.getTilePosition(p);
          // let note = `[${Math.round(100*pos.x)/100}, ${Math.round(100*pos.y)/100}]`;

          let h = toRad(parseAngle(grid.getTileData(p, 'heading')));
          if (typeof h !== 'number' || isNaN(h)) h = 0;
          // note = `${note} θ=${Math.round(h/Math.PI *100)/100}π`;

          const svs = this.sense.map(dh => {
            const cell = grid.tileAt(atHeading(pos, h + dh), 'trail');
            if (!cell) return 0;
            const value = parseTrailValue(this.grid.getTileData(cell, 'value'));
            return Math.floor(value / this.quant);
          });

          const turnKey = svs.join(',');
          // note = `${note} sense=${turnKey}`;
          let turn = this.turns[turnKey];
          if (Array.isArray(turn)) turn = turn[Math.floor(Math.random()*turn.length)];
          if (typeof turn === 'number') {
            // note = `${note} turn=${Math.round(turn/Math.PI *100)/100}π`
            h += Math.PI * turn;
            h %= 2 * Math.PI;
            grid.setTileData(p, 'heading', `${h}rad`);
          }

          if (this.showSensors) {
            const sts = grid.queryTiles({className: 'sense', data: {'for': p.id}});
            for (let i = 0; i < sts.length; ++i) {
              const dh = this.sense[i];
              const θ = h+dh;
              const at = atHeading(pos, θ)
              const sensor = sts[i];
              const sensed = `${svs[i] * this.quant * 100}%`;
              grid.updateTile(sensor, {
                pos: at,
                data: {sensed},
              });
              sensor.title = `#${sensor.id}[for=${sensor.dataset['for']}] i=${i} sv=${svs[i]} sensed=${sensed}`;
            }
          }

          // notes.push(p.title = `#${p.id}(${note})`);
        }
      },
      handle: (grid, p, pos, to) => {
        // must stay on trail support
        if (!grid.tileAt(to, 'trail')) {
          let h = toRad(parseAngle(grid.getTileData(p, 'heading')));
          if (typeof h !== 'number' || isNaN(h)) h = 0;
          // TODO incidence/reflection angle bouncing?
          h = (h + this.bounce[Math.floor(Math.random()*this.bounce.length)]) % 2*Math.PI;
          grid.setTileData(p, 'heading', `${h}rad`);
          return false;
        }

        // deposit in outgoin cell
        const cell = grid.tileAt(pos, 'trail');
        if (cell) {
          let value = parseTrailValue(grid.getTileData(cell, 'value'));
          value = Math.min(1, value + this.depositAmt);
          grid.setTileData(cell, 'value', `${value * 100}%`);
        }

        return true;
      },
    });
    diffuse({
      grid: this.grid,
      stencil: this.diffuse,
      decay: this.decay,
    });
    this.status.innerText = `${notes.join(' ')}`;
  }
}

/**
 * @param {any} value
 * @return {number}
 */
function parseTrailValue(value) {
  if (!value) return 0;
  if (typeof value === 'string') return parsePercent(value);
  else if (typeof value === 'number') return value;
  return NaN;
}

/**
 * @param {Object} options
 * @param {TileGrid} options.grid
 * @param {Point[]} [options.stencil]
 * @param {number} [options.decay]
 * @param {string} [options.className]
 * @param {string} [options.valueName]
 */
export function diffuse({
  grid,
  stencil = [
    {x:  0, y:  0},
    {x:  0, y:  1},
    {x:  1, y:  1},
    {x:  1, y:  0},
    {x:  1, y: -1},
    {x:  0, y: -1},
    {x: -1, y: -1},
    {x: -1, y:  0},
    {x: -1, y:  1},
  ],
  decay = 0,
  className = 'trail',
}) {
  const cells = grid.queryTiles({className});
  const posi = cells.map(cell => grid.getTilePosition(cell));
  const vals = cells.map(cell => parseTrailValue(grid.getTileData(cell, 'value')));

  // gather prior values
  /** @type {Map<number, number>} */
  const at = new Map();
  for (let i = 0; i < cells.length; ++i) {
    const key = mortonKey(posi[i]);
    const val = vals[i];
    if (!isNaN(val)) at.set(key, val);
  }

  const mul = 1 - decay;
  for (let i = 0; i < cells.length; ++i) {
    const {x, y} = posi[i];
    let t=0, n=0;
    for (const {x: dx, y: dy} of stencil) {
      const key = mortonKey({x: x+dx, y: y+dy});
      const val = at.get(key);
      if (typeof val === 'number' && !isNaN(val)) t+=val, n++;
    }
    const cell = cells[i];
    grid.setTileData(cell, 'value', `${mul * t/n * 100}%`);
  }
}
