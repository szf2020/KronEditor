// src/utils/plcStandards.js

export const PLC_BLOCKS = {
  // --- ZAMANLAYICILAR ---
  TON: {
    label: 'TON',
    description: 'On-Delay Timer',
    inputs: [
      { id: 'IN', type: 'BOOL', label: 'IN' }, 
      { id: 'PT', type: 'TIME', label: 'PT' }
    ],
    outputs: [
      { id: 'Q', type: 'BOOL', label: 'Q' },
      { id: 'ET', type: 'TIME', label: 'ET' }
    ]
  },
  TOF: {
    label: 'TOF',
    description: 'Off-Delay Timer',
    inputs: [
      { id: 'IN', type: 'BOOL', label: 'IN' },
      { id: 'PT', type: 'TIME', label: 'PT' }
    ],
    outputs: [
      { id: 'Q', type: 'BOOL', label: 'Q' },
      { id: 'ET', type: 'TIME', label: 'ET' }
    ]
  },
  TP: {
    label: 'TP',
    description: 'Pulse Timer',
    inputs: [
      { id: 'IN', type: 'BOOL', label: 'IN' },
      { id: 'PT', type: 'TIME', label: 'PT' }
    ],
    outputs: [
      { id: 'Q', type: 'BOOL', label: 'Q' },
      { id: 'ET', type: 'TIME', label: 'ET' }
    ]
  },
  
  // --- SAYICILAR ---
  CTU: {
    label: 'CTU',
    description: 'Count Up',
    inputs: [
      { id: 'CU', type: 'BOOL', label: 'CU' },
      { id: 'R', type: 'BOOL', label: 'R' },
      { id: 'PV', type: 'INT', label: 'PV' }
    ],
    outputs: [
      { id: 'Q', type: 'BOOL', label: 'Q' },
      { id: 'CV', type: 'INT', label: 'CV' }
    ]
  },
  CTD: {
    label: 'CTD',
    description: 'Count Down',
    inputs: [
      { id: 'CD', type: 'BOOL', label: 'CD' },
      { id: 'LD', type: 'BOOL', label: 'LD' },
      { id: 'PV', type: 'INT', label: 'PV' }
    ],
    outputs: [
      { id: 'Q', type: 'BOOL', label: 'Q' },
      { id: 'CV', type: 'INT', label: 'CV' }
    ]
  },
  CTUD: {
    label: 'CTUD',
    description: 'Count Up/Down',
    inputs: [
      { id: 'CU', type: 'BOOL', label: 'CU' },
      { id: 'CD', type: 'BOOL', label: 'CD' },
      { id: 'R',  type: 'BOOL', label: 'R'  },
      { id: 'LD', type: 'BOOL', label: 'LD' },
      { id: 'PV', type: 'INT',  label: 'PV' }
    ],
    outputs: [
      { id: 'QU', type: 'BOOL', label: 'QU' },
      { id: 'QD', type: 'BOOL', label: 'QD' },
      { id: 'CV', type: 'INT',  label: 'CV' }
    ]
  },

  // --- TETİKLEYİCİLER ---
  R_TRIG: {
    label: 'R_TRIG',
    description: 'Rising Edge',
    inputs: [{ id: 'CLK', type: 'BOOL', label: 'CLK' }],
    outputs: [{ id: 'Q', type: 'BOOL', label: 'Q' }]
  },
  F_TRIG: {
    label: 'F_TRIG',
    description: 'Falling Edge',
    inputs: [{ id: 'CLK', type: 'BOOL', label: 'CLK' }],
    outputs: [{ id: 'Q', type: 'BOOL', label: 'Q' }]
  },

  // --- BİSTABLE ---
  SR: {
    label: 'SR',
    description: 'Set Dominant',
    inputs: [
      { id: 'S1', type: 'BOOL', label: 'S1' },
      { id: 'R',  type: 'BOOL', label: 'R'  }
    ],
    outputs: [{ id: 'Q1', type: 'BOOL', label: 'Q1' }]
  },
  RS: {
    label: 'RS',
    description: 'Reset Dominant',
    inputs: [
      { id: 'S',  type: 'BOOL', label: 'S'  },
      { id: 'R1', type: 'BOOL', label: 'R1' }
    ],
    outputs: [{ id: 'Q1', type: 'BOOL', label: 'Q1' }]
  },

  // --- COMPARISON ---
  GT:   { label: 'GT',   description: 'Greater Than',     inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }] },
  GE:   { label: 'GE',   description: 'Greater or Equal', inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }] },
  EQ:   { label: 'EQ',   description: 'Equal',            inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }] },
  NE:   { label: 'NE',   description: 'Not Equal',        inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }] },
  LE:   { label: 'LE',   description: 'Less or Equal',    inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }] },
  LT:   { label: 'LT',   description: 'Less Than',        inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }] },

  // --- ARİTMETİK ---
  ADD:  { label: 'ADD',  description: 'Addition',       inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DINT', label: 'OUT' }] },
  SUB:  { label: 'SUB',  description: 'Subtraction',    inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DINT', label: 'OUT' }] },
  MUL:  { label: 'MUL',  description: 'Multiplication', inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DINT', label: 'OUT' }] },
  DIV:  { label: 'DIV',  description: 'Division',       inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DINT', label: 'OUT' }] },
  MOD:  { label: 'MOD',  description: 'Modulo',         inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'DINT', label: 'IN1' }, { id: 'IN2', type: 'DINT', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DINT', label: 'OUT' }] },
  MOVE: { label: 'MOVE', description: 'Move / Assign',  inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN',  type: 'DINT', label: 'IN'  }],                                              outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DINT', label: 'OUT' }] },

  // --- MATEMATİK ---
  ABS:   { label: 'ABS',   description: 'Absolute Value',          inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN',  type: 'REAL', label: 'IN'  }],                                              outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'REAL', label: 'OUT' }] },
  SQRT:  { label: 'SQRT',  description: 'Square Root',             inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN',  type: 'REAL', label: 'IN'  }],                                              outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'REAL', label: 'OUT' }] },
  EXPT:  { label: 'EXPT',  description: 'Exponentiation',          inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN',  type: 'REAL', label: 'IN'  }, { id: 'EXP', type: 'REAL', label: 'EXP' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'REAL', label: 'OUT' }] },
  MAX:   { label: 'MAX',   description: 'Maximum of two values',   inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'REAL', label: 'IN1' }, { id: 'IN2', type: 'REAL', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'REAL', label: 'OUT' }] },
  MIN:   { label: 'MIN',   description: 'Minimum of two values',   inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN1', type: 'REAL', label: 'IN1' }, { id: 'IN2', type: 'REAL', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'REAL', label: 'OUT' }] },
  LIMIT: { label: 'LIMIT', description: 'Clamp to [MN, MX]',       inputs: [{ id: 'EN', type: 'BOOL', label: 'EN' }, { id: 'IN',  type: 'REAL', label: 'IN'  }, { id: 'MN',  type: 'REAL', label: 'MN'  }, { id: 'MX', type: 'REAL', label: 'MX' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'REAL', label: 'OUT' }] },

  // --- BİTSEL ---
  BAND:  { label: 'BAND', description: 'Bitwise AND',    inputs: [{ id: 'EN', type: 'BOOL',  label: 'EN' }, { id: 'IN1', type: 'DWORD', label: 'IN1' }, { id: 'IN2', type: 'DWORD', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DWORD', label: 'OUT' }] },
  BOR:   { label: 'BOR',  description: 'Bitwise OR',     inputs: [{ id: 'EN', type: 'BOOL',  label: 'EN' }, { id: 'IN1', type: 'DWORD', label: 'IN1' }, { id: 'IN2', type: 'DWORD', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DWORD', label: 'OUT' }] },
  BXOR:  { label: 'BXOR', description: 'Bitwise XOR',    inputs: [{ id: 'EN', type: 'BOOL',  label: 'EN' }, { id: 'IN1', type: 'DWORD', label: 'IN1' }, { id: 'IN2', type: 'DWORD', label: 'IN2' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DWORD', label: 'OUT' }] },
  BNOT:  { label: 'BNOT', description: 'Bitwise NOT',    inputs: [{ id: 'EN', type: 'BOOL',  label: 'EN' }, { id: 'IN',  type: 'DWORD', label: 'IN'  }],                                              outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DWORD', label: 'OUT' }] },
  SHL:   { label: 'SHL',  description: 'Shift Left',     inputs: [{ id: 'EN', type: 'BOOL',  label: 'EN' }, { id: 'IN',  type: 'DWORD', label: 'IN'  }, { id: 'N', type: 'USINT', label: 'N' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DWORD', label: 'OUT' }] },
  SHR:   { label: 'SHR',  description: 'Shift Right',    inputs: [{ id: 'EN', type: 'BOOL',  label: 'EN' }, { id: 'IN',  type: 'DWORD', label: 'IN'  }, { id: 'N', type: 'USINT', label: 'N' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DWORD', label: 'OUT' }] },
  ROL:   { label: 'ROL',  description: 'Rotate Left',    inputs: [{ id: 'EN', type: 'BOOL',  label: 'EN' }, { id: 'IN',  type: 'DWORD', label: 'IN'  }, { id: 'N', type: 'USINT', label: 'N' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DWORD', label: 'OUT' }] },
  ROR:   { label: 'ROR',  description: 'Rotate Right',   inputs: [{ id: 'EN', type: 'BOOL',  label: 'EN' }, { id: 'IN',  type: 'DWORD', label: 'IN'  }, { id: 'N', type: 'USINT', label: 'N' }], outputs: [{ id: 'ENO', type: 'BOOL', label: 'ENO' }, { id: 'OUT', type: 'DWORD', label: 'OUT' }] }
};

