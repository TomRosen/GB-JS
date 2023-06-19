import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register } from "../gb/register";
import { CpuPointer as r } from "../gb";

export function bit(bit: number, a: number) {
  //bit to test
  return () => {
    flags.Z = register[a] && 0x1 << bit == 0x1 << bit ? false : true;

    flags.N = false;
    flags.H = true;

    r.PC += 1;
    return 8;
  };
}

export function bit_from_mem(bit: number, a: number, b: number) {
  return () => {
    var n = read((register[a] << 8) + register[b]);
    flags.Z = n && 0x1 << bit == 0x1 << bit ? false : true;

    flags.N = false;
    flags.H = true;

    r.PC += 1;
    return 16;
  };
}

export function set(bit: number, a: number) {
  //set bit b in flag
  return () => {
    let m = 0x1 << bit;
    register[a] |= m;

    r.PC += 1;
    return 8;
  };
}

export function set_from_mem(bit: number, a: number, b: number) {
  //set bit in memory
  return () => {
    let m = 0x1 << bit;
    let n = read((register[a] << 8) + register[b]);
    n |= m;
    write((register[a] << 8) + register[b], n);

    r.PC += 1;
    return 16;
  };
}

export function res(bit: number, a: number) {
  //reset bit b in flag
  return () => {
    let m = 0x1 << bit;
    register[a] &= ~m;

    r.PC += 1;
    return 8;
  };
}

export function res_from_mem(bit: number, a: number, b: number) {
  //reset bit in memory
  return () => {
    let m = 0x1 << bit;
    let n = read((register[a] << 8) + register[b]);
    n &= ~m;
    write((register[a] << 8) + register[b], n);

    r.PC += 1;
    return 16;
  };
}
