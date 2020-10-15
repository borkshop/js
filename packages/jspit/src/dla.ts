import {html} from 'lit-html';
import {readHashVar, setHashVar} from './state';
import type {Context, SimAction} from './sim';

export class DLA {
  static demoName = 'DLA'
  static demoTitle = 'Diffusion Limited Aggregation'

  particleID = 0

  rate = 5
  turnLeft = 0.5
  turnRight = 0.5
  stepLimit = 50

  setup(ctx:Context):void {
    ctx.grid.createTile(`particle-${++this.particleID}`, {
      tag: ['particle', 'init'],
      bg: 'var(--black)',
      fg: 'var(--dark-grey)',
      text: '.',
    });
    ctx.grid.centerViewOn({x: 0, y: 0});
    for (const name of ['rate', 'turnLeft', 'turnRight'])
      this.updateSetting(name, readHashVar(name));
    this.showMenu(ctx);
  }

  updateSetting(name:string, value:string|null) {
    switch (name) {
      case 'turnLeft':
      case 'turnRight':
      case 'rate':
        const given = value !== null;
        if (!given) value = this[name].toString();
        setHashVar(name, value);
        if (given) this[name] = parseFloat(value || '');
    }
  }

  #ctls: HTMLElement[] = []

  showMenu(ctx:Context):void {
    this.#ctls = this.#ctls.filter(ctl => {
      ctl.parentNode?.removeChild(ctl);
      return false;
    });

    const change = (ev:Event) => {
      const {name, value} = ev.target as HTMLInputElement;
      this.updateSetting(name, value);
      this.showMenu(ctx);
    };

    ctx.showModal(html`
      <section>
        <h1>Diffusion Limited Aggregation</h1>

        <p>
          This implementation fires particles from the origin with random
          initial radial heading. Each move proceeds by randomly perturbing the
          heading up to the turning radius set below, and advancing forward
          orthogonally along the greatest projected axis.
        </p>

        <fieldset><legend>Settings</legend><dl>
          <dt>Turns upto</dt>
          <dd><label for="dla-turnLeft">Left: Math.PI *</label>
            <input id="dla-turnLeft" name="turnLeft" type="number" min="0" max="1" step="0.2" value="${this.turnLeft}" @change=${change}>
          </dd>
          <dd><label for="dla-turnRight">Right: Math.PI *</label>
            <input id="dla-turnRight" name="turnRight" type="number" min="0" max="1" step="0.2" value="${this.turnRight}" @change=${change}>
          </dd>

          <dt>Particles Move</dt><dd>
            1 <!-- TODO -->
            step <!-- TODO -->
            <label for="dla-rate">every</label>
            <input id="dla-rate" name="rate" type="number" min="1" max="100" value="${this.rate}" @change=${change}>ms
          </dd>
        </dl></fieldset>

        <button @click=${() => {
          ctx.showModal(null);
          const drop = ctx.addCtl(html`
            <button @click=${() => {
              drop?.parentNode?.removeChild(drop);
              this.dropPlayer(ctx);
              this.rate = 100;
            }}>Drop Player</button>
          `);
          this.#ctls.push(drop);
        }}>Run</button>
      </section>

      <section>

        Inspired by
        <a href="//web.archive.org/web/20151003181050/http://codepen.io/DonKarlssonSan/full/BopXpq/">2015-10 codepen by DonKarlssonSan</a>
        <br>
        <br>

        Other resources:
        <ul>
          <li><a href"https://roguelike.club/event2020.html">Roguecel 2020 talk by Herbert Wolverson</a> demonstrated DLA among other techniques</li>
          <li><a href="//www.roguebasin.com/index.php?title=Diffusion-limited_aggregation">Roguebasin DLA article</a></li>
          <li><a href="//en.wikipedia.org/wiki/Diffusion-limited_aggregation">WikiPedia on the wider topic</a></li>
          <li><a href="//paulbourke.net/fractals/dla/">Paul Boruke, reference from DonKarlssonSan</a></li>
        </ul>

      </section>
    `);
  }

  elapsed = 0

  dropPlayer(ctx:Context) {
    ctx.grid.createTile('at', {
      text: '@',
      tag: ['solid', 'mind', 'keyMove'],
      fg: 'var(--orange)',
      pos: {x: 0, y: 0},
    });
  }

  update(ctx:Context, dt:number): void {
    this.elapsed += dt
    const n = Math.min(this.stepLimit, Math.floor(this.elapsed / this.rate));
    if (!n) return;
    this.elapsed -= n * this.rate;
    let ps = ctx.grid.queryTiles('particle', 'live');
    const spawn = () => {
      const p = ctx.grid.createTile(`particle-${++this.particleID}`, {
        tag: ['particle', 'live'],
        fg: 'var(--green)',
        text: '*',
      });
      ctx.setStatus(html`
        <label for="particleID">Particels:</label>
        <span id="particleID">${this.particleID}</span>
      `);
      ps.push(p);
    };
    for (let i = 0; i < n; ++i) {
      ps = ps.filter(p => p.classList.contains('live'));
      if (!ps.length) {
        spawn();
        continue;
      }

      for (const p of ps) {
        let heading = (p.dataset.heading && parseFloat(p.dataset.heading)) || 0;
        const adj = Math.random() * (this.turnLeft + this.turnRight) - this.turnLeft;
        heading += Math.PI * adj;
        heading %= 2 * Math.PI;
        p.dataset.heading = heading.toString();

        const dx = Math.cos(heading);
        const dy = Math.sin(heading);
        const pos = ctx.grid.getTilePosition(p);
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy < 0) pos.y--;
          else pos.y++;
        } else {
          if (dx < 0) pos.x--;
          else pos.x++;
        }

        if (!ctx.grid.tilesAt(pos, 'particle').length) {
          delete p.dataset.heading;
          ctx.grid.updateTile(p, {
            tag: ['particle'],
            bg: 'var(--black)',
            fg: 'var(--grey)',
            text: '.',
            pos,
          });
        } else {
          ctx.grid.moveTileTo(p, pos);
          if (!ctx.grid.queryTiles('keyMove').length) ctx.grid.nudgeViewTo(pos, 0.2);
        }
      }
    }
  }

  digSeq = new Map<string, number>()
  act(ctx:Context, action:SimAction): SimAction {
    if (!action.actor.classList.contains('solid')) return action;

    const hits = ctx.grid.tilesAt(action.targ);

    if (!hits.length) {
      const aid = action.actor.id;
      const did = (this.digSeq.get(aid) || 0) + 1;
      this.digSeq.set(aid, did);
      ctx.grid.createTile(`particle-placed-${aid}-${did}`, {
        tag: ['particle'],
        bg: 'var(--black)',
        fg: 'var(--orange)',
        text: '.',
        pos: action.targ,
      });
    } else if (!hits.some((h) => h.classList.contains('particle'))) {
      action.ok = false;
    }

    return action;
  }
}
