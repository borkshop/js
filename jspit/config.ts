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

interface Accessors {
  getInput(name:string): HTMLInputElement|null;
  getSelect(name:string): HTMLSelectElement|null;
}

export function bindVars({data, ...acc}:Accessors&{
  data:Data,
}) {
  for (const name in data) {
    bindVar({
      ...acc,
      name,
      load: () => data[name],
      save: (v:Datum) => data[name] = v,
    });
  }
}

export function bindProp({obj, name, ...acc}:Accessors&{
  obj: {[name: string]: any},
  name: string,
}) {
  bindVar({...acc,
    name,
    load: () => obj[name],
    save: (v:Datum) => obj[name] = v,
  });
}

function bindVar({name, load, save, getInput, getSelect}:Accessors&{
  name: string,
  load: () => any,
  save: (_:any) => void,
}) {
  const value = load();
  const {stov, vtos} = tossers(value);
  switch (typeof value) {

  case 'string':
    hookupInput({
      name,
      input: getInput(name),
      load, save,
      stov, vtos,
      read: (i:HTMLInputElement) => i.value,
      write: (i:HTMLInputElement, v:any) => i.value = typeof v === 'string' ? v : v.toString(),
    });
    break;

  case 'number':
    hookupInput({
      name,
      input: getInput(name),
      load, save,
      stov, vtos,
      read: (i:HTMLInputElement) => i.valueAsNumber,
      write: (i:HTMLInputElement, v:any) => i.valueAsNumber = typeof v === 'number' ? v : NaN,
    });
    break;

  case 'boolean':
    hookupInput({
      name,
      input: getInput(name),
      load, save,
      stov, vtos,
      read: (i:HTMLInputElement) => i.checked,
      write: (i:HTMLInputElement, v:any) => i.checked = typeof v === 'boolean' ? v : false,
    });
    break;

  // TODO structured Array/list support? object/table?

  case 'object':

    if (value.value !== undefined && value.options !== undefined) {
      const {stov, vtos} = tossers(value.value);
      hookupSelect({
        name,
        select: getSelect(name),
        options: value.options,
        load: () => load().value,
        save: (value:any) => save({value, options: load().options}),
        stov, vtos,
      });
      return;
    }

    hookupInput({
      name,
      input: getInput(name),
      load, save,
      stov, vtos,
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

function hookupInput({
  name, input,
  load, save,
  stov, vtos,
  read, write,
}:{
  name: string,
  input: HTMLInputElement|null,
  load: () => any,
  save: (_:any) => void,
  read: (i:HTMLInputElement) => any, // TODO can fail
  write: (i:HTMLInputElement, v:any) => void,
}&Tossers) {
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

function hookupSelect({
  name, select,
  options,
  load, save,
  stov, vtos,
}:{
  name: string,
  select: HTMLSelectElement|null,
  options: string|{
    value: string,
    label?: string,
  }[],
  load: () => any,
  save: (_:any) => void,
}&Tossers) {
  const update = (value:any) => {
    const given = value !== null && value !== undefined;
    if (!given) value = load();
    setHashVar(name, vtos(value));
    if (given) save(value);
    if (select) select.value = value;
  };
  if (select) {
    while (select.options.length) select.remove(0);
    for (const opt of options) {
      if (typeof opt === 'string') {
        select.add(new Option(opt, opt));
      } else {
        const {label, value} = opt;
        select.add(new Option(label, value === undefined ? label : value));
      }
    }
    select.addEventListener('change', () => update(stov(select.value)));
  }
  const value = readHashVar(name);
  update(value === null ? load() : stov(value));
}

interface Tossers {
  stov(s:string): any;
  vtos(v:any): string;
}

function tossers(value:Datum):Tossers {
  switch (typeof value) {
    case 'string':
      return {
        stov: (s:string) => s,
        vtos: (v:any)    => typeof v === 'string' ? v : v.toString(),
      };

    case 'number':
      return {
        stov: (s:string) => s ? parseFloat(s) : null,
        vtos: (v:any)    => typeof v === 'number' ? v.toString() : '',
      };

    case 'boolean':
      return {
        stov: (s:string) => s ? parseBoolean(s) : null,
        vtos: (v:any)    => typeof v === 'boolean' ? v.toString() : '',
      };

    case 'object':
      return {
        stov: (s:string) => JSON.parse(s),
        vtos: (v:any)    => JSON.stringify(v),
      };

    default:
      throw new Error(`unupported ${name} setting of type ${typeof value}`);
  }
}
