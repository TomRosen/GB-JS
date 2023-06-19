import {
  inc,
  inc16,
  dec,
  dec16,
  add16,
  add,
  add_from_mem,
  adc,
  adc_from_mem,
  sub,
  sub_from_mem,
  sbc,
  sbc_from_mem,
  and,
  and_from_mem,
  xor,
  xor_from_mem,
  or,
  or_from_mem,
  cp,
  cp_from_mem,
} from "./alu";
import { bit, bit_from_mem, res, res_from_mem, set, set_from_mem } from "./bit";
import { call } from "./calls";
import { jump_add_imm, jump_from_mem_imm, jump_hl } from "./jumps";
import {
  ld,
  ld16,
  ldac,
  ldd,
  ldh,
  ldhl,
  ldi,
  ld_from_mem,
  ld_from_mem_imm,
  ld_imm,
  ld_to_mem,
  ld_to_mem_imm,
  pop,
  push,
} from "./loads";
import { ccf, cpl, daa, di, ei, halt, nop, scf, swap, unused } from "./misc";
import { rst } from "./restarts";
import { ret } from "./returns";
import {
  rl,
  rl_from_mem,
  rr,
  rr_from_mem,
  sl,
  sl_from_mem,
  sr,
  sr_from_mem,
} from "./shifts_rotates";
import { A, F, B, C, D, E, H, L } from "../gb/register";
import { flags } from "../gb/flags";
import { read } from "../gb/memory";
import { CpuPointer as r, spimm, imm } from "../gb";

//opcode array
var opcodes = new Array(0x1000);

opcodes[0x00] = nop(); //NOP
opcodes[0x01] = ld16(B, C, imm); //ld BC,nn
opcodes[0x02] = ld_to_mem(B, C, A); //ld (BC),A
opcodes[0x03] = inc16(B, C); //inc BC
opcodes[0x04] = inc(B, B); //inc B
opcodes[0x05] = dec(B, B); //dec B
opcodes[0x06] = ld_imm(B); //ld B,n
opcodes[0x07] = rl(A, false, true); //rlca
opcodes[0x08] = ld16(r.SP, r.SP, spimm); //ld (nn),SP
opcodes[0x09] = add16(B, C, null); //add HL,BC
opcodes[0x0a] = ld_from_mem(A, B, C); //ld A,(BC)
opcodes[0x0b] = dec16(B, C); //dec BC
opcodes[0x0c] = inc(C, C); //inc C
opcodes[0x0d] = dec(C, C); //dec C
opcodes[0x0e] = ld_imm(C); //ld C,n
opcodes[0x0f] = rr(A, false, true); // rrca
opcodes[0x10] = 0; //https://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf#page=97
opcodes[0x11] = ld16(D, E, imm); //ld DE,nn
opcodes[0x12] = ld_to_mem(D, E, A); //ld (DE),A
opcodes[0x13] = inc16(D, E); //inc DE
opcodes[0x14] = inc(D, D); //inc D
opcodes[0x15] = dec(D, D); //dec D
opcodes[0x16] = ld_imm(D); //ld D,n
opcodes[0x17] = rl(A, true, true); //rla
opcodes[0x18] = jump_add_imm(true); //JR n
opcodes[0x19] = add16(D, E, null); //add HL,DE
opcodes[0x1a] = ld_from_mem(A, D, E); //ld A,(DE)
opcodes[0x1b] = dec16(D, E); //dec DE
opcodes[0x1c] = inc(E, E); //inc E
opcodes[0x1d] = dec(E, E); //dec E
opcodes[0x1e] = ld_imm(E); //ld E,n
opcodes[0x1f] = rr(A, true, true); //rra
opcodes[0x20] = jump_add_imm(!flags.Z); //JR NZ,*
opcodes[0x21] = ld16(H, L, imm); //ld HL,nn
opcodes[0x22] = ldi(321, A); //ld (HL+),A
opcodes[0x23] = inc16(H, L); //inc HL
opcodes[0x24] = inc(H, H); //inc H
opcodes[0x25] = dec(H, H); //dec H
opcodes[0x26] = ld_imm(H); //ld H,n
opcodes[0x27] = daa(); // daa
opcodes[0x28] = jump_add_imm(flags.Z); //JR Z,*
opcodes[0x29] = add16(H, L, null); //add HL,HL
opcodes[0x2a] = ldi(A, 321); //ld A,(HL+)
opcodes[0x2b] = dec16(H, L); //dec HL
opcodes[0x2c] = inc(L, L); //inc L
opcodes[0x2d] = dec(L, L); //dec L
opcodes[0x2e] = ld_imm(L); //ld L,n
opcodes[0x2f] = cpl(); //cpl
opcodes[0x30] = jump_add_imm(!flags.C); //JR NC,*
opcodes[0x31] = ld16(r.SP, spimm, spimm); //ld SP,nn
opcodes[0x32] = ldd(321, A); //ld (HL-),A
opcodes[0x33] = inc16(r.SP, null); //inc SP
opcodes[0x34] = inc(H, L); //inc (HL)
opcodes[0x35] = dec(H, L); //dec (HL)
opcodes[0x36] = ld_to_mem_imm(H, L); //ld (HL),n
opcodes[0x37] = scf(); //scf
opcodes[0x38] = jump_add_imm(flags.C); //JR C,*
opcodes[0x39] = add16(r.SP, r.SP, null); //add SP,HL
opcodes[0x3a] = ldd(A, 321); //ld A,(HL-)
opcodes[0x3b] = dec16(r.SP, null); //dec SP
opcodes[0x3c] = inc(A, A); //inc A
opcodes[0x3d] = dec(A, A); //dec A
opcodes[0x3e] = ld_imm(A); //ld A,#
opcodes[0x3f] = ccf(); //ccf
opcodes[0x40] = ld(B, B); //ld B,B
opcodes[0x41] = ld(B, C); //ld B,C
opcodes[0x42] = ld(B, D); //ld B,D
opcodes[0x43] = ld(B, E); //ld B,E
opcodes[0x44] = ld(B, H); //ld B,H
opcodes[0x45] = ld(B, L); //ld B,L
opcodes[0x46] = ld_from_mem(B, H, L); //ld B,(HL)
opcodes[0x47] = ld(B, A); //ld B,A
opcodes[0x48] = ld(C, B); //ld C,B
opcodes[0x49] = ld(C, C); //ld C,C
opcodes[0x4a] = ld(C, D); //ld C,D
opcodes[0x4b] = ld(C, E); //ld C,E
opcodes[0x4c] = ld(C, H); //ld C,H
opcodes[0x4d] = ld(C, L); //ld C,L
opcodes[0x4e] = ld_from_mem(C, H, L); //ld C,(HL)
opcodes[0x4f] = ld(C, A); //ld C,A
opcodes[0x50] = ld(D, B); //ld D,B
opcodes[0x51] = ld(D, C); //ld D,C
opcodes[0x52] = ld(D, D); //ld D,D
opcodes[0x53] = ld(D, E); //ld D,E
opcodes[0x54] = ld(D, H); //ld D,H
opcodes[0x55] = ld(D, L); //ld D,L
opcodes[0x56] = ld_from_mem(D, H, L); //ld D,(HL)
opcodes[0x57] = ld(D, A); //ld D,A
opcodes[0x58] = ld(E, B); //ld E,B
opcodes[0x59] = ld(E, C); //ld E,C
opcodes[0x5a] = ld(E, D); //ld E,D
opcodes[0x5b] = ld(E, E); //ld E,E
opcodes[0x5c] = ld(E, H); //ld E,H
opcodes[0x5d] = ld(E, L); //ld E,L
opcodes[0x5e] = ld_from_mem(E, H, L); //ld E,(HL)
opcodes[0x5f] = ld(E, A); //ld E,A
opcodes[0x60] = ld(H, B); //ld H,B
opcodes[0x61] = ld(H, C); //ld H,C
opcodes[0x62] = ld(H, D); //ld H,D
opcodes[0x63] = ld(H, E); //ld H,E
opcodes[0x64] = ld(H, H); //ld H,H
opcodes[0x65] = ld(H, L); //ld H,L
opcodes[0x66] = ld_from_mem(H, H, L); //ld H,(HL)
opcodes[0x67] = ld(H, A); //ld H,A
opcodes[0x68] = ld(L, B); //ld L,B
opcodes[0x69] = ld(L, C); //ld L,C
opcodes[0x6a] = ld(L, D); //ld L,D
opcodes[0x6b] = ld(L, E); //ld L,E
opcodes[0x6c] = ld(L, H); //ld L,H
opcodes[0x6d] = ld(L, L); //ld L,L
opcodes[0x6e] = ld_from_mem(L, H, L); //ld L,(HL)
opcodes[0x6f] = ld(L, A); //ld L,A
opcodes[0x70] = ld_to_mem(H, L, B); //ld (HL),B
opcodes[0x71] = ld_to_mem(H, L, C); //ld (HL),C
opcodes[0x72] = ld_to_mem(H, L, D); //ld (HL),D
opcodes[0x73] = ld_to_mem(H, L, E); //ld (HL),E
opcodes[0x74] = ld_to_mem(H, L, H); //ld (HL),H
opcodes[0x75] = ld_to_mem(H, L, L); //ld (HL),L
opcodes[0x76] = halt(); //halt
opcodes[0x77] = ld_to_mem(H, L, A); //ld (HL),A
opcodes[0x78] = ld(A, B); //ld A,B
opcodes[0x79] = ld(A, C); //ld A,C
opcodes[0x7a] = ld(A, D); //ld A,D
opcodes[0x7b] = ld(A, E); //ld A,E
opcodes[0x7c] = ld(A, H); //ld A,H
opcodes[0x7d] = ld(A, L); //ld A,L
opcodes[0x7e] = ld_from_mem(A, H, L); //ld A,(HL)
opcodes[0x7f] = ld(A, A); //ld A,A
opcodes[0x80] = add(B); //add A,B
opcodes[0x81] = add(C); //add A,C
opcodes[0x82] = add(D); //add A,D
opcodes[0x83] = add(E); //add A,E
opcodes[0x84] = add(H); //add A,H
opcodes[0x85] = add(L); //add A,L
opcodes[0x86] = add_from_mem(H, L); //add A,(HL)
opcodes[0x87] = add(A); //add A,A
opcodes[0x88] = adc(B); //adc A,B
opcodes[0x89] = adc(C); //adc A,C
opcodes[0x8a] = adc(D); //adc A,D
opcodes[0x8b] = adc(E); //adc A,E
opcodes[0x8c] = adc(H); //adc A,H
opcodes[0x8d] = adc(L); //adc A,L
opcodes[0x8e] = adc_from_mem(H, L); //adc A,(HL)
opcodes[0x8f] = adc(A); //adc A,A
opcodes[0x90] = sub(B); //sub B
opcodes[0x91] = sub(C); //sub C
opcodes[0x92] = sub(D); //sub D
opcodes[0x93] = sub(E); //sub E
opcodes[0x94] = sub(H); //sub H
opcodes[0x95] = sub(L); //sub L
opcodes[0x96] = sub_from_mem(H, L); //sub (HL)
opcodes[0x97] = sub(A); // sub A
opcodes[0x98] = sbc(B); //sbc A,B
opcodes[0x99] = sbc(C); //sbc A,C
opcodes[0x9a] = sbc(D); //sbc A,D
opcodes[0x9b] = sbc(E); //sbc A,E
opcodes[0x9c] = sbc(H); //sbc A,H
opcodes[0x9d] = sbc(L); //sbc A,L
opcodes[0x9e] = sbc_from_mem(H, L); //sbc A,(HL)
opcodes[0x9f] = sbc(A); //sbc A,A
opcodes[0xa0] = and(B); //and B
opcodes[0xa1] = and(C); //and C
opcodes[0xa2] = and(D); //and D
opcodes[0xa3] = and(E); //and E
opcodes[0xa4] = and(H); //and H
opcodes[0xa5] = and(L); //and L
opcodes[0xa6] = and_from_mem(H, L); //and (HL)
opcodes[0xa7] = and(A); //and A
opcodes[0xa8] = xor(B); //xor B
opcodes[0xa9] = xor(C); //xor C
opcodes[0xaa] = xor(D); //xor D
opcodes[0xab] = xor(E); //xor E
opcodes[0xac] = xor(H); //xor H
opcodes[0xad] = xor(L); //xor L
opcodes[0xae] = xor_from_mem(H, L); //xor (HL)
opcodes[0xaf] = xor(A); //xor A
opcodes[0xb0] = or(B); //or B
opcodes[0xb1] = or(C); //or C
opcodes[0xb2] = or(D); //or D
opcodes[0xb3] = or(E); //or E
opcodes[0xb4] = or(H); //or H
opcodes[0xb5] = or(L); //or L
opcodes[0xb6] = or_from_mem(H, L); //or (HL)
opcodes[0xb7] = or(A); //or A
opcodes[0xb8] = cp(B); //cp B
opcodes[0xb9] = cp(C); //cp C
opcodes[0xba] = cp(D); //cp D
opcodes[0xbb] = cp(E); //cp E
opcodes[0xbc] = cp(H); //cp H
opcodes[0xbd] = cp(L); //cp L
opcodes[0xbe] = cp_from_mem(H, L); //cp (HL)
opcodes[0xbf] = cp(A); //cp A
opcodes[0xc0] = ret(!flags.Z); //ret NZ
opcodes[0xc1] = pop(B, C); //pop BC
opcodes[0xc2] = jump_from_mem_imm(!flags.Z); // jp NZ,nn
opcodes[0xc3] = jump_from_mem_imm(true); // jp nn
opcodes[0xc4] = call(!flags.Z); // call NZ,nn
opcodes[0xc5] = push(B, C); //push BC
opcodes[0xc6] = add_from_mem(A, imm); //add A,#
opcodes[0xc7] = rst(0x00); //rst 00H
opcodes[0xc8] = ret(flags.Z); //ret Z
opcodes[0xc9] = ret(true); //ret
opcodes[0xca] = jump_from_mem_imm(flags.Z); // jp Z,nn
opcodes[0xcb] = function () {
  return cbcodes[read(++r.PC)]();
}; //prefix cb
opcodes[0xcc] = call(flags.Z); // call Z,nn
opcodes[0xcd] = call(true); // call nn
opcodes[0xce] = adc_from_mem(A, imm); //adc A,#
opcodes[0xcf] = rst(0x08); //rest 08H
opcodes[0xd0] = ret(!flags.C); //ret NC
opcodes[0xd1] = pop(D, E); //pop DE
opcodes[0xd2] = jump_from_mem_imm(!flags.C); // jp NC,nn
opcodes[0xd3] = unused;
opcodes[0xd4] = call(!flags.C); // call NC,nn
opcodes[0xd5] = push(D, E); //push DE
opcodes[0xd6] = sub_from_mem(A, imm); //sub #
opcodes[0xd7] = rst(0x10); //rest 10H
opcodes[0xd8] = ret(flags.C); //ret C
opcodes[0xd9] = ret(true, true); //reti
opcodes[0xda] = jump_from_mem_imm(flags.C); // jp C,nn
opcodes[0xdb] = unused;
opcodes[0xdc] = call(flags.C); // call C,nn
opcodes[0xdd] = unused;
opcodes[0xde] = sbc_from_mem(A, imm); //sbc A,#
opcodes[0xdf] = rst(0x18); //rst 18H
opcodes[0xe0] = ldh(imm, A); //ld ($FF00+n),A
opcodes[0xe1] = pop(H, L); //pop HL
opcodes[0xe2] = ldac(C, A); //ld ($FF00+C),A
opcodes[0xe3] = unused;
opcodes[0xe4] = unused;
opcodes[0xe5] = push(H, L); //push HL
opcodes[0xe6] = and_from_mem(A, imm); //and #
opcodes[0xe7] = rst(0x20); //rst 20H
opcodes[0xe8] = add16(r.SP, r.SP, spimm); //add SP,#
opcodes[0xe9] = jump_hl(); //JP (HL)
opcodes[0xea] = ld_to_mem_imm(A, imm); //ld (nn),A
opcodes[0xeb] = unused;
opcodes[0xec] = unused;
opcodes[0xed] = unused;
opcodes[0xee] = xor_from_mem(A, imm); //xor #  //arguments don't matter
opcodes[0xef] = rst(0x28); //rst 28H
opcodes[0xf0] = ldh(A, imm); //ld A,($FF00+n)
opcodes[0xf1] = pop(A, F); //pop AF
opcodes[0xf2] = ldac(A, C); //ld A,($FF00+C)
opcodes[0xf3] = di(); //di
opcodes[0xf4] = unused;
opcodes[0xf5] = push(A, F); //push AF
opcodes[0xf6] = or_from_mem(A, imm); //or #
opcodes[0xf7] = rst(0x30); //rst 30H
opcodes[0xf8] = ldhl(); //ldhl SP,n
opcodes[0xf9] = ld16(0, r.SP, 0); //ld SP,HL
opcodes[0xfa] = ld_from_mem_imm(A); //ldd A,(nn)
opcodes[0xfb] = ei(); //ei
opcodes[0xfc] = unused;
opcodes[0xfd] = unused;
opcodes[0xfe] = cp_from_mem(A, imm); //cp #  //arguments don't matter
opcodes[0xff] = rst(0x38); //rst 38H

var cbcodes = new Array(0x1000);

cbcodes[0x00] = rl(B, false, false); //rlc B
cbcodes[0x01] = rl(C, false, false); //rlc C
cbcodes[0x02] = rl(D, false, false); //rlc D
cbcodes[0x03] = rl(E, false, false); //rlc E
cbcodes[0x04] = rl(H, false, false); //rlc H
cbcodes[0x05] = rl(L, false, false); //rlc L
cbcodes[0x06] = rl_from_mem(H, L, false); //rlc (HL)
cbcodes[0x07] = rl(A, false, false); //rrc A
cbcodes[0x08] = rr(B, false, false); //rrc B
cbcodes[0x09] = rr(C, false, false); //rrc C
cbcodes[0x0a] = rr(D, false, false); //rrc D
cbcodes[0x0b] = rr(E, false, false); //rrc E
cbcodes[0x0c] = rr(H, false, false); //rrc H
cbcodes[0x0d] = rr(L, false, false); //rrc L
cbcodes[0x0e] = rr_from_mem(H, L, false); //rrc (HL)
cbcodes[0x0f] = rr(A, false, false); //rrc A
cbcodes[0x10] = rl(B, true, false); //rl B
cbcodes[0x11] = rl(C, true, false); //rl C
cbcodes[0x12] = rl(D, true, false); //rl D
cbcodes[0x13] = rl(E, true, false); //rl E
cbcodes[0x14] = rl(H, true, false); //rl H
cbcodes[0x15] = rl(L, true, false); //rl L
cbcodes[0x16] = rl_from_mem(H, L, true); //rl (HL)
cbcodes[0x17] = rl(A, true, false); //rr A
cbcodes[0x18] = rr(B, true, false); //rr B
cbcodes[0x19] = rr(C, true, false); //rr C
cbcodes[0x1a] = rr(D, true, false); //rr D
cbcodes[0x1b] = rr(E, true, false); //rr E
cbcodes[0x1c] = rr(H, true, false); //rr H
cbcodes[0x1d] = rr(L, true, false); //rr L
cbcodes[0x1e] = rr_from_mem(H, L, true); //rr (HL)
cbcodes[0x1f] = rr(A, true, false); //rr A
cbcodes[0x20] = sl(B); //sla B
cbcodes[0x21] = sl(C); //sla C
cbcodes[0x22] = sl(D); //sla D
cbcodes[0x23] = sl(E); //sla E
cbcodes[0x24] = sl(H); //sla H
cbcodes[0x25] = sl(L); //sla L
cbcodes[0x26] = sl_from_mem(H, L); //sla (HL)
cbcodes[0x27] = sl(A); //sla A
cbcodes[0x28] = sr(B, false); //sra B
cbcodes[0x29] = sr(C, false); //sra C
cbcodes[0x2a] = sr(D, false); //sra D
cbcodes[0x2b] = sr(E, false); //sra E
cbcodes[0x2c] = sr(H, false); //sra H
cbcodes[0x2d] = sr(L, false); //sra L
cbcodes[0x2e] = sr_from_mem(H, L, false); //sra (HL)
cbcodes[0x2f] = sr(A, false); //sra A
cbcodes[0x30] = swap(B); //swap B
cbcodes[0x31] = swap(C); //swap C
cbcodes[0x32] = swap(D); //swap D
cbcodes[0x33] = swap(E); //swap E
cbcodes[0x34] = swap(H); //swap H
cbcodes[0x35] = swap(L); //swap L
cbcodes[0x36] = swap(321); //swap (HL)
cbcodes[0x37] = swap(A); //swap A
cbcodes[0x38] = sr(B, true); //srl B
cbcodes[0x39] = sr(C, true); //srl C
cbcodes[0x3a] = sr(D, true); //srl D
cbcodes[0x3b] = sr(E, true); //srl E
cbcodes[0x3c] = sr(H, true); //srl H
cbcodes[0x3d] = sr(L, true); //srl L
cbcodes[0x3e] = sr_from_mem(H, L, true); //srl (HL)
cbcodes[0x3f] = sr(A, true); //srl A

for (let i = 0; i < 2; i++) {
  for (let j = 0; j < 4; j++) {
    let b = i == 1 ? j * 2 + 1 : j * 2;
    cbcodes[0x40 + 0x10 * j + (0x0 + 0x08 * i)] = bit(b, B);
    cbcodes[0x40 + 0x10 * j + (0x01 + 0x08 * i)] = bit(b, C);
    cbcodes[0x40 + 0x10 * j + (0x02 + 0x08 * i)] = bit(b, D);
    cbcodes[0x40 + 0x10 * j + (0x03 + 0x08 * i)] = bit(b, E);
    cbcodes[0x40 + 0x10 * j + (0x04 + 0x08 * i)] = bit(b, H);
    cbcodes[0x40 + 0x10 * j + (0x05 + 0x08 * i)] = bit(b, L);
    cbcodes[0x40 + 0x10 * j + (0x06 + 0x08 * i)] = bit_from_mem(b, H, L);
    cbcodes[0x40 + 0x10 * j + (0x07 + 0x08 * i)] = bit(b, A);

    cbcodes[0x80 + 0x10 * j + (0x0 + 0x08 * i)] = res(b, B);
    cbcodes[0x80 + 0x10 * j + (0x01 + 0x08 * i)] = res(b, C);
    cbcodes[0x80 + 0x10 * j + (0x02 + 0x08 * i)] = res(b, D);
    cbcodes[0x80 + 0x10 * j + (0x03 + 0x08 * i)] = res(b, E);
    cbcodes[0x80 + 0x10 * j + (0x04 + 0x08 * i)] = res(b, H);
    cbcodes[0x80 + 0x10 * j + (0x05 + 0x08 * i)] = res(b, L);
    cbcodes[0x80 + 0x10 * j + (0x06 + 0x08 * i)] = res_from_mem(b, H, L);
    cbcodes[0x80 + 0x10 * j + (0x07 + 0x08 * i)] = res(b, A);

    cbcodes[0xc0 + 0x10 * j + (0x0 + 0x08 * i)] = set(b, B);
    cbcodes[0xc0 + 0x10 * j + (0x01 + 0x08 * i)] = set(b, C);
    cbcodes[0xc0 + 0x10 * j + (0x02 + 0x08 * i)] = set(b, D);
    cbcodes[0xc0 + 0x10 * j + (0x03 + 0x08 * i)] = set(b, E);
    cbcodes[0xc0 + 0x10 * j + (0x04 + 0x08 * i)] = set(b, H);
    cbcodes[0xc0 + 0x10 * j + (0x05 + 0x08 * i)] = set(b, L);
    cbcodes[0xc0 + 0x10 * j + (0x06 + 0x08 * i)] = set_from_mem(b, H, L);
    cbcodes[0xc0 + 0x10 * j + (0x07 + 0x08 * i)] = set(b, A);
  }
}

export { opcodes };
