import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register, A, H, L } from "../gb/register";
import { CpuPointer as r, spimm } from "../gb";

export function add(a: number) {
  //add register n to register A
  return () => {
    register[A] += register[a];
    flags.H = (register[A] & 0xf) + (register[a] & 0xf) >= 0x10 ? true : false;
    flags.C = register[A] + register[a] < register[A] ? true : false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    r.PC += 1;
    return 4;
  };
}

export function add_from_mem(a: number, b: number) {
  //add byte from memory to register A
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]);
      register[A] += n;
      r.PC += 1;
    } else {
      var n = read(r.PC + 1);
      register[A] += n;
      r.PC += 2;
    }

    flags.H = (register[A] & 0xf) + (n & 0xf) >= 0x10 ? true : false;
    flags.C = register[A] + n < register[A] ? true : false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    return 8;
  };
}

export function adc(a: number) {
  //add register n + flag C to register A
  return () => {
    var n = register[a] + Number(flags.C); // verify if only c or whole flagByte
    register[A] += n;
    flags.H = (register[A] & 0xf) + (n & 0xf) >= 0x10 ? true : false;
    flags.C = register[A] + n < register[A] ? true : false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    r.PC += 1;
    return 4;
  };
}

export function adc_from_mem(a: number, b: number) {
  //add memory byte + flag C to register A
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]) + Number(flags.C);
      register[A] += n;
      r.PC += 1;
    } else {
      var n = read(r.PC + 1) + Number(flags.C);
      register[A] += n;
      r.PC += 2;
    }
    flags.H = (register[A] & 0xf) + (n & 0xf) >= 0x10 ? true : false;
    flags.C = register[A] + n < register[A] ? true : false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    return 8;
  };
}

export function sub(a: number) {
  //add register n to register A
  return () => {
    register[A] -= register[a];
    flags.H = (register[A] & 0xf0) - (register[a] & 0xf0) < 0x10 ? true : false;
    flags.C = register[A] - register[a] > register[A] ? true : false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = true;
    r.PC += 1;
    return 4;
  };
}

export function sub_from_mem(a: number, b: number) {
  //add byte from memory to register A
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]);
      register[A] -= n;
      r.PC += 1;
    } else {
      var n = read(r.PC + 1);
      register[A] -= n;
      r.PC += 2;
    }

    flags.H = (register[A] & 0xf0) - (n & 0xf0) < 0x10 ? true : false;
    flags.C = register[A] - n > register[A] ? true : false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = true;
    return 8;
  };
}

export function sbc(a: number) {
  //add register n + flag C to register A
  return () => {
    var n = register[a] - Number(flags.C);
    register[A] -= n;
    flags.H = (register[A] & 0xf0) - (n & 0xf0) < 0x10 ? true : false;
    flags.C = register[A] - n > register[A] ? true : false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = true;
    r.PC += 1;
    return 4;
  };
}

export function sbc_from_mem(a: number, b: number) {
  //add memory byte + flag C to register A
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]) - Number(flags.C);
      register[A] -= n;
      r.PC += 1;
    } else {
      var n = read(r.PC + 1) - Number(flags.C);
      register[A] -= n;
      r.PC += 2;
    }
    flags.H = (register[A] & 0xf0) - (n & 0xf0) < 0x10 ? true : false;
    flags.C = register[A] - n > register[A] ? true : false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = true;
    return 8;
  };
}

export function and(a: number) {
  return () => {
    register[A] &= register[a];
    flags.H = true;
    flags.C = false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    r.PC += 1;
    return 4;
  };
}

export function and_from_mem(a: number, b: number) {
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]);
      register[A] &= n;
      r.PC += 1;
    } else {
      var n = read(r.PC + 1);
      register[A] = register[A] & n;
      r.PC += 2;
    }
    flags.H = true;
    flags.C = false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    return 8;
  };
}

export function or(a: number) {
  return () => {
    register[A] |= register[a];
    flags.H = false;
    flags.C = false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    r.PC += 1;
    return 4;
  };
}

export function or_from_mem(a: number, b: number) {
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]);
      register[A] |= n;
      r.PC += 1;
    } else {
      var n = read(r.PC + 1);
      register[A] = register[A] & n;
      r.PC += 2;
    }
    flags.H = false;
    flags.C = false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    return 8;
  };
}

export function xor(a: number) {
  return () => {
    register[A] ^= register[a];
    flags.H = false;
    flags.C = false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    r.PC += 1;
    return 4;
  };
}

export function xor_from_mem(a: number, b: number) {
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]);
      register[A] ^= n;
      r.PC += 1;
    } else {
      var n = read(r.PC + 1);
      register[A] = register[A] & n;
      r.PC += 2;
    }
    flags.H = false;
    flags.C = false;
    flags.Z = register[A] == 0 ? true : false;
    flags.N = false;
    return 8;
  };
}

export function cp(a: number) {
  //add register n to register A
  return () => {
    register[A] -= register[a];
    flags.H = (register[A] & 0xf0) - (register[a] & 0xf0) < 0x10 ? true : false;
    flags.C = register[A] < register[a] ? true : false; //might also need to check for carry
    flags.Z = register[A] == register[a] ? true : false;
    flags.N = true;
    r.PC += 1;
    return 4;
  };
}

export function cp_from_mem(a: number, b: number) {
  //add byte from memory to register A
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]);
      register[A] -= n;
      r.PC += 1;
    } else {
      var n = read(r.PC + 1);
      register[A] -= n;
      r.PC += 2;
    }

    flags.H = (register[A] & 0xf0) - (n & 0xf0) < 0x10 ? true : false;
    flags.C = register[A] < n ? true : false;
    flags.Z = register[A] == n ? true : false;
    flags.N = true;
    return 8;
  };
}

export function inc(a: number, b: number) {
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]);
      n += 1;
      write((register[a] << 8) + register[b], n);
      flags.H = (n & 0xf) + 1 >= 0x10 ? true : false;
      flags.Z = register[a] == 0 ? true : false;
      flags.N = false;
      r.PC += 1;
      return 12;
    } else {
      register[a] += 1;
      flags.H = (register[a] & 0xf) + 1 >= 0x10 ? true : false;
      flags.Z = register[a] == 0 ? true : false;
      flags.N = false;
      r.PC += 1;
      return 4;
    }
  };
}

export function dec(a: number, b: number) {
  return () => {
    if (a == H && b == L) {
      var n = read((register[a] << 8) + register[b]);
      n -= 1;
      write((register[a] << 8) + register[b], n);
      flags.H = (n & 0xf0) - 1 < 0x10 ? true : false;
      flags.Z = register[a] == 0 ? true : false;
      flags.N = true;
      r.PC += 1;
      return 12;
    } else {
      register[a] -= 1;
      flags.H = (register[a] & 0xf0) - 1 < 0x10 ? true : false;
      flags.Z = register[a] == 0 ? true : false;
      flags.N = true;
      r.PC += 1;
      return 4;
    }
  };
}

export function add16(a: number, b: number, c: number | null) {
  return () => {
    if (c == spimm) {
      flags.H = (r.SP & 0xfff) + read(r.PC + 1) >= 0x1000 ? true : false;
      flags.C = r.SP < r.SP + read(r.PC + 1) ? true : false;
      flags.Z = false;
      flags.N = false;
      r.PC += 2;
      return 16;
    } else if (a == r.SP) {
      var m = (register[H] << 8) + register[L];
      var mn = m + r.SP;
      register[H] = mn >>> 8;
      register[L] = mn;
      flags.H = (m & 0xfff) + (r.SP & 0xfff) >= 0x1000 ? true : false;
      flags.C = mn < m ? true : false;
      flags.N = false;
      r.PC += 1;
      return 8;
    } else {
      var m = (register[H] << 8) + register[L];
      var n = (register[a] << 8) + register[b];
      var mn = m + n;
      register[H] = mn >>> 8;
      register[L] = mn;
      flags.H = (m & 0xfff) + (n & 0xfff) >= 0x1000 ? true : false;
      flags.C = mn < m ? true : false;
      flags.N = false;
      r.PC += 1;
      return 8;
    }
  };
}

export function inc16(a: number, b: number | null) {
  return () => {
    if (a == r.SP && b == null) {
      r.SP += 1;
      r.PC += 1;
      return 8;
    } else {
      var m = (register[a] << 8) + register[b!] + 1;
      register[a] = m >>> 8;
      register[b!] = m;
      r.PC += 1;
      return 8;
    }
  };
}

export function dec16(a: number, b: number | null) {
  return () => {
    if (a == r.SP && b == null) {
      r.SP -= 1;
      r.PC += 1;
      return 8;
    } else {
      var m = (register[a] << 8) + register[b!] - 1;
      register[a] = m >>> 8;
      register[b!] = m;
      r.PC += 1;
      return 8;
    }
  };
}
