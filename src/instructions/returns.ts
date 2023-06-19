import { read } from "../gb/memory";
import { CpuPointer as r, CpuControl as cc } from "../gb";

export function ret(con: boolean, reti = false) {
  //Pop two bytes from stack & jump to that address
  return () => {
    if (reti) cc.IME = true;
    if (con) {
      let a = read(r.SP);
      r.SP += 1;
      let b = read(r.SP);
      r.SP += 1;
      r.PC = (a << 8) + b;
    }

    return 8;
  };
}
