// ===== MOVE LOGIC =====
function canSummonUniquePiece(owner, type) {
  if (type === 'D') {
    return !hasSummonedDragon[owner];
  }
  if (type === 'U') {
    return !hasSummonedUma[owner];
  }
  return true;
}

function getKnightMoves(r,c,owner) {
  const moves=[];
  const jumps=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for(const[dr,dc]of jumps){
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<8&&nc>=0&&nc<8){
      const t=board[nr][nc];
      if(!t || (t && t[0] !== owner)) {
        moves.push([nr,nc]);
      } else {
        if (t === `${owner}N` && canSummonUniquePiece(owner, 'D')) {
          moves.push([nr,nc]);
        }
        if (t === `${owner}P` && canSummonUniquePiece(owner, 'U')) {
          moves.push([nr,nc]);
        }
      }
    }
  }
  return moves;
}

function getRookMoves(r,c,owner) {
  const moves=[];
  for(const[dr,dc]of[[0,1],[0,-1],[1,0],[-1,0]]){
    let nr=r+dr,nc=c+dc;
    while(nr>=0&&nr<8&&nc>=0&&nc<8){
      if(board[nr][nc]){
        if(board[nr][nc][0]!==owner) moves.push([nr,nc]);
        break;
      }
      moves.push([nr,nc]);
      nr+=dr;nc+=dc;
    }
  }
  return moves;
}

function getBishopMoves(r,c,owner) {
  const moves=[];
  for(const[dr,dc]of[[1,1],[1,-1],[-1,1],[-1,-1]]){
    let nr=r+dr,nc=c+dc;
    while(nr>=0&&nr<8&&nc>=0&&nc<8){
      if(board[nr][nc]){
        if(board[nr][nc][0]!==owner) moves.push([nr,nc]);
        break;
      }
      moves.push([nr,nc]);
      nr+=dr;nc+=dc;
    }
  }
  return moves;
}

function getQueenMoves(r,c,owner) {
  return [...getRookMoves(r,c,owner),...getBishopMoves(r,c,owner)];
}

function getKingMoves(r,c,owner) {
  const moves=[];
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc) continue;
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<8&&nc>=0&&nc<8){
      const t=board[nr][nc];
      if(!t||(t[0]!==owner)) moves.push([nr,nc]);
    }
  }
  // Castling with check checks
  const opponent = owner === 'w' ? 'b' : 'w';
  if(owner==='w'&&r===7&&c===4){
    if(castlingRights.wK&&!board[7][5]&&!board[7][6]&&!isSquareThreatened(7,4,opponent)&&!isSquareThreatened(7,5,opponent)) moves.push([7,6]);
    if(castlingRights.wQ&&!board[7][3]&&!board[7][2]&&!board[7][1]&&!isSquareThreatened(7,4,opponent)&&!isSquareThreatened(7,3,opponent)) moves.push([7,2]);
  }
  if(owner==='b'&&r===0&&c===4){
    if(castlingRights.bK&&!board[0][5]&&!board[0][6]&&!isSquareThreatened(0,4,opponent)&&!isSquareThreatened(0,5,opponent)) moves.push([0,6]);
    if(castlingRights.bQ&&!board[0][3]&&!board[0][2]&&!board[0][1]&&!isSquareThreatened(0,4,opponent)&&!isSquareThreatened(0,3,opponent)) moves.push([0,2]);
  }
  return moves;
}

function getPawnMoves(r,c,owner) {
  const moves=[];
  const dir = owner==='w'?-1:1;
  const start = owner==='w'?6:1;
  const nr1=r+dir;
  if(nr1>=0&&nr1<8&&!board[nr1][c]) {
    moves.push([nr1,c]);
    if(r===start&&!board[r+2*dir][c]) moves.push([r+2*dir,c]);
  }
  for(const dc of[-1,1]){
    const nc=c+dc;
    if(nc>=0&&nc<8&&nr1>=0&&nr1<8){
      const t = board[nr1][nc];
      if (t) {
        if (t[0] !== owner) {
          moves.push([nr1,nc]);
        } else if (t === `${owner}N` && canSummonUniquePiece(owner, 'U')) {
          moves.push([nr1,nc]);
        }
      }
      if(enPassantTarget&&enPassantTarget[0]===nr1&&enPassantTarget[1]===nc) moves.push([nr1,nc]);
    }
  }
  return moves;
}

function isDragonCell(r,c){
  return board[r][c] === 'wD' || board[r][c] === 'bD';
}

function isDragonAt(r,c,exceptOwner){
  const piece = board[r][c];
  if(piece === 'wD' || piece === 'bD') {
    return piece[0] !== exceptOwner;
  }
  return false;
}

function getDragonAt(r,c){
  const piece = board[r][c];
  if(piece === 'wD' || piece === 'bD') {
    return dragons.find(d => d.row === r && d.col === c);
  }
  return null;
}

function getValidMovesFor(r,c){
  const piece=board[r][c];
  if(!piece) return [];
  const owner=piece[0];
  const type=piece[1];
  let rawMoves = [];
  switch(type){
    case 'P': rawMoves = getPawnMoves(r,c,owner); break;
    case 'N': rawMoves = getKnightMoves(r,c,owner); break;
    case 'B': rawMoves = getBishopMoves(r,c,owner); break;
    case 'R': rawMoves = getRookMoves(r,c,owner); break;
    case 'Q': rawMoves = getQueenMoves(r,c,owner); break;
    case 'K': rawMoves = getKingMoves(r,c,owner); break;
    case 'W': rawMoves = getKingMoves(r,c,owner); break;
    case 'U': rawMoves = getUmaMoves(r,c,owner); break;
    default: return [];
  }

  // Filter out captures and fusions if Golden Hour is active (but keep valid fusion summons)
  if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
    rawMoves = rawMoves.filter(([tr, tc]) => {
      const target = board[tr][tc];
      if (target !== null) {
        const isFriendly = target[0] === owner;
        const targetType = target[1];
        if (isFriendly) {
          if (type === 'N' && (targetType === 'N' || targetType === 'P')) {
            return true;
          }
          if (type === 'P' && targetType === 'N') {
            return true;
          }
        }
        return false;
      }
      if (type === 'P' && c !== tc) return false; // block other diagonal captures/en passant
      return true;
    });
  }
  
  // Filter moves that leave the King in check
  const valid = [];
  const opponent = owner === 'w' ? 'b' : 'w';
  
  for (const [tr, tc] of rawMoves) {
    const originalSource = board[r][c];
    const originalTarget = board[tr][tc];
    
    // Handle en passant capture simulation
    let epRow = -1, epCol = -1, epPiece = null;
    if (type === 'P' && c !== tc && !originalTarget) {
      epRow = r;
      epCol = tc;
      epPiece = board[epRow][epCol];
      board[epRow][epCol] = null;
    }
    
    board[tr][tc] = originalSource;
    board[r][c] = null;
    
    const kingPos = findKing(owner);
    let inCheck = false;
    if (kingPos) {
      inCheck = isSquareThreatened(kingPos[0], kingPos[1], opponent);
    }
    
    // Undo
    board[r][c] = originalSource;
    board[tr][tc] = originalTarget;
    if (epRow !== -1) {
      board[epRow][epCol] = epPiece;
    }
    
    if (!inCheck) {
      valid.push([tr, tc]);
    }
  }
  return valid;
}

function isSegmentEmpty(r1, c1, r2, c2) {
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  let r = r1 + dr;
  let c = c1 + dc;
  while (r !== r2 || c !== c2) {
    if (board[r][c]) return false;
    r += dr;
    c += dc;
  }
  return true;
}

function checkUmaPath(fr, fc, tr, tc, pathType) {
  if (fr === tr || fc === tc) return false; // Must be a 2-leg corner turn
  
  const owner = board[fr][fc] ? board[fr][fc][0] : null;
  const target = board[tr][tc];
  if (target && owner && target[0] === owner) return false; // Friendly fire not allowed

  if (pathType === 'path1') {
    // Path 1: vertical first, then horizontal. Corner: (tr, fc)
    if (board[tr][fc] !== null) return false;
    if (!isSegmentEmpty(fr, fc, tr, fc)) return false;
    if (!isSegmentEmpty(tr, fc, tr, tc)) return false;
    return true;
  }
  
  if (pathType === 'path2') {
    // Path 2: horizontal first, then vertical. Corner: (fr, tc)
    if (board[fr][tc] !== null) return false;
    if (!isSegmentEmpty(fr, fc, fr, tc)) return false;
    if (!isSegmentEmpty(fr, tc, tr, tc)) return false;
    return true;
  }
  
  return false;
}

function getUmaMoves(r, c, owner) {
  const moves = [];
  for (let tr = 0; tr < 8; tr++) {
    for (let tc = 0; tc < 8; tc++) {
      if (tr === r && tc === c) continue;
      if (checkUmaPath(r, c, tr, tc, 'path1') || checkUmaPath(r, c, tr, tc, 'path2')) {
        moves.push([tr, tc]);
      }
    }
  }
  return moves;
}

function willUmaKickKillKing(ur, uc, tr, tc, opponentColor) {
  const target = board[tr][tc];
  if (!target) return false; // Empty square means normal move (no kick), so King cannot die
  
  let pr = 0, pc = 0;
  if (checkUmaPath(ur, uc, tr, tc, 'path1')) {
    pr = 0;
    pc = Math.sign(tc - uc);
  } else if (checkUmaPath(ur, uc, tr, tc, 'path2')) {
    pr = Math.sign(tr - ur);
    pc = 0;
  } else {
    return false; // Path not valid
  }

  // Find the chain of occupied cells
  const cells = [];
  let i = 0;
  while (true) {
    const cr = tr + i * pr;
    const cc = tc + i * pc;
    if (cr < 0 || cr > 7 || cc < 0 || cc > 7) break;
    if (!board[cr][cc]) break;
    cells.push([cr, cc]);
    i++;
  }

  if (cells.length === 1) {
    const [cr, cc] = cells[0];
    const nr = cr + pr;
    const nc = cc + pc;
    const piece = board[cr][cc];
    if (piece === `${opponentColor}K`) {
      // King is the target. Dies if pushed off board.
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) {
        return true;
      }
    }
  } else if (cells.length === 2) {
    const [cr1, cc1] = cells[1];
    const piece = board[cr1][cc1];
    if (piece === `${opponentColor}K`) {
      // King is the back piece in a 2-piece chain. Dies.
      return true;
    }
  } else if (cells.length >= 3) {
    const [lr, lc] = cells[cells.length - 1];
    const piece = board[lr][lc];
    if (piece === `${opponentColor}K`) {
      // King is the furthest piece in a chain. Dies.
      return true;
    }
  }
  return false;
}

function isUmaThreateningSquare(ur, uc, tr, tc, defendingColor) {
  // Temporarily place the King at (tr, tc) to simulate the threat
  const originalPiece = board[tr][tc];
  board[tr][tc] = `${defendingColor}K`;
  
  const owner = board[ur][uc] ? board[ur][uc][0] : null;
  if (!owner) {
    board[tr][tc] = originalPiece;
    return false;
  }
  
  const moves = getUmaMoves(ur, uc, owner);
  
  let threatened = false;
  for (const [um_tr, um_tc] of moves) {
    if (willUmaKickKillKing(ur, uc, um_tr, um_tc, defendingColor)) {
      threatened = true;
      break;
    }
  }
  
  board[tr][tc] = originalPiece;
  return threatened;
}

function getDragonMoves(d){
  // Dragon moves like a queen but 2 squares max
  const moves=[];
  const owner=d.owner;
  const r=d.row,c=d.col;
  for(const[dr,dc]of[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]){
    for(let s=1;s<=2;s++){
      const nr=r+dr*s,nc=c+dc*s;
      if(nr<0||nr>7||nc<0||nc>7) break; 
      if(board[nr][nc]){
        if(board[nr][nc][0]!==owner) moves.push([nr,nc]);
        break; // blocked
      }
      moves.push([nr,nc]);
    }
  }
  return moves;
}

function isValidMove(r,c){
  return validMoves.some(m=>m[0]===r&&m[1]===c);
}

function findKing(color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]===`${color}K` || board[r][c]===`${color}W`) return [r,c];
  return null;
}

function isSquareThreatened(tr, tc, attackerColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p[0] === attackerColor) {
        const type = p[1];
        if (type === 'K' || type === 'W') {
          // King/Warlord threats are only adjacent cells
          if (Math.abs(tr - r) <= 1 && Math.abs(tc - c) <= 1) return true;
          continue;
        }
        
        let rawMoves = [];
        switch (type) {
          case 'P': rawMoves = getPawnMoves(r, c, attackerColor); break;
          case 'N': rawMoves = getKnightMoves(r, c, attackerColor); break;
          case 'B': rawMoves = getBishopMoves(r, c, attackerColor); break;
          case 'R': rawMoves = getRookMoves(r, c, attackerColor); break;
          case 'Q': rawMoves = getQueenMoves(r, c, attackerColor); break;
          case 'U': {
            const defendingColor = attackerColor === 'w' ? 'b' : 'w';
            if (isUmaThreateningSquare(r, c, tr, tc, defendingColor)) {
              return true;
            }
            break;
          }
          case 'D': {
            const d = getDragonAt(r, c);
            if (d) rawMoves = getDragonMoves(d);
            break;
          }
        }
        if (rawMoves.some(m => m[0] === tr && m[1] === tc)) {
          return true;
        }
      }
    }
  }
  return false;
}
