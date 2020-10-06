# 2020-10-05

## TODO

- elaborate on design after importing ios notes
- input controller
  - event/intent sources:
    - local dom events
    - local storage updates, e.g. to make an event bus with other local
      windows? ai workers? network sockets?
  - transmute events into intent
  - ingest external intent
  - harvest intents into actions for next tick

## WIP

- orienting on ape-ecs
  - NOTE: `entity.getComponents('Q')` better than `entity.types['Q']` since
    it can te constructor functions
  - TODO: what means "evergreen entities"? seems to be a singleton per-world?
  - NOTE: copyTypes for world -> world creation
  - NOTE: system subscription works
    - by `this.subscribe(T)` in init
    - then harvesting `this.changes` in `update`
    - things like add/detroy
    - ref add/delete
    - change if using update and component opted in to tracking
  - NOTE: `spinup` to `World.registerCompenent` is a capacity hint, ala
    `pool.targetSize`; pool then reclaims after `2*targetSize`
  - NOTE: system update doing a `for each entity, process and consume/remove
    (one of) its qualifiying components seems inefficient; ideally could be
    more like:

    ```javascript
    const subjects = this.inQuery.execute();
    for(const entity of subject) {
      for (const q of entity.getComponents('Q'))
      // XXX instead of entity.removeComponent('Q')
    }
    subjects.removeComponent('Q'); // XXX would rather, can?
    ```

## Done

- wrote down some scant design notes into ios note app
