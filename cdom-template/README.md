# Cascading DOMgeon Template

This is a starter template for a modern browser-native roguelike dungeon game.

NOTE: at present, it's coupled to the borkshop/js repository
structure; temlating a standalone repository is not yet sorted out.

# Usage

- `cp -a packages/cdom-template packages/your-thing`
- `$EDITOR packages/your-thing/package.json` and rename a few things
- `$EDITOR packages/your-thing/src/index.html` and have fun!
- `yarn start` to start your dev server

# Building

When you're reading to publish your DOMgeon contraption run `yarn build` to
create a static site `build/` directory, that should look something like:

```
$ find build
build
build/index.html
build/cdom
build/cdom/domgeon.js
build/cdom/tiles.js
build/cdom/anim.js
build/cdom/input.js
build/__snowpack__
build/__snowpack__/env.js
build/index.css
```

This will just work for a Vercel project with an approppriate "Other" config.
