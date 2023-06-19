import { read, write16bit } from "../gb/memory";
import { CpuPointer as r } from "../gb";

export function call(con: boolean) {
  //Push address of next instruction onto stack and then jump to address nn.
  return () => {
    if (con) {
      r.SP -= 2;
      write16bit(r.SP, (r.PC + 3) >> 8, (r.PC + 3) & 0xff); // maybe write upper lower nibble as one byte?
      r.PC = read(r.PC + 1) + (read(r.PC + 2) << 8);
    } else {
      r.PC += 3;
    }

    return 12;
  };
}
