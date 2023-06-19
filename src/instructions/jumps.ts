import { read } from "../gb/memory";
import { register, H, L } from "../gb/register";
import { CpuPointer as r } from "../gb";

export function jump_from_mem_imm(con: boolean) {
  //Jump to address (nn) if condition con
  return () => {
    if (con) {
      r.PC = (read(r.PC + 2) << 8) + read(r.PC + 1);
    } else {
      r.PC += 3;
    }

    return 12;
  };
}

export function jump_hl() {
  // Jump to address in HL
  return () => {
    r.PC = (register[H] << 8) + register[L];

    return 4;
  };
}

export function jump_add_imm(con: boolean) {
  //Add imm byte to curr addr and jump to it
  return () => {
    if (con) {
      r.PC += read(r.PC + 1);
    } else {
      r.PC += 2;
    }

    return 8;
  };
}
