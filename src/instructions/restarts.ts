import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register, A, F, B, C, D, E, H, L } from "../gb/register";

export function rst(start) {
  //Push current addr to stack and jump to start
  return () => {
    SP -= 2;
    write16bit(SP, (PC + 1) >> 8, (PC + 1) & 0xff); // maybe write upper lower nibble as one byte?
    PC = start;
    return 32;
  };
}
