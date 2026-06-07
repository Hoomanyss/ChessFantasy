// ===== CHESS VS AI HEURISTIC ENGINE =====

function makeAIMove() {
  if (gameOver || currentTurn !== 'b') return;
  
  // AI card usage check (e.g. Rewind)
  if (playerCards['b'] && playerCards['b'].includes('rewind') && gameHistory.length >= 2) {
    const prevTurnState = gameHistory[gameHistory.length - 2];
    const prevBoard = prevTurnState.board;
    
    let prevBlackPieces = 0;
    for (let r=0; r<8; r++) {
      for (let c=0; c<8; c++) {
        const p = prevBoard[r][c];
        if (p && p[0] === 'b') prevBlackPieces++;
      }
    }
    
    let currBlackPieces = 0;
    for (let r=0; r<8; r++) {
      for (let c=0; c<8; c++) {
        const p = board[r][c];
        if (p && p[0] === 'b') currBlackPieces++;
      }
    }
    
    if (prevBlackPieces > currBlackPieces) {
      addLog("🤖 AI menggunakan kartu efek!", "special");
      setTimeout(() => {
        useCard('b', 'rewind');
      }, 500);
      return;
    }
  }
  
  const possibleActions = [];
  
  // 1. Gather all actions for Black pieces
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece[0] === 'b') {
        const moves = getValidMovesFor(r, c);
        for (const [tr, tc] of moves) {
          const isUma = piece[1] === 'U';
          const isCapture = board[tr][tc] && board[tr][tc][0] === 'w';
          
          if (isUma && isCapture) {
            possibleActions.push({
              type: 'uma_kick',
              fr: r, fc: c, tr, tc,
              score: evaluateAction({ type: 'uma_kick', fr: r, fc: c, tr, tc })
            });
          } else {
            possibleActions.push({
              type: 'move',
              fr: r, fc: c, tr, tc,
              score: evaluateAction({ type: 'move', fr: r, fc: c, tr, tc })
            });
          }
        }
      }
    }
  }
  
  // 2. Gather active Black Dragons for Fire Breath options
  const blackDragons = dragons.filter(d => d.owner === 'b');
  for (const d of blackDragons) {
    const directions = ['U', 'D', 'L', 'R', 'UL', 'UR', 'DL', 'DR'];
    for (const dir of directions) {
      possibleActions.push({
        type: 'fire',
        dragon: d,
        direction: dir,
        score: evaluateAction({ type: 'fire', dragon: d, direction: dir })
      });
    }
  }
  
  if (possibleActions.length === 0) {
    // No moves (stalemate or checkmate check)
    checkGameOver();
    return;
  }
  
  // Sort actions by score descending
  possibleActions.sort((a, b) => b.score - a.score);
  
  // Choose the best move (introduce a small random variance for diversity)
  const bestScore = possibleActions[0].score;
  const candidateActions = possibleActions.filter(act => Math.abs(act.score - bestScore) < 2);
  const selectedAction = candidateActions[Math.floor(Math.random() * candidateActions.length)];
  
  // Execute the chosen action
  executeAIAction(selectedAction);
}

function evaluateAction(act) {
  let score = 0;
  
  // Material value mapping
  const pieceValues = {
    P: 10, N: 30, B: 30, R: 50, Q: 90, U: 70, D: 150, K: 10000
  };
  
  if (act.type === 'move') {
    const piece = board[act.fr][act.fc];
    const target = board[act.tr][act.tc];
    
    // Capture value
    if (target) {
      score += pieceValues[target[1]] * 1.5;
    }
    
    // Pawn promotion bonus
    if (piece[1] === 'P' && (act.tr === 0 || act.tr === 7)) {
      score += 80;
    }
    
    // Dragon Fusion bonus (Knight onto own Knight)
    if (piece[1] === 'N' && target === 'bN') {
      score += 120;
    }
    
    // Uma Musume Fusion bonus (Pawn on Knight / Knight on Pawn)
    if ((piece[1] === 'P' && target === 'bN') || (piece[1] === 'N' && target === 'bP')) {
      score += 80;
    }
    
    // Center control bonus
    const centerRows = [3, 4];
    const centerCols = [3, 4];
    if (centerRows.includes(act.tr) && centerCols.includes(act.tc)) {
      score += 2;
    }
    
    // Safety check: Avoid moving to a threatened square unless protected/capturing
    const originalSource = board[act.fr][act.fc];
    const originalTarget = board[act.tr][act.tc];
    
    board[act.tr][act.tc] = piece;
    board[act.fr][act.fc] = null;
    
    const canBeCaptured = isSquareThreatened(act.tr, act.tc, 'w');
    
    board[act.fr][act.fc] = originalSource;
    board[act.tr][act.tc] = originalTarget;
    
    if (canBeCaptured) {
      score -= pieceValues[piece[1]] * 0.8;
    }
  }
  
  if (act.type === 'uma_eat') {
    const target = board[act.tr][act.tc];
    if (target) {
      score += pieceValues[target[1]] * 1.5;
    }
    
    const originalSource = board[act.fr][act.fc];
    const originalTarget = board[act.tr][act.tc];
    board[act.tr][act.tc] = 'bU';
    board[act.fr][act.fc] = null;
    const canBeCaptured = isSquareThreatened(act.tr, act.tc, 'w');
    board[act.fr][act.fc] = originalSource;
    board[act.tr][act.tc] = originalTarget;
    
    if (canBeCaptured) {
      score -= 50;
    }
  }
  
  if (act.type === 'uma_kick') {
    const { fr, fc, tr, tc } = act;
    
    // Automatically calculate direction based on path taken
    const isPath1Valid = checkUmaPath(fr, fc, tr, tc, 'path1');
    const isPath2Valid = checkUmaPath(fr, fc, tr, tc, 'path2');
    
    let direction = '';
    if (isPath1Valid) direction = 'horizontal';
    else if (isPath2Valid) direction = 'vertical';
    
    const pr = direction === 'vertical' ? Math.sign(tr - fr) : 0;
    const pc = direction === 'horizontal' ? Math.sign(tc - fc) : 0;
    
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
      const targetPiece = board[cr][cc];
      const nr = cr + pr;
      const nc = cc + pc;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) {
        score += pieceValues[targetPiece[1]] * 1.5; // Kicked off-board
      } else {
        score += 5; // Pushed safely
      }
    } else if (cells.length === 2) {
      const [cr1, cc1] = cells[1];
      const backPiece = board[cr1][cc1];
      if (backPiece) {
        score += pieceValues[backPiece[1]] * 1.5;
      }
    } else if (cells.length >= 3) {
      const lastIdx = cells.length - 1;
      const [lr, lc] = cells[lastIdx];
      const deadPiece = board[lr][lc];
      if (deadPiece) {
        score += pieceValues[deadPiece[1]] * 1.5;
      }
    }
    
    const originalSource = board[fr][fc];
    const originalTarget = board[tr][tc];
    board[tr][tc] = 'bU';
    board[fr][fc] = null;
    const canBeCaptured = isSquareThreatened(tr, tc, 'w');
    board[fr][fc] = originalSource;
    board[tr][tc] = originalTarget;
    
    if (canBeCaptured) {
      score -= 50;
    }
  }
  
  if (act.type === 'fire') {
    const zone = getFireBreathZone(act.dragon, act.direction);
    let hitValue = 0;
    for (const [zr, zc] of zone) {
      const p = board[zr][zc];
      if (p && p[0] === 'w') {
        hitValue += pieceValues[p[1]] * 2.0;
      }
    }
    score += hitValue;
    if (hitValue === 0) {
      score -= 20;
    }
  }
  
  score += Math.random() * 2;
  return score;
}



function executeAIAction(act) {
  if (act.type === 'move') {
    movePiece(act.fr, act.fc, act.tr, act.tc);
  } else if (act.type === 'uma_eat') {
    executeUmaEat(act.fr, act.fc, act.tr, act.tc);
  } else if (act.type === 'uma_kick') {
    executeUmaKick(act.fr, act.fc, act.tr, act.tc);
  } else if (act.type === 'fire') {
    executeFireBreath(act.dragon, act.direction);
  }
}
