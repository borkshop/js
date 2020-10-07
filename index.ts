const raf = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

async function main() {
  const el = document.querySelector('main');
  if (!el) return;

  let last = await raf();
  let dt = 0;
  let elapsed = 0;
  while (true) {
    elapsed += dt;
    const n = Math.round(elapsed / 500);

    el.innerText = new Array(1 + n % 5).fill('*').join(' ');

    const next = await raf();
    dt = next - last, last = next;
  }
}

window.addEventListener('DOMContentLoaded', _event => main());

// vim:set ts=2 sw=2 expandtab:
