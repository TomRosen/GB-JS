/*Interrupt Enable Register
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
var registar = new Uint8Array(8); //cpu reg

//cpu reg addresses
const A = (1 << 0); //Accumulator register
const F = (1 << 1); //Accumulator flag
const B = (1 << 2); 
const C = (1 << 3); 
const D = (1 << 4); 
const E = (1 << 5); 
const H = (1 << 6); // HL 2 Byte register used to store memory addresses
const L = (1 << 7); // HL 2 Byte register used to store memory addresses

var SP = 0; //stack pointer
var PC = 0; //programm counter

//Bus
function write(addr, data ){
    if(addr >= 0x0000 && addr <= 0xFFFF){
        memory[addr] = data;
    }     
}

function read(addr){
    if(addr >= 0x0000 && addr <= 0xFFFF){
        return memory(addr);
    }
    return 0x00
}

function dec2bin(dec){
    return (dec >>> 0).toString(2);
}
