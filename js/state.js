// ===== GAME STATE =====
let board = [];
let currentTurn = 'w';
let selectedCell = null;
let validMoves = [];
let moveCount = 1;
let gameOver = false;
let log = [];
let dragons = []; // {row, col, owner, hasFired}
let pendingSummon = null; // {knight1, knight2, topRow, leftCol, owner}
let pendingFireBreath = null; // dragon cell
let pendingPromotion = null;
let enPassantTarget = null;
let castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
let initialPieces = 16;
let whitePieceCount = 16;
let blackPieceCount = 16;
let animatingFire = false;
let pendingUmaAction = null;
let gameMode = 'vsPlayer';
let hasSummonedDragon = { w: false, b: false };
let hasSummonedUma = { w: false, b: false };

let playerCards = { w: [], b: [] };
let playerTurnCount = { w: 1, b: 0 };
let activeGoldenHour = null;
let gameHistory = [];

let isMultiplayer = false;
let myColor = 'w';
let conn = null;

function initBoard() {
  board = Array.from({length:8},()=>Array(8).fill(null));
  // White (row 7-6 = index 0 from bottom = board[7], board[6])
  const backW = ['wR','wN','wB','wQ','wK','wB','wN','wR'];
  for(let c=0;c<8;c++){
    board[7][c] = backW[c];
    board[6][c] = 'wP';
    board[1][c] = 'bP';
    board[0][c] = backW[c].replace('w','b');
  }
  dragons = [];
  enPassantTarget = null;
  castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
  whitePieceCount = blackPieceCount = 16;
  hasSummonedDragon = { w: false, b: false };
  hasSummonedUma = { w: false, b: false };
  playerCards = { w: [], b: [] };
  playerTurnCount = { w: 1, b: 0 };
  activeGoldenHour = null;
  gameHistory = [];
  if (typeof updateHPBars === 'function') {
    updateHPBars();
  }
}

function countPieces(color) {
  let cnt = 0;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
    if(board[r][c] && board[r][c][0]===color && board[r][c]!==`${color}D`) cnt++;
  }
  cnt += dragons.filter(d=>d.owner===color).length;
  return cnt;
}

function saveHistoryState() {
  gameHistory.push({
    board: JSON.parse(JSON.stringify(board)),
    currentTurn: currentTurn,
    moveCount: moveCount,
    dragons: JSON.parse(JSON.stringify(dragons)),
    enPassantTarget: enPassantTarget ? [...enPassantTarget] : null,
    castlingRights: { ...castlingRights },
    whitePieceCount: whitePieceCount,
    blackPieceCount: blackPieceCount,
    hasSummonedDragon: { ...hasSummonedDragon },
    hasSummonedUma: { ...hasSummonedUma }
  });
  if (gameHistory.length > 50) {
    gameHistory.shift();
  }
}

