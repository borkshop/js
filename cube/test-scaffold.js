import { assertDefined } from './assert.js';
import { makeDaia } from './daia.js';
import {
  makeModel,
  terrainWater,
  terrainLava,
  terrainCold,
  terrainHot,
} from './model.js';
import { makeMechanics } from './mechanics.js';
import { makeController } from './controller.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeBoxTileMap } from './tile-map-box.js';
import {
  recipes,
  actions,
  tileTypes,
  validAgentTypes,
  validItemTypes,
  validEffectTypes,
} from './data.js';

/**
 * @param {import('ava').ExecutionContext} t
 * @param {Object} args
 * @param {import('./geometry2d.js').Point} args.size
 * @param {Array<import('./mechanics.js').TileType>} args.tileTypes
 * @param {Record<string, string>} args.glyphsByTileName
 */
const makeTestWatcher = (t, { size, tileTypes, glyphsByTileName }) => {
  const locations = new Map();
  const types = new Map();
  /** @type {Map<number, Map<number, Set<number>>>} */
  const table = new Map();

  /** @param {{x: number, y: number}} coord */
  const provideCell = ({ x, y }) => {
    let column = table.get(y);
    if (column === undefined) {
      /** @type {Map<number, Set<number>>} */
      column = new Map();
      table.set(y, column);
    }
    let cell = column.get(x);
    if (cell === undefined) {
      /** @type {Set<number>} */
      cell = new Set();
      column.set(x, cell);
    }
    return cell;
  };

  /** @type {import('./view-model.js').Watcher} */
  const watcher = {
    enter(entity, type) {
      // t.log('9x9 enter', { entity, type });
      types.set(entity, type);
    },
    exit(entity) {
      const location = locations.get(entity);
      const type = types.get(entity);
      // t.log('9x9 exit', { entity, location });
      t.assert(location !== undefined);
      t.assert(type !== undefined);
      provideCell(location).delete(entity);
      locations.delete(entity);
      types.delete(entity);
    },
    place(entity, location, _pressure, _progress, _transition) {
      const priorLocation = locations.get(entity);
      if (priorLocation !== undefined) {
        provideCell(priorLocation).delete(entity);
      }
      locations.set(entity, location);
      provideCell(location).add(entity);
    },
  };

  const draw = () => {
    let drawing = '';
    for (let y = 0; y < size.y; y += 1) {
      for (let x = 0; x < size.x; x += 1) {
        const entities = provideCell({ x, y });
        let glyph = '.';
        let open = ' ';
        let close = ' ';

        const entityTypes = [...entities].map(entity => types.get(entity));
        const nonReticleEntityTypes = entityTypes.filter(
          entityType => entityType !== -1,
        );
        const entityGlyphs = nonReticleEntityTypes.map(entityType => {
          const tile = tileTypes[entityType];
          t.assert(tile !== undefined);
          const name = tile.name;
          return glyphsByTileName[name] || name.slice(0, 1);
        });
        t.assert(
          nonReticleEntityTypes.length <= 1,
          `Multiple non-reticle entity types at (${x}, ${y}): ${entityGlyphs
            .map(glyph => JSON.stringify(glyph))
            .join(', ')}`,
        );

        if (entityTypes.length > nonReticleEntityTypes.length) {
          open = '(';
          close = ')';
        }
        for (const entityGlyph of entityGlyphs) {
          glyph = entityGlyph;
        }
        drawing += open + glyph + close;
      }
      drawing += '\n';
    }
    return drawing;
  };

  /**
   * @param {string} looselyExpected
   */
  const expect = looselyExpected => {
    const expected = looselyExpected
      .replace(/ /g, '')
      .replace(/<-[^\n]*/g, '') // comments
      .trim();
    const actual = draw().replace(/ /g, '').trim();
    t.is(actual, expected);
  };

  return { watcher, draw, expect };
};

/**
 * @param {import('ava').ExecutionContext} t
 */
export const makeScaffold = (t, { size = 3, legend = {} } = {}) => {
  /** @type {Record<string, string>} */
  const glyphsByTileName = {
    north: '^',
    south: 'v',
    watch: 'z',
    west: '<',
    east: '>',
    left: '[',
    right: ']',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    happy: '@',
    appleTree: 'A',
    knittingNeedles: 'n',
    ...Object.fromEntries(
      Object.entries(legend).map(([glyph, name]) => [name, glyph]),
    ),
  };

  /** @type {number | undefined} */
  let player;

  /** @type {Record<string, string>} */
  const agentTypesByGlyph = {
    '@': 'player',
    A: 'appleTree',
    P: 'pearTree',
    M: 'mountain',
    B: 'bank',
    F: 'forge',
    ...legend,
  };

  const mechanics = makeMechanics({
    recipes,
    actions,
    tileTypes,
    validAgentTypes,
    validItemTypes,
    validEffectTypes,
  });

  const daia = makeDaia({
    faceSize: size,
    tileSizePx: NaN,
  });

  const {
    watcher: worldWatcher,
    expect: expectScene,
    draw: drawScene,
  } = makeTestWatcher(t, {
    size: { x: size, y: size },
    tileTypes: mechanics.tileTypes,
    glyphsByTileName,
  });

  const worldViewModel = makeViewModel();
  const worldMacroViewModel = makeMacroViewModel(worldViewModel, {
    name: 'world',
  });

  worldViewModel.watchEntities(
    makeBoxTileMap({
      x: size,
      y: size,
    }),
    worldWatcher,
  );

  const {
    watcher: nineKeyWatcher,
    expect: expectControls,
    draw: drawControls,
  } = makeTestWatcher(t, {
    size: { x: 3, y: 3 },
    tileTypes: mechanics.tileTypes,
    glyphsByTileName,
  });

  const {
    watcher: oneKeyWatcher,
    expect: expectButton,
    draw: drawButton,
  } = makeTestWatcher(t, {
    size: { x: 1, y: 1 },
    tileTypes: mechanics.tileTypes,
    glyphsByTileName,
  });

  const worldModel = makeModel({
    size: daia.worldArea,
    advance: daia.advance,
    macroViewModel: worldMacroViewModel,
    mechanics,
  });

  const cameraController = {
    move() {},
    jump() {},
    animate() {},
    tick() {},
    tock() {},
  };

  const { toponym, advance } = daia;

  /**
   * @param {number} _destination
   * @param {import('./daia.js').CursorChange} _change
   */
  const followCursor = (_destination, _change) => {};

  const menuController = {
    goNorth() {},
    goSouth() {},
    getState() {
      return 'play';
    },
    show() {},
    hide() {},
    animate() {},
    tick() {},
    tock() {},
  };

  const dialogController = {
    /** @param {string} _message */
    log(_message) {
      // t.log(_message);
    },
    /** @param {string} _message */
    logHTML(_message) {
      // t.log(_message);
    },
    close() {},
    animate() {},
    tock() {},
  };

  let health = 0;
  const healthController = {
    /** @param {number} newHealth */
    set(newHealth) {
      health = newHealth;
    },
    animate() {},
    tick() {},
    tock() {},
  };

  let stamina = 0;
  const staminaController = {
    /** @param {number} newStamina */
    set(newStamina) {
      stamina = newStamina;
    },
    animate() {},
    tick() {},
    tock() {},
  };

  const world = {
    mechanics,
    worldModel,
    worldMacroViewModel,
    cameraController,
    toponym,
    advance,
  };

  const controller = makeController({
    nineKeyWatcher,
    oneKeyWatcher,
    menuController,
    dialogController,
    healthController,
    staminaController,
    followCursor,
    mechanics,
    async loadWorld() {},
    async saveWorld() {},
  });

  /**
   * @param {string} spec
   * @param {number} [f]
   */
  const scene = (spec, f = 0) => {
    const table = spec
      .replace(/ +/g, '')
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(''));
    let y = 0;
    for (const line of table) {
      let x = 0;
      for (const glyph of line) {
        if (glyph !== '.') {
          const location = daia.tileNumber({ x, y, f });
          // t.log({x, y, f, location});
          const agentTypeName = agentTypesByGlyph[glyph];
          t.assert(
            agentTypeName !== undefined,
            `Scene cannot contain glyph ${glyph} with no corresponding agent type`,
          );
          const agentType = mechanics.agentTypesByName[agentTypeName];
          const entity = worldModel.set(location, agentType);
          if (glyph === '@') {
            player = entity;
          }
        }
        x += 1;
      }
      y += 1;
    }
  };

  /**
   * @param {string} spec
   * @param {number} [f]
   */
  const terrain = (spec, f = 0) => {
    const table = spec
      .replace(/ +/g, '')
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(''));
    let y = 0;
    for (const line of table) {
      let x = 0;
      for (const glyph of line) {
        const location = daia.tileNumber({ x, y, f });
        if (glyph === 'w') {
          worldModel.toggleTerrainFlags(location, terrainWater);
        } else if (glyph === 'l') {
          worldModel.toggleTerrainFlags(location, terrainLava);
        } else if (glyph === 'h') {
          worldModel.toggleTerrainFlags(location, terrainHot);
        } else if (glyph === 'c') {
          worldModel.toggleTerrainFlags(location, terrainCold);
        } else {
          t.assert(glyph === '.');
        }
        x += 1;
      }
      y += 1;
    }
  };

  const play = () => {
    controller.play(world, player);
    controller.tock();
  };

  /**
   * @param {unknown} data
   */
  const restore = data => {
    const result = worldModel.restore(data);
    if (typeof result === 'number') {
      player = result;
    } else {
      t.fail(result.join(', '));
    }
  };

  /**
   * @param {number} digit
   * @param {boolean} [repeat]
   */
  const command = (digit, repeat = false) => {
    // t.log('---');
    // t.log('command', digit, repeat);
    controller.command(digit, repeat);
    controller.tock();
  };

  /** @param {string} modeName */
  const expectMode = modeName => {
    t.is(controller.modeName(), modeName);
  };

  /**
   * @param {number} slot
   * @param {string} itemName
   */
  const inventory = (slot, itemName) => {
    if (typeof player !== 'number') {
      t.fail('no player, no inventory');
      return;
    }
    const itemType = mechanics.itemTypesByName[itemName];
    t.assert(itemType !== undefined, `No such item type for name ${itemName}`);
    worldModel.put(player, slot, itemType);
    controller.tock();
  };

  /**
   * @param {number} slot
   * @param {string} expectedItemName
   */
  const expectInventory = (slot, expectedItemName) => {
    if (typeof player !== 'number') {
      t.fail('no player, no inventory');
      return;
    }
    const itemType = worldModel.inventory(player, slot);
    const actualItemName = mechanics.itemTypes[itemType].name;
    t.is(actualItemName, expectedItemName);
  };

  return {
    scene,
    terrain,
    play,
    restore,
    command,
    controller,
    worldModel,
    expectMode,
    expectControls,
    drawControls,
    expectScene,
    drawScene,
    expectButton,
    drawButton,
    world,
    mechanics,
    inventory,
    expectInventory,
    get health() {
      return health;
    },
    /** @param {number} health */
    set health(health) {
      assertDefined(player);
      worldModel.setHealth(player, health);
    },
    get stamina() {
      return stamina;
    },
    /** @param {number} stamina */
    set stamina(stamina) {
      assertDefined(player);
      worldModel.setStamina(player, stamina);
    },
  };
};
