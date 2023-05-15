import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register, A, F, B, C, D, E, H, L } from "../gb/register";

export function bit(bit, a) {
  //bit to test
  return () => {
    flags.Z = register[a] && 0x1 << bit == 0x1 << bit ? false : true;

    flags.N = false;
    flags.H = true;

    PC += 1;
    return 8;
  };
}

export function bit_from_mem(bit, a, b) {
  return () => {
    var n = read((register[a] << 8) + register[b]);
    flags.Z = n && 0x1 << bit == 0x1 << bit ? false : true;

    flags.N = false;
    flags.H = true;

    PC += 1;
    return 16;
  };
}

export function set(bit, a) {
  //set bit b in flag
  return () => {
    let m = 0x1 << bit;
    register[a] |= m;

    PC += 1;
    return 8;
  };
}

export function set_from_mem(bit, a, b) {
  //set bit in memory
  return () => {
    let m = 0x1 << bit;
    let n = read((register[a] << 8) + register[b]);
    n |= m;
    write((register[a] << 8) + register[b], n);

    PC += 1;
    return 16;
  };
}

export function res(bit, a) {
  //reset bit b in flag
  return () => {
    let m = 0x1 << bit;
    register[a] &= ~m;

    PC += 1;
    return 8;
  };
}

export function res_from_mem(bit, a, b) {
  //reset bit in memory
  return () => {
    let m = 0x1 << bit;
    let n = read((register[a] << 8) + register[b]);
    n &= ~m;
    write((register[a] << 8) + register[b], n);

    PC += 1;
    return 16;
  };
}
