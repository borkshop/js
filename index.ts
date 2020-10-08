const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

const once = (target:EventTarget, name:string) => new Promise<Event>(resolve => {
    const handler = (event:Event) => {
      target.removeEventListener(name, handler);
      resolve(event);
    };
    target.addEventListener(name, handler);
  }
);

async function main() {
  await once(window, 'DOMContentLoaded');

  const el = document.querySelector('main');
  if (!el) throw new Error('no <main> element');

  let last = await nextFrame();
  let dt = 0;

  let spin = 0;
  while (true) {
    spin = (spin + dt / 500) % 5;

    el.innerText = new Array(1 + Math.round(spin)).fill('*').join(' ');

    const next = await nextFrame();
    dt = next - last, last = next;
  }
}
main();

// vim:set ts=2 sw=2 expandtab:
