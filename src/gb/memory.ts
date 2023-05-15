let memory: Uint8Array = new Uint8Array(0x10000);
let cartridgeRAM: Uint8Array = new Uint8Array(0x8000); //upto 32kb of switchable RAM

let RAMEnabled = false; //8kb cartridge RAM
let currentRAMBank = 0;
let MBCMode = 0; //MemoryBankController 1 has two modes 16Mbit ROM / 8KByte RAM && 4Mbit ROM / 32KByte RAM
let RAMBankOffset = () => {
  return 0x2000 * (MBCMode ? currentRAMBank : 0) - 0xa000;
};

let currentROMBank = 1;
let ROMBankOffset = () => {
  return (0x4000 * (currentROMBank - 1)) % rom.length;
};

export function read(addr: number): number {
  // if (addr < 0x100) return bootCode[addr];
  if (addr < 0x4000) return rom[addr]; // 16KB ROM bank #0
  if (addr < 0x8000) return rom[addr + ROMBankOffset()]; // 16KB switchable ROM bank
  if (addr >= 0xa000 && addr < 0xc000)
    // 8KB switchable RAM bank
    return cartridgeRAM[addr + RAMBankOffset()];
  if (addr >= 0xe000 && addr < 0xfe00) {
    // echo RAM
    console.log("read from echo");
    return memory[addr - 0x1fff];
  }

  if (addr >= 0x0000 && addr <= 0xffff) {
    return memory[addr];
  }
  return 0x00;
}

export function write(addr: number, data: number): void {
  if (addr < 0x8000) {
    // memory bank controller
    memorybankControll(addr, data);
    return;
  }
  if (addr >= 0xa000 && addr < 0xc000 && RAMEnabled) {
    // 8KB switchable RAM bank
    cartridgeRAM[addr + RAMBankOffset()] = data;
    return;
  }
  if (addr >= 0xe000 && addr < 0xfe00) {
    // echo RAM
    console.log("write to echo");
    memory[addr - 0x1fff] = data;
    return;
  }
  if (addr == 0xff07) {
    // timer control
    timerScaler = [1024, 16, 64, 256][data & 0x3];
    timerRegisterCounter = timerScaler;
    memory[addr] = data;
    return;
  }

  if (addr >= 0x0000 && addr <= 0xffff) {
    memory[addr] = data;
  }
}

export function write16bit(addr: number, data1: number, data2: number) {
  //write 2 Byte to memory
  write(addr, data1);
  write(addr + 1, data2);
}

function memorybankControll(addr: number, data: number): void {
  let cartType = read(0x147);

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
        currentROMBank = (data & 0x1f) == 0 ? 1 : data & 0x1f;
        console.log(
          "my set: ",
          ROMBankOffset(),
          " his set: ",
          ((currentROMBank - 1) * 0x4000) % rom.length
        );
      } else if (addr <= 0x5fff) {
        //switch RAM bank
        if (MBCMode == 0) {
          console.log("switching in mbcmode 0");
          //stolen from https://github.com/mitxela/swotGB/blob/master/gbjs.htm line 976
          currentROMBank = (currentROMBank & 0x1f) | (data << 5);
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
        if (addr & (0x100 == 0))
          //lsb of upper byte must be 0
          RAMEnabled = (data & 0xf) == 0xa;
      } else if (addr <= 0x3fff) {
        if (addr & (0x100 == 0x100))
          //lsb of upper byte must be 1
          currentROMBank = (data & 0x1f) == 0 ? 1 : data & 0x1f;
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
      if (addr <= 0x1fff) {
        //also timer enable
        RAMEnabled = (data & 0xf) == 0xa;
      } else if (addr <= 0x3fff) {
        currentROMBank = (data & 0x7f) == 0 ? 1 : data & 0x7f;
      } else if (addr <= 0x5fff) {
        if (data < 8) {
          currentRAMBank = data;
        } else {
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
      if (addr <= 0x1fff) {
        RAMEnabled = (data & 0x0f) == 0xa;
      } else if (addr <= 0x2fff) {
        currentROMBank = data & 0xff;
      } else if (addr <= 0x3fff) {
        currentROMBank &= 0xff;
        if (data & 1) ROMbank += 0x100;
      } else if (addr <= 0x5fff) {
        currentRAMBank = data & 0x0f;
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
      console.log(`Unknown cart type: ${cartType}`);
      break;
  }
}

export { memory, cartridgeRAM };
