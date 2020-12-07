# 2020-12-07

## TODO

- basic abilitites
  - build door
  - dig wall
  - build wall
  - place torch
  - modulate self light
  - modulate dopple light
- procgen abilitites
  - spawn N-walker @-adjacent
  - summon DLA particle @-attracted
  - spawn energy-plane denizen
  - build hallway @-adjacent
  - build room @-adjacent

- procgen ideas
  - directional cave <http://www.roguebasin.com/index.php?title=Basic_directional_dungeon_generation>
  - BSP <http://www.roguebasin.com/index.php?title=Basic_BSP_Dungeon_generation>
    - param: split range + offset
    - param: split mode and weights
    - param: border width(s)
  - Grid System <http://www.roguebasin.com/index.php?title=Grid_Based_Dungeon_Generator>
  - random rooms + connections, ala <https://github.com/ondras/rot.js/blob/a21112e/src/map/uniform.ts>

- domgeon
  - player inventory/ability system; good initial use cases include a digging
    item, floor tile creator, a particle gun, or void walking boots
  - move and other interaction animations
- builder
  - a more adept hallway builder
  - Line
  - Circle
  - Polygon / Path
  - TBD fill v stroke variants and reconciling with the current `fillRect` /
    `strokeRect` pair
- TileGrid
  - how about default classes keyed by text; would simplify much building code
  - save/loading of tile state

## WIP

## Done

Ejected page level script code from all other jspit demos.

TODO catch cdom-template up

# Week Ending 2020-12-05

- Finished a basic/classic version of BSP-drive rooms and hallways procgen;
  next step is to start generalizing many of the demo-internal utilities into
  the cdom/procgen module. This will likely happen by further iterating on the
  BSP demo itself, evolving it beyond just the classic scheme, and beginning to
  blend it with other procgen methods, something like.
- Analyzed and fixed forest's prng seeding, moderately improving the cdom/prng
  module along the way.
- Started adopting the externalized script idiom from the forest demo,
  primarily since it forces type checking of all code, helping to forestall the
  need for testing beyond lint. Fixed revealed type checking errors, mostly
  around `cdom/builder.Context` vs `TileSpec.kind`.
- Minor improvements to the button input scheme, now explicitly supporting
  aliases, and handler registration by ID.

## 2020-12-04

Fixed type issues around `cdom/builder.Context` vs `TileSpec.kind` by adding
`NewTileSpec` required by `createTile` and `buildTile` methods.

Finally fixed BSP demo hallway building, no longer able to reveal void cells,
and more often results in a fully-connected level.

## 2020-12-03

Refactored BSP rooms-and-halls builder, fixing a simple priority reversal bug
that was causing disconnected levels. There may still be other, now rarer,
sources of disconnected levels tho.

Added by-id button handling, use it in BSP demo.

Ejected BSP page script module in alignment with forest structure; will work on
rectifying the `builder.Context` vs `TileSpec` type awkwardness soon.

## 2020-12-02

Improved button input situation:
- added proper key/code alias support
- change default config to WASD with arrow key aliases
- stop over-eager config saving
- expand support for default button legends

Refactored and flattened the `cdom/prng` module:
- simplified over `ArrayBuffer`
- reified into a proper class, easing state inspection, type checking, and code
  readability
- as a follow-on, redid the forest seed generation scheme, improving randomness
  across levels
- took time to evaluate prior seed generation schemes

Fixed BSP FOV invalidation after a player respawn/move.

## 2020-12-01

Finished a sufficient version of the BSP generator, be declaring it's remaining
bugs to be "fun".

## 2020-11-30

Made the BSP demo resetable and playable:
- press `<Backspace>` to regenerate the world
- press `@` to spawn a player

## 2020-11-29

Finished BSP wall simplification and door placement. Started developing hallway
connections, but wasn't able to finish that part completely...

Made cdom-template buttons semi-translucent.

# Week Ending 2020-11-28

- finished half of a classic BSP dungeon gen, on top of a flexible BSP
  iteration core, and a new jspit demo page; for now it's just rooms, next up
  is halls
- made small fixes to the template revealed by the new forest world
- adopted viewport transform approach pioneered by the new forest world
- further simplifed template html structure, dropping the main element, and
  making action bar buttons alway above grid planes
- fixed buttonbar z-index so that tiles cannot occlude buttons
- made actor lighting optional and not a special case; now the page stylesheet
  must add a `--lightInit` to movers if desired.
- recolored the template domgeon demo over HSL space, rather than a limited
  discrete palette; there's still more work to do towards simplifying and
  separating the two main concerns in the template stylesheet: rules for common
  functionality, and (default) theming
- fixed template grid background, which was supposed to be hard black, rather
  than a bright black, after the recent color
- further solidifed the subjectvie plane notion, so that it is the only thing
  rendered now, rather than compositing with the objective plane

## 2020-11-28

BSP demo progress:
- elaborated in-page status text
- fixed all remaining off-by-one (lol ob1) errors in adjacent room edge 
- added cdom toggle button support, and used it fro BSP's debug plane

## 2020-11-27

Fixed cdom-template's snowpack config by syncing it from jspit, and dropped the
problematic cdom symlink; pain points revealed by the new forest demo.

Minor continuing work on the BSP demo towards connecting rooms, including
cleaning up cdom-template's inspector hookup, and adopting it in the bsp demo.

Adopted viewport transform update from forest demo: now done with a planar CSS
transform, rather than being calculated on each tile. Have not tried to measure
any difference yet, but this just seems more intrinsically correct.

## 2020-11-26

Started out on a jspit BSP demo page.

## 2020-11-25

Got a basic BSP harness working under a development version of the cdom-template demo.
Not quite sure what to do with it yet, and the hallway connector is as yet unexercised.

Minor improvements to tile creation and meme copying.

## 2020-11-24

Made minor fixes and improvements while researching action and procgen systems:
- pushed stream behaviors WIP section into the past
- further simplifed template html structure, dropping the main element
- fixed buttonbar z-index so that tiles cannot occlude buttons
- fixed template grid background, which was supposed to be hard black, rather
  than a bright black, after the recent color

## 2020-11-23

Finished out sporadic progress made over the last couple days: the demo now
renders exclusively from the subjective (meme) plane, with light values copied
in from the objective plane.

Made actor lighting optional and not a special case; now the page stylesheet
must add a `--lightInit` to movers if desired.

Recolored the template domgeon demo over HSL space, rather than a limited
discrete palette.

# Week Ending 2020-11-21

Reworked FOV system to work by copying tiles into a subjective plane of "meme"
tiles, while the underlying "solid" plane remains hidden; supporting notes:

- added plane structure within `TileGrid`, allowing tiles to be categorized and
  styled along such grouping; this allows things like full-plane occlusion,
  parallax translation, and z-index tiers.
- fixed initial flash of unlit tiles, and made the domgeon demo
  start out centered on the `@` rather than panning in by accident.
- reduced FOV/lighting computation to happen as-needed rather than every frame
- made movement keys persistent through local storage, allowing user
  customization; with no settings UI yet, users are welcome to edit their
  `localStorage` JSON directly ;-)
- added a config data shape, afforded through the `DOMgeon` constructor for
  page-level customization of things like default movement buttons
- fixed light falloff model to be circular, rather than quadrant-depth based
- simplified common page setup, dropping explicit header/footer elements
- fixed view move animation and easing
- sorted actor switch actions by distance

## 2020-11-20

Further improved FOV propagation to not reveal unlit tiles.

Finished initial pass at a subjective plane for the player: FOV update now
copies tiles into a subjective "meme" plane, which gets composited with the
objective source plane. Missing meme tiles get moved into a long term store
plane. While there are many next steps to make it suitable for more than just
the player's viewport, this works well enough to release for feedback.

Firmed up tile grid plane API, and fixed many minor bugs following from the
recent pivot to explicit `<div class="plane">` containers a couple days ago;
filled gaps like inability to query tiles by plane.

Fixed initial flash of unlit tiles, and made the domgeon demo start out
centered on the `@` rather than panning in by accident.

## 2020-11-19

While developing and debugging the new meme plane feature, made movement keys
configurable from page-level data passed to the `DOMgeon` constructor, and also
persisted to local storage for user customization. This further revealed that
movement button input support for keycodes, like for the actual arrow keys, was
incomplete; fixed as part of the new config driven scheme.

## 2020-11-18

Finished prep scope from yesterday, FOV recompute now only happes on
change/move, and lighting recompute stops after the animations are done. Also
changed light falloff to be circular.

Reified planes into sub-TileGrid elements that contain tiles of their plane,
this allows things like full-plane occlusion, parallax translation, and z-index
tiers.

Next up: meme plane(s).

## 2020-11-17

Developing towards a memory layer/plane, fell off a perf cliff due to layout
churn and force reflow / style recomputes. Left progress in dev for next, but
prototyped non-text content tiles and meme-tile copying driven by FOV.

## 2020-11-16

Cleaned up common page structures while fiddling around with flex box, and
reading large swaths of MDN et al:
- dropped explicit header/footer elements
- standardized button conventions
- move status display out of footer into main grid, which gives it top-left
  conventional layout for now

## 2020-11-15

Several minor fixes while exploring / researching next step:
- view move animation wasn't eased as intended, fixed, and adjusted the easing
  function
- don't highlight disabled keys
- sort actor switch actions by distance so that nearer ones are numbered lower

# Week Ending 2020-11-14

The updated [jspit/DLA](https://jspit.vercel.app/dla.html) demo is the real
star of the week, best showcasing most of the features; the
[jspit/domgeon](https://jspit.vercel.app/domgeon.html) demo is worth checking
out also, especially for actor focus swapping.

- Did a bit of head-dumping into WIP about what we'd like to get out of a
  further evolved behavior system
- Made all `<button data-*>` key/values available through input parsing and
  move processing
- Refactored `TileGrid` movement processing to further set the stage for less
  trivial actions beyond mere movement.
- Decomposed and extended the input system: all buttons now have associated
  keys, mouse clicking work better than ever, chording is decoupled, and
  there's even a nice button activation highlight that tracks key state.
- Separated FOV from lighting, with added support for ambient lighting, and
  light sources from any tile
- Finished out planar isolation, so that light does not interact, e.g. between
  debugging tiles and the game world
- Added lighting animation, used when swapping actors in addition to viewport
  movement animation
- Completed lighting, now with void-cross-ability when emitted by a
  self-supported tile
- Added viewport movement animation, with circular easing, and constantly
  following the currently focused input actor
- Added event integration points for "about to move" to give AI a chance, and
  "view" which should be usable for infinite procgen

## 2020-11-14

Decomposed `input.KeyCtl` into:
- `input.Handlers`: affords easy one-off key handlers, e.g. `Escape` menu
  toggles
- `input.KeySynthesizer`: generates synthetic keydown/up events based on clicks
  of `<button data-key data-keycode>` elements; if such elements have a
  `--holdable` variable set, then they are toggle buttons, that "hold down" /
  "pop up" on successive clicks, generating respective keydown/up events
- `input.KeyChorder` coalesces keydown/up events and dispatches a custom
  "chordinput" event after the last held key is released

And added an additional `input.KeyHighlighter` that toggles `.held` classes on
`<button data-key data-keycode>` elements in response to matching keydown/up
events, which makes for immediately more transparent demo videos.

All of these pieces are now integrated by DOMgeon, with the only
breaking/visible change that `dmg.keys.on.code` is now written
`dmg.onKey.byCode`, and that dispatch by ID or action name has been dropped
(for now at least).

TileGrid movement processing is now more general and self-contained: it's now
up to the proc to do any sort of spatial math, query, and move; provided a
default proc with the prior behavior. Collapsed and simplifeid DOMgeon's
move/action procs then, to set the stage for more generalized behaviors.

Validated, debugged, and finished yesterdays's scope into main. Added a
toplevel npm test script to aid minimal automated type checking, and fixed a
latent bug from the recent queryTiles refactor.

## 2020-11-13

Refactored most of the way through input/move parsing and handling in dev
branch, to set the stage for more complicated / general actions.

## 2020-11-12

Did no coding today, but did assemble some thoughts about behaviors:

### Musing toward a behavior mechanism/system

Current functionality like movement and interaction is more or less directly
coded into the domgeon engine:
- input gets parsed into directional movement or an "action" string
- movement applies to the currently focused input actor, and action strings
  resolve against any matching capable tile adjacent to the focused input actor
- action input buttons present are determined in the first place by "what
  actionable tile are adjacent to the focused input actor" in a previous frame
- the behavior incurred by an actionable tile is defined by it having up to 3
  data/variables defined: morphTarget, morphSubject, or morphSpawn; the first
  two proscribe an update to an existing tile (the target being acted upon, or
  the subject actor) while the third proscribes a new tile to be spawned at the
  target tile location

For example a door is an actionable tile that morph itself, toggling it's
possibility; further the "void rune" spawns a new input actor; prior versions
of the "void rune" would morph the subject actor.

While this works, I want to start evolving it into more of a pluggable behavior
system, various motivations include:
- spawning is separate behavior from morphing really
- want to start bringing in logged behavior, which could go along with
  interaction, be a result of a combat interaction, or just be locationally
  triggered
- want to do at least moderately interactive dialogs, for things like
  inventory, talking to other characters, a character screen, etc.
- want to add skill and abilities other than movement to actors
- want to be able stipulate requirements of a subject actor to activate
  something, e.g. for a locked door

So notionally, I'm thinking about refactoring the current move and interaction
code into a behavior system; some of the initial behaviors in mind:
- tileMorpher -- updates self, actor, or specific tile
- tileSpawner -- creates new tile [@∈]{self, actor, or specific} tile
- mover -- maybe recast the current movement system into a behavior
- capable -- to support capability checking for another behavior
- logger -- log a short message to the game console
- dialog -- presents a modal interface... maybe itself composed of interactive
  elements w/ behaviors

So how about expanding the current tile scheme:
- support sub-structure like
  - el > :first-child is its content
    - it could be a `<span>` w/ text
    - it could be a `<canvas>`
    - it could be a `<svg>`
  - el > * else is sub-element
    - could be inventory
    - could be parts
    - could be abilities / skills
    - could be a character stats sheet `<table>` or `<dl>`
- then it's up to the stylesheet to display only the first-child
- and up to application code how to update / set that first-child content
- the children may have behaviors attached, or may serve simply as data for
  other behaviors

## 2020-11-11

Further reworked lighting to separate FOV revelation from light casting, then
added ambient and non-actor light sources. Demonstrated best by an update to
the DLA demo.

## 2020-11-10

Lighting Inspection

Reworked FOV and made lighting blend between actors on focus change.

Added self-supported light so that walking around in the void can be as lit as
supported interior. Fixed a revealed/latent bug in FOV computation where the
scanning iteration can update quadrant boundary positions twice; this matters
now that the update is additive.

Finished out planar isolation feature, since lack of it was further
complicating compounding debug of lighting: FOV is now constrained to a plane,
so that it's not accidentally blocked by debug tiles or the inspector cursor.

Fixed a tile inspector bug introduced by yesterday's `TileGrid.viewOffset`
un-flooring, by re-introducing the floor math within tile inspector
positioning.

## 2020-11-09

Improved viewport movement

Replaced the accidentally "zeno eased" movement with explicitly bounded and
eased movement. Went with circular in/out easing over 1s, as it feels especially
interesting when chained: as the player keeps moving, the ease-out keeps
getting restarted, meaning that the viewport stays more in place over a lot of
quick movements, and then catches up when the player stops moving.

Dropped the floor from `TileGrid.viewOffset` updates, as otherwise animating
with sub-tile accuracy isn't feasible.

## 2020-11-08

Viewport animation and extension points

Inspired by Sunday borkshop congress, made it so that moves of the domgeon
viewport are animated (simple LERP for now). Also factored out the viewport
recentering logic into a method that can be easily overridden by a DM.

Added two other DM extension points:
- a `"move"` event that fires after player input has been registered, but
  before it's processed, giving an AI system a chance to register other moves;
  this won't suit for a multiplayer system, since an event handler cannot block
  movement application until other moves are available, but it should do for
  locally computable movement choices
- a "view" event that fires right after the grid view has just been update
  (e.g. after lighting update and any viewport re-centering); this hook could
  be used to update other custom systems, and should be able to serve as the
  basis for an infinite-space procgen to build tiles right before the viewport
  shifts

# Week Ending 2020-11-07

- added ability for interactable tiles to spawn a new tile
- added focus control when multiple actors are present
- reworked the input system to be button-oriented, encompassing clicks, and to
  process chords of keys upon final key release, rather than the prior 10hz
  static processing rate
- added player-centric FOV lighting based on shadowcasting
- keyctl now processes mouse events
- input chording
- input handling defined by buttons
- buttons: move bar and action bar
- generalized movement and interaction semantics, no more hardcoded concept of
  a "floor"
- interactions can now be purely coded in CSS variables, doors exhibit this via
  stylesheet rules, and the void runes exhibits it via inline styles
- ported remnant jspit DLA and colorboop demos to use domgeon directly,
  reducing externally used cdom surface area for refactoring, and further
  simplifying the demos
- added click-to-pin behavior to the domgeon inspector

## 2020-11-07

Many actors, Such input

Solidified the latent support for multiple input-tagged movers (player actors):
one is tagged with `.focus`, controlled by movement input, and is the anchor
for adjacent interactions. The others get additional "Focus Me" actions,
allowing the player to cycle between them.

To exercise this, added added spawning support to the morphic interaction deal:
now an interactable tile may react by spawning a new tile upon itself. So now
the demo `V` tile works by: spawning a new focused actor, and removing focus
from the subject actor that triggered it. These new actors are tagged as self
supporting `*`s which can venture forth into the void, while the original
player `@` remains safe in the rune room.

After sharing with the RL dev discord, @ddmills pointed out how laggy the input
felt. While at first I chalked it up to "eh, their machine must be slow?", that
didn't seem quite right... I later realized (while out on a walk, like you do)
that it was due to the old static 10hz input consumption / key counting
mechanism.

Now, the old 10hz key counter was already slated for reconsideration, since it
had terrible trailing edge behavior (when two key releases would race for, and
sometimes straddle a 100ms interval)...

But it was only on this fateful walk that I realized: "can you just track the
held button set, and trigger a chord after the last one is released? And reset
the chord set upon key down, to allow for amendments after the first held key?"

Try it out:
- hold `Up`, press `Left` -- the pending chord is now `UpLeft`, but does not
  yet trigger because `Up` is still held
- ... press `Right` -- the pending chord is now `UpRight`, but still does not
  trigger until:
- ... release `Up` -- now now key is held, so flush and process the chord

This turns out to be immediately more responsive and accurate for ADOM style
diagonal moves. Some points to look into going forward:
- cancel when an annihilator key is pressed `Esc` or the "stay" key
- how about non movement chording? e.g. directional shooting?
- how about non keyboard ui, like mobile? how bad would it be to make the
  `<button>`s sticky, so they stay depressed until tapped again, synthesizing
  our own up/down scheme?

## 2020-11-06

The FOV has rolled in: now used in both the DLA demo (when playing) and in the
cdom template.

Added basic player-centric FOV lighting, using the Symmetric Shadowcasting
technique presented at 2020 roguecel: after every move, lighting gets
recomputed into a `--light` variable on all visibly tiles from the player.
Lighting diminishes using the inverse square rule, and starts 8x over-saturated
to keep a 3-cell radius bright around the player.

The FOV computation core can eventually be re-used for more lighting
computation, like from environmental sources, with only a bit of TODO
modification, and elaboration/integration around it.

Other possibilities for next include:
- using the FOV-lit cells to update player memory tiles that become visible if
  not occluded by any currently visible tile
- allowing light to transmit through the void when originating from a
  self-supported tile (e.g. the void walking player)

## 2020-11-05

Now with even more use of CSS

Reworked movement and interaction to be planar, no longer hardcoded to "solids"
or "floors". This immediately simplified the colorboop and DLA demos a bit.

Lofted domgeon's more specific `classList` mutation logic into `TileGrid`, and
completely walked away from fully (usually over) specifying `className`
entirely. There may still be use cases that need to fully stomp `className`,
but the support has been dropped for now at least, in lieu of micro
add/remove/toggle-class commands.

Pivoted much functionality into CSS rule carried variables, in particular doors
and other morphic interactions are no longer built procedurally, but defined
purely in CSS rules.

In particular, doors are now just tiles that toggle their `passable` class;
even the text label is carried on pseduo content attached to class.

The first scene of the tutorial is now 90% complete: the player can walk to the
`V` rune, get void walking ability (self-supporting movement), and then proceed
to walk out the door to nowhere... and on!

Oh the "void rune" is now literally drawn on to a floor tile, not its own
separate tile, to demonstrate that possibility.

## 2020-11-04

Completed rework of input handling to be defined by, and accept clicks of,
button elements. Movement is now defined by a set of static buttons, with
default WASD creation of no elements pre-existed. Any interactable tiles
available to the player are presented in a dynamic set of numeric-keyed action
buttons. This also gives a good place to add skill/ability buttons into going
forward.

Other future ideas:
- teach `KeyCtl` how to process more mouse events, maybe even grow up into a
  mobile friend d-pad with diagonal blending
- targetable abilities, like a ranged spell, could be done by chording their
  action button/key with a movement button/key, similar to the current diagonal
  key chording
- could eventually support clicking of more than just buttons, like say
  directly clicking a tile to move

## 2020-11-03

Had realization that `<button>` elements may suffice for input configuration:
user can add buttons, domgeon can create add defaults if none exist, either way
user can change data attributes to remap keys. (Inter)Action buttons are then
just dynamic version of those static (basic movement) buttons; may need to
eventually add ghost buttons to support (re)configuration of those dynamic keys
regardless of whether present.

- towards that, working prototype, unlocked latent `Move.action` support in the
  underlying tiles module, and simplified the input module "have" state away
  into a simpler "nullabe Move"
- added additional restrictions to the interaction core logic:
  - actor must be on the same "plane" and spatially near (less than 2 cell
    distance so that diagonals count
  - planes are defined by the movement category, so "solid" in the default
    config; this prevents discorporated entities from open/closing doors, once
    the new action buttons are added
  - added explicit `.passable`ility to the movement system, so that an entity like a
    door may remain "solid" when open, while not blocking movement
- subsumed input parsing into the domgeon module, simplifying the input module
  down to just event handling

Will likely do something something similar to `.passable` to generalize the
space-defining nature of floor tiles, instead making them `.support` for their
plane.

## 2020-11-02

- jspit
  - ported DLA to also use DOMgeon, and translated it from TS to JS
  - ported colorboop to domgeon morphs interactions, eliminating its external
    (type)script, further exercising higher level cdom code

## 2020-11-01

- prototyped actionbar based interaction
- improved the domgeon inspector to support click-to-pin with details

# Week Ending 2020-10-31

Dialed beck the level of tooling artifice:
- mostly switching away from directly written TypeScript, to ts-check annotated
  modern JavaScript.
- flattened the repository layout, dispensing with the node module system as a
  way to structure borkshop code; instead rely on browser native modules,
  assisted by snowpack during dev and for production build; keeping snowpack
  leaves us an escape hatch for using 3rd party deps and progressive
  transpiling where appropriate.
- dropped ultra-modern private `#field` notation for better compatibility with
  things like FireFox

Shaped up the `jspit/config` module further, now useful for one-off bindings to
JS or CSS variables; may hoist it into `cdom` space soon.

Added an initial take at a "morphic interaction" system (builtin to
`cdom/domgeon`), where tiles may morph themselves or a subject actor tile:
- initial use case is for doors that morph between a closed solid form and an
  open passable one
- currently only triggered by movement (solid) collision, but with plan to add
  other methods of discovery and interaction
- the subject morph should allow for things like simple teleporters, or tiles
  that grant an ability to the player; the ColorBoop demo could now be redone
  with zero code using subject morph data definitions

Added an initial take at a tile shader oriented `cdom/builder` module:
- a shader is basically a `(grid, pos) => ...` function that is expected to
  call `grid.buildTile` one or more times; it also receives an third `shape`
  parameter that is specific to a draw operation
- basic drawing routines for filled/stroked rectangles; TODO add more shapes
- many layers of shader builders, culminating with `roomShader` that lays down
  floor, wall, and door tiles

Wrote another particle-based simulation, this time hybridized with a cell grid,
called Physarum:
- while performance isn't really feasible at present, it did serve as a useful
  smoke/stress test of the base `TileGrid`, which is much improved for the
  process
- cutoff development before getting it to as "done" a state as the DLA demo tho
- but it may provide a useful procgen setting eventually, especially if
  iterated infrequently, or out-of-dom for better performance

## 2020-10-31

- finished initial cut of "morphic interaction" system:
  - tiles may now be tagged `.interact` and carry `"morph_target"` and
    `"morph_subject"` data that will be used to update themselves and/or an
    interacting subject tile (e.g. the player moved tile)
  - morph values are currently limited to a slight extended `TileSpec` shape,
    or a string name that will be resolved to another `"morph_form_NAME"` field
    (to break data circularity, e.g. a door that morphs open and back to
    closed)
  - see the current cdom-template door demo, which leans heavily on the new
    builder module, for an example
  - likely will need to add full-fledged custom behavior functions at
    somepoint, but this gets basic things working for now
- finished initial tile shader oriented builder module, now used to build build
  two rooms connect by a hallway and doors

## 2020-10-30

- started development of door interaction and room buiilder code

## 2020-10-29

- explored further options in physarum design space, like a variable decay
  field, but decided to set that line of polish work aside for now
  - did however decide to release the blob-ified settings, and a few minor code
    improvements made
- improved DLA's player viewport scrolling
- fixed initial overly eager input capture

## 2020-10-28

- spent a lot of time watching and tuning physarim settings: found that if you
  widen the sensor spread, but tighten its turning range, it presents much more
  potential to congeal into blobs and form flow streams. Still 
- still mostly on dev branch iteration, but am speculating about further
  changes to the setup, like: a variable deacy function to discourage edge
  clumping or dropping decay entirely in lieu of a conservation-basde
  movement/deposition scheme
- translated jspit `particels` and `config` modules to proper js

## 2020-10-27

- dropped ultra-modern private `#field` notation for better compatibility with
  things like FireFox
- completed working Physarum sim, which proved to be a really useful bicycle to
  improve TileGrid all around; still have some finishing to do, like exposing
  settings for exploration
  - TODO read the original <https://uwe-repository.worktribe.com/output/980579>
    for more ideas

## 2020-10-26

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

## 2020-10-24

- wrote a weekly stream summary
- stored the jspit "game" TODOs down in a new stream Basement section; calling
  DLA "done for now ™"

## 2020-10-23

- domgeon
  - reified everything to expose an object off which custom DM logic may hang
  - decoupled inspector
- tiles
  - provide auto generated tile ids, easing domgeon inline creation scripts

## 2020-10-22

- wrote a small domgeon skeleton with a hardcoded 5x5 room
- added `TileGrid` support for pre-existing tiles
- improved `TileInspector` so that it emits events for empty cells too
- refactored demo page module structure to further simplify start/stop
  structure
- generalized `KeyMap` into `KeyCtl` to generalize the prior `filter` code
  dispatch for things like `Escape` and `Space`
- tried a last few tricks for initial DLA void point selection, without much
  result other than a `mortonCompact1` function

## 2020-10-21

- factored out particles module with the core underlying update logic from the
  DLA demo
- tiles module:
  - reshaped `TileSpec` for better CSS/DOM alignment
  - provide default mover class
  - refactored `TileGrid` view movement code, dropping the overly specific
    nudge routine
  - refactored viewport management, reducing surface are, and adding resize
    handling to keep the requested point centered

## 2020-10-20

- moved deployment to vercel, dropping version display for now
- dropped lit-html dependency; generalized dla's inspector dumping, but decided
  to not use it in colorboop for now
- DLA
  - made config instanced per world rather than just static
  - provided defaults bounds based on viewport
- factored out general move processing routine into tiles module
- de-objectified ColorBoop

## 2020-10-19

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

# Pre history

## 2020-10-17

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

## 2020-10-16

- fixed DLA demo to actually do DLA, preserving the random walker behavior as
  well
- revamped and generalized settings module

## 2020-10-15

- added initial heading controls for DLA particles
- fixed DLA particle movement: particels now take on fractional positions, but
  create normal integer-aligned tiles
- indirected DLA color variables
- Finished de-Simification through DLA
- Sketched a new page-module pattern around bindings and state
- Improved menu system, no longer just modal, with a shared ui bindings module

## 2020-10-14

- fully erased the `Sim` abstraction from `ColorBoop`; TODO follow through with
  DLA tomorrow, then drop the `sim` module
- reworked to a multi-page app structure: index, colorboop, and dla are now
  separate `.html` files
- started disaggregating modules, broke out `input`, `tiles`, `anim`, `state`,
  `sim`, `dla`, and `colorboop` modules

## 2020-10-13

- refactored `Sim` plumbing to decouple from the multi-Scenario demo use case
- revamped `DLA` settings, now persisted through location hash

## 2020-10-12

- emptied out old jcorbin rep with a notice, stil publishing built game to
  jcorbin github pages
- switched fully to snowpack and ESNext standards
- moved into brave new borkshop monorepo

## 2020-10-09

- added player drop and dig to DLA demo
- improved DLA turning arc: dual ended control
- subsumed Sim reboot button, and bound to Escape key
- added a morton-curve spatial index to TileGrid
- added tile inspection support to Sim/Scenario, example use in ColorBoop

## 2020-10-08

- wrote a DLA demo, which was a great way to furher experiment with modal UI,
  and also quickly hit the limits of the current brute force spatial query (guess)
- refactored to support multiple demos / scenarios:
  - the main animation loop is tiny again
  - it pumps a `Sim` object
  - that has a `change()`able `Scenario` object
- implemented basic color boop collider
- factored out TileGrid to reify the grid sketched yesterday
- sorted out details for building and pushing to github pages

## 2020-10-07

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

## 2020-10-06

- more ecs and other lore research
  - NOTE ape-ecs seems designed around a mono world... `world.registerCopmonet`
    smashes `klass.prototype` <https://github.com/fritzy/ape-ecs/issues/33>
  - NOTE reserved component names... because not using a Map?
- imported design from ios notes, edited quite a lot
- starting collecting resources at top
- digested thoughts on ape-ecs below

## 2020-10-05

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
- Physarum
  - decay function
  - value conservation mode
    - no decay
    - particles can consume upto X from current cell
    - moving spends Y by ejecting it behind
    - likewise turning spends Z ejected at an opposite angle to the turn
    - particles have an intrinsic value (weight)
    - plus a carrying capacity
    - cannot move once expended
    - may be consumed by other particles
    - will need a respawning mechanic, at least cheesed, if not reproductive
    - maybe this is a "survival" mode vs the o.g. "creative" one
    - or maybe this is a new deal not called "physarum"
  - towards level gen
    - set a value threshold/range of what's "passable"
    - flood fill floor tiles, edging with wall
    - TBD online model and threshold choice


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
