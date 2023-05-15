let register = new Uint8Array(8); //cpu reg

//cpu reg addresses
const A = 7; //Accumulator register
const F = 6; //Flag register
const B = 0; //BC 2 Byte register
const C = 1; //BC 2 Byte register
const D = 2; //DE 2 Byte register
const E = 3; //DE 2 Byte register
const H = 4; //HL 2 Byte register used to store memory addresses
const L = 5; //HL 2 Byte register used to store memory addresses

export { register, A, F, B, C, D, E, H, L };
