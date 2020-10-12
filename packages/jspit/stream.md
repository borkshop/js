# 2020-10-12

## TODO

- soul prototype
- mind research: prolog-like systems
- TileGrid
  - animations like boop and particles
  - viewport correction on resize
  - masking?
  - custom shader funcs, or at least some affordance for stepped css classes
  - nudge needs to take whole tile into account, nudge if any part of the given point is out
- DLA
  - persist parameters in location hash
  - indirect color variables, add color settings
  - controlled RNG with seed setting

## WIP

- get github-pages deploy cooking again
- switch to snowpack

## Done

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

# Resources

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
