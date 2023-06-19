import { flags } from "../gb/flags";
import { read, write, write16bit } from "../gb/memory";
import { register, A, F, H, L } from "../gb/register";
import { CpuPointer as r, spimm, imm } from "../gb";
import { signed } from "../helper";

export function ld(a: number, b: number) {
  // load from register b to register a
  return () => {
    register[a] = register[b];
    r.PC += 1;
    return 4;
  };
}

export function ld_imm(a: number) {
  //loads next immediate byte from memory
  return () => {
    register[a] = read(r.PC + 1);
    r.PC += 2;
    return 8;
  };
}

export function ld_from_mem(a: number, b: number, c: number) {
  //loads from defined memory location
  return () => {
    register[a] = read((register[b] << 8) + register[c]);
    r.PC += 1;
    return 8;
  };
}

export function ld_from_mem_imm(a: number) {
  //loads from memory location, pointed to by next two bytes
  return () => {
    register[a] = read((read(r.PC + 2) << 8) + read(r.PC + 1));
    r.PC += 3;
    return 16;
  };
}

export function ld_to_mem(a: number, b: number, c: number) {
  //write to defined memory location
  return () => {
    write((register[b] << 8) + register[a], register[c]);
    r.PC += 1;
    return 8;
  };
}

export function ld_to_mem_imm(a: number, b: number) {
  return () => {
    if (b == imm) {
      //write to next immediate mem location
      write((read(r.PC + 2) << 8) + read(r.PC + 1), register[a]);
      r.PC += 3;
      return 16;
    } else {
      //ld from next immediate byte and write to other mem location
      write((register[b] << 8) + register[a], read(r.PC + 1));
      r.PC += 3;
      return 12;
    }
  };
}

export function ldac(a: number, b: number) {
  return () => {
    if (a == A) {
      //read from (C)
      register[a] == read(0xff00 + register[b]);
      r.PC += 1;
      return 8;
    } else {
      //write A to (C)
      write(0xff00 + register[a], register[b]);
      r.PC += 1;
      return 8;
    }
  };
}

export function ldd(a: number, b: number) {
  //ld decrease
  return () => {
    if (a == 321) {
      //write to (HL)
      write(register[L] + (register[H] << 8), register[b]);
      if (register[L] == 0) register[H] -= 1;
      else register[L] -= 1;
      r.PC += 1;
      return 8;
    } else {
      //read from (HL)
      register[b] = read(register[L] + (register[H] << 8));
      if (register[L] == 0) register[H] -= 1;
      else register[L] -= 1;
      r.PC += 1;
      return 8;
    }
  };
}

export function ldi(a: number, b: number) {
  //ld increase
  return () => {
    if (a == 321) {
      //write to (HL)
      write(register[L] + (register[H] << 8), register[b]);
      if (register[L] == 255) register[H] += 1;
      else register[L] += 1;
      r.PC += 1;
      return 8;
    } else {
      //read from (HL)
      register[b] = read(register[L] + (register[H] << 8));
      if (register[L] == 255) register[H] += 1;
      else register[L] += 1;
      r.PC += 1;
      return 8;
    }
  };
}

export function ldh(a: number, b: number) {
  return () => {
    if (a == imm) {
      //write register to 0xFF00+n
      write(0xff00 + read(r.PC + 1), register[b]);
      r.PC += 2;
      return 8;
    } else {
      //read from 0xFF00+n
      register[a] = read(0xff00 + read(r.PC + 1));
      r.PC += 2;
      return 8;
    }
  };
}

export function ld16(a: number, b: number, c: number) {
  //ld 16-bit
  return () => {
    if (c == imm) {
      //ld n,nn
      register[a] = read(r.PC + 2);
      register[b] = read(r.PC + 1);
      r.PC += 3;
      return 12;
    } else if (c == spimm) {
      if (a == r.SP && b == spimm) {
        //ld SP,nn
        r.SP = read(r.PC + 1) + (read(r.PC + 2) << 8);
        r.PC += 3;
        return 12;
      } else {
        //////////////////////////check again, not sure if it is write16bit or write
        //ld (nn),SP
        write16bit(
          (read(r.PC + 2) << 8) + read(r.PC + 1),
          r.SP >>> 8,
          r.SP & 0xff /*  SP & 0xff, SP >>> 8 */
        );
        r.PC += 3;
        return 20;
      }
    } else {
      //ld SP,HL
      r.SP = (register[H] << 8) + register[L];
      r.PC += 1;
      return 8;
    }
  };
}

export function ldhl() {
  return () => {
    var n = signed(read(r.PC + 1));
    var spn = r.SP + n;
    register[H] = spn >> 8;
    register[L] = spn & 0xff;
    flags.H = (r.SP & 0xf) + (n & 0xf) >= 0x10 ? true : false;
    flags.C = (r.SP & 0xff) + (n & 0xff) >= 0x100 ? true : false;
    flags.Z = false;
    flags.N = false;
    r.PC += 2;
    return 12;
  };
}

export function push(a: number, b: number) {
  return () => {
    if (b === F) {
      r.SP -= 1;
      write(r.SP, a);
      r.SP -= 1;
      write(r.SP, flags.flagByte());
      return 16; // must be verified
    } else {
      r.SP -= 1;
      write(r.SP, a);
      r.SP -= 1;
      write(r.SP, b);
      r.PC += 1;
      return 16;
    }
  };
}

export function pop(a: number, b: number) {
  return () => {
    if (b === F) {
      let f = read(r.SP);
      flags.Z = (f & (1 << 7)) != 0;
      flags.N = (f & (1 << 6)) != 0;
      flags.H = (f & (1 << 5)) != 0;
      flags.C = (f & (1 << 4)) != 0;
      r.SP += 1;
      register[a] = read(r.SP);
      r.SP += 1;
      r.PC += 1;
      return 12;
    } else {
      register[b] = read(r.SP);
      r.SP += 1;
      register[a] = read(r.SP);
      r.SP += 1;
      r.PC += 1;
      return 12;
    }
  };
}
