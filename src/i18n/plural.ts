// صيغ العدد في العربية: 1 «مكوّن واحد»، 2 «مكوّنان»، 3–10 «3 مكوّنات»، 11+ «11 مكوّناً» — والإنجليزية مفرد/جمع.
// num يُمرَّر لتنسيق الرقم كبقية الواجهة.
export interface ArForms {
  one: string;
  two: string;
  few: string;
  many: string;
}

export function arCount(n: number, f: ArForms, num: (n: number) => string = String) {
  const k = Math.abs(Math.trunc(n));
  if (k === 1) return f.one;
  if (k === 2) return f.two;
  const m = k % 100;
  if (k === 0) return `${num(n)} ${f.few}`;
  if (m >= 3 && m <= 10) return `${num(n)} ${f.few}`;
  if (m === 1 || m === 2) return `${num(n)} ${f.many}`;
  return `${num(n)} ${f.many}`;
}

export const enCount = (n: number, one: string, many: string) => `${n} ${Math.abs(n) === 1 ? one : many}`;
