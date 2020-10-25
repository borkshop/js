export function nextFrame() {
  return new Promise<number>(resolve => requestAnimationFrame(resolve));
}

export async function everyFrame(update:(dt:number)=>boolean) {
  let last = await nextFrame();
  let dt = 0;
  while (update(dt)) {
    const next = await nextFrame();
    dt = next - last, last = next;
  }
}

export function schedule(...parts:(
  | {every:number, then:(n:number)=>boolean}
  | ((dt:number)=>boolean)
)[]) {
  const every = parts.map(part => typeof part === 'function' ? 0    : part.every);
  const then  = parts.map(part => typeof part === 'function' ? part : part.then);
  const last  = every.map(()   => 0);
  return (dt:number):boolean => {
    for (let i = 0; i < every.length; ++i) {
      let n = dt;
      if (every[i] > 0) {
        last[i] += dt / every[i];
        if (n = Math.floor(last[i])) last[i] -= n;
      }
      if (n && !then[i](n)) return false;
    }
    return true;
  }
}
