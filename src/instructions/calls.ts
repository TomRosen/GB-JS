import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register, A, F, B, C, D, E, H, L } from "../gb/register";

export function call(con) {
  //Push address of next instruction onto stack and then jump to address nn.
  return () => {
    if (con || con == null) {
      SP -= 2;
      write16bit(SP, (PC + 3) >> 8, (PC + 3) & 0xff); // maybe write upper lower nibble as one byte?
      PC = read(PC + 1) + (read(PC + 2) << 8);
    } else {
      PC += 3;
    }

    return 12;
  };
}
