import {readHashVar, setHashVar} from './state';

export type Datum =
  | boolean
  | string
  | number
  | Datum[]
  | Data

export interface Data {
  [name: string]: Datum
}

function parseBoolean(s:string):boolean|null {
  switch (s.toLowerCase()) {
    case 't':
    case 'true':
      return true;
    case 'f':
    case 'false':
      return false;
  }
  return null;
}

export function bindVars({data, getInput}:{
  data:Data,
  getInput:(name:string)=>HTMLInputElement|null,
}) {
  for (const name in data) {
    bindVar({
      name,
      input: getInput(name),
      load: () => data[name],
      save: (v:Datum) => data[name] = v,
    });
  }
}

function bindVar({name, input, load, save}:{
  name: string,
  input: HTMLInputElement|null,
  load: () => any,
  save: (_:any) => void,
}) {
  switch (typeof load()) {

  case 'string':
    hookupVar({
      name, input, load, save,
      stov: (s:string) => s,
      vtos: (v:any)    => typeof v === 'string' ? v : v.toString(),
      read: (i:HTMLInputElement) => i.value,
      write: (i:HTMLInputElement, v:any) => i.value = typeof v === 'string' ? v : v.toString(),
    });
    break;

  case 'number':
    hookupVar({
      name, input, load, save,
      stov: (s:string) => s ? parseFloat(s) : null,
      vtos: (v:any)    => typeof v === 'number' ? v.toString() : '',
      read: (i:HTMLInputElement) => i.valueAsNumber,
      write: (i:HTMLInputElement, v:any) => i.valueAsNumber = typeof v === 'number' ? v : NaN,
    });
    break;

  case 'boolean':
    hookupVar({
      name, input, load, save,
      stov: (s:string) => s ? parseBoolean(s) : null,
      vtos: (v:any)    => typeof v === 'boolean' ? v.toString() : '',
      read: (i:HTMLInputElement) => i.checked,
      write: (i:HTMLInputElement, v:any) => i.checked = typeof v === 'boolean' ? v : false,
    });
    break;

  // TODO structured Array/list support? object/table?

  default:
    hookupVar({
      name, input,
      load, save,
      stov: (s:string) => JSON.parse(s),
      vtos: (v:any)    => JSON.stringify(v),
      read: (i:HTMLInputElement) => {
        try {
          return JSON.parse(i.value);
        } catch (e) {
          return null;
        }
      },
      write: (i:HTMLInputElement, v:any) => i.value = JSON.stringify(v),
    });
  }
}

function hookupVar({
  name, input,
  load, save,
  stov, vtos,
  read, write,
}:{
  name: string,
  input: HTMLInputElement|null,
  load: () => any,
  save: (_:any) => void,
  stov: (s:string) => any,
  vtos: (v:any) => string,
  read: (i:HTMLInputElement) => any, // TODO can fail
  write: (i:HTMLInputElement, v:any) => void,
}) {
  const update = (value:any) => {
    const given = value !== null && value !== undefined;
    if (!given) value = load();
    setHashVar(name, vtos(value));
    if (given) save(value);
    if (input) write(input, value);
  };
  if (input) input.addEventListener('change', () => update(read(input)));
  const value = readHashVar(name);
  update(value === null ? load() : stov(value));
}
