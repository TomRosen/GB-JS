declare interface ICPUPointer {
  SP: number;
  PC: number;
}

declare interface ICPUControl {
  IME: boolean;
  cpuRunning: boolean;
}

declare interface ITimerControl {
  timerScaler: timerScaler;
  timerRegisterCounter: number;
}

declare interface ICartridge {
  rom: Uint8Array;
  ram: Uint8Array;
}

declare interface ICartridgeControl {
  ramBank: number;
  ramEnabled: boolean;
  mbcMode: number;
  ramBankOffset: () => number;
  romBank: number;
  romBankOffset: () => number;
}

declare type ImmPlaceholder = 921;
declare type SPImmPlaceholder = 913;

declare type TimerScaler = 16 | 64 | 256 | 1024;
