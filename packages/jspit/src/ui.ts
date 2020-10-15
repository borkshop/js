export interface Bindings {
  head: HTMLElement,
  foot: HTMLElement,
  main: HTMLElement,
  menu: HTMLElement,
  grid: HTMLElement,
}

export function show(bound:Partial<Bindings>, should:boolean, running:boolean) {
  const overlay = should ? '' : 'none';
  if (bound.head) bound.head.style.display = overlay;
  if (bound.foot) bound.foot.style.display = overlay;
  if (bound.grid) bound.grid.style.display = overlay;
  if (bound.menu) {
    if (should) bound.menu.classList.remove('modal');
    else bound.menu.classList.add('modal');
    bound.menu.style.display = running ? 'none' : '';
  }
}
