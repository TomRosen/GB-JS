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
const A = 0; 
const F = 1; 
const B = 2; 
const C = 3; 
const D = 4; 
const E = 5; 
const H = 6; 
const L = 7; 

//Bus

function write(addr, data ){
    memory[addr] = data;
}

function read(addr){
    return memory(addr);
}

function dec2bin(dec){
    return (dec >>> 0).toString(2);
}
