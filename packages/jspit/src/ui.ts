export interface Bindings {
  version: HTMLElement|NodeListOf<HTMLElement>,
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
  document.body.classList.toggle('showUI', should);
  document.body.classList.toggle('running', running);
  if (bound.version) {
    const version = getVersion() || 'DEV';
    if (bound.version instanceof HTMLElement) bound.version.innerText = version;
    else for (const el of bound.version) el.innerText = version;
  }
}
