/**
 * Generated by scripts/gen-whole-world-ts.js:
 */

export type ActionDescription = {
  agent?: string;
  patient: string;
  left?: string;
  right?: string;
  effect?: string;
  verb: string;
  items?: Array<string>;
  morph?: string;
  shift?: string;
  dialog?: string;
  jump?: string;
};

export type AgentDescription = {
  name: string;
  tile?: string;
  wanders?: string;
  dialog?: Array<string>;
  health?: number;
  stamina?: number;
  modes?: Array<{
    tile: string;
    holds?: string;
    has?: string;
    hot?: boolean;
    cold?: boolean;
    sick?: boolean;
    health?: number;
    stamina?: number;
    immersed?: boolean;
  }>;
  slots?: Array<{ tile: string; held?: boolean; pack?: boolean }>;
};

export type ConditionDescription = {
  holds?: string;
  has?: string;
  hot?: boolean;
  cold?: boolean;
  sick?: boolean;
  health?: number;
  stamina?: number;
  immersed?: boolean;
};

export type DaiaLevelDescription = {
  facetsPerFace: number;
  tilesPerFacet: number;
  colors: Array<{ base: string; lava: string; water: string; earth: string }>;
};

export type EffectDescription = { name: string; tile?: string };

export type ItemDescription = {
  name: string;
  tile?: string;
  comestible?: boolean;
  health?: number;
  stamina?: number;
  heat?: number;
  boat?: boolean;
  swimGear?: boolean;
  tip?: string;
  slot?: string;
};

export type LevelDescription =
  | {
      topology: 'rect';
      size: { x: number; y: number };
      colors: { base: string; lava: string; water: string; earth: string };
    }
  | {
      topology: 'torus';
      tilesPerChunk: { x: number; y: number };
      chunksPerLevel: { x: number; y: number };
      colors: { base: string; lava: string; water: string; earth: string };
    }
  | {
      topology: 'daia';
      facetsPerFace: number;
      tilesPerFacet: number;
      colors: Array<{
        base: string;
        lava: string;
        water: string;
        earth: string;
      }>;
    };

export type MechanicsDescription = {
  agentTypes?: Array<{
    name: string;
    tile?: string;
    wanders?: string;
    dialog?: Array<string>;
    health?: number;
    stamina?: number;
    modes?: Array<{
      tile: string;
      holds?: string;
      has?: string;
      hot?: boolean;
      cold?: boolean;
      sick?: boolean;
      health?: number;
      stamina?: number;
      immersed?: boolean;
    }>;
    slots?: Array<{ tile: string; held?: boolean; pack?: boolean }>;
  }>;
  recipes?: Array<{
    agent: string;
    reagent: string;
    product: string;
    byproduct?: string;
    price?: number;
    dialog?: string;
  }>;
  actions?: Array<{
    agent?: string;
    patient: string;
    left?: string;
    right?: string;
    effect?: string;
    verb: string;
    items?: Array<string>;
    morph?: string;
    shift?: string;
    dialog?: string;
    jump?: string;
  }>;
  tileTypes?: Array<{ name: string; text: string; turn?: number }>;
  itemTypes?: Array<{
    name: string;
    tile?: string;
    comestible?: boolean;
    health?: number;
    stamina?: number;
    heat?: number;
    boat?: boolean;
    swimGear?: boolean;
    tip?: string;
    slot?: string;
  }>;
  effectTypes?: Array<{ name: string; tile?: string }>;
};

export type Point = { x: number; y: number };

export type RecipeDescription = {
  agent: string;
  reagent: string;
  product: string;
  byproduct?: string;
  price?: number;
  dialog?: string;
};

export type RectLevelDescription = {
  size: { x: number; y: number };
  colors: { base: string; lava: string; water: string; earth: string };
};

export type TileDescription = { name: string; text: string; turn?: number };

export type TorusLevelDescription = {
  tilesPerChunk: { x: number; y: number };
  chunksPerLevel: { x: number; y: number };
  colors: { base: string; lava: string; water: string; earth: string };
};

export type WholeWorldDescription = {
  locations: Array<number>;
  types: Array<number>;
  player?: number;
  inventories?: Map<number, Array<number>>;
  terrain?: Uint8Array;
  healths?: Map<number, number>;
  staminas?: Map<number, number>;
  targetLocations?: Map<number, number>;
  targetEntities?: Map<number, number>;
  colors: Map<string, string>;
  levels: Array<
    | {
        topology: 'rect';
        size: { x: number; y: number };
        colors: { base: string; lava: string; water: string; earth: string };
      }
    | {
        topology: 'torus';
        tilesPerChunk: { x: number; y: number };
        chunksPerLevel: { x: number; y: number };
        colors: { base: string; lava: string; water: string; earth: string };
      }
    | {
        topology: 'daia';
        facetsPerFace: number;
        tilesPerFacet: number;
        colors: Array<{
          base: string;
          lava: string;
          water: string;
          earth: string;
        }>;
      }
  >;
  mechanics: {
    agentTypes?: Array<{
      name: string;
      tile?: string;
      wanders?: string;
      dialog?: Array<string>;
      health?: number;
      stamina?: number;
      modes?: Array<{
        tile: string;
        holds?: string;
        has?: string;
        hot?: boolean;
        cold?: boolean;
        sick?: boolean;
        health?: number;
        stamina?: number;
        immersed?: boolean;
      }>;
      slots?: Array<{ tile: string; held?: boolean; pack?: boolean }>;
    }>;
    recipes?: Array<{
      agent: string;
      reagent: string;
      product: string;
      byproduct?: string;
      price?: number;
      dialog?: string;
    }>;
    actions?: Array<{
      agent?: string;
      patient: string;
      left?: string;
      right?: string;
      effect?: string;
      verb: string;
      items?: Array<string>;
      morph?: string;
      shift?: string;
      dialog?: string;
      jump?: string;
    }>;
    tileTypes?: Array<{ name: string; text: string; turn?: number }>;
    itemTypes?: Array<{
      name: string;
      tile?: string;
      comestible?: boolean;
      health?: number;
      stamina?: number;
      heat?: number;
      boat?: boolean;
      swimGear?: boolean;
      tip?: string;
      slot?: string;
    }>;
    effectTypes?: Array<{ name: string; tile?: string }>;
  };
  marks?: Map<string, number>;
};

export type WorldColorNamePalette = {
  base: string;
  lava: string;
  water: string;
  earth: string;
};

export type WorldDescription = {
  locations: Array<number>;
  types: Array<number>;
  player?: number;
  inventories?: Map<number, Array<number>>;
  terrain?: Uint8Array;
  healths?: Map<number, number>;
  staminas?: Map<number, number>;
  targetLocations?: Map<number, number>;
  targetEntities?: Map<number, number>;
};

export type WorldMetaDescription = {
  colors: Map<string, string>;
  levels: Array<
    | {
        topology: 'rect';
        size: { x: number; y: number };
        colors: { base: string; lava: string; water: string; earth: string };
      }
    | {
        topology: 'torus';
        tilesPerChunk: { x: number; y: number };
        chunksPerLevel: { x: number; y: number };
        colors: { base: string; lava: string; water: string; earth: string };
      }
    | {
        topology: 'daia';
        facetsPerFace: number;
        tilesPerFacet: number;
        colors: Array<{
          base: string;
          lava: string;
          water: string;
          earth: string;
        }>;
      }
  >;
  mechanics: {
    agentTypes?: Array<{
      name: string;
      tile?: string;
      wanders?: string;
      dialog?: Array<string>;
      health?: number;
      stamina?: number;
      modes?: Array<{
        tile: string;
        holds?: string;
        has?: string;
        hot?: boolean;
        cold?: boolean;
        sick?: boolean;
        health?: number;
        stamina?: number;
        immersed?: boolean;
      }>;
      slots?: Array<{ tile: string; held?: boolean; pack?: boolean }>;
    }>;
    recipes?: Array<{
      agent: string;
      reagent: string;
      product: string;
      byproduct?: string;
      price?: number;
      dialog?: string;
    }>;
    actions?: Array<{
      agent?: string;
      patient: string;
      left?: string;
      right?: string;
      effect?: string;
      verb: string;
      items?: Array<string>;
      morph?: string;
      shift?: string;
      dialog?: string;
      jump?: string;
    }>;
    tileTypes?: Array<{ name: string; text: string; turn?: number }>;
    itemTypes?: Array<{
      name: string;
      tile?: string;
      comestible?: boolean;
      health?: number;
      stamina?: number;
      heat?: number;
      boat?: boolean;
      swimGear?: boolean;
      tip?: string;
      slot?: string;
    }>;
    effectTypes?: Array<{ name: string; tile?: string }>;
  };
  marks?: Map<string, number>;
};
