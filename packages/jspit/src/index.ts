import {html, render} from 'lit-html';
import {readHashFrag, setHashFrag} from './state';
import {Sim, Context, ScenarioCons} from './sim';
import {ColorBoop} from './colorboop';
import {DLA} from './dla';

const once = (target:EventTarget, name:string) => new Promise<Event>(resolve => {
  const handler = (event:Event) => {
    target.removeEventListener(name, handler);
    resolve(event);
  };
  target.addEventListener(name, handler);
});

function make(tagName:string, className?:string):HTMLElement {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  return el;
}

type Nullable<T> = { [P in keyof T]: T[P] | null };

class Hello {
  static demoName = 'Hello'
  static demoTitle = 'Welcome screen'

  setup(ctx:Context) {
    ctx.showModal(html`
      <section>
        <p>
          Welcome to the Pits of JavaScript, where we experiment our way towards
          a "game", spinning demos and other pieces of interest as the spirit
          moves...
        </p>

        <p>
          To get started, just pick a demo from the header dropdown.
        </p>
      </section>

      <section align="center">
        <a href="//github.com/borkshop/js/tree/main/packages/jspit">Github</a>
        |
        <a href="//github.com/borkshop/js/blob/main/packages/jspit/stream.md">Dev log</a>
      </section>
    `);
  }
}

export class DemoApp {
  demos = [
    Hello,
    ColorBoop,
    DLA,
  ]

  main: HTMLElement
  head: HTMLElement
  foot: HTMLElement
  sel: HTMLSelectElement
  sim: Sim|null = null

  constructor(options:Partial<Nullable<{
    main: HTMLElement,
    head: HTMLElement,
    foot: HTMLElement,
  }>>) {
    if (!options.main) {
      this.main = make('main');
      document.body.appendChild(this.main);
    } else {
      this.main = options.main;
    }

    if (!options.head) {
      this.head = make('header');
      this.main.parentNode?.insertBefore(this.head, this.main);
    } else {
      this.head = options.head;
    }

    if (!options.foot) {
      this.foot = make('footer');
      if (this.main.nextSibling) {
        this.main.parentNode?.insertBefore(this.foot, this.main.nextSibling);
      } else {
        this.main.parentNode?.appendChild(this.foot);
      }
    } else {
      this.foot = options.foot;
    }

    for (const ctl of this.head.querySelectorAll('.ctl.demo'))
      this.head.removeChild(ctl);

    const demoOption = ({demoName, demoTitle}:ScenarioCons) => html`
      <option value="${demoName}" title="${demoTitle}">${demoName}</option>`;

    render(html`
      <select id="demo" title="Simulation Scenario" @change=${() => {
        this.change(this.sel.value);
        this.sel.blur();
      }}>${this.demos.map(demoOption)}</select>
    `, this.head.appendChild(make('div', 'ctl demo right')));
    render(html`
      <button @click=${() => this.sim?.reboot()} title="Reboot Scenario <Escape>">Reboot</button>
    `, this.head.appendChild(make('div', 'ctl demo right')));
    this.sel = this.head.querySelector('#demo') as HTMLSelectElement;

    this.change(readHashFrag() || '');
  }

  change(name:string) {
    let cons = this.demos[0];
    for (const d of this.demos) if (d.name === name) {
      cons = d;
      break;
    }

    if (this.sim) this.sim.halt();
    setHashFrag(cons.demoName);
    this.sel.value = cons.demoName;

    this.sim = new Sim({
      cons,
      el: this.main,
      head: this.head,
      foot: this.foot,
      keysOn: document.body,
    });
    this.sim.run();
  }
}

async function main() {
  await once(window, 'DOMContentLoaded');
  new DemoApp({
    main: document.querySelector('main'),
    head: document.querySelector('header'),
    foot: document.querySelector('footer'),
  });
}
main();

// vim:set ts=2 sw=2 expandtab:
