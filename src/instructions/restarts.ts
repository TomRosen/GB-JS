import { write16bit } from "../gb/memory";
import { CpuPointer as r } from "../gb";

export function rst(start: number) {
  //Push current addr to stack and jump to start
  return () => {
    r.SP -= 2;
    write16bit(r.SP, (r.PC + 1) >> 8, (r.PC + 1) & 0xff); // maybe write upper lower nibble as one byte?
    r.PC = start;
    return 32;
  };
}
