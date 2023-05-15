import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register, A, F, B, C, D, E, H, L } from "../gb/register";

export function jump_from_mem_imm(con) {
  //Jump to address (nn) if condition con
  return () => {
    if (con || con == null) {
      PC = (read(PC + 2) << 8) + read(PC + 1);
    } else {
      PC += 3;
    }

    return 12;
  };
}

export function jump_hl() {
  // Jump to address in HL
  return () => {
    PC = (register[H] << 8) + register[L];

    return 4;
  };
}

export function jump_add_imm(con) {
  //Add imm byte to curr addr and jump to it
  return () => {
    if (con || con == null) {
      PC += read(PC + 1);
    } else {
      PC += 2;
    }

    return 8;
  };
}
