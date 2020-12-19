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
    PC += 1;
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
    PC += 2;
    return 12;
}

function push(a,b){
    SP -= 1;
    write(SP,a);
    SP -= 1;
    write(SP,b);
    PC += 1;
    return 16;
}

function pop(a,b){
    register[b] = read(SP);
    SP += 1;
    register[a] = read(SP);
    SP += 1;
    PC += 1;
    return 12;
}

function add(a){ //add register n to register A
    register[A] += register[a];
    flags.H = (((register[A]&0xF)+(register[a]&0xF))>=0x10) ? (true) : (false);
    flags.C = ((register[A]+register[a])<register[A]) ? (true) : (false);
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    PC += 1;
    return 4;
}

function add_from_mem(a,b){ //add byte from memory to register A
    if(a==H && b==L){
        var n = read( (register[a]<<8) + register[b]);
        regsiter[A] +=  n;
        PC += 1;
    }else{
        var n = read(PC+1);
        register[A] += n;
        PC += 2;
    }
    
    flags.H = (((register[A]&0xF)+(n&0xF))>=0x10) ? (true) : (false);
    flags.C = ((register[A]+n)<register[A]) ? (true) : (false);
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    return 8;
}

function adc(a){ //add register n + flag C to register A
    var n = register[a] + flags.C;
    register[A] += n;
    flags.H = (((register[A]&0xF)+(n&0xF))>=0x10) ? (true) : (false);
    flags.C = ((register[A]+n)<register[A]) ? (true) : (false);
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    PC += 1;
    return 4;
}

function adc_from_mem(a,b){ //add memory byte + flag C to register A
    if(a==H && b==L){
        var n = read( (register[a]<<8) + register[b]) + flags.C;
        regsiter[A] +=  n;
        PC += 1;
    }else{
        var n = read(PC+1) + flags.C;
        register[A] += n;
        PC += 2;
    }
    flags.H = (((register[A]&0xF)+(n&0xF))>=0x10) ? (true) : (false);
    flags.C = ((register[A]+n)<register[A]) ? (true) : (false);
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    return 8;
}

function sub(a){ //add register n to register A
    register[A] -= register[a];
    flags.H = (((register[A]&0xF0)-(register[a]&0xF0))<0x10) ? (true) : (false);
    flags.C = ((register[A]-register[a])>register[A]) ? (true) : (false);
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = true;
    PC += 1;
    return 4;
}

function sub_from_mem(a,b){ //add byte from memory to register A
    if(a==H && b==L){
        var n = read( (register[a]<<8) + register[b]);
        regsiter[A] -=  n;
        PC += 1;
    }else{
        var n = read(PC+1);
        register[A] -= n;
        PC += 2;
    }
    
    flags.H = (((register[A]&0xF0)-(n&0xF0))<0x10) ? (true) : (false);
    flags.C = ((register[A]-n)>register[A]) ? (true) : (false);
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = true;
    return 8;
}

function sbc(a){ //add register n + flag C to register A
    var n = register[a] - flags.C;
    register[A] -= n;
    flags.H = (((register[A]&0xF0)-(n&0xF0))<0x10) ? (true) : (false);
    flags.C = ((register[A]-n)>register[A]) ? (true) : (false);
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = true;
    PC += 1;
    return 4;
}

function sbc_from_mem(a,b){ //add memory byte + flag C to register A
    if(a==H && b==L){
        var n = read( (register[a]<<8) + register[b]) - flags.C;
        regsiter[A] -=  n;
        PC += 1;
    }else{
        var n = read(PC+1) - flags.C;
        register[A] -= n;
        PC += 2;
    }
    flags.H = (((register[A]&0xF0)-(n&0xF0))<0x10) ? (true) : (false);
    flags.C = ((register[A]-n)>register[A]) ? (true) : (false);
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = true;
    return 8;
}

function and(a){
    register[A] &= register[a];
    flags.H = true;
    flags.C = false;
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    PC += 1;
    return 4;
}

function and_from_mem(a,b){
    if(a==H && b==L){
        var n = read( (register[a]<<8) + register[b]);
        regsiter[A] &= n;
        PC += 1;
    }else{
        var n = read(PC+1);
        register[A] = rregister[A]&n;
        PC += 2;
    }
    flags.H = true;
    flags.C = false;
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    return 8;
}

function or(a){
    register[A] |= register[a];
    flags.H = false;
    flags.C = false;
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    PC += 1;
    return 4;
}

function or_from_mem(a,b){
    if(a==H && b==L){
        var n = read( (register[a]<<8) + register[b]);
        regsiter[A] |= n;
        PC += 1;
    }else{
        var n = read(PC+1);
        register[A] = rregister[A]&n;
        PC += 2;
    }
    flags.H = false;
    flags.C = false;
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    return 8;
}

function xor(a){
    register[A] ^= register[a];
    flags.H = false;
    flags.C = false;
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    PC += 1;
    return 4;
}

function xor_from_mem(a,b){
    if(a==H && b==L){
        var n = read( (register[a]<<8) + register[b]);
        regsiter[A] ^= n;
        PC += 1;
    }else{
        var n = read(PC+1);
        register[A] = rregister[A]&n;
        PC += 2;
    }
    flags.H = false;
    flags.C = false;
    flags.Z = (register[A] == 0) ? (true) : (false);
    flags.N = false;
    return 8;
}

function cp(a){ //add register n to register A
    register[A] -= register[a];
    flags.H = (((register[A]&0xF0)-(register[a]&0xF0))<0x10) ? (true) : (false);
    flags.C = (register[A] < register[a]) ? (true) : (false);
    flags.Z = (register[A] == register[a]) ? (true) : (false);
    flags.N = true;
    PC += 1;
    return 4;
}

function cp_from_mem(a,b){ //add byte from memory to register A
    if(a==H && b==L){
        var n = read( (register[a]<<8) + register[b]);
        regsiter[A] -=  n;
        PC += 1;
    }else{
        var n = read(PC+1);
        register[A] -= n;
        PC += 2;
    }
    
    flags.H = (((register[A]&0xF0)-(n&0xF0))<0x10) ? (true) : (false);
    flags.C = (register[A] < n) ? (true) : (false);
    flags.Z = (register[A] == n) ? (true) : (false);
    flags.N = true;
    return 8;
}

function inc(a,b){
    if(a == H && b == L){
        var n = read( (register[a]<<8) + register[b]);
        n += 1;
        write((register[a]<<8) + register[b], n);
        flags.H = (((n&0xF)+1)>=0x10) ? (true) : (false);
        flags.Z = (register[a] == 0) ? (true) : (false);
        flags.N = false;
        PC += 1;
        return 12;
    }else{
        register[a] += 1; 
        flags.H = (((register[a]&0xF)+1)>=0x10) ? (true) : (false);
        flags.Z = (register[a] == 0) ? (true) : (false);
        flags.N = false;
        PC += 1
        return 4;
    }
}

function dec(a,b){
    if(a == H && b == L){
        var n = read( (register[a]<<8) + register[b]);
        n -= 1;
        write((register[a]<<8) + register[b], n);
        flags.H = (((n&0xF0)-1)<0x10) ? (true) : (false);
        flags.Z = (register[a] == 0) ? (true) : (false);
        flags.N = true;
        PC += 1;
        return 12;
    }else{
        register[a] -= 1; 
        flags.H = (((register[a]&0xF0)-1)<0x10) ? (true) : (false);
        flags.Z = (register[a] == 0) ? (true) : (false);
        flags.N = true;
        PC += 1
        return 4;
    }  
}

function add16(a,b,c){
    if(c == spimm){
        flags.H = (((SP&0xFFF)+read(PC+1))>=0x1000) ? (true) : (false);
        flags.C = (SP < SP+read(PC+1)) ? (true) : (false);
        flags.Z = false;
        flags.N = false;
        PC += 2;
        return 16;
    }else if(a == SP){
        var m = (register[H]<<8) + register[L];; 
        var mn = m + SP
        register[H] = mn>>8;
        register[L] = mn;
        flags.H = (((m&0xFFF)+(SP&0xFFF))>=0x1000) ? (true) : (false);
        flags.C = (mn < m) ? (true) : (false);
        flags.N = false;
        PC += 1;
        return 8;
    }else{
        var m = (register[H]<<8) + register[L];
        var n = (register[a]<<8) + register[b]; 
        var mn = m + n
        register[H] = mn>>8;
        register[L] = mn;
        flags.H = (((m&0xFFF)+(n&0xFFF))>=0x1000) ? (true) : (false);
        flags.C = (mn < m) ? (true) : (false);
        flags.N = false;
        PC += 1;
        return 8;
    }
}

function inc16(a,b){
    if(a == S && b == P){
        SP += 1;
        PC += 1;
        return 8;
    }else{
        var m = ((register[a]<<8) + register[b])+1;
        register[a] = m>>8;
        register[b] = m;
        PC += 1;
        return 8;
    }   
}

function dec16(a,b){
    if(a == S && b == P){
        SP -= 1;
        PC += 1;
        return 8;
    }else{
        var m = ((register[a]<<8) + register[b])-1;
        register[a] = m>>8;
        register[b] = m;
        PC += 1;
        return 8;
    }   
}

function swap(a){
    if(a == HL){
        var m = read((register[H]<<8) + register[L]);
        n = m<<4 + m>>4;
        write((register[H]<<8) + register[L],n)
        flags.Z = (n == 0) ? (true) : (false);
        flags.N = false;
        flags.H = false;
        flags.C = false;
        PC += 1;
        return 8;
    }else{
        var m = register[a]>>4;
        register[a] = register<<4 + m;
        flags.Z = (register[a] == 0) ? (true) : (false);
        flags.N = false;
        flags.H = false;
        flags.C = false;
        PC += 1;
        return 8;
    }
}


//opcode array
opcodes = new Uint8Array(0x1000);

opcodes[ 0x00 ] = nop(4); //NOP
opcodes[ 0x01 ] = ld16(B,C,imm); //ld BC,nn
opcodes[ 0x02 ] = ld_to_mem(B,C,A); //ld (BC),A
opcodes[ 0x03 ] = inc16(B,C); //inc BC
opcodes[ 0x04 ] = inc(B,B); //inc B
opcodes[ 0x05 ] = dec(B,B); //dec B
opcodes[ 0x06 ] = ld_imm(B); //ld B,n
opcodes[ 0x07 ] = 
opcodes[ 0x08 ] = ld16(SP,SP,spimm); //ld (nn),SP
opcodes[ 0x09 ] = add16(B,C,HL); //add HL,BC
opcodes[ 0x0A ] = ld_from_mem(A,B,C); //ld A,(BC)
opcodes[ 0x0B ] = dec16(B,C); //dec BC
opcodes[ 0x0C ] = inc(C,C); //inc C 
opcodes[ 0x0D ] = dec(C,C); //dec C
opcodes[ 0x0E ] = ld_imm(C); //ld C,n
opcodes[ 0x0F ] = 
opcodes[ 0x10 ] = 
opcodes[ 0x11 ] = ld16(D,E,imm); //ld DE,nn
opcodes[ 0x12 ] = ld_to_mem(D,E,A); //ld (DE),A
opcodes[ 0x13 ] = inc16(D,E); //inc DE
opcodes[ 0x14 ] = inc(D,D); //inc D
opcodes[ 0x15 ] = dec(D,D); //dec D
opcodes[ 0x16 ] = ld_imm(D); //ld D,n
opcodes[ 0x17 ] = 
opcodes[ 0x18 ] = 
opcodes[ 0x19 ] = add16(D,E,HL); //add HL,DE
opcodes[ 0x1A ] = ld_from_mem(A,D,E); //ld A,(DE)
opcodes[ 0x1B ] = dec16(D,E); //dec DE
opcodes[ 0x1C ] = inc(E,E); //inc E
opcodes[ 0x1D ] = dec(E,E); //dec E
opcodes[ 0x1E ] = ld_imm(E); //ld E,n
opcodes[ 0x1F ] = 
opcodes[ 0x20 ] = 
opcodes[ 0x21 ] = ld16(H,L,imm); //ld HL,nn
opcodes[ 0x22 ] = ldi(HL,A); //ld (HL+),A
opcodes[ 0x23 ] = inc16(H,L); //inc HL
opcodes[ 0x24 ] = inc(H,H); //inc H
opcodes[ 0x25 ] = dec(H,H); //dec H
opcodes[ 0x26 ] = ld_imm(H); //ld H,n
opcodes[ 0x27 ] = 
opcodes[ 0x28 ] = 
opcodes[ 0x29 ] = add16(H,L,HL); //add HL,HL
opcodes[ 0x2A ] = ldi(A,HL); //ld A,(HL+)
opcodes[ 0x2B ] = dec16(H,L); //dec HL
opcodes[ 0x2C ] = inc(L,L); //inc L
opcodes[ 0x2D ] = dec(L,L); //dec L
opcodes[ 0x2E ] = ld_imm(L); //ld L,n
opcodes[ 0x2F ] = 
opcodes[ 0x30 ] = 
opcodes[ 0x31 ] = ld(SP,spimm,spimm); //ld SP,nn
opcodes[ 0x32 ] = ldd(HL,A); //ld (HL-),A
opcodes[ 0x33 ] = inc16(S,P); //inc SP
opcodes[ 0x34 ] = inc(H,L) //inc (HL)
opcodes[ 0x35 ] = dec(H,L); //dec (HL)
opcodes[ 0x36 ] = ld_to_mem_imm(H,L); //ld (HL),n
opcodes[ 0x37 ] = 
opcodes[ 0x38 ] = 
opcodes[ 0x39 ] = add16(SP,SP,HL); //add SP,HL
opcodes[ 0x3A ] = ldd(A,HL); //ld A,(HL-)
opcodes[ 0x3B ] = dec16(S,P); //dec SP
opcodes[ 0x3C ] = inc(A,A); //inc A
opcodes[ 0x3D ] = dec(A,A); //dec A
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
opcodes[ 0x80 ] = add(B); //add A,B
opcodes[ 0x81 ] = add(C); //add A,C
opcodes[ 0x82 ] = add(D); //add A,D
opcodes[ 0x83 ] = add(E); //add A,E
opcodes[ 0x84 ] = add(H); //add A,H
opcodes[ 0x85 ] = add(L); //add A,L
opcodes[ 0x86 ] = add_from_mem(H,L); //add A,(HL)
opcodes[ 0x87 ] = add(A); //add A,A
opcodes[ 0x88 ] = adc(B); //adc A,B
opcodes[ 0x89 ] = adc(C); //adc A,C
opcodes[ 0x8A ] = adc(D); //adc A,D
opcodes[ 0x8B ] = adc(E); //adc A,E
opcodes[ 0x8C ] = adc(H); //adc A,H
opcodes[ 0x8D ] = adc(L); //adc A,L
opcodes[ 0x8E ] = adc_from_mem(H,L); //adc A,(HL)
opcodes[ 0x8F ] = adc(A); //adc A,A
opcodes[ 0x90 ] = sub(B); //sub B
opcodes[ 0x91 ] = sub(C); //sub C
opcodes[ 0x92 ] = sub(D); //sub D
opcodes[ 0x93 ] = sub(E); //sub E
opcodes[ 0x94 ] = sub(H); //sub H
opcodes[ 0x95 ] = sub(L); //sub L
opcodes[ 0x96 ] = sub_from_mem(H,L); //sub (HL)
opcodes[ 0x97 ] = sub(A); // sub A
opcodes[ 0x98 ] = sbc(B); //sbc A,B
opcodes[ 0x99 ] = sbc(C); //sbc A,C
opcodes[ 0x9A ] = sbc(D); //sbc A,D
opcodes[ 0x9B ] = sbc(E); //sbc A,E
opcodes[ 0x9C ] = sbc(H); //sbc A,H
opcodes[ 0x9D ] = sbc(L); //sbc A,L
opcodes[ 0x9E ] = sbc_from_mem(H,L); //sbc A,(HL)
opcodes[ 0x9F ] = sbc(A); //sbc A,A
opcodes[ 0xA0 ] = and(B); //and B
opcodes[ 0xA1 ] = and(C); //and C
opcodes[ 0xA2 ] = and(D); //and D
opcodes[ 0xA3 ] = and(E); //and E
opcodes[ 0xA4 ] = and(H); //and H
opcodes[ 0xA5 ] = and(L); //and L
opcodes[ 0xA6 ] = and_from_mem(H,L); //and (HL)
opcodes[ 0xA7 ] = and(A); //and A
opcodes[ 0xA8 ] = xor(B); //xor B
opcodes[ 0xA9 ] = xor(C); //xor C
opcodes[ 0xAA ] = xor(D); //xor D
opcodes[ 0xAB ] = xor(E); //xor E
opcodes[ 0xAC ] = xor(H); //xor H
opcodes[ 0xAD ] = xor(L); //xor L
opcodes[ 0xAE ] = xor_from_mem(H,L); //xor (HL)
opcodes[ 0xAF ] = xor(A); //xor A
opcodes[ 0xB0 ] = or(B); //or B
opcodes[ 0xB1 ] = or(C); //or C
opcodes[ 0xB2 ] = or(D); //or D
opcodes[ 0xB3 ] = or(E); //or E
opcodes[ 0xB4 ] = or(H); //or H
opcodes[ 0xB5 ] = or(L); //or L
opcodes[ 0xB6 ] = or_from_mem(H,L); //or (HL)
opcodes[ 0xB7 ] = or(A); //or A
opcodes[ 0xB8 ] = cp(B); //cp B
opcodes[ 0xB9 ] = cp(C); //cp C
opcodes[ 0xBA ] = cp(D); //cp D
opcodes[ 0xBB ] = cp(E); //cp E
opcodes[ 0xBC ] = cp(H); //cp H
opcodes[ 0xBD ] = cp(L); //cp L
opcodes[ 0xBE ] = cp_from_mem(H,L); //cp (HL)
opcodes[ 0xBF ] = cp(A); //cp A
opcodes[ 0xC0 ] = 
opcodes[ 0xC1 ] = pop(B,C); //pop BC
opcodes[ 0xC2 ] = 
opcodes[ 0xC3 ] = 
opcodes[ 0xC4 ] = 
opcodes[ 0xC5 ] = push(B,C); //push BC
opcodes[ 0xC6 ] = add_from_mem(A,imm); //add A,#
opcodes[ 0xC7 ] = 
opcodes[ 0xC8 ] = 
opcodes[ 0xC9 ] = 
opcodes[ 0xCA ] = 
opcodes[ 0xCB ] = 
opcodes[ 0xCC ] = 
opcodes[ 0xCD ] = 
opcodes[ 0xCE ] = adc_from_mem(A,imm); //adc A,#
opcodes[ 0xCF ] = 
opcodes[ 0xD0 ] = 
opcodes[ 0xD1 ] = pop(D,E); //pop DE
opcodes[ 0xD2 ] = 
opcodes[ 0xD3 ] = unused
opcodes[ 0xD4 ] = 
opcodes[ 0xD5 ] = push(D,E); //push DE
opcodes[ 0xD6 ] = sub_from_mem(A,imm); //sub #
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
opcodes[ 0xE1 ] = pop(H,L); //pop HL
opcodes[ 0xE2 ] = ld(C,A); //ld (C),A
opcodes[ 0xE3 ] = unused
opcodes[ 0xE4 ] = unused
opcodes[ 0xE5 ] = push(H,L); //push HL
opcodes[ 0xE6 ] = and_from_mem(A,imm); //and #
opcodes[ 0xE7 ] = 
opcodes[ 0xE8 ] = add16(SP,SP,spimm); //add SP,#
opcodes[ 0xE9 ] = 
opcodes[ 0xEA ] = ld_to_mem_imm(A,imm); //ld (nn),A
opcodes[ 0xEB ] = 
opcodes[ 0xEC ] = unused 
opcodes[ 0xED ] = unused
opcodes[ 0xEE ] = xor(A,imm); //xor # 
opcodes[ 0xEF ] = 
opcodes[ 0xF0 ] = ldh(A,imm); //ld A,($FF00+n)
opcodes[ 0xF1 ] = pop(A,F); //pop AF
opcodes[ 0xF2 ] = ld(A,C); //ld A,(C)
opcodes[ 0xF3 ] = 
opcodes[ 0xF4 ] = unused
opcodes[ 0xF5 ] = push(A,F); //push AF
opcodes[ 0xF6 ] = or_from_mem(A,imm); //or #
opcodes[ 0xF7 ] = 
opcodes[ 0xF8 ] = ldhl(); //ldhl SP,n
opcodes[ 0xF9 ] = ld16(HL,SP,HL); //ld SP,HL
opcodes[ 0xFA ] = ld_from_mem_imm(A); //ldd A,(nn)
opcodes[ 0xFB ] = 
opcodes[ 0xFC ] = unused
opcodes[ 0xFD ] = unused
opcodes[ 0xFE ] = cp(A,imm); //cp #
opcodes[ 0xFF ] = 

cbcodes = new Uint8Array(0x1000)

cbcodes[ 0x30 ] =
cbcodes[ 0x31 ] =
cbcodes[ 0x32 ] =
cbcodes[ 0x33 ] =
cbcodes[ 0x34 ] =
cbcodes[ 0x35 ] =
cbcodes[ 0x36 ] =
cbcodes[ 0x37 ] =
