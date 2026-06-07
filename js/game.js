// ===== GAMEPLAY CONTROLLER =====
function onCellClick(r,c){
  if(gameOver||animatingFire||pendingUmaAction) return;
  if(gameMode === 'vsAI' && currentTurn === 'b') return;
  if(typeof isMultiplayer !== 'undefined' && isMultiplayer && currentTurn !== myColor) return;

  if (typeof pendingWarlordPromotion !== 'undefined' && pendingWarlordPromotion !== null) {
    const wr = pendingWarlordPromotion.r;
    const wc = pendingWarlordPromotion.c;
    const isPawn = board[r][c] === `${currentTurn}P`;
    const isWithin3x3 = Math.abs(r - wr) <= 1 && Math.abs(c - wc) <= 1;
    if (isPawn && isWithin3x3) {
      if (typeof showWarlordPromoChoices === 'function') {
        showWarlordPromoChoices(r, c);
      }
    } else {
      pendingWarlordPromotion = null;
      selectedCell = null;
      validMoves = [];
      updateActionsArea(null);
      renderBoard();
    }
    return;
  }

  // If fire breath preview active
  if(pendingFireBreath){
    cancelFireBreath();
    return;
  }

  // If summon confirmation pending
  if(pendingSummon){
    pendingSummon=null;
    selectedCell=null;
    validMoves=[];
    updateActionsArea(null);
    renderBoard();
    endTurn();
    return;
  }

  const piece=board[r][c];
  const dragon=getDragonAt(r,c);

  // Dragon selected
  if(dragon&&dragon.owner===currentTurn){
    if(selectedCell&&selectedCell[0]===dragon.row&&selectedCell[1]===dragon.col){
      selectedCell=null; validMoves=[]; updateActionsArea(null);
    } else {
      selectedCell=[dragon.row,dragon.col];
      validMoves=getDragonMoves(dragon);
      updateActionsArea({type:'dragon',dragon});
    }
    renderBoard();
    return;
  }

  // Execute move on valid target
  if(selectedCell){
    const [sr,sc]=selectedCell;
    const selDragon=getDragonAt(sr,sc);

    if(isValidMove(r,c)){
      const pieceOnSource = board[sr][sc];
      const isUmaMove = pieceOnSource && pieceOnSource[1] === 'U';
      const isCapture = board[r][c] && board[r][c][0] !== currentTurn;

      if (isUmaMove && isCapture) {
        if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
          addLog("⚠️ Tidak bisa menggunakan skill saat Golden Hour!", "special");
          return;
        }
        selectedCell = null;
        validMoves = [];
        executeUmaKick(sr, sc, r, c);
        return;
      }

      if(selDragon){
        // Move dragon
        moveDragon(selDragon,r,c);
      } else {
        movePiece(sr,sc,r,c);
      }
      selectedCell=null; validMoves=[];
      if(!pendingSummon){
        updateActionsArea(null);
      }
      return;
    }
  }

  // Select new piece
  if(piece&&piece[0]===currentTurn&&piece!=='wD'&&piece!=='bD'){
    selectedCell=[r,c];
    validMoves=getValidMovesFor(r,c);
    updateActionsArea({type:'piece',r,c,piece});
    renderBoard();
  } else {
    selectedCell=null; validMoves=[];
    updateActionsArea(null);
    renderBoard();
  }
}

function movePiece(fr,fc,tr,tc,promoteTo){
  const piece=board[fr][fc];
  const owner=piece[0];
  const type=piece[1];
  const captured=board[tr][tc];

  // Detect friendly Knight fusion capture
  if(type==='N' && captured && captured===`${owner}N`){
    if (!canSummonUniquePiece(owner, 'D')) return;
    board[fr][fc]=null;
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer && owner === myColor) {
      sendMultiplayerMessage({
        type: 'move',
        fr: fr, fc: fc, tr: tr, tc: tc
      });
    }
    if (typeof executeFusionSummon === 'function') {
      executeFusionSummon(owner, tr, tc);
    }
    return;
  }

  // Detect friendly Pawn-Knight fusion or Knight-Pawn fusion
  const isPawnKnightFusion = (type === 'P' && captured === `${owner}N`) || (type === 'N' && captured === `${owner}P`);
  if (isPawnKnightFusion) {
    if (!canSummonUniquePiece(owner, 'U')) return;
    board[fr][fc] = null;
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer && owner === myColor) {
      sendMultiplayerMessage({
        type: 'move',
        fr: fr, fc: fc, tr: tr, tc: tc
      });
    }
    if (typeof executeUmaFusionSummon === 'function') {
      executeUmaFusionSummon(owner, tr, tc);
    }
    return;
  }

  // Detect friendly King-Queen fusion or Queen-King fusion
  const isWarlordFusion = (type === 'K' && captured === `${owner}Q`) || (type === 'Q' && captured === `${owner}K`);
  if (isWarlordFusion) {
    board[fr][fc] = null;
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer && owner === myColor) {
      sendMultiplayerMessage({
        type: 'move',
        fr: fr, fc: fc, tr: tr, tc: tc
      });
    }
    if (typeof executeWarlordFusionSummon === 'function') {
      executeWarlordFusionSummon(owner, tr, tc);
    }
    return;
  }

  if(captured) {
    addLog(`${PIECE_EMOJIS[piece]} memakan ${PIECE_EMOJIS[captured]}`);
    if (captured === 'wD' || captured === 'bD') {
      const deadDragon = getDragonAt(tr, tc);
      if (deadDragon && typeof destroyDragon === 'function') {
        destroyDragon(deadDragon);
      }
    }
  }

  // En passant
  if(type==='P'&&fc!==tc&&!captured){
    board[fr][tc]=null;
    addLog(`${PIECE_EMOJIS[piece]} en passant!`,'special');
  }

  // Set en passant target
  enPassantTarget=null;
  if(type==='P'&&Math.abs(tr-fr)===2){
    enPassantTarget=[(fr+tr)/2,fc];
  }

  // Castling
  if(type==='K'){
    castlingRights[owner==='w'?'wK':'bK']=false;
    castlingRights[owner==='w'?'wQ':'bQ']=false;
    if(tc===fc+2){ board[fr][fc+1]=board[fr][7]; board[fr][7]=null; }
    if(tc===fc-2){ board[fr][fc-1]=board[fr][0]; board[fr][0]=null; }
  }
  if(type==='R'){
    if(fc===0) castlingRights[owner==='w'?'wQ':'bQ']=false;
    if(fc===7) castlingRights[owner==='w'?'wK':'bK']=false;
  }

  board[tr][tc]=piece;
  board[fr][fc]=null;

  // Pawn promotion
  if(type==='P'&&(tr===0||tr===7)){
    if (promoteTo) {
      board[tr][tc] = `${owner}${promoteTo}`;
      addLog(`👑 Promosi ke ${promoteTo === 'Q' ? 'Ratu' : promoteTo === 'R' ? 'Benteng' : promoteTo === 'B' ? 'Gajah' : 'Kuda'}!`, 'special');
      finishMoveActions();
    } else if (owner === 'b' && gameMode === 'vsAI') {
      board[tr][tc] = `${owner}Q`;
      addLog(`👑 Promosi ke Ratu!`, 'special');
      finishMoveActions();
    } else {
      pendingPromotion={r:tr,c:tc,owner, fr_original: fr, fc_original: fc};
      renderBoard();
      showPromoModal(owner);
    }
    return;
  }

  addLog(`${PIECE_EMOJIS[piece]} ${COLS[fc]}${8-fr}→${COLS[tc]}${8-tr}`);
  
  if (typeof isMultiplayer !== 'undefined' && isMultiplayer && owner === myColor) {
    sendMultiplayerMessage({
      type: 'move',
      fr: fr, fc: fc, tr: tr, tc: tc
    });
  }
  
  finishMoveActions();
}

function moveDragon(dragon,tr,tc){
  // Capture any piece in new cell
  let captured=0;
  if(board[tr][tc]&&board[tr][tc][0]!==dragon.owner){
    const targetPiece = board[tr][tc];
    if (targetPiece === 'wD' || targetPiece === 'bD') {
      const deadDragon = getDragonAt(tr, tc);
      if (deadDragon && typeof destroyDragon === 'function') {
        destroyDragon(deadDragon);
      }
    }
    board[tr][tc]=null;
    captured++;
  }

  // Clear old pos
  const oldRow = dragon.row;
  const oldCol = dragon.col;
  board[oldRow][oldCol]=null;

  // Update dragon
  dragon.row=tr; dragon.col=tc;
  board[tr][tc]=`${dragon.owner}D`;

  addLog(`🐉 Naga bergerak ke ${COLS[tc]}${8-tr}${captured?` (+${captured})`:''}`,'dragon');
  
  if (typeof isMultiplayer !== 'undefined' && isMultiplayer && dragon.owner === myColor) {
    sendMultiplayerMessage({
      type: 'move',
      fr: oldRow, fc: oldCol, tr: tr, tc: tc
    });
  }
  
  finishMoveActions();
}

function finishMoveActions() {
  renderBoard();
  if (activeGoldenHour !== null) {
    checkGameOver();
  } else {
    endTurn();
    checkGameOver();
  }
}

function endTurn(){
  currentTurn=currentTurn==='w'?'b':'w';
  moveCount++;
  
  // Save history state for the new turn
  saveHistoryState();
  
  // Increment turn count for the new active player
  playerTurnCount[currentTurn]++;
  
  // Draw card if player completed 6 turns
  if (playerTurnCount[currentTurn] % 6 === 0) {
    drawCardForPlayer(currentTurn);
  }
  
  selectedCell=null; validMoves=[];
  updateActionsArea(null);
  renderBoard();

  if (gameMode === 'vsAI' && currentTurn === 'b' && !gameOver) {
    setTimeout(() => {
      if (typeof makeAIMove === 'function') makeAIMove();
    }, 600);
  }
}

// ===== GAME OVER CHECK =====
function checkGameOver(){
  const wK=findKing('w'), bK=findKing('b');
  if(!wK){ showGameOver('Hitam Menang!'); return; }
  if(!bK){ showGameOver('Putih Menang!'); return; }
}

// ===== RESTART =====
function restartGame(isLocalOnly){
  if (activeGoldenHour && activeGoldenHour.timerId) {
    clearInterval(activeGoldenHour.timerId);
  }
  gameOver=false; currentTurn='w'; selectedCell=null; validMoves=[];
  moveCount=1; dragons=[]; pendingSummon=null; pendingFireBreath=null;
  pendingPromotion=null; pendingWarlordPromotion=null; enPassantTarget=null;
  initBoard();
  
  const banner = document.getElementById('goldenHourBanner');
  if (banner) banner.style.display = 'none';
  
  saveHistoryState();
  
  addLog('♟ Permainan baru dimulai!','special');
  renderBoard();

  if (typeof isMultiplayer !== 'undefined' && isMultiplayer && isLocalOnly !== true) {
    sendMultiplayerMessage({
      type: 'restart'
    });
  }
}

// Bottom restart button
function executeUmaEat(fr, fc, tr, tc) {
  pendingUmaAction = null;
  movePiece(fr, fc, tr, tc);
}

function executeUmaKick(fr, fc, tr, tc, forceDirection) {
  const piece = board[fr][fc];
  const owner = piece[0];
  
  let pr = 0;
  let pc = 0;
  if (forceDirection === 'horizontal') {
    pr = 0;
    pc = Math.sign(tc - fc);
  } else if (forceDirection === 'vertical') {
    pr = Math.sign(tr - fr);
    pc = 0;
  } else {
    // Fallback/Legacy
    const isPath1Valid = checkUmaPath(fr, fc, tr, tc, 'path1');
    const isPath2Valid = checkUmaPath(fr, fc, tr, tc, 'path2');
    if (isPath1Valid) {
      pr = 0;
      pc = Math.sign(tc - fc);
    } else if (isPath2Valid) {
      pr = Math.sign(tr - fr);
      pc = 0;
    }
  }

  // Collect consecutive occupied cells along (pr, pc) starting at (tr, tc)
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

  // Execute chain reaction physics
  if (cells.length > 0 && board[tr][tc][1] === 'W') {
    addLog(`🛡️ Warlord kebal dari tendangan Uma Musume!`, 'special');
    pendingUmaAction = null;
    renderBoard();
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer && owner === myColor) {
      sendMultiplayerMessage({
        type: 'move',
        fr: fr, fc: fc, tr: tr, tc: tc
      });
    }
    endTurn();
    checkGameOver();
    return;
  }

  // Find if there is a Warlord behind the target
  let blockIdx = -1;
  for (let idx = 1; idx < cells.length; idx++) {
    const [cr, cc] = cells[idx];
    if (board[cr][cc][1] === 'W') {
      blockIdx = idx;
      break;
    }
  }

  if (blockIdx !== -1) {
    // The piece at blockIdx - 1 dies
    const [dr, dc] = cells[blockIdx - 1];
    const deadPiece = board[dr][dc];
    board[dr][dc] = null;
    
    if (deadPiece === 'wD' || deadPiece === 'bD') {
      const deadDragon = getDragonAt(dr, dc);
      if (deadDragon && typeof destroyDragon === 'function') {
        destroyDragon(deadDragon);
      }
    }

    // Shift pieces in front of it (from blockIdx-2 down to 0) forward
    for (let idx = blockIdx - 2; idx >= 0; idx--) {
      const [cr, cc] = cells[idx];
      const nr = cr + pr;
      const nc = cc + pc;
      board[nr][nc] = board[cr][cc];
    }
    board[tr][tc] = null; // Clear target cell for Uma Musume

    addLog(`🦵 Uma Musume menendang berantai! Terbentur Warlord, ${PIECE_EMOJIS[deadPiece]} gugur!`, 'fire');
  } else {
    // Standard push physics (no Warlord blocking)
    if (cells.length === 1) {
      const [cr, cc] = cells[0];
      const nr = cr + pr;
      const nc = cc + pc;
      const targetPiece = board[cr][cc];
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) {
        board[cr][cc] = null;
        addLog(`🦵 Uma Musume menendang ${PIECE_EMOJIS[targetPiece]} keluar papan!`, 'fire');
        if (targetPiece === 'wD' || targetPiece === 'bD') {
          const deadDragon = getDragonAt(cr, cc);
          if (deadDragon && typeof destroyDragon === 'function') {
            destroyDragon(deadDragon);
          }
        }
      } else {
        board[nr][nc] = board[cr][cc];
        board[cr][cc] = null;
        addLog(`🦵 Uma Musume menendang ${PIECE_EMOJIS[targetPiece]} mundur 1 petak!`, 'special');
      }
    } else {
      const lastIdx = cells.length - 1;
      const [lr, lc] = cells[lastIdx];
      const deadPiece = board[lr][lc];
      board[lr][lc] = null;
      if (deadPiece === 'wD' || deadPiece === 'bD') {
        const deadDragon = getDragonAt(lr, lc);
        if (deadDragon && typeof destroyDragon === 'function') {
          destroyDragon(deadDragon);
        }
      }
      for (let idx = lastIdx - 1; idx >= 0; idx--) {
        const [cr, cc] = cells[idx];
        const nr = cr + pr;
        const nc = cc + pc;
        board[nr][nc] = board[cr][cc];
      }
      board[tr][tc] = null;
      addLog(`🦵 Uma Musume menendang berantai! ${PIECE_EMOJIS[deadPiece]} gugur dan bidak lain mundur!`, 'fire');
    }
  }

  // Move Uma Musume to target square
  board[tr][tc] = board[fr][fc];
  board[fr][fc] = null;

  // Cleanup and end turn
  pendingUmaAction = null;
  renderBoard();
  
  if (typeof isMultiplayer !== 'undefined' && isMultiplayer && owner === myColor) {
    sendMultiplayerMessage({
      type: 'move',
      fr: fr, fc: fc, tr: tr, tc: tc
    });
  }
  
  endTurn();
  checkGameOver();
}

function buildBottomActions(){
  const area=document.getElementById('bottomActions');
  if (!area) return;
  area.innerHTML = '';
  const restartBtn=document.createElement('button');
  restartBtn.className='btn';
  restartBtn.textContent='🔄 Mulai Ulang';
  restartBtn.onclick=restartGame;
  area.appendChild(restartBtn);
}

function selectGameMode(mode) {
  gameMode = mode;
  const overlay = document.getElementById('welcomeOverlay');
  if (overlay) overlay.style.display = 'none';
  restartGame();
}

function showWelcomeScreen() {
  const overlay = document.getElementById('welcomeOverlay');
  if (overlay) overlay.style.display = 'flex';
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  initBoard();
  saveHistoryState();
  renderBoard();
  buildBottomActions();
  window.addEventListener('resize', ()=>{ renderBoard(); });
});

// ===== EFFECT CARDS & TIME-WARP MECHANICS =====
function drawCardForPlayer(color) {
  const cardPool = ['rewind', 'golden_hour'];
  const randomCard = cardPool[Math.floor(Math.random() * cardPool.length)];
  
  if (!playerCards[color]) {
    playerCards[color] = [];
  }
  playerCards[color].push(randomCard);
  
  const cardNames = {
    'rewind': 'Rewind',
    'golden_hour': 'Golden Hour'
  };
  
  const playerName = color === 'w' ? 'Putih' : 'Hitam';
  addLog(`🎴 Player ${playerName} menarik kartu: ${cardNames[randomCard]}!`, 'special');
  
  if (typeof renderCards === 'function') {
    renderCards();
  }
}

function useCard(color, cardId) {
  if (gameOver) return;
  if (currentTurn !== color) {
    addLog(`⚠️ Bukan giliran Anda untuk menggunakan kartu!`, 'special');
    return;
  }
  
  const cardIdx = playerCards[color].indexOf(cardId);
  if (cardIdx === -1) return;
  
  if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
    if (color === myColor) {
      sendMultiplayerMessage({
        type: 'card',
        cardId: cardId
      });
    }
  }
  
  const cardNames = {
    'rewind': 'Rewind',
    'golden_hour': 'Golden Hour'
  };
  
  const playerName = color === 'w' ? 'Putih' : 'Hitam';
  
  if (cardId === 'rewind') {
    if (gameHistory.length <= 1) {
      addLog(`⚠️ Tidak ada riwayat langkah untuk di-rewind!`, 'special');
      return;
    }
    
    playerCards[color].splice(cardIdx, 1);
    addLog(`🎴 ${playerName} menggunakan kartu: ${cardNames[cardId]}!`, 'special');
    
    applyRewind();
  } 
  else if (cardId === 'golden_hour') {
    if (activeGoldenHour) {
      addLog(`⚠️ Golden Hour sudah aktif!`, 'special');
      return;
    }
    
    playerCards[color].splice(cardIdx, 1);
    addLog(`🎴 ${playerName} menggunakan kartu: ${cardNames[cardId]}!`, 'special');
    
    activateGoldenHour(color);
  }
  
  if (typeof renderCards === 'function') {
    renderCards();
  }
}

function activateGoldenHour(color) {
  if (activeGoldenHour && activeGoldenHour.timerId) {
    clearInterval(activeGoldenHour.timerId);
  }
  
  activeGoldenHour = {
    owner: color,
    timeLeft: 5.0,
    timerId: null
  };
  
  selectedCell = null;
  validMoves = [];
  updateActionsArea(null);
  
  playCardSound('activate');
  
  const banner = document.getElementById('goldenHourBanner');
  const timerText = document.getElementById('goldenHourTimer');
  if (banner) banner.style.display = 'block';
  if (timerText) timerText.textContent = '5.0';
  
  addLog(`⏱️ GOLDEN HOUR dimulai! Gerak bebas 5 detik untuk ${color === 'w' ? 'Putih' : 'Hitam'}. (Tidak bisa memakan)`, 'special');
  
  activeGoldenHour.timerId = setInterval(() => {
    if (gameOver) {
      clearInterval(activeGoldenHour.timerId);
      deactivateGoldenHour();
      return;
    }
    
    activeGoldenHour.timeLeft = Math.max(0, activeGoldenHour.timeLeft - 0.1);
    if (timerText) timerText.textContent = activeGoldenHour.timeLeft.toFixed(1);
    
    const sideTimer = document.getElementById('goldenHourTimerSide');
    if (sideTimer) sideTimer.textContent = activeGoldenHour.timeLeft.toFixed(1) + 's';
    
    if (banner) {
      if (activeGoldenHour.timeLeft <= 1.5) {
        banner.style.background = 'linear-gradient(90deg, rgba(255, 0, 0, 0.9), rgba(150, 0, 0, 0.9))';
        banner.style.color = '#fff';
      } else {
        banner.style.background = 'linear-gradient(90deg, rgba(200, 168, 75, 0.9), rgba(138, 106, 26, 0.9))';
        banner.style.color = '#000';
      }
    }
    
    if (activeGoldenHour.timeLeft <= 0) {
      clearInterval(activeGoldenHour.timerId);
      deactivateGoldenHour();
    }
  }, 100);
  
  renderBoard();
}

function deactivateGoldenHour() {
  if (!activeGoldenHour) return;
  
  const banner = document.getElementById('goldenHourBanner');
  if (banner) banner.style.display = 'none';
  
  addLog("⏱️ Waktu Golden Hour habis!", "special");
  activeGoldenHour = null;
  selectedCell = null;
  validMoves = [];
  
  renderBoard();
  endTurn();
}

function playCardSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'activate') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'rewind') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch (e) {
    console.log('Audio Context not allowed or supported yet.');
  }
}

function applyRewind() {
  if (gameHistory.length <= 1) {
    addLog("⚠️ Tidak bisa rewind: riwayat tidak cukup!", "special");
    return false;
  }
  
  const userColor = currentTurn;
  let targetStateIndex = -1;
  let matchesCount = 0;
  
  // Search backward for the 3rd state where it was userColor's turn
  for (let i = gameHistory.length - 2; i >= 0; i--) {
    if (gameHistory[i].currentTurn === userColor) {
      matchesCount++;
      if (matchesCount === 3) {
        targetStateIndex = i;
        break;
      }
    }
  }
  
  // Fallback: If not enough turns, find the oldest turn of the same player
  if (targetStateIndex === -1) {
    for (let i = 0; i < gameHistory.length - 1; i++) {
      if (gameHistory[i].currentTurn === userColor) {
        targetStateIndex = i;
        break;
      }
    }
  }
  
  // Final fallback: Revert to the initial starting state
  if (targetStateIndex === -1) {
    targetStateIndex = 0;
  }
  
  const statesToRemove = gameHistory.length - 1 - targetStateIndex;
  for (let i = 0; i < statesToRemove; i++) {
    gameHistory.pop();
  }
  
  const prevState = gameHistory[gameHistory.length - 1];
  
  board = JSON.parse(JSON.stringify(prevState.board));
  currentTurn = prevState.currentTurn;
  moveCount = prevState.moveCount;
  dragons = JSON.parse(JSON.stringify(prevState.dragons));
  enPassantTarget = prevState.enPassantTarget ? [...prevState.enPassantTarget] : null;
  castlingRights = { ...prevState.castlingRights };
  whitePieceCount = prevState.whitePieceCount;
  blackPieceCount = prevState.blackPieceCount;
  hasSummonedDragon = { ...prevState.hasSummonedDragon };
  hasSummonedUma = { ...prevState.hasSummonedUma };
  if (prevState.warlordCharges) {
    warlordCharges = { ...prevState.warlordCharges };
  }
  
  playCardSound('rewind');
  addLog(`⏮️ Rewind berhasil! Kembali ke giliran Anda 3 turn sebelumnya.`, 'special');
  
  selectedCell = null;
  validMoves = [];
  updateActionsArea(null);
  renderBoard();

  if (gameMode === 'vsAI' && currentTurn === 'b' && !gameOver) {
    setTimeout(() => {
      if (typeof makeAIMove === 'function') makeAIMove();
    }, 600);
  }

  return true;
}
