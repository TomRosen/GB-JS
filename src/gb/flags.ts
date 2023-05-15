export let flags = {
  Z: false, //Zero flag
  N: false, //Subtract flag
  H: false, //Half Carry flag
  C: false, //Carry flag
  flagByte: function () {
    var byte = 0;
    if (this.Z == true) byte += 8;
    if (this.N == true) byte += 4;
    if (this.H == true) byte += 2;
    if (this.C == true) byte += 1;
    return byte << 4;
  },
};

export const SpecialFlags = {
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
