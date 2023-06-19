import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register } from "../gb/register";
import { CpuPointer as r } from "../gb";

export function rl(a: number, c: boolean, rla: boolean) {
  //c = through Carry  |rla  = used RLA instead of RL A
  return () => {
    if (c == true) {
      var n = flags.flagByte() && 0x10 == 0x10 ? 0x1 : 0x0; //get C flag
      flags.C = register[a] && 0x80 == 0x80 ? true : false; //move bit 7 to C flag
      register[a] = register[a] << (1 + n);
    } else {
      if (register[a] && 0x80 == 0x80) {
        register[a] = register[a] << (1 + 0x1);
        flags.C = true;
      } else {
        register[a] = register[a] << 1;
        flags.C = false;
      }
    }
    flags.N = false;
    flags.H = false;
    flags.Z = register[a] == 0 ? true : false;
    r.PC += 1;
    let rc = rla == true ? 4 : 8;
    return rc;
  };
}

export function rl_from_mem(a: number, b: number, c: boolean) {
  //a,b mem location
  return () => {
    var n = read((register[a] << 8) + register[b]);
    if (c == true) {
      var n = flags.flagByte() && 0x10 == 0x10 ? 0x1 : 0x0; //get C flag
      flags.C = n && 0x80 == 0x80 ? true : false; //move bit 7 to C flag
      n = n << (1 + n);
    } else {
      if (n && 0x80 == 0x80) {
        n = n << (1 + 0x1);
        flags.C = true;
      } else {
        n = n << 1;
        flags.C = false;
      }
    }
    flags.N = false;
    flags.H = false;
    flags.Z = n == 0 ? true : false;
    write((register[a] << 8) + register[b], n);
    r.PC += 1;
    return 16;
  };
}

export function rr(a: number, c: boolean, rla: boolean) {
  //c = through Carry  |rla  = used RLA instead of RL A
  return () => {
    if (c == true) {
      var n = flags.flagByte() && 0x10 == 0x10 ? 0x80 : 0x0; //get C flag
      flags.C = register[a] && 0x1 == 0x1 ? true : false; //move bit 0 to C flag
      register[a] = register[a] >>> (1 + n);
    } else {
      if (register[a] && 0x1 == 0x1) {
        register[a] = register[a] >>> (1 + 0x80);
        flags.C = true;
      } else {
        register[a] = register[a] >>> 1;
        flags.C = false;
      }
    }
    flags.N = false;
    flags.H = false;
    flags.Z = register[a] == 0 ? true : false;

    r.PC += 1;
    let rc = rla == true ? 4 : 8;
    return rc;
  };
}

export function rr_from_mem(a: number, b: number, c: boolean) {
  //a,b mem location
  return () => {
    var n = read((register[a] << 8) + register[b]);
    if (c == true) {
      var m = flags.flagByte() && 0x10 == 0x10 ? 0x80 : 0x0; //get C flag
      flags.C = n && 0x1 == 0x1 ? true : false; //move bit 0 to C flag
      n = n >>> (1 + m);
    } else {
      if (n && 0x1 == 0x1) {
        n = n >>> (1 + 0x80);
        flags.C = true;
      } else {
        n = n >>> 1;
        flags.C = false;
      }
    }
    flags.N = false;
    flags.H = false;
    flags.Z = n == 0 ? true : false;
    write((register[a] << 8) + register[b], n);

    r.PC += 1;
    return 16;
  };
}

export function sl(a: number) {
  return () => {
    flags.C = register[a] && 0x80 == 0x80 ? true : false; //move bit 7 to Carry flag
    register[a] = register[a] << 1;

    flags.N = false;
    flags.H = false;
    flags.Z = register[a] == 0 ? true : false;

    r.PC += 1;
    return 8;
  };
}

export function sl_from_mem(a: number, b: number) {
  return () => {
    var n = read((register[a] << 8) + register[b]);
    flags.C = n && 0x80 == 0x80 ? true : false; //move bit 7 to C flag
    n = n << 1;

    flags.N = false;
    flags.H = false;
    flags.Z = n == 0 ? true : false;
    write((register[a] << 8) + register[b], n);

    r.PC += 1;
    return 16;
  };
}

export function sr(a: number, fbz: boolean) {
  //fbz = first bit to zero
  return () => {
    flags.C = register[a] && 0x1 == 0x1 ? true : false; //move bit 0 to C flag
    if (fbz == true) register[a] = register[a] >>> 1;
    else register[a] = register[a] >> 1;

    flags.N = false;
    flags.H = false;
    flags.Z = register[a] == 0 ? true : false;

    r.PC += 1;
    return 8;
  };
}

export function sr_from_mem(a: number, b: number, fbz: boolean) {
  return () => {
    var n = read((register[a] << 8) + register[b]);
    flags.C = n && 0x1 == 0x1 ? true : false; //move bit 0 to C flag
    if (fbz == true) n = n >>> 1;
    else n = n >> 1;

    flags.N = false;
    flags.H = false;
    flags.Z = n == 0 ? true : false;
    write((register[a] << 8) + register[b], n);

    r.PC += 1;
    return 16;
  };
}
