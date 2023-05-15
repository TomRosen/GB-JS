import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register, A, F, B, C, D, E, H, L } from "../gb/register";

export function ret(con, reti = false) {
  //Pop two bytes from stack & jump to that address
  return () => {
    if (reti) IME = true;
    if (con || con == null) {
      let a = read(SP);
      SP += 1;
      let b = read(SP);
      SP += 1;
      PC = (a << 8) + b;
    }

    return 8;
  };
}
