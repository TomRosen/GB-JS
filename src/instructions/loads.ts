import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register, A, F, B, C, D, E, H, L } from "../gb/register";

export function ld(a, b) {
  // load from register b to register a
  return () => {
    register[a] = register[b];
    PC += 1;
    return 4;
  };
}

export function ld_imm(a) {
  //loads next immediate byte from memory
  return () => {
    register[a] = read(PC + 1);
    PC += 2;
    return 8;
  };
}

export function ld_from_mem(a, b, c) {
  //loads from defined memory location
  return () => {
    register[a] = read((register[b] << 8) + register[c]);
    PC += 1;
    return 8;
  };
}

export function ld_from_mem_imm(a) {
  //loads from memory location, pointed to by next two bytes
  return () => {
    register[a] = read((read(PC + 2) << 8) + read(PC + 1));
    PC += 3;
    return 16;
  };
}

export function ld_to_mem(a, b, c) {
  //write to defined memory location
  return () => {
    write((register[b] << 8) + register[a], register[c]);
    PC += 1;
    return 8;
  };
}

export function ld_to_mem_imm(a, b) {
  return () => {
    if (b == imm) {
      //write to next immediate mem location
      write((read(PC + 2) << 8) + read(PC + 1), register[a]);
      PC += 3;
      return 16;
    } else {
      //ld from next immediate byte and write to other mem location
      write((register[b] << 8) + register[a], read(PC + 1));
      PC += 3;
      return 12;
    }
  };
}

export function ldac(a, b) {
  return () => {
    if (a == A) {
      //read from (C)
      register[a] == read(0xff00 + register[b]);
      PC += 1;
      return 8;
    } else {
      //write A to (C)
      write(0xff00 + register[a], register[b]);
      PC += 1;
      return 8;
    }
  };
}

export function ldd(a, b) {
  //ld decrease
  return () => {
    if (a == 321) {
      //write to (HL)
      write(register[L] + (register[H] << 8), register[b]);
      if (register[L] == 0) register[H] -= 1;
      else register[L] -= 1;
      PC += 1;
      return 8;
    } else {
      //read from (HL)
      register[b] = read(register[L] + (register[H] << 8));
      if (register[L] == 0) register[H] -= 1;
      else register[L] -= 1;
      PC += 1;
      return 8;
    }
  };
}

export function ldi(a, b) {
  //ld increase
  return () => {
    if (a == 321) {
      //write to (HL)
      write(register[L] + (register[H] << 8), register[b]);
      if (register[L] == 255) register[H] += 1;
      else register[L] += 1;
      PC += 1;
      return 8;
    } else {
      //read from (HL)
      register[b] = read(register[L] + (register[H] << 8));
      if (register[L] == 255) register[H] += 1;
      else register[L] += 1;
      PC += 1;
      return 8;
    }
  };
}

export function ldh(a, b) {
  return () => {
    if (a == imm) {
      //write register to 0xFF00+n
      write(0xff00 + read(PC + 1), register[b]);
      PC += 2;
      return 8;
    } else {
      //read from 0xFF00+n
      register[a] = read(0xff00 + read(PC + 1));
      PC += 2;
      return 8;
    }
  };
}

export function ld16(a, b, c) {
  //ld 16-bit
  return () => {
    if (c == imm) {
      //ld n,nn
      register[a] = read(PC + 2);
      register[b] = read(PC + 1);
      PC += 3;
      return 12;
    } else if (c == spimm) {
      if (a == SP && b == spimm) {
        //ld SP,nn
        SP = read(PC + 1) + (read(PC + 2) << 8);
        PC += 3;
        return 12;
      } else {
        //////////////////////////check again, not sure if it is write16bit or write
        //ld (nn),SP
        write16bit(
          (read(PC + 2) << 8) + read(PC + 1),
          SP >>> 8,
          SP & 0xff /*  SP & 0xff, SP >>> 8 */
        );
        PC += 3;
        return 20;
      }
    } else {
      //ld SP,HL
      SP = (register[H] << 8) + register[L];
      PC += 1;
      return 8;
    }
  };
}

export function ldhl() {
  return () => {
    var n = signed(read(PC + 1));
    var spn = SP + n;
    register[H] = spn >> 8;
    register[L] = spn & 0xff;
    flags.H = (SP & 0xf) + (n & 0xf) >= 0x10 ? true : false;
    flags.C = (SP & 0xff) + (n & 0xff) >= 0x100 ? true : false;
    flags.Z = false;
    flags.N = false;
    PC += 2;
    return 12;
  };
}

export function push(a, b) {
  return () => {
    if (b === F) {
      SP -= 1;
      write(SP, a);
      SP -= 1;
      write(SP, flags.flagByte());
    } else {
      SP -= 1;
      write(SP, a);
      SP -= 1;
      write(SP, b);
      PC += 1;
      return 16;
    }
  };
}

export function pop(a, b) {
  return () => {
    if (b === F) {
      let f = read(SP);
      flags.Z = (f & (1 << 7)) != 0;
      flags.N = (f & (1 << 6)) != 0;
      flags.H = (f & (1 << 5)) != 0;
      flags.C = (f & (1 << 4)) != 0;
      SP += 1;
      register[a] = read(SP);
      SP += 1;
      PC += 1;
      return 12;
    } else {
      register[b] = read(SP);
      SP += 1;
      register[a] = read(SP);
      SP += 1;
      PC += 1;
      return 12;
    }
  };
}
