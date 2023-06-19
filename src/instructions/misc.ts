import { flags } from "../gb/flags";
import { read, write } from "../gb/memory";
import { register, A, H, L } from "../gb/register";
import { CpuPointer as r, CpuControl as cc } from "../gb";

export function nop() {
  return () => {
    r.PC += 1;
    return 4;
  };
}

export function swap(a: number) {
  return () => {
    if (a == 321) {
      //swap at location (HL)
      var m = read((register[H] << 8) + register[L]);
      var n = (m << (4 + m)) >>> 4;
      write((register[H] << 8) + register[L], n);
      flags.Z = n == 0 ? true : false;
      flags.N = false;
      flags.H = false;
      flags.C = false;
      r.PC += 1;
      return 16;
    } else {
      var m = register[a] >>> 4;
      register[a] = register[a] << (4 + m); //verify pls
      flags.Z = register[a] == 0 ? true : false;
      flags.N = false;
      flags.H = false;
      flags.C = false;
      r.PC += 1;
      return 8;
    }
  };
}

export function daa() {
  //Decimal adjust register A to BCD
  //http://gbdev.gg8.se/wiki/articles/DAA
  return () => {
    if (flags.N) {
      if (flags.C) register[A] -= 0x60;
      if (flags.H) register[A] -= 0x06;
    } else {
      if (register[A] > 0x99 || flags.C) {
        register[A] += 0x60;
        flags.C = true;
      }
      if ((register[A] & 0x0f) > 0x09 || flags.H) register[A] += 0x06;
    }

    flags.Z = register[A] == 0;
    flags.H = false;

    r.PC += 1;
    return 4;
  };
}

export function cpl() {
  //Complement register A
  return () => {
    register[A] = register[A] ^ 0xff;

    flags.N = true;
    flags.H = true;

    r.PC += 1;
    return 4;
  };
}

export function ccf() {
  //Complement C Flag
  return () => {
    flags.N = false;
    flags.H = false;

    flags.C = !flags.C;

    r.PC += 1;
    return 4;
  };
}

export function scf() {
  //Set C Flag
  return () => {
    flags.N = false;
    flags.H = false;

    flags.C = true;

    r.PC += 1;
    return 4;
  };
}

export function di() {
  return () => {
    cc.IME = false;

    r.PC += 1;
    return 4;
  };
}

export function ei() {
  //but wait until next instruction
  return () => {
    cc.IME = true;

    r.PC += 1;
    return 4;
  };
}

export function halt() {
  //stop cpu until next intterupt
  return () => {
    cc.cpuRunning = false;
    r.PC += 1;
    return 4;
  };
}

export function stop() {
  //halt cpu & lcd until button is pressed
  return () => {
    //todo
    r.PC += 1;
    return 4;
  };
}

export function unused() {
  return 4;
}
