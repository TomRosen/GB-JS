/*
Interrupt Enable Register
--------------------------- FFFF
Internal RAM
--------------------------- FF80
Empty but unusable for I/O
--------------------------- FF4C
I/O ports
--------------------------- FF00
Empty but unusable for I/O
--------------------------- FEA0
Sprite Attrib Memory (OAM)
--------------------------- FE00
Echo of 8kB Internal RAM
--------------------------- E000
8kB Internal RAM
--------------------------- C000
8kB switchable RAM bank
--------------------------- A000
8kB Video RAM
--------------------------- 8000 --
16kB switchable ROM bank         |
--------------------------- 4000 |= 32kB Cartrigbe
16kB ROM bank #0                 |
--------------------------- 0000 --
*/
var memory = new Uint8Array(0x10000); //64kb total memory
var register = new Uint8Array(8); //cpu reg

//cpu reg addresses
const A = (1 << 0); //Accumulator register
const F = (1 << 1); //Accumulator flag
const B = (1 << 2); //BC 2 Byte register
const C = (1 << 3); //BC 2 Byte register
const D = (1 << 4); //DE 2 Byte register
const E = (1 << 5); //DE 2 Byte register
const H = (1 << 6); //HL 2 Byte register used to store memory addresses
const L = (1 << 7); //HL 2 Byte register used to store memory addresses

var SP = 0xFFFE; //stack pointer
var PC = 0x100; //programm counter

var imm = 921;
var spimm = 913;

var flags = {
    'Z': false,
    'N': false,
    'H': false,
    'C': false,
    'flagByte': function(){
        var byte = 0;
        if(Z == true)
            byte += 8;
        if(N == true)
            byte += 4;
        if(H == true)
            byte += 2;
        if(C == true)
            byte += 1;
        return (byte << 4);
    }
}

//Bus
function write(addr, data ){ //write data to memory
    if(addr >= 0x0000 && addr <= 0xFFFF){
        memory[addr] = data;
    }     
}

function write16bit(addr, data1, data2){ //write 2 Byte to memory
    write(addr, data1);
    write(addr+1, data2)
}

function read(addr){ //return data from memory
    if(addr >= 0x0000 && addr <= 0xFFFF){
        return memory[addr];
    }
    return 0x00
}

function dec2bin(dec){
    return (dec >>> 0).toString(2);
}

function signed(a){
    if(a > 127)
        return (a - 256);
    else
        a;
}

//opcode functions
function nop(){
    cp += 1;
    return 4;
}

function ld(a,b){
    register[a] = register[b];
    PC += 1;
    return 4;
}

function ld_imm(a){ //loads next immediate byte from memory
    register[a] = read(PC+1);
    PC += 2;
    return 8;
}

function ld_from_mem(a,b,c){ //loads from defined memory location
    register[a] = read( (register[b]<<8) + register[c]);
    PC += 1;
    return 8;
}

function ld_from_mem_imm(a){ //loads from memory location, pointed to by next to bytes
    register[a] = read( (read(PC+2)<<8) + read(PC+1));
    PC += 3;
    return 16;
}

function ld_to_mem(a,b,c){ //write to defined memory location
    write((register[b]<<8) + register[a], register[c]);
    PC += 1;
    return 8;
}

function ld_to_mem_imm(a,b){
    if(b == imm){ //write to next immediate mem location
        write( (read(PC+2)<<8) + read(PC+1), register[a])
        PC += 3;
        return 16;
    }else{ //ld from next immediate byte and write to other mem location
        write((register[b]<<8) + register[a], read(PC+1));
        PC += 3;
        return 12; 
    }  
}

function ldac(a,b){
    if(a==A){ //read from (C)
        register[a] == read(0xFF00 + register[b]);
        PC += 1;
        return 8;
    } else{ //write A to (C)
        write(0xFF00 + register[a], register[b]);
        PC += 1;
        return 8;
    }
}

function ldd(a,b){//ld decrease
    if(a==HL){//write to (HL)
        write(register[L] + (register[H]<<8), register[b]);
        if(register[L]==0)
            register[H] -= 1;
        else
            register[L] -= 1;
        PC += 1;
        return 8;
    }else{ //read from (HL)
        register[b] = read(register[L] + (register[H]<<8));
        if(register[L]==0)
            register[H] -= 1;
        else
            register[L] -= 1;
        PC += 1;
        return 8;
    }
}

function ldi(a,b){//ld increase
    if(a==HL){//write to (HL)
        write(register[L] + (register[H]<<8), register[b]);
        if(register[L]==255)
            register[H] += 1;
        else
            register[L] += 1;
        PC += 1;
        return 8;
    }else{ //read from (HL)
        register[b] = read(register[L] + (register[H]<<8));
        if(register[L]==255)
            register[H] += 1;
        else
            register[L] += 1;
        PC += 1;
        return 8;
    }
}

function ldh(a,b){
    if(a==imm){//write register to 0xFF00+n
        write(0xFF00+read(PC+1), register[b]);
        PC += 2;
        return 8;
    }else{//read from 0xFF00+n
        register[a] = read(0xFF00+read(PC+1));
        PC += 2;
        return 8;
    }
}

function ld16(a,b,c){//ld 16-bit
    if(c==imm){//ld n,nn
        register[a] = read(PC+2);
        register[b] = read(PC+1);
        PC += 3;
        return 12;
    }else if(c==spimm){
        if(a==SP && b==spimm){//ld SP,nn
            SP = read(PC+1) + (read(PC+2)<<8);
            PC += 3;
            return 12; 
        }else{//ld (nn),SP
            write( (read(PC+2)<<8) + read(PC+1), SP&0xFF, SP>>8);
            PC += 3;
            return 20;
        }   
    }else{//ld SP,HL
        SP = regsiter[H]<<8 + register[L];
        PC =+ 1;
        return 8;
    }
}

function ldhl(){
    var n = signed(read(PC+1));  
    var spn = SP + n;
    flags.H = (((SP&0xF)+(n&0xF))>=0x10) ? (true) : (false);
    flags.C = (((SP&0xFF)+(n&0xFF))>=0x100) ? (true) : (false);
    flags.Z = false;
    flags.N = false;
}


//opcode array
opcodes = new Uint8Array(0x1000);

opcodes[ 0x00 ] = nop(4); //NOP
opcodes[ 0x01 ] = ld16(B,C,imm); //ld BC,nn
opcodes[ 0x02 ] = ld_to_mem(B,C,A); //ld (BC),A
opcodes[ 0x03 ] = 
opcodes[ 0x04 ] = 
opcodes[ 0x05 ] = 
opcodes[ 0x06 ] = ld_imm(B); //ld B,n
opcodes[ 0x07 ] = 
opcodes[ 0x08 ] = ld16(SP,SP,spimm); //ld (nn),SP
opcodes[ 0x09 ] = 
opcodes[ 0x0A ] = ld_from_mem(A,B,C); //ld A,(BC)
opcodes[ 0x0B ] = 
opcodes[ 0x0C ] = 
opcodes[ 0x0D ] = 
opcodes[ 0x0E ] = ld_imm(C); //ld C,n
opcodes[ 0x0F ] = 
opcodes[ 0x10 ] = 
opcodes[ 0x11 ] = ld16(D,E,imm); //ld DE,nn
opcodes[ 0x12 ] = ld_to_mem(D,E,A); //ld (DE),A
opcodes[ 0x13 ] = 
opcodes[ 0x14 ] = 
opcodes[ 0x15 ] = 
opcodes[ 0x16 ] = ld_imm(D); //ld D,n
opcodes[ 0x17 ] = 
opcodes[ 0x18 ] = 
opcodes[ 0x19 ] = 
opcodes[ 0x1A ] = ld_from_mem(A,D,E); //ld A,(DE)
opcodes[ 0x1B ] = 
opcodes[ 0x1C ] = 
opcodes[ 0x1D ] = 
opcodes[ 0x1E ] = ld_imm(E); //ld E,n
opcodes[ 0x1F ] = 
opcodes[ 0x20 ] = 
opcodes[ 0x21 ] = ld16(H,L,imm); //ld HL,nn
opcodes[ 0x22 ] = ldi(HL,A); //ld (HL+),A
opcodes[ 0x23 ] = 
opcodes[ 0x24 ] = 
opcodes[ 0x25 ] = 
opcodes[ 0x26 ] = ld_imm(H); //ld H,n
opcodes[ 0x27 ] = 
opcodes[ 0x28 ] = 
opcodes[ 0x29 ] = 
opcodes[ 0x2A ] = ldi(A,HL); //ld A,(HL+)
opcodes[ 0x2B ] = 
opcodes[ 0x2C ] = 
opcodes[ 0x2D ] = 
opcodes[ 0x2E ] = ld_imm(L); //ld L,n
opcodes[ 0x2F ] = 
opcodes[ 0x30 ] = 
opcodes[ 0x31 ] = ld(SP,spimm,spimm); //ld SP,nn
opcodes[ 0x32 ] = ldd(HL,A); //ld (HL-),A
opcodes[ 0x33 ] = 
opcodes[ 0x34 ] = 
opcodes[ 0x35 ] = 
opcodes[ 0x36 ] = ld_to_mem_imm(H,L); //ld (HL),n
opcodes[ 0x37 ] = 
opcodes[ 0x38 ] = 
opcodes[ 0x39 ] = 
opcodes[ 0x3A ] = ldd(A,HL); //ld A,(HL-)
opcodes[ 0x3B ] = 
opcodes[ 0x3C ] = 
opcodes[ 0x3D ] = 
opcodes[ 0x3E ] = ld_imm(A); //ld A,#
opcodes[ 0x3F ] = 
opcodes[ 0x40 ] = ld(B,B); //ld B,B
opcodes[ 0x41 ] = ld(B,C); //ld B,C
opcodes[ 0x42 ] = ld(B,D); //ld B,D
opcodes[ 0x43 ] = ld(B,E); //ld B,E
opcodes[ 0x44 ] = ld(B,H); //ld B,H
opcodes[ 0x45 ] = ld(B,L); //ld B,L
opcodes[ 0x46 ] = ld_from_mem(B,H,L); //ld B,(HL)
opcodes[ 0x47 ] = ld(B,A); //ld B,A
opcodes[ 0x48 ] = ld(C,B); //ld C,B
opcodes[ 0x49 ] = ld(C,C); //ld C,C
opcodes[ 0x4A ] = ld(C,D); //ld C,D
opcodes[ 0x4B ] = ld(C,E); //ld C,E
opcodes[ 0x4C ] = ld(C,H); //ld C,H
opcodes[ 0x4D ] = ld(C,L); //ld C,L
opcodes[ 0x4E ] = ld_from_mem(C,H,L); //ld C,(HL)
opcodes[ 0x4F ] = ld(C,A); //ld C,A
opcodes[ 0x50 ] = ld(D,B); //ld D,B
opcodes[ 0x51 ] = ld(D,C); //ld D,C
opcodes[ 0x52 ] = ld(D,D); //ld D,D
opcodes[ 0x53 ] = ld(D,E); //ld D,E
opcodes[ 0x54 ] = ld(D,H); //ld D,H
opcodes[ 0x55 ] = ld(D,L); //ld D,L
opcodes[ 0x56 ] = ld_from_mem(D,H,L); //ld D,(HL)
opcodes[ 0x57 ] = ld(D,A); //ld D,A
opcodes[ 0x58 ] = ld(E,B); //ld E,B
opcodes[ 0x59 ] = ld(E,C); //ld E,C
opcodes[ 0x5A ] = ld(E,D); //ld E,D
opcodes[ 0x5B ] = ld(E,E); //ld E,E
opcodes[ 0x5C ] = ld(E,H); //ld E,H
opcodes[ 0x5D ] = ld(E,L); //ld E,L
opcodes[ 0x5E ] = ld_from_mem(E,H,L); //ld E,(HL)
opcodes[ 0x5F ] = ld(E,A); //ld E,A
opcodes[ 0x60 ] = ld(H,B); //ld H,B
opcodes[ 0x61 ] = ld(H,C); //ld H,C
opcodes[ 0x62 ] = ld(H,D); //ld H,D
opcodes[ 0x63 ] = ld(H,E); //ld H,E
opcodes[ 0x64 ] = ld(H,H); //ld H,H
opcodes[ 0x65 ] = ld(H,L); //ld H,L
opcodes[ 0x66 ] = ld_from_mem(H,H,L); //ld H,(HL)
opcodes[ 0x67 ] = ld(H,A); //ld H,A
opcodes[ 0x68 ] = ld(L,B); //ld L,B
opcodes[ 0x69 ] = ld(L,C); //ld L,C
opcodes[ 0x6A ] = ld(L,D); //ld L,D
opcodes[ 0x6B ] = ld(L,E); //ld L,E
opcodes[ 0x6C ] = ld(L,H); //ld L,H
opcodes[ 0x6D ] = ld(L,L); //ld L,L
opcodes[ 0x6E ] = ld_from_mem(L,H,L); //ld L,(HL)
opcodes[ 0x6F ] = ld(L,A); //ld L,A
opcodes[ 0x70 ] = ld_to_mem(H,L,B); //ld (HL),B
opcodes[ 0x71 ] = ld_to_mem(H,L,C); //ld (HL),C
opcodes[ 0x72 ] = ld_to_mem(H,L,D); //ld (HL),D
opcodes[ 0x73 ] = ld_to_mem(H,L,E); //ld (HL),E
opcodes[ 0x74 ] = ld_to_mem(H,L,H); //ld (HL),H
opcodes[ 0x75 ] = ld_to_mem(H,L,L); //ld (HL),L
opcodes[ 0x76 ] = 
opcodes[ 0x77 ] = ld_to_mem(H,L,A); //ld (HL),A 
opcodes[ 0x78 ] = ld(A,B); //ld A,B
opcodes[ 0x79 ] = ld(A,C); //ld A,C
opcodes[ 0x7A ] = ld(A,D); //ld A,D
opcodes[ 0x7B ] = ld(A,E); //ld A,E
opcodes[ 0x7C ] = ld(A,H); //ld A,H
opcodes[ 0x7D ] = ld(A,L); //ld A,L
opcodes[ 0x7E ] = ld_from_mem(A,H,L); //ld A,(HL)
opcodes[ 0x7F ] = ld(A,A); //ld A,A
opcodes[ 0x80 ] = 
opcodes[ 0x81 ] = 
opcodes[ 0x82 ] = 
opcodes[ 0x83 ] = 
opcodes[ 0x84 ] = 
opcodes[ 0x85 ] = 
opcodes[ 0x86 ] = 
opcodes[ 0x87 ] = 
opcodes[ 0x88 ] = 
opcodes[ 0x89 ] = 
opcodes[ 0x8A ] = 
opcodes[ 0x8B ] = 
opcodes[ 0x8C ] = 
opcodes[ 0x8D ] = 
opcodes[ 0x8E ] = 
opcodes[ 0x8F ] = 
opcodes[ 0x90 ] = 
opcodes[ 0x91 ] = 
opcodes[ 0x92 ] = 
opcodes[ 0x93 ] = 
opcodes[ 0x94 ] = 
opcodes[ 0x95 ] = 
opcodes[ 0x96 ] = 
opcodes[ 0x97 ] = 
opcodes[ 0x98 ] = 
opcodes[ 0x99 ] = 
opcodes[ 0x9A ] = 
opcodes[ 0x9B ] = 
opcodes[ 0x9C ] = 
opcodes[ 0x9D ] = 
opcodes[ 0x9E ] = 
opcodes[ 0x9F ] = 
opcodes[ 0xA0 ] = 
opcodes[ 0xA1 ] = 
opcodes[ 0xA2 ] = 
opcodes[ 0xA3 ] = 
opcodes[ 0xA4 ] = 
opcodes[ 0xA5 ] = 
opcodes[ 0xA6 ] = 
opcodes[ 0xA7 ] = 
opcodes[ 0xA8 ] = 
opcodes[ 0xA9 ] = 
opcodes[ 0xAA ] = 
opcodes[ 0xAB ] = 
opcodes[ 0xAC ] = 
opcodes[ 0xAD ] = 
opcodes[ 0xAE ] = 
opcodes[ 0xAF ] = 
opcodes[ 0xB0 ] = 
opcodes[ 0xB1 ] = 
opcodes[ 0xB2 ] = 
opcodes[ 0xB3 ] = 
opcodes[ 0xB4 ] = 
opcodes[ 0xB5 ] = 
opcodes[ 0xB6 ] = 
opcodes[ 0xB7 ] = 
opcodes[ 0xB8 ] = 
opcodes[ 0xB9 ] = 
opcodes[ 0xBA ] = 
opcodes[ 0xBB ] = 
opcodes[ 0xBC ] = 
opcodes[ 0xBD ] = 
opcodes[ 0xBE ] = 
opcodes[ 0xBF ] = 
opcodes[ 0xC0 ] = 
opcodes[ 0xC1 ] = 
opcodes[ 0xC2 ] = 
opcodes[ 0xC3 ] = 
opcodes[ 0xC4 ] = 
opcodes[ 0xC5 ] = 
opcodes[ 0xC6 ] = 
opcodes[ 0xC7 ] = 
opcodes[ 0xC8 ] = 
opcodes[ 0xC9 ] = 
opcodes[ 0xCA ] = 
opcodes[ 0xCB ] = 
opcodes[ 0xCC ] = 
opcodes[ 0xCD ] = 
opcodes[ 0xCE ] = 
opcodes[ 0xCF ] = 
opcodes[ 0xD0 ] = 
opcodes[ 0xD1 ] = 
opcodes[ 0xD2 ] = 
opcodes[ 0xD3 ] = unused
opcodes[ 0xD4 ] = 
opcodes[ 0xD5 ] = 
opcodes[ 0xD6 ] = 
opcodes[ 0xD7 ] = 
opcodes[ 0xD8 ] = unused
opcodes[ 0xD9 ] = 
opcodes[ 0xDA ] = 
opcodes[ 0xDB ] = 
opcodes[ 0xDC ] = 
opcodes[ 0xDD ] = unused
opcodes[ 0xDE ] = 
opcodes[ 0xDF ] = 
opcodes[ 0xE0 ] = ldh(imm,A); //ld ($FF00+n),A
opcodes[ 0xE1 ] = 
opcodes[ 0xE2 ] = ld(C,A); //ld (C),A
opcodes[ 0xE3 ] = unused
opcodes[ 0xE4 ] = unused
opcodes[ 0xE5 ] = 
opcodes[ 0xE6 ] = 
opcodes[ 0xE7 ] = 
opcodes[ 0xE8 ] = unused
opcodes[ 0xE9 ] = 
opcodes[ 0xEA ] = ld_to_mem_imm(A,imm); //ld (nn),A
opcodes[ 0xEB ] = 
opcodes[ 0xEC ] = unused 
opcodes[ 0xED ] = unused
opcodes[ 0xEE ] = 
opcodes[ 0xEF ] = 
opcodes[ 0xF0 ] = ldh(A,imm); //ld A,($FF00+n)
opcodes[ 0xF1 ] = 
opcodes[ 0xF2 ] = ld(A,C); //ld A,(C)
opcodes[ 0xF3 ] = 
opcodes[ 0xF4 ] = unused
opcodes[ 0xF5 ] = 
opcodes[ 0xF6 ] = 
opcodes[ 0xF7 ] = 
opcodes[ 0xF8 ] = ldhl(); //ldhl SP,n
opcodes[ 0xF9 ] = ld16(HL,SP,HL); //ld SP,HL
opcodes[ 0xFA ] = ld_from_mem_imm(A); //ldd A,(nn)
opcodes[ 0xFB ] = 
opcodes[ 0xFC ] = unused
opcodes[ 0xFD ] = unused
opcodes[ 0xFE ] = 
opcodes[ 0xFF ] = 


