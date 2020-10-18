export interface Bindings {
  version: HTMLElement|NodeListOf<HTMLElement>,
}

function tailPart(s:string):string {
  const parts = s.split('/');
  return parts.pop() || parts.pop() || '';
}

interface urlParts {
  hash: string;
  host: string;
  hostname: string;
  href: string;
  readonly origin: string;
  pathname: string;
  port: string;
  protocol: string;
  search: string;
}

function parseVersion(doc:Document, url:string|urlParts):string {
  if (typeof url === 'string') url = new URL(url);
  const base = doc.querySelector('head base');
  const version = tailPart(base?.getAttribute('href') || '');
  if (version && version !== '.') return version;
  const parts = url.pathname.split('/');
  return parts[parts.length - 2] || '';
}

function getVersion():string {
  return parseVersion(document, window.location);
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
