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

var rom; //ROM data

var cartridgeRAM = new Uint8Array(0x8000); //upto 32kb of switchable RAM
var RAMEnabled = false; //8kb cartridge RAM
var currentRAMBank = 0;
var MBCMode = 0; //MemoryBankController has two modes 16Mbit ROM / 8KByte RAM && 4Mbit ROM / 32KByte RAM
var RAMBankOffset = () => {
	return 0x2000 * (MBCMode ? currentRAMBank : 0) - 0xa000;
};

var currentROMBank = 1;
var ROMBankOffset = () => {
	return 0x4000 * (currentROMBank - 1);
};

//cpu reg addresses
const A = 1 << 0; //Accumulator register
const F = 1 << 1; //Accumulator flag
const B = 1 << 2; //BC 2 Byte register
const C = 1 << 3; //BC 2 Byte register
const D = 1 << 4; //DE 2 Byte register
const E = 1 << 5; //DE 2 Byte register
const H = 1 << 6; //HL 2 Byte register used to store memory addresses
const L = 1 << 7; //HL 2 Byte register used to store memory addresses

var SP = 0xfffe; //stack pointer
var PC = 0x100; //programm counter

var imm = 921; //placeholder for immediate
var spimm = 913;

var flags = {
	Z: false, //Zero flag
	N: false, //Subtract flag
	H: false, //Half Carry flag
	C: false, //Carry flag
	flagByte: function () {
		var byte = 0;
		if (Z == true) byte += 8;
		if (N == true) byte += 4;
		if (H == true) byte += 2;
		if (C == true) byte += 1;
		return byte << 4;
	},
};

var SpecialFlags = {
	// http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf#page=35
	P1: 0xff00, //Register for reading joy pad info and determining system type
	SB: 0xff01, //Serial transfer data
	SC: 0xff02, //SIO Control
	DIV: 0xff04, //Divider Register
	TIMA: 0xff05, //Timer counter
	TMA: 0xff06, //Timer Modulo
	TAC: 0xff07, //Time Control
	IF: 0xff0f, //Interrupt Flag
	NR10: 0xff10, //Sound Mode 1 register, Sweep register
	NR11: 0xff11, //Sound Mode 1 register, Sound length/Wave pattern duty
	NR12: 0xff12, //Sound Mode 1 register, envelope
	NR13: 0xff13, //Sound Mode 1 register, Frequency lo
	NR14: 0xff14, //Sound Mode 1 register, Frequency hi
	NR21: 0xff16, //Sound Mode 2 register, Sound Length; Wave Patter Duty
	NR22: 0xff17, //Sound Mode 2 register, envelope
	NR23: 0xff18, //Sound Mode 2 register, frequency low data
	NR24: 0xff19, //Sound Mode 2 register, frequency hi data
	NR30: 0xff1a, //Sound Mode 3 register, Sound on/off
	NR31: 0xff1b, //Sound Mode 3 register, sound length
	NR32: 0xff1c, //Sound Mode 3 register, Select output level
	NR33: 0xff1d, //Sound Mode 3 register, frequency's lower data
	NR34: 0xff1e, //Sound Mode 3 register, frequency's higher data
	NR41: 0xff20, //Sound Mode 4 register, sound length
	NR42: 0xff21, //Sound Mode 4 regsiter, envolope
	NR43: 0xff22, //Sound Mode 4 Register, polynomial counter
	NR44: 0xff23, //Sound Mode 4 Register counter/consecutive
	NR50: 0xff24, //Channel control / ON-OFF / Volume
	NR51: 0xff25, //Selection of Sound output terminal
	NR52: 0xff26, //Sound on/off
	// 0xFF30-0xFF3F (Wave Pattern RAM)
	LCDC: 0xff40, //LCD Control | Background & Window controll http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf#page=23
	STAT: 0xff41, //LCDC Status
	SCY: 0xff42, //Scroll Y
	SCX: 0xff43, //Scroll X
	LY: 0xff44, //LCDC Y-Coordinate
	LYC: 0xff45, //LY Compare
	DMA: 0xff46, //DMA Transfer and Start Adress
	BGP: 0xff47, //BG & Windows Palette Data
	OBP0: 0xff48, //Object Palette 0 Data
	OBP1: 0xff49, //Object Palette 1 Data
	WY: 0xff4a, //Window Y Position
	WX: 0xff4b, //Window X Position
	IE: 0xffff, //Interrupt Enable
};

function memorybankControll(addr, data) {
	let cartType = memory[0x147];

	switch (cartType) {
		case 0x00: //ROM only
			break;
		case 0x01: //ROM+MBC1
		case 0x02: //ROM+MBC1+RAM
		case 0x03: //ROM+MBC1+RAM+BATT
			if (addr <= 0x1fff) {
				//enable ram if data XXXX1010
				RAMEnabled = (data & 0xf) == 0xa;
			} else if (addr <= 0x3fff) {
				//switch ROM bank
				currentROMBank = (data&0x1f) == 0 ? 1 : data&0x1f;
			} else if (addr <= 0x5fff) {
				//switch RAM bank
				if(MBCMode == 0){
					//stolen from https://github.com/mitxela/swotGB/blob/master/gbjs.htm line 976
					currentROMBank = (currentROMBank&0x1F)|(data<<5);
				} else {
					currentRAMBank = data & 0x3;
				}
			} else {
				//switch MBCMode
				MBCMode = data & 0x1;
			}
			break;
		case 0x05: //ROM+MBC2
		case 0x06: //ROM+MBC2+BATT Has upto 256k RAM without switching ?????
			if (addr <= 0x1fff) {
				if(addr&0x100 == 0) //lsb of upper byte must be 0
					RAMEnabled = (data & 0xf) == 0xa;
			} else if (addr <= 0x3fff) {
				if(addr&0x100 == 0x100) //lsb of upper byte must be 1
					currentROMBank = (data&0x1f) == 0 ? 1 : data&0x1f;	
			}
			break;
		case 0x08: //ROM+RAM
		case 0x09: //ROM+RAM+BATT
			console.log("Don't know how thes card types work");
			break;
		case 0x0b: //ROM+MMM01
		case 0x0c: //ROM+MMM01+SRAM
		case 0x0d: //ROM+MMM01+SRAM+BATT
			console.log("No");
			break;
		case 0x0f: //ROM+MBC3+TIMER+BATT
		case 0x10: //ROM+MBC3+TIMER+RAM+BATT
		case 0x11: //ROM+MBC3
		case 0x12: //ROM+MBC3+RAM
		case 0x13: //ROM+MBC3+RAM+BATT
			if (addr <= 0x1FFF) { //also timer enable
      			RAMEnabled = (data & 0xf) == 0xa;
    		} else if (addr <= 0x3FFF){
				currentROMBank = (data&0x7f) == 0 ? 1 : data&0x7f;
    		} else if (addr<=0x5fff) {
      			if (data < 8) {
        			currentRAMBank=data;
      			} else{ 
       			 //0x08-0x0C map RTC register to RAM space
      			}
    		} else {
      			// 6000-7FFF - Latch Clock Data
				// https://gbdev.gg8.se/wiki/articles/Memory_Bank_Controllers#MBC3_.28max_2MByte_ROM_and.2For_64KByte_RAM_and_Timer.29
    		}
			break;
		case 0x19: //ROM+MBC5
		case 0x1a: //ROM+MBC5+RAM
		case 0x1b: //ROM+MBC5+RAM+BATT
			if (addr <= 0x1FFF) {
      			RAMEnabled = ((data & 0x0F) == 0xA) 
   			} else if(addr <= 0x2FFF){
				currentROMBank = data&0xFF;
			} else if (addr <= 0x3FFF){
      			currentROMBank &= 0xFF;
      			if (data&1) ROMbank+=0x100;
    		} else if (addr<=0x5fff) {
      			currentRAMBank=data&0x0F;
    		}
			break;
		case 0x1c: //ROM+MBC5+RUMBLE
		case 0x1d: //ROM+MBC5+RUMBLE+SRAM
		case 0x1e: //ROM+MBC5+RUMBLE+SRAM+BATT
			console.log("Rumble Cards not handled yet");
			break;
		case 0x1f: //POCKET CAMERA
		case 0xfd: //BANDAI TAMA5
		case 0xfe: //HUDSON HUC-3
		case 0xff: //HUSON HUC-1
		default:
			console.log('Unknown cart type: ' + cartType);
			break;
	}
}

//Bus
function write(addr, data) {
	if (addr < 0x8000) {
		memorybankControll(addr, data);
		return;
	}
	if (addr >= 0xa000 && addr < 0xc000 && RAMEnabled) {
		cartridgeRAM[addr + RAMBankOffset()] = data;
		return;
	}
	//write data to memory
	if (addr >= 0x0000 && addr <= 0xffff) {
		memory[addr] = data;
	}
}

function write16bit(addr, data1, data2) {
	//write 2 Byte to memory
	write(addr, data1);
	write(addr + 1, data2);
}

function read(addr) {
	//return data from memory
	if(addr < 0x4000) return rom[addr];
	if(addr < 0x8000) return rom[addr + ROMBankOffset()];
	if (addr >= 0xa000 && addr < 0xc000)
		return cartridgeRAM[addr + RAMBankOffset()];
	
	if (addr >= 0x0000 && addr <= 0xffff) {
		return memory[addr];
	}
	return 0x00;
}

function dec2bin(dec) {
	return (dec >>> 0).toString(2);
}

function signed(a) {
	if (a > 127) return a - 256;
	else a;
}

//opcode functions
function nop() {
	return () => {
		PC += 1;
		return 4;
	};
}

function ld(a, b) {
	// load from register b to register a
	return () => {
		register[a] = register[b];
		PC += 1;
		return 4;
	};
}

function ld_imm(a) {
	//loads next immediate byte from memory
	return () => {
		register[a] = read(PC + 1);
		PC += 2;
		return 8;
	};
}

function ld_from_mem(a, b, c) {
	//loads from defined memory location
	return () => {
		register[a] = read((register[b] << 8) + register[c]);
		PC += 1;
		return 8;
	};
}

function ld_from_mem_imm(a) {
	//loads from memory location, pointed to by next two bytes
	return () => {
		register[a] = read((read(PC + 2) << 8) + read(PC + 1));
		PC += 3;
		return 16;
	};
}

function ld_to_mem(a, b, c) {
	//write to defined memory location
	return () => {
		write((register[b] << 8) + register[a], register[c]);
		PC += 1;
		return 8;
	};
}

function ld_to_mem_imm(a, b) {
	return () => {
		if (b == imm) {
			//write to next immediate mem location
			write((read(PC + 2) << 8) + read(PC + 1), register[a]);
			PC += 3;
			return 16;
		} else {
			//ld from next immediate byte and write to other mem location
			write((register[b] << 8) + register[a], read(PC + 1));
			PC += 3;
			return 12;
		}
	};
}

function ldac(a, b) {
	return () => {
		if (a == A) {
			//read from (C)
			register[a] == read(0xff00 + register[b]);
			PC += 1;
			return 8;
		} else {
			//write A to (C)
			write(0xff00 + register[a], register[b]);
			PC += 1;
			return 8;
		}
	};
}

function ldd(a, b) {
	//ld decrease
	return () => {
		if (a == HL) {
			//write to (HL)
			write(register[L] + (register[H] << 8), register[b]);
			if (register[L] == 0) register[H] -= 1;
			else register[L] -= 1;
			PC += 1;
			return 8;
		} else {
			//read from (HL)
			register[b] = read(register[L] + (register[H] << 8));
			if (register[L] == 0) register[H] -= 1;
			else register[L] -= 1;
			PC += 1;
			return 8;
		}
	};
}

function ldi(a, b) {
	//ld increase
	return () => {
		if (a == 321) {
			//write to (HL)
			write(register[L] + (register[H] << 8), register[b]);
			if (register[L] == 255) register[H] += 1;
			else register[L] += 1;
			PC += 1;
			return 8;
		} else {
			//read from (HL)
			register[b] = read(register[L] + (register[H] << 8));
			if (register[L] == 255) register[H] += 1;
			else register[L] += 1;
			PC += 1;
			return 8;
		}
	};
}

function ldh(a, b) {
	return () => {
		if (a == imm) {
			//write register to 0xFF00+n
			write(0xff00 + read(PC + 1), register[b]);
			PC += 2;
			return 8;
		} else {
			//read from 0xFF00+n
			register[a] = read(0xff00 + read(PC + 1));
			PC += 2;
			return 8;
		}
	};
}

function ld16(a, b, c) {
	//ld 16-bit
	return () => {
		if (c == imm) {
			//ld n,nn
			register[a] = read(PC + 2);
			register[b] = read(PC + 1);
			PC += 3;
			return 12;
		} else if (c == spimm) {
			if (a == SP && b == spimm) {
				//ld SP,nn
				SP = read(PC + 1) + (read(PC + 2) << 8);
				PC += 3;
				return 12;
			} else {
				//ld (nn),SP
				write((read(PC + 2) << 8) + read(PC + 1), SP & 0xff, SP >>> 8);
				PC += 3;
				return 20;
			}
		} else {
			//ld SP,HL
			SP = regsiter[H] << (8 + register[L]);
			PC = +1;
			return 8;
		}
	};
}

function ldhl() {
	return () => {
		var n = signed(read(PC + 1));
		var spn = SP + n;
		flags.H = (SP & 0xf) + (n & 0xf) >= 0x10 ? true : false;
		flags.C = (SP & 0xff) + (n & 0xff) >= 0x100 ? true : false;
		flags.Z = false;
		flags.N = false;
		PC += 2;
		return 12;
	};
}

function push(a, b) {
	return () => {
		SP -= 1;
		write(SP, a);
		SP -= 1;
		write(SP, b);
		PC += 1;
		return 16;
	};
}

function pop(a, b) {
	return () => {
		register[b] = read(SP);
		SP += 1;
		register[a] = read(SP);
		SP += 1;
		PC += 1;
		return 12;
	};
}

function add(a) {
	//add register n to register A
	return () => {
		register[A] += register[a];
		flags.H = (register[A] & 0xf) + (register[a] & 0xf) >= 0x10 ? true : false;
		flags.C = register[A] + register[a] < register[A] ? true : false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		PC += 1;
		return 4;
	};
}

function add_from_mem(a, b) {
	//add byte from memory to register A
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]);
			regsiter[A] += n;
			PC += 1;
		} else {
			var n = read(PC + 1);
			register[A] += n;
			PC += 2;
		}

		flags.H = (register[A] & 0xf) + (n & 0xf) >= 0x10 ? true : false;
		flags.C = register[A] + n < register[A] ? true : false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		return 8;
	};
}

function adc(a) {
	//add register n + flag C to register A
	return () => {
		var n = register[a] + flags.C;
		register[A] += n;
		flags.H = (register[A] & 0xf) + (n & 0xf) >= 0x10 ? true : false;
		flags.C = register[A] + n < register[A] ? true : false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		PC += 1;
		return 4;
	};
}

function adc_from_mem(a, b) {
	//add memory byte + flag C to register A
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]) + flags.C;
			regsiter[A] += n;
			PC += 1;
		} else {
			var n = read(PC + 1) + flags.C;
			register[A] += n;
			PC += 2;
		}
		flags.H = (register[A] & 0xf) + (n & 0xf) >= 0x10 ? true : false;
		flags.C = register[A] + n < register[A] ? true : false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		return 8;
	};
}

function sub(a) {
	//add register n to register A
	return () => {
		register[A] -= register[a];
		flags.H = (register[A] & 0xf0) - (register[a] & 0xf0) < 0x10 ? true : false;
		flags.C = register[A] - register[a] > register[A] ? true : false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = true;
		PC += 1;
		return 4;
	};
}

function sub_from_mem(a, b) {
	//add byte from memory to register A
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]);
			regsiter[A] -= n;
			PC += 1;
		} else {
			var n = read(PC + 1);
			register[A] -= n;
			PC += 2;
		}

		flags.H = (register[A] & 0xf0) - (n & 0xf0) < 0x10 ? true : false;
		flags.C = register[A] - n > register[A] ? true : false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = true;
		return 8;
	};
}

function sbc(a) {
	//add register n + flag C to register A
	return () => {
		var n = register[a] - flags.C;
		register[A] -= n;
		flags.H = (register[A] & 0xf0) - (n & 0xf0) < 0x10 ? true : false;
		flags.C = register[A] - n > register[A] ? true : false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = true;
		PC += 1;
		return 4;
	};
}

function sbc_from_mem(a, b) {
	//add memory byte + flag C to register A
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]) - flags.C;
			register[A] -= n;
			PC += 1;
		} else {
			var n = read(PC + 1) - flags.C;
			register[A] -= n;
			PC += 2;
		}
		flags.H = (register[A] & 0xf0) - (n & 0xf0) < 0x10 ? true : false;
		flags.C = register[A] - n > register[A] ? true : false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = true;
		return 8;
	};
}

function and(a) {
	return () => {
		register[A] &= register[a];
		flags.H = true;
		flags.C = false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		PC += 1;
		return 4;
	};
}

function and_from_mem(a, b) {
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]);
			regsiter[A] &= n;
			PC += 1;
		} else {
			var n = read(PC + 1);
			register[A] = register[A] & n;
			PC += 2;
		}
		flags.H = true;
		flags.C = false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		return 8;
	};
}

function or(a) {
	return () => {
		register[A] |= register[a];
		flags.H = false;
		flags.C = false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		PC += 1;
		return 4;
	};
}

function or_from_mem(a, b) {
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]);
			regsiter[A] |= n;
			PC += 1;
		} else {
			var n = read(PC + 1);
			register[A] = rregister[A] & n;
			PC += 2;
		}
		flags.H = false;
		flags.C = false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		return 8;
	};
}

function xor(a) {
	return () => {
		register[A] ^= register[a];
		flags.H = false;
		flags.C = false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		PC += 1;
		return 4;
	};
}

function xor_from_mem(a, b) {
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]);
			regsiter[A] ^= n;
			PC += 1;
		} else {
			var n = read(PC + 1);
			register[A] = rregister[A] & n;
			PC += 2;
		}
		flags.H = false;
		flags.C = false;
		flags.Z = register[A] == 0 ? true : false;
		flags.N = false;
		return 8;
	};
}

function cp(a) {
	//add register n to register A
	return () => {
		register[A] -= register[a];
		flags.H = (register[A] & 0xf0) - (register[a] & 0xf0) < 0x10 ? true : false;
		flags.C = register[A] < register[a] ? true : false; //might also need to check for carry
		flags.Z = register[A] == register[a] ? true : false;
		flags.N = true;
		PC += 1;
		return 4;
	};
}

function cp_from_mem(a, b) {
	//add byte from memory to register A
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]);
			regsiter[A] -= n;
			PC += 1;
		} else {
			var n = read(PC + 1);
			register[A] -= n;
			PC += 2;
		}

		flags.H = (register[A] & 0xf0) - (n & 0xf0) < 0x10 ? true : false;
		flags.C = register[A] < n ? true : false;
		flags.Z = register[A] == n ? true : false;
		flags.N = true;
		return 8;
	};
}

function inc(a, b) {
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]);
			n += 1;
			write((register[a] << 8) + register[b], n);
			flags.H = (n & 0xf) + 1 >= 0x10 ? true : false;
			flags.Z = register[a] == 0 ? true : false;
			flags.N = false;
			PC += 1;
			return 12;
		} else {
			register[a] += 1;
			flags.H = (register[a] & 0xf) + 1 >= 0x10 ? true : false;
			flags.Z = register[a] == 0 ? true : false;
			flags.N = false;
			PC += 1;
			return 4;
		}
	};
}

function dec(a, b) {
	return () => {
		if (a == H && b == L) {
			var n = read((register[a] << 8) + register[b]);
			n -= 1;
			write((register[a] << 8) + register[b], n);
			flags.H = (n & 0xf0) - 1 < 0x10 ? true : false;
			flags.Z = register[a] == 0 ? true : false;
			flags.N = true;
			PC += 1;
			return 12;
		} else {
			register[a] -= 1;
			flags.H = (register[a] & 0xf0) - 1 < 0x10 ? true : false;
			flags.Z = register[a] == 0 ? true : false;
			flags.N = true;
			PC += 1;
			return 4;
		}
	};
}

function add16(a, b, c) {
	return () => {
		if (c == spimm) {
			flags.H = (SP & 0xfff) + read(PC + 1) >= 0x1000 ? true : false;
			flags.C = SP < SP + read(PC + 1) ? true : false;
			flags.Z = false;
			flags.N = false;
			PC += 2;
			return 16;
		} else if (a == SP) {
			var m = (register[H] << 8) + register[L];
			var mn = m + SP;
			register[H] = mn >>> 8;
			register[L] = mn;
			flags.H = (m & 0xfff) + (SP & 0xfff) >= 0x1000 ? true : false;
			flags.C = mn < m ? true : false;
			flags.N = false;
			PC += 1;
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
			PC += 1;
			return 8;
		}
	};
}

function inc16(a, b) {
	return () => {
		if (a == SP && b == null) {
			SP += 1;
			PC += 1;
			return 8;
		} else {
			var m = (register[a] << 8) + register[b] + 1;
			register[a] = m >>> 8;
			register[b] = m;
			PC += 1;
			return 8;
		}
	};
}

function dec16(a, b) {
	return () => {
		if (a == SP && b == null) {
			SP -= 1;
			PC += 1;
			return 8;
		} else {
			var m = (register[a] << 8) + register[b] - 1;
			register[a] = m >>> 8;
			register[b] = m;
			PC += 1;
			return 8;
		}
	};
}

function swap(a) {
	return () => {
		if (a == 321) {
			//swap at location (HL)
			var m = read((register[H] << 8) + register[L]);
			n = (m << (4 + m)) >>> 4;
			write((register[H] << 8) + register[L], n);
			flags.Z = n == 0 ? true : false;
			flags.N = false;
			flags.H = false;
			flags.C = false;
			PC += 1;
			return 16;
		} else {
			var m = register[a] >>> 4;
			register[a] = register << (4 + m);
			flags.Z = register[a] == 0 ? true : false;
			flags.N = false;
			flags.H = false;
			flags.C = false;
			PC += 1;
			return 8;
		}
	};
}

function daa() {
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

		PC += 1;
		return 4;
	};
}

function cpl() {
	//Complement register A
	return () => {
		register[A] = register[A] ^ 0xff;

		flags.N = true;
		flags.H = true;

		PC += 1;
		return 4;
	};
}

function ccf() {
	//Complement C Flag
	return () => {
		flags.N = false;
		flags.H = false;

		flags.C = !flags.C;

		PC += 1;
		return 4;
	};
}

function scf() {
	//Set C Flag
	return () => {
		flags.N = false;
		flags.H = false;

		flags.C = true;

		PC += 1;
		return 4;
	};
}

function rl(a, c, rla) {
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
		PC += 1;
		let r = rla == true ? 4 : 8;
		return r;
	};
}

function rl_from_mem(a, b, c) {
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
		PC += 1;
		return 16;
	};
}

function rr(a, c, rla) {
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

		PC += 1;
		let r = rla == true ? 4 : 8;
		return r;
	};
}

function rr_from_mem(a, b, c) {
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

		PC += 1;
		return 16;
	};
}

function sl(a) {
	return () => {
		flags.C = register[a] && 0x80 == 0x80 ? true : false; //move bit 7 to C flag
		register[a] = regsiter[a] << 1;

		flags.N = false;
		flags.H = false;
		flags.Z = register[a] == 0 ? true : false;

		PC += 1;
		return 8;
	};
}

function sl_from_mem(a, b) {
	return () => {
		var n = read((register[a] << 8) + register[b]);
		flags.C = n && 0x80 == 0x80 ? true : false; //move bit 7 to C flag
		n = n << 1;

		flags.N = false;
		flags.H = false;
		flags.Z = n == 0 ? true : false;
		write((register[a] << 8) + register[b], n);

		PC += 1;
		return 16;
	};
}

function sr(a, fbz) {
	//fbz = first bit to zero
	return () => {
		flags.C = n && 0x1 == 0x1 ? true : false; //move bit 0 to C flag
		if (fbz == true) register[a] = register[a] >>> 1;
		else register[a] = register[a] >> 1;

		flags.N = false;
		flags.H = false;
		flags.Z = register[a] == 0 ? true : false;

		PC += 1;
		return 8;
	};
}

function sr_from_mem(a, b, fbz) {
	return () => {
		var n = read((register[a] << 8) + register[b]);
		flags.C = n && 0x1 == 0x1 ? true : false; //move bit 0 to C flag
		if (fbz == true) n = n >>> 1;
		else n = n >> 1;

		flags.N = false;
		flags.H = false;
		flags.Z = n == 0 ? true : false;
		write((register[a] << 8) + register[b], n);

		PC += 1;
		return 16;
	};
}

function bit(bit, a) {
	//bit to test
	return () => {
		flags.Z = register[a] && 0x1 << bit == 0x1 << bit ? false : true;

		flags.N = false;
		flags.H = true;

		PC += 1;
		return 8;
	};
}

function bit_from_mem(bit, a, b) {
	return () => {
		var n = read((register[a] << 8) + register[b]);
		flags.Z = n && 0x1 << bit == 0x1 << bit ? false : true;

		flags.N = false;
		flags.H = true;

		PC += 1;
		return 16;
	};
}

function set(bit, a) {
	//set bit b in flag
	return () => {
		let m = 0x1 << bit;
		register[a] |= m;

		PC += 1;
		return 8;
	};
}

function set_from_mem(bit, a, b) {
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

function res(bit, a) {
	//reset bit b in flag
	return () => {
		let m = 0x1 << bit;
		register[a] &= ~m;

		PC += 1;
		return 8;
	};
}

function res_from_mem(bit, a, b) {
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

function jump_from_mem_imm(con) {
	//Jump to address (nn) if condition con
	return () => {
		if (con || con == null) {
			PC = (read(PC + 2) << 8) + read(PC + 1);
		} else {
			PC += 3;
		}

		return 12;
	};
}

function jump_hl() {
	// Jump to address in HL
	return () => {
		PC = (register[a] << 8) + register[b];

		return 4;
	};
}

function jump_add_imm(con) {
	//Add imm byte to curr addr and jump to it
	return () => {
		if (con || con == null) {
			PC += read(PC + 1);
		} else {
			PC += 2;
		}

		return 8;
	};
}

function call(con) {
	//Push address of next instruction onto stack and then jump to address nn.
	return () => {
		if (con || con == null) {
			SP -= 2;
			writeMem16(SP, (PC + 3) >> 8, (PC + 3) & 0xff); // maybe write upper lower nibble as one byte?
			PC = (read(PC + 2) << 8) + read(PC + 1);
		} else {
			PC += 3;
		}

		return 12;
	};
}

function rst(start) {
	//Push current addr to stack and jump to start
	return () => {
		SP -= 2;
		writeMem16(SP, (PC + 1) >> 8, (PC + 1) & 0xff); // maybe write upper lower nibble as one byte?
		PC = start;
		return 32;
	};
}

function ret(con) {
	//Pop two bytes from stack & jump to that address
	return () => {
		if (con || con == null) {
			let a = readMem16(SP);
			SP += 2;
			PC = (a[0] << 8) + a[1];
		}

		return 8;
	};
}

function unused() {
	return 4;
}

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
opcodes[0x08] = ld16(SP, SP, spimm); //ld (nn),SP
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
opcodes[0x18] = jump_add_imm(null); //JR n
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
opcodes[0x31] = ld(SP, spimm, spimm); //ld SP,nn
opcodes[0x32] = ldd(321, A); //ld (HL-),A
opcodes[0x33] = inc16(SP, null); //inc SP
opcodes[0x34] = inc(H, L); //inc (HL)
opcodes[0x35] = dec(H, L); //dec (HL)
opcodes[0x36] = ld_to_mem_imm(H, L); //ld (HL),n
opcodes[0x37] = scf(); //scf
opcodes[0x38] = jump_add_imm(flags.C); //JR C,*
opcodes[0x39] = add16(SP, SP, null); //add SP,HL
opcodes[0x3a] = ldd(A, 321); //ld A,(HL-)
opcodes[0x3b] = dec16(SP, null); //dec SP
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
opcodes[0x76] = 0; //https://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf#page=97
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
opcodes[0xc3] = jump_from_mem_imm(null); // jp nn
opcodes[0xc4] = call(!flags.Z); // call NZ,nn
opcodes[0xc5] = push(B, C); //push BC
opcodes[0xc6] = add_from_mem(A, imm); //add A,#
opcodes[0xc7] = rst(0x00); //rst 00H
opcodes[0xc8] = ret(flags.Z); //ret Z
opcodes[0xc9] = ret(null); //ret
opcodes[0xca] = jump_from_mem_imm(flags.Z); // jp Z,nn
opcodes[0xcb] = function () {
	return CBcodes[readMem(++PC)]();
}; //prefix cb
opcodes[0xcc] = call(flags.Z); // call Z,nn
opcodes[0xcd] = call(null); // call nn
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
opcodes[0xd9] = 0; //#page=118
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
opcodes[0xe8] = add16(SP, SP, spimm); //add SP,#
opcodes[0xe9] = jump_hl(); //JP (HL)
opcodes[0xea] = ld_to_mem_imm(A, imm); //ld (nn),A
opcodes[0xeb] = unused;
opcodes[0xec] = unused;
opcodes[0xed] = unused;
opcodes[0xee] = xor(A, imm); //xor #
opcodes[0xef] = rst(0x28); //rst 28H
opcodes[0xf0] = ldh(A, imm); //ld A,($FF00+n)
opcodes[0xf1] = pop(A, F); //pop AF
opcodes[0xf2] = ldac(A, C); //ld A,($FF00+C)
opcodes[0xf3] = 0; //https://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf#page=98
opcodes[0xf4] = unused;
opcodes[0xf5] = push(A, F); //push AF
opcodes[0xf6] = or_from_mem(A, imm); //or #
opcodes[0xf7] = rst(0x30); //rst 30H
opcodes[0xf8] = ldhl(); //ldhl SP,n
opcodes[0xf9] = ld16(null, SP, null); //ld SP,HL
opcodes[0xfa] = ld_from_mem_imm(A); //ldd A,(nn)
opcodes[0xfb] = 0; //https://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf#page=98
opcodes[0xfc] = unused;
opcodes[0xfd] = unused;
opcodes[0xfe] = cp(A, imm); //cp #
opcodes[0xff] = rst(0x38); //rst 38H

/*
    Todo:   halt() --> interrupt
            stop() --> clock
            di() --> interrupts 
            ei() --> interrupts
*/

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

function cpu() {
	let running = false;
	let cycles = 0;
	if (running) {
		cycles = cbcodes[read(PC)]();
	}
}

var openFile = function (event) {
	var input = event.target;

	var reader = new FileReader();
	reader.onloadend = function (evt) {
		if (evt.target.readyState === FileReader.DONE) {
			rom = new Uint8Array(reader.result);
			for (var i = 0; i < rom.length; i++) {}
			for (let j = 260; j<= 307; j++ ){
				console.log(rom[j].toString(16));
				
			}

			currentROMBank = 0;
			currentRAMBank, MBCMode = 0;
			RAMEnabled = false;
			
		}
	};
	reader.readAsArrayBuffer(input.files[0]);
};

var canvasCtx = document.getElementById('screen').getContext('2D');

var cImgData = canvasCtx.getImageData(0,0,160,144);

