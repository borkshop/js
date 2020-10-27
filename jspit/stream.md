# 2020-10-27

## TODO

- domgeon:
  - player inventorty/ability system; good initial use cases includ a digging
    item, floor tile creator, a particle gun, or void walking boots
  - visibility ala <https://www.albertford.com/shadowcasting>
  - interactable tiles like doors and runes
  - a builder based on common patterns like rectangld draw/fill

- tiles
  - watch for any spatial index bugs, once saw a zombie particle at incorrect
    location, which allowed the player to step into the void in the DLA demo
  - TileGrid
    - custom shader funcs, or at least some affordance for stepped css classes
    - animations like boop and particles
    - save/load ; initial state
    - masking?

## WIP

<https://www.sagejenson.com/physarum>
- TODO read the original <https://uwe-repository.worktribe.com/output/980579>

## Done

# 2020-10-26

Started a local/uncommitted Physarum prototype: got diffusion and decay
working, before getting hung up on heading trig vs coordinate system bugs.
Will continue and piece out progress tomorrow.

### Flatter and more tooling agnostic

Prompted by @kris, inspired by [properjs.org](http://properjs.org/), and it
resonance with [snowpack.dev](https://www.snowpack.dev/)'s design philosophy:

- switched away from direct TS files in lieu of ts-checked JS; done for cdom,
  jspit itself still needs to be translated
- made quite a few improvements made while translating and documenting
- flattened the repository by two steps: `packages/{cdom,jspit}/src/*` are all
  now just `{cdom,jspit}/*`
- moved away from using the node module system to structure out monorepo,
  instead relying on snowpack mounts, symlinks, and typescript's "classic"
  module resolution order, which is basically "retry in the parent directory"

Did however choose to not take the tooling since:

- consistency in dev tool versions and production builds (e.g. under vercel)
  is still useful, rather than relying on system-wide `tsc` and friends
- `file:///` or "just run `http-server`" aren't really a good dev xp
- don't want to go all the way back to `Makefile`s for project orchestration,
  and there is value that yarn et al provide there, let alone network effects
- there's still use for file transformations, like markdown rendering and
  sprite sheet assembly, and maybe even a DSL, or at least JSON/CSV use case
  for game rule/data inclusion
- snowpack serves as a useful / minimal dev server and build tool so far, in
  particular things I'd miss at this point:
  - dev server uncaught exception overlay
  - live reloading, no matter what fate HMR, rather than mashing refresh
  - the ability to still fold in `.ts` files and consume 3rd party node
    modules without any additional effort
- now, having decided to keep `tsc` and `snowpack` in the mix, we still have
  a need for each project/site root within the monorepo to contain a
  `package.json` and a `tsconfig.json`; however I was able to inline the
  snowpack config itself into `package.json`, so one less file; also we can
  get away with a mere symlink for `tsconfig.json`, but must have one because
  reasons... alos I was unable to get `jsconfig.json` to work, especially
  under how the snowpack typescript plugin invokes tsc; that may be
  configurable, but I had to draw the line somewhere, and get to done...

So in summary, what we now have:

- `/package.json` still contains workspace declarations for `jspit` and
  `cdom-template`, but that's now hardcoded rather than globbed
- `/cdom` is the library, contatins `.js` modules, but is not a formal
  "package"
- `/cdom-template` is the starter kit for "write you a DOMgeon, using HTML,
  CSS, and maybe some JavaScript (inline or otherwise)".
- `/jspit` is similar to the template, but still written in TS to prove that
  still works; will probably continue to progressively translate it, at least
  when things mature out into `/cdom`; TBD what I write new code in when
  experimenting, since jsdoc-annotated code is still more cumbersome than
  native TS
- `/svgeon` is still its own island, lacking a `package.json` and not setup as
  a workspace
- the way that jspit and the template find cdom is two part: their snowpack
  config has `../cdom` explicitly mounted at `/cdom`; typescript's configured
  to use its "classic" rather than "node" module resolution, so it Just Works™
  when it tries `../cdom/*` after failing to find `./cdom/*` from an `import
  yada from 'cdom/thing'`

# Week Ending 2020-10-24

- moved jspit deployment to vercel, which ended up simpliying away all of the
  common "ui" module code shared between demos, since it was 90% concerned with
  version display and management
- dropped lit-html dependency, there are now no 3rd party runtime deps
- finished out the jspit DLA demo enough to call it "done" for now:
  implementing things like ghost particle reaping served as a decent smoke test
  of the the tile system

- started a DOMgeon prototype as a 3rd jspit demo page
  - will eventually split out a template package backed by a module that can
    eventually be published outside the borkshop monorepo
  - started out with a hardcoded-html 5x5 room, which was a useful exercise for
    "this should be possbile" even if it's too cumbersome for much use
  - after landing on a believable `class DOMgeon` base API, shifted this to
    inline scripted room construction
  - also started out with a `DOMgeonInspector` built on top of the base
    `TileInspector`; this may eventually pivot into a proper `DOMgeonEditor`
  - the basic minimal core is something like:

    ```html
    <div id="grid"></div>
    <style>
      /* TODO style your .grid .tile classes */
    </style>
    <script type="module">
      import {DOMgeon} from '.../domgeon';
      const dmg = window.dmg = new DOMgeon(document.getElementById('grid'));
      dmg.grid.createTile({
        id: 'player',
        pos: {x: 0, y: 0},             // NOTE tile system coordinates
        className: ['input', 'mover'], // NOTE would typically include 'solid'
        text: '@',
      });
      // NOTE typically, create a level out of tile likes:
      // - className:'floor'           -- these define a space for .solid.mover tiles
      // - className:['wall', 'solid'] -- these further constrain .solid.mover tiles
    </script>
    ```

    Speculatively, would like to end up with an additional layer, where there's
    no inline javacript, but maybe just: a JSON config block inside a
    `grid > script[type="applicaton/json"]` element afforded by a standardized
    module script.

- generalized the "input" module's `KeyMap` into `KeyCtl`

  Eases adding simple key/code handling on top of parseed movement coalescing;
  this unified code previously duplicated by both demoes

  Plus now makes it easy for a DM to do things like:
  ```javascript
  dmg.keys.on.key['5'] = (ev) => if (ev.type === 'keyup') alert('what of it?')
  ```
  to easily define custom behavior for a key.

  TODO: such handler function gets called for both key up and down, expecting
  the user to first check the event type; we could further ease this by
  allowing the map value above to be an object like `{up?: (ev)=>void, down?:
  (ev)=>void}` and/or providing a simpler default like "you only see `keyup`
  events, unless you ask for down..."

- iterated a lot on how best to scope the boundaries across html / css / inline
  script / page script / and supporting modules
  - 80% happy with where the `tiles` module is at, it contains things like:
    - `TileGrid` -- the main rendering component used by everything
    - `TileSpec` and `TileQuery` -- types that it deals in for creating,
      updating, and retieving tiles
    - `TileInspector` -- an addon that supports building a mouse-oriented
      "What's That?" UI
    - `moveTiles` -- supports implementing arbitrary tile movement rules, with
      a default provision for "solid" tile collison and "floor" support tile
      requirement
    - dropped things like "view nudging", instead the grid now has a central
      "veiePoint" property mediated by accessors; the viewport now tracks this
      center point on resize
    - naturalized the shape of `TileSpec` to aling better with DOM shapes; things
      like "fg/bg are now style.color and style.backgroundColor"
    - am a little uncertain about the shit-I-made up under `TileQuery`, and may
      drop/refactor it before 1.0
    - the grid now provides default IDs based on an internal monotonic counter
      keyed by the first/primary `className`;. i.e. if you
      `grid.createTile({className: 'floor'})`, it get's a "floor-N" id
    - made the `TileInspector` track empt cells too, now the only thing missing
      from things like `DOMgeonInspector` is a ghost tile to move around when
      none is selected...
  - factored a new "particles" module out of the DLA demo; for now it's just a
    `stepParticles()` to call in something like an `update(dt)` loop, but it
    can eventually accrete things like: spawning routines adapted from the DLA
    demo and aceelerated/out-of-DOM versions for procgen

# 2020-10-24

- wrote a weekly stream summary
- stored the jspit "game" TODOs down in a new stream Basement section; calling
  DLA "done for now ™"

# 2020-10-23

- domgeon
  - reified everything to expose an object off which custom DM logic may hang
  - decoupled inspector
- tiles
  - provide auto generated tile ids, easing domgeon inline creation scripts

# 2020-10-22

- wrote a small domgeon skeleton with a hardcoded 5x5 room
- added `TileGrid` support for pre-existing tiles
- improved `TileInspector` so that it emits events for empty cells too
- refactored demo page module structure to further simplify start/stop
  structure
- generalized `KeyMap` into `KeyCtl` to generalize the prior `filter` code
  dispatch for things like `Escape` and `Space`
- tried a last few tricks for initial DLA void point selection, without much
  result other than a `mortonCompact1` function

# 2020-10-21

- factored out particles module with the core underlying update logic from the
  DLA demo
- tiles module:
  - reshaped `TileSpec` for better CSS/DOM alignment
  - provide default mover class
  - refactored `TileGrid` view movement code, dropping the overly specific
    nudge routine
  - refactored viewport management, reducing surface are, and adding resize
    handling to keep the requested point centered

# 2020-10-20

- moved deployment to vercel, dropping version display for now
- dropped lit-html dependency; generalized dla's inspector dumping, but decided
  to not use it in colorboop for now
- DLA
  - made config instanced per world rather than just static
  - provided defaults bounds based on viewport
- factored out general move processing routine into tiles module
- de-objectified ColorBoop

# 2020-10-19

- TileGrid
  - expanded inspector so that it can be toggled on and off after creation
  - hardened edge so that user must past tile elements, rather than implicit
    lookup of string ids
  - expanded tile querying to support id substring matches and data attribute
    matches
- DLA
  - added tile hidden data reveal mode with inspection widget
  - reap and reincarnate ghosts before creating new particles when spawning;
    this fixes the balance between void and prime particles, since dead void
    particles would drag down that side's final count
  - dropped toroidal topology in lieu of just step-expiring  particles

# 2020-10-17

- added latest verion detection and link display to all pages
- read <http://paulbourke.net/fractals/dla/> for more background and
  inspiration; elaborated DLA TODO section above

### aside: finding stickiness probabilities

Say we want to use a stickiness factor that scales with number of neighbors, we
might have various design goals like:
- the overall probability should be `0.5` when half the neighbors are occupied
- the overall probability should be circa `0.9` at full neighbor saturation

Using a joint probability model where each neighbor contributes an independent
stick probability:
> P(x) | P(y) = ~(~P(y) & ~P(y))

We can:
```
  > let joint = (...ps) => 1 - ps.map(p => 1-p).reduce((a,b) => a*b, 1)
  undefined

  > joint(0.5, 0.5)
  0.75

  > joint(0.5, 0.5, 0.5)
  0.875

  > joint(...(new Array(4).fill(0.15910358474628546)))
  0.5000000000000001

  > joint(...(new Array(8).fill(0.26)))
  0.9100805259796224
```

# 2020-10-16

- fixed DLA demo to actually do DLA, preserving the random walker behavior as
  well
- revamped and generalized settings module

# 2020-10-15

- added initial heading controls for DLA particles
- fixed DLA particle movement: particels now take on fractional positions, but
  create normal integer-aligned tiles
- indirected DLA color variables
- Finished de-Simification through DLA
- Sketched a new page-module pattern around bindings and state
- Improved menu system, no longer just modal, with a shared ui bindings module

# 2020-10-14

- fully erased the `Sim` abstraction from `ColorBoop`; TODO follow through with
  DLA tomorrow, then drop the `sim` module
- reworked to a multi-page app structure: index, colorboop, and dla are now
  separate `.html` files
- started disaggregating modules, broke out `input`, `tiles`, `anim`, `state`,
  `sim`, `dla`, and `colorboop` modules

# 2020-10-13

- refactored `Sim` plumbing to decouple from the multi-Scenario demo use case
- revamped `DLA` settings, now persisted through location hash

# 2020-10-12

- emptied out old jcorbin rep with a notice, stil publishing built game to
  jcorbin github pages
- switched fully to snowpack and ESNext standards
- moved into brave new borkshop monorepo

# 2020-10-09

- added player drop and dig to DLA demo
- improved DLA turning arc: dual ended control
- subsumed Sim reboot button, and bound to Escape key
- added a morton-curve spatial index to TileGrid
- added tile inspection support to Sim/Scenario, example use in ColorBoop

# 2020-10-08

- wrote a DLA demo, which was a great way to furher experiment with modal UI,
  and also quickly hit the limits of the current brute force spatial query (guess)
- refactored to support multiple demos / scenarios:
  - the main animation loop is tiny again
  - it pumps a `Sim` object
  - that has a `change()`able `Scenario` object
- implemented basic color boop collider
- factored out TileGrid to reify the grid sketched yesterday
- sorted out details for building and pushing to github pages

# 2020-10-07

- NOTE: current plan is to code from the bottom-up or outside-in, while
  continuing to ruminate on and expand design thoughts here in markdown land.
  This will allow putting off entity implementation as long as possible, since
  I'm still going back and forth between "use ape-ecs" or "build a froggy-like
  component-graph-system"...
- added a readme, posted to github
- setup parcel and a sample html with minimal stylesheet
- started building input control, starting with key events marshalled from
  up/down events harvested at a fixed rate every several frames
- after inspiration from
  <https://eager.io/blog/communicating-between-javascript-and-css-with-css-variables/>
  via @kris, built a minimal infinite-scrolling CSS tile grid

# 2020-10-06

- more ecs and other lore research
  - NOTE ape-ecs seems designed around a mono world... `world.registerCopmonet`
    smashes `klass.prototype` <https://github.com/fritzy/ape-ecs/issues/33>
  - NOTE reserved component names... because not using a Map?
- imported design from ios notes, edited quite a lot
- starting collecting resources at top
- digested thoughts on ape-ecs below

# 2020-10-05

- wrote down some scant design notes into ios note app

- read much of ape-ecs's docs. On balance I think it'll do find and allow jspit
  to not be "an ECS project". My main concerns are that it's not really setup
  for great performance with millions of entities. Everything seems to be slung
  off "for entity in query for component on it" form, rather than allowing for
  native vectorized batch operations over component data.

  In summary, my initial impression is:
  - it's got decent performance vs an typical OOP-tangle
  - but it's more aligned with being a convenient / powerful / flexible domain
    modeling tool than it is about "high performance"
  - on balance, I think that's the right trade-off for jspit

  Notes taken in-situ:
  - TODO: what means "evergreen entities"? seems to be a singleton per-world?
  - NOTE: `entity.getComponents('Q')` better than `entity.types['Q']` since
    it can take constructor functions like `entity.getComponents(Q)`
  - NOTE: copyTypes for world -> world creation
  - NOTE: system subscription works
    - by `this.subscribe(T)` in init
    - then harvesting `this.changes` in `update`
    - things like add/detroy
    - ref add/delete
    - change if using update and component opted in to tracking
  - NOTE: `spinup` to `World.registerCompenent` is a capacity hint, ala
    `pool.targetSize`; pool then reclaims after `2*targetSize`
  - NOTE: system update doing a "for each entity, process and consume/remove
    (one of) its qualifiying components" seems inefficient; ideally could be
    more like:

    ```javascript
    const subjects = this.inQuery.execute();
    for(const entity of subject) {
      for (const q of entity.getComponents('Q'))
      // XXX instead of entity.removeComponent('Q')
    }
    subjects.removeComponent('Q'); // XXX would rather, can?
    ```

# Design

Musings on an eventual game design, see [Prior](#prior) section below for notes
on jspit's predecessor.

## The Pits

- each pit is its own isolated (objective) world
- starts out as a wall rectangle defined in its void, with a default filling
  rule for ...wall/tile?

- each has a super(visor) that exists in its spirit plane, and has special
  privileges to control the pit's basic plane
  - TBD is the super integrated with the pit / directly in control? or must it
    indirectly do things through other entities in the control plane? i.e. is
    there potential for other spirits to co-opt the controls?
  - responsible for all souls in their pit
  - create a new spawn pod by DLA from the super point
  - pick a soul, spawn a body, generate new mind, attach soul

## Spirits

- are attracted by a sufficiently aligned entity
- creates rifts in out-of-the-way places ( e.g. from DLA pocketing )
- tries to lead entity through its entrance rift back to its realm
- archetypes: messenger / collector for a higher spirt ; hermit spirt took note

## 3 Categories of Phenomena

### Physical: entity bodies

The objective world, realm of what can be seen, felt, done, heard, smelt,
tasted, or otherwise sensed and interacted with. Only singular in the
"universe" sense, in that it binds together many entities subjectively
interacting with it. There will still be many of these multiversally.

Organized into planes within each world:
- typically one plane at a time is rendered ; could do a (pseudo)-3d stacked god view
- collision is local to a plane
- TBD whether need cross-planar entities or go with linked shadow/proxy/avatars
- cross-planar action needs to be possible, if uncommon

Will probably go with a finite set of plane represented as ECS tags; probably
don't need dynamic plane space?

Energy ideas: heat, steam, prana, qi, psi, electricity, light, force...

All of this exists in a singular world with tightly controlled access to
implement physical restrictions and the like.

### Thought: entity minds

Many subjective worlds, realm of AI and IA:
- IA: support for intelligences, artifical (NPCs) or natural (Player)
  - a tuple/fact database to record input/action/goal/plans e.g.
    - an atomic action like "move North"
    - a goal like "move to X,Y" that can generate atomic actions
    - known facts, like current HP / max, how long it's been since we last took
      damage, etc
    - memory of prior received damage with attribution
- AI: maybe a rules engine ala prolog and/or maybe behavior trees?

All of this exists in a separate world attached to each minded entity:
- updated by sensing from the objective world
- player's view is rendered only from their subjective world
- likewise ai only sees its subjective world

### Accounting: entity souls

- a fundamental log/ledger that is more-or-less immutable
  - it's at least normatively immutable, may of course need to do some sort of
    compaction / archival eventually
  - and of course a rare power to hack/change a soul irrevocably is too
    enticing of a game mechanic to not at least consider

- accumulated stats/balances: these seem more like the realm of the mind above,
  e.g. things like accumulated hate and such, but there may be some call for it
  here rather than always requiring ledger traversals

# Prior

My first [exploration into ECS](https://github.com/jcorbin/execs) ended up with
[a prototype](https://github.com/jcorbin/execs/blob/twentyone) that I lovingly
called "deathroom":

- having punted on procgen, it was a single (square? rectangular?) room
- where entities would spawn, starting with the first player controlled one
- the artificial minds
  - started out just picking random wall points to walk up to and boop
  - if that led them to accidentally bump into another entity, damage was done
  - damage accumulated hate, which then caused them to prioritize revenge over
    random wall boops
- their artificial bodies
  - had internal sub-graph structure, each part having an hp, damage, and armor
    rating
  - entity interaction, like combat, were modeled on this sub-graph structure
  - death occurred when an entity's head was severed or destroyed
  - assemblies of severed body parts remained and could be scavenged by other
    entities to augment themselves
- there was a latent energy system within the movement system
  - each turn all minded-entities accumulated a movement point (N)
  - movement was possible, and scaled with, their body's legs
  - moving spends N, any additional accumulated N could be used to charge
    forward 2 spaces, and could serve a damage bonus
- disembodied entities continued to exist, but were no longer subject to
  collision

I'd wanted to take this further to include such things as:
- spirit entities able to influence / possess / or re-incarnate in some way
- further things to do with accumulated energy points
- further things to do when "not moving"
- (meta) progression through an additional soul component of some kind

# Basement

## TODO

- soul prototype
- mind research: prolog-like systems
- DLA
  - cell visited counts
  - particle trace option
  - spawn upto N live concurrent particles?
  - reaction rules between live particles?
  - linked particles; are they "non-live shadows"?
  - heading range constraint
  - spawn area / shape / fn
  - particle bounce, e.g after depositing or forging
  - ...or off of impassable tiles, which would allow for concrete containment
  - attractors that bias or snap heading
  - stickiness probability ; maybe informed by neighbor count!
  - config
    - make hash var bind optional
    - pivot to support multiple schemes within one sim
  - eliminate static bounds entirely: use an expanded dynamic bounding box to
    spawn particles
  - terminate particles more aggresively (e.g. if have moved away from bounds
    for N turns)

# Resources

- <http://www.roguebasin.com/index.php?title=Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels>
- <http://www.roguebasin.com/index.php?title=Irregular_Shaped_Rooms>
- <https://www.albertford.com/shadowcasting> use this to control information
  transfer between the objective world and subjective worlds
- <http://www.roguebasin.com/index.php?title=The_Incredible_Power_of_Dijkstra_Maps>
  use for things like "where may a spirit form a rift?"
- Things to unfold from <https://roguelike.club/event2020.html>:
  - DLA and other things from map procgen talk
  - parallel async schedules from Tyriq's talk on multiplayer

## Prog Lore

- ECS
  - from the rust side of things
    - <https://csherratt.github.io/blog/posts/specs-and-legion/>
    - <https://github.com/kvark/froggy/wiki/Component-Graph-System>
    - <https://github.com/Ralith/hecs#why-ecs>
    - <https://arewegameyet.rs/ecosystem/ecs/>
  - <https://skypjack.github.io/2019-02-14-ecs-baf-part-1/> from the EnTT author
  - <http://gameprogrammingpatterns.com/component.html> a section from Nystrom
- AI
  - <https://www.craft.ai/blog/bt-101-behavior-trees-grammar-basics/> instead
    of prolog? or is there some useful synthesis of the two?
  - <https://arxiv.org/pdf/1709.00084.pdf> more on behavior trees