export interface Bindings {
  head: HTMLElement,
  foot: HTMLElement,
  main: HTMLElement,
  menu: HTMLElement,
  grid: HTMLElement,
  version: HTMLElement,
}

function tailPart(s:string):string {
  const parts = s.split('/');
  return parts.pop() || parts.pop() || '';
}

function getVersion():string {
  const base = document.querySelector('head base');
  const version = tailPart(base?.getAttribute('href') || '');
  if (version && version !== '.') return version;
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 2] || '';
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
  if (bound.version) bound.version.innerText = getVersion() || 'DEV';
}
