export function dec2bin(dec: number): string {
  return (dec >>> 0).toString(2);
}

export function signed(a: number): number {
  if (a > 127) return a - 256;
  else a;
}
