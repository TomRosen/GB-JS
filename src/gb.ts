import { SpecialFlags } from "./gb/flags";
import { memory, read, write16bit } from "./gb/memory";
import { A, B, C, D, E, F, H, L, register } from "./gb/register";
import { opcodes } from "./instructions/opcodes";

const frameClocks = /* 0.01; */ 4194304 / 59.7;
var frameClockCounter = frameClocks;
const frameIntervalMs = 1000 / 59.7;
var cpuRunning = true;
var thisFrame,
  lastFrame = performance.now();
var limitFramerate = true;

var divRegisterCounter = 0;
var timerRegisterCounter = 0;
var timerScaler = 1024;

var stopEmu = false;

var bootCode =
  "31 FE FF AF 21 FF 9F 32 CB 7C 20 FB 21 26 FF 0E 11 3E 80 32 E2 0C 3E F3 E2 32 3E 77 77 3E FC E0 47 11 A8 00 21 10 80 1A CD 95 00 CD 96 00 13 7B FE 34 20 F3 11 D8 00 06 08 1A 13 22 23 05 20 F9 3E 19 EA 10 99 21 2F 99 0E 0C 3D 28 08 32 0D 20 F9 2E 0F 18 F3 67 3E 64 57 E0 42 3E 91 E0 40 04 1E 02 0E 0C F0 44 FE 90 20 FA 0D 20 F7 1D 20 F2 0E 13 24 7C 1E 83 FE 62 28 06 1E C1 FE 64 20 06 7B E2 0C 3E 87 E2 F0 42 90 E0 42 15 20 D2 05 20 4F 16 20 18 CB 4F 06 04 C5 CB 11 17 C1 CB 11 17 05 20 F5 22 23 22 23 C9 00 00 00 0D 00 09 11 09 89 39 08 C9 00 0B 00 03 00 0C CC CC 00 0F 00 00 00 00 EC CC EC CC DD DD 99 99 98 89 EE FB 67 63 6E 0E CC DD 1F 9F 88 88 00 00 00 00 00 00 00 00 21 A8 00 11 A8 00 1A 13 BE 20 FE 23 7D FE 34 20 F5 06 19 78 86 23 05 20 FB 86 20 FE 3E 01 E0 50"
    .split(" ")
    .map((x) => parseInt(x, 16));

var SP = 0xfffe; //stack pointer
var PC = 0x100; //0x100; //programm counter

var IME = false; //Interupt Master enable

var imm = 921; //placeholder for immediate
var spimm = 913;

function interrupt(jumpTo: number) {
  cpuRunning = true;
  SP -= 2;
  write16bit(SP, PC >> 8, PC & 0xff);
  PC = jumpTo;
  IME = false;
}

function runFrame(time: number) {
  thisFrame = time || performance.now();
  if (limitFramerate) {
    // https://github.com/mitxela/swotGB/blob/master/gbjs.htm#L2729
    let timeDelta = thisFrame - lastFrame;
    if (timeDelta >= frameIntervalMs - 0.1) {
      lastFrame = thisFrame - (timeDelta % frameIntervalMs);
    } else {
      requestAnimationFrame(runFrame);
      return;
    }
  }

  //handle Input

  while (true) {
    //do cpu until no cycles for frame left
    let cycles = cpu();
    frameClockCounter -= cycles;

    if (frameClockCounter < 0) {
      frameClockCounter += frameClocks;
      break;
    }
  }
  if (limitFramerate && !stopEmu) window.requestAnimationFrame(runFrame);

  displayDebug();
}

function cpu() {
  let cycles = 4; //default 4 cycles
  if (PC >= 0xffff) {
    cpuRunning = false;
  }
  if (cpuRunning) {
    try {
      cycles = opcodes[read(PC)]();
    } catch (e) {
      console.log(e);
      cpuRunning = false;
      IME = false;
      displayDebug();
    }
  }

  if ((divRegisterCounter += cycles) > 255) {
    divRegisterCounter -= 256;
    memory[SpecialFlags.DIV]++;
  }

  if (memory[SpecialFlags.TAC] & 0x04) {
    //if bit 2 is set
    timerRegisterCounter -= cycles;
    if (timerRegisterCounter < 0) {
      //check later, maybe while loop needed
      timerRegisterCounter += timerScaler;
      memory[SpecialFlags.TIMA]++;
      if (memory[SpecialFlags.TIMA] == 0xff) {
        memory[SpecialFlags.TIMA] = memory[SpecialFlags.TMA];
        memory[SpecialFlags.IF] |= 1 << 2;
        cpuRunning = true;
      }
    }
  }

  //trigger interrupt
  if (IME) {
    let enabled = read(SpecialFlags.IF) & read(SpecialFlags.IE);
    if (enabled & 0x10) {
      //High-to-Low of P10-P13
      memory[SpecialFlags.IF] &= ~0x10;
      interrupt(0x60);
    } else if (enabled & 0x08) {
      //Serial Transer Completion
      memory[SpecialFlags.IF] &= ~0x08;
      interrupt(0x58);
    } else if (enabled & 0x04) {
      //Timer Overflow
      memory[SpecialFlags.IF] &= ~0x04;
      interrupt(0x50);
    } else if (enabled & 0x02) {
      //LCDC Status
      memory[SpecialFlags.IF] &= ~0x02;
      interrupt(0x48);
    } else if (enabled & 0x01) {
      //V-Blank
      memory[SpecialFlags.IF] &= ~0x01;
      interrupt(0x40);
    }
  }

  return cycles;
}

function initializeRegister() {
  register[A] = 0x01;
  register[F] = 0xb0;
  register[B] = 0x00;
  register[C] = 0x13;
  register[D] = 0x00;
  register[E] = 0xd8;
  register[H] = 0x01;
  register[L] = 0x4d;
  SP = 0xfffe;
  PC = 0x100;
}

var openFile = function (event) {
  var input = event.target;

  var reader = new FileReader();
  reader.onloadend = function (evt) {
    if (evt.target.readyState === FileReader.DONE) {
      rom = new Uint8Array(reader.result);
      // for (let i = 0; i < 256; i++) rom[i] = bootCode[i];
      for (let j = 260; j <= 307; j++) {
        console.log(rom[j].toString(16));
      }

      currentROMBank, currentRAMBank, (MBCMode = 0);
      RAMEnabled = false;
      initializeRegister();
      runFrame();
    }
  };
  reader.readAsArrayBuffer(input.files[0]);
};

var canvasCtx = document.getElementById("screen").getContext("2D");

function buildFrame() {}

const debugRegister = document.querySelector("#register");
const debugFlags = document.querySelector("#flags");
const debugIME = document.querySelector("#ime");
const debugPointer = document.querySelector("#pointer");
const debugInstruction = document.querySelector("#instruction");
const debugCartInfo = document.querySelector("#card-info");
const debugMBC = document.querySelector("#mbc");
const debugMemory = document.querySelector("#memory");

function displayDebug() {
  debugCartInfo.innerText = `Cartridgetype: ${read(0x147).toString(
    16
  )}\nROM Size: ${read(0x148).toString(16)}\nRAM Size: ${read(0x149).toString(
    16
  )}\nRom length: ${rom.length.toString(16)}\n`;
  debugRegister.innerText = `AF: ${((register[A] << 8) + register[F]).toString(
    16
  )}\nBC: ${((register[B] << 8) + register[C]).toString(16)}\nDE: ${(
    (register[D] << 8) +
    register[E]
  ).toString(16)}\nHL: ${((register[H] << 8) + register[L]).toString(16)}\n`;
  debugPointer.innerText = `PC: ${PC.toString(16)}\nSP: ${SP.toString(16)}\n`;
  debugFlags.innerText = `Z: ${flags.Z}\nN: ${flags.N}\nH: ${flags.H}\nC: ${flags.C}\n`;
  debugIME.innerText = `IME: ${IME}\nHALT: ${!cpuRunning}\nIE: ${read(
    SpecialFlags.IE
  ).toString(2)}\nIF: ${read(SpecialFlags.IF).toString(2)}`;
  debugInstruction.innerText = `Curr Instrc: ${read(PC)?.toString(16)}\n`;
  debugMBC.innerText = `Ram enabled: ${RAMEnabled}\nCurrent Ram Bank: ${currentRAMBank}\nCurrent ROM Bank: ${currentROMBank}\nMBCMode: ${MBCMode}\nRomBankOffset: ${ROMBankOffset().toString(
    16
  )}\n`;
  let memoryDebug = "";
  var debugOffset = PC & 0xff00;
  function f(a, l) {
    return ("0000" + a.toString(16).toUpperCase()).slice(-l || -2);
  }
  for (var j = 0; j < 16; j++) {
    memoryDebug += "$" + f(debugOffset + j * 16, 4) + "   ";
    for (var i = 0; i < 16; i++) {
      var q = i + j * 16 + debugOffset;
      memoryDebug += "<span title='$" + f(q, 4) + "'";
      memoryDebug += PC == q ? " style='color:red'>" : ">";
      memoryDebug += f(read(q)) + "</span>";

      memoryDebug += i == 7 ? "|" : " ";
    }
    memoryDebug += "\n";
  }

  debugMemory.innerHTML = memoryDebug;
}
