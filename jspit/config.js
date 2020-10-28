import {readHashVar, setHashVar} from './state';

/**
 * @param {string} s
 * @returns {boolean|null}
 */
function parseBoolean(s) {
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

/**
 * @typedef {object} Context
 * @prop {(name:string) => HTMLInputElement|null} getInput
 * @prop {(name:string) => HTMLSelectElement|null} getSelect
 */

/**
 * @param {object} params
 * @param {Context} params.ctx
 * @param {any} params.data
 * @returns {void}
 */
export function bindVars({ctx, data}) {
  for (const name in data) {
    bindVar({ctx,
      name,
      load: () => data[name],
      save: (v) => data[name] = v,
    });
  }
}

/**
 * @param {object} params
 * @param {Context} params.ctx
 * @param {any} params.obj
 * @param {string} params.name
 * @returns {void}
 */
export function bindProp({ctx, obj, name}) {
  // obj: {[name: string]: any},
  bindVar({ctx,
    name,
    load: () => obj[name],
    save: (v) => obj[name] = v,
  });
}

/**
 * @param {object} params
 * @param {Context} params.ctx
 * @param {CSSStyleDeclaration} params.style
 * @param {string} params.name
 * @returns {void}
 */
export function bindCSSVar({ctx, style, name}) {
  bindVar({ctx,
    name,
    load: () => style.getPropertyValue(`--${name}`),
    save: (v) => style.setProperty(`--${name}`, `${v}`),
  });
}

/**
 * @param {object} params
 * @param {Context} params.ctx
 * @param {string} params.name
 * @param {() => any} params.load
 * @param {(v:any) => void} params.save
 * @returns {void}
 */
function bindVar({name, load, save, ctx: {getInput, getSelect}}) {
  const value = load();
  const codec = valueCodec(value);
  switch (typeof value) {

  case 'string':
    hookupInput({
      name,
      codec,
      input: getInput(name),
      load, save,
      read: (i) => i.value,
      write: (i, v) => i.value = typeof v === 'string' ? v : v.toString(),
    });
    break;

  case 'number':
    hookupInput({
      name,
      codec,
      input: getInput(name),
      load, save,
      read: (i) => i.valueAsNumber,
      write: (i, v) => i.valueAsNumber = typeof v === 'number' ? v : NaN,
    });
    break;

  case 'boolean':
    hookupInput({
      name,
      codec,
      input: getInput(name),
      load, save,
      read: (i) => i.checked,
      write: (i, v) => i.checked = typeof v === 'boolean' ? v : false,
    });
    break;

  // TODO structured Array/list support? object/table?

  case 'object':

    if (value.value !== undefined && value.options !== undefined) {
      const codec = valueCodec(value.value);
      hookupSelect({
        name,
        codec,
        select: getSelect(name),
        options: value.options,
        load: () => load().value,
        save: (value) => save({value, options: load().options}),
      });
      return;
    }

    hookupInput({
      name,
      codec,
      input: getInput(name),
      load, save,
      read: (i) => {
        try {
          return JSON.parse(i.value);
        } catch (e) {
          return null;
        }
      },
      write: (i, v) => i.value = JSON.stringify(v),
    });
  }
}

/**
 * @param {object} params
 * @param {string} params.name
 * @param {HTMLInputElement|null} params.input
 * @param {Codec} params.codec
 * @param {() => any} params.load
 * @param {(v:any) => void} params.save
 * @param {(i:HTMLInputElement) => any} params.read - afford failure
 * @param {(i:HTMLInputElement, v:any) => void} params.write
 * @returns {void}
 */
function hookupInput({
  name, input,
  codec,
  load, save,
  read, write,
}) {
  /** @param {any} value */
  const update = (value) => {
    const given = value !== null && value !== undefined;
    if (!given) value = load();
    setHashVar(name, codec.encode(value));
    if (given) save(value);
    if (input) write(input, value);
  };
  if (input) input.addEventListener('change', () => update(read(input)));
  const value = readHashVar(name);
  update(value === null ? load() : codec.decode(value));
}

/**
 * @param {object} params
 * @param {string} params.name
 * @param {HTMLSelectElement|null} params.select
 * @param {Codec} params.codec
 * @param {string|{ value: string, label?: string, }[]} params.options
 * @param {() => any} params.load
 * @param {(_:any) => void} params.save
 * @returns {void}
 */
function hookupSelect({
  name, select,
  codec,
  options,
  load, save,
}) {
  /** @param {any} value */
  const update = (value) => {
    const given = value !== null && value !== undefined;
    if (!given) value = load();
    setHashVar(name, codec.encode(value));
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
    select.addEventListener('change', () => update(codec.decode(select.value)));
  }
  const value = readHashVar(name);
  update(value === null ? load() : codec.decode(value));
}

/**
 * @typedef {object} Codec
 * @prop {(s:string) => any} decode
 * @prop {(v:any) => string} encode
 * 
 * @param {any} value
 * @returns {Codec}
 */
function valueCodec(value) {
  switch (typeof value) {
    case 'string':
      return {
        decode: (s) => s,
        encode: (v) => typeof v === 'string' ? v : v.toString(),
      };

    case 'number':
      return {
        decode: (s) => s ? parseFloat(s) : null,
        encode: (v) => typeof v === 'number' ? v.toString() : '',
      };

    case 'boolean':
      return {
        decode: (s) => s ? parseBoolean(s) : null,
        encode: (v) => typeof v === 'boolean' ? v.toString() : '',
      };

    case 'object':
      return {
        decode: (s) => JSON.parse(s),
        encode: (v) => JSON.stringify(v),
      };

    default:
      throw new Error(`unupported ${name} setting of type ${typeof value}`);
  }
}
