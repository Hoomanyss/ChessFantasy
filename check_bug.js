const fs = require('fs');
const path = require('path');

// Mock DOM
const createMockElement = () => ({
  innerHTML: '',
  style: {},
  appendChild: () => {},
  insertBefore: () => {},
  removeChild: () => {},
  addEventListener: () => {},
  children: [],
  classList: { add: () => {}, remove: () => {} },
  dataset: {}
});

global.window = {
  innerWidth: 1024,
  addEventListener: () => {}
};
global.document = {
  addEventListener: () => {},
  getElementById: (id) => createMockElement(),
  createElement: () => createMockElement()
};

global.addLog = (msg, type) => {
  console.log(`[LOG - ${type || 'normal'}] ${msg}`);
};

const baseDir = 'c:/Users/abdul/Documents/CheesF';
const files = [
  'js/constants.js',
  'js/state.js',
  'js/moves.js',
  'js/summon.js',
  'js/ui.js',
  'js/game.js',
  'js/ai.js'
];

let allCode = '';
for (const file of files) {
  allCode += fs.readFileSync(path.join(baseDir, file), 'utf8') + '\n';
}

allCode += `
try {
  initBoard();
  
  // Recreate the screenshot board state for White King at d5
  for (let r=0; r<8; r++) {
    for (let c=0; c<8; c++) {
      board[r][c] = null;
    }
  }
  
  board[1][2] = 'wD'; // White Dragon at c7
  dragons = [{ row: 1, col: 2, owner: 'w' }];
  
  board[2][7] = 'wP'; // White Pawn at h6
  
  board[3][3] = 'wK'; // White King at d5
  board[3][6] = 'wB'; // White Bishop at g5
  
  board[6][0] = 'bU'; // Black Uma Musume at a2
  board[6][2] = 'wP'; // White Pawn at c2
  board[6][4] = 'wB'; // White Bishop at e2
  board[6][6] = 'wP'; // White Pawn at g2
  board[6][7] = 'wP'; // White Pawn at h2
  
  board[7][0] = 'wR'; // White Rook at a1
  board[7][3] = 'wP'; // White Pawn at d1
  board[7][5] = 'wR'; // White Rook at f1
  board[7][6] = 'bK'; // Black King at g1
  
  currentTurn = 'w';
  
  console.log('Calculating moves for White King at (3,3)...');
  let moves = getValidMovesFor(3, 3);
  console.log('Moves calculated successfully! Valid moves count:', moves.length);
  console.log('Moves:', JSON.stringify(moves));
} catch (err) {
  console.error('ERROR OCCURRED during move calculation:', err.stack);
}
`;

eval(allCode);
