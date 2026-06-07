// ===== SUMMON & FUSION MECHANICS =====
function executeFusionSummon(owner, r, c) {
  board[r][c] = `${owner}D`;
  dragons.push({row:r, col:c, owner});
  hasSummonedDragon[owner] = true;
  addLog(`✨ FUSION! Kuda ${owner==='w'?'Putih':'Hitam'} menyatu menjadi Naga ${owner==='w'?'Putih':'Hitam'}!`,'dragon');
  if (typeof updateDragonStatus === 'function') updateDragonStatus();
  if (typeof renderBoard === 'function') renderBoard();
  if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
    // Keep turn during Golden Hour
  } else {
    if (typeof endTurn === 'function') endTurn();
  }
}

// ===== FIRE BREATH =====
function getFireBreathZone(dragon, direction) {
  const {row,col}=dragon;
  const zone=[];
  let dr=0, dc=0;
  switch(direction){
    case 'U':  dr=-1; dc=0;  break; // Vertical Up
    case 'D':  dr=1;  dc=0;  break; // Vertical Down
    case 'L':  dr=0;  dc=-1; break; // Horizontal Left
    case 'R':  dr=0;  dc=1;  break; // Horizontal Right
    case 'UL': dr=-1; dc=-1; break; // Diagonal Up-Left
    case 'UR': dr=-1; dc=1;  break; // Diagonal Up-Right
    case 'DL': dr=1;  dc=-1; break; // Diagonal Down-Left
    case 'DR': dr=1;  dc=1;  break; // Diagonal Down-Right
  }
  for(let step=1;step<=2;step++){
    const fr = row + dr * step;
    const fc = col + dc * step;
    if(fr>=0&&fr<8&&fc>=0&&fc<8) zone.push([fr,fc]);
  }
  return zone;
}

function executeFireBreath(dragon, direction) {
  if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
    addLog(`⚠️ Bidak spesial tidak bisa menggunakan skill saat Golden Hour!`, 'special');
    return;
  }
  
  if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
    if (dragon.owner === myColor) {
      sendMultiplayerMessage({
        type: 'fire',
        dragonRow: dragon.row,
        dragonCol: dragon.col,
        direction: direction
      });
    }
  }
  
  const zone=getFireBreathZone(dragon, direction);
  let destroyed=0;
  for(const[r,c]of zone){
    if(board[r][c]&&board[r][c][0]!==dragon.owner){
      if (board[r][c][1] === 'W') {
        addLog(`🛡️ Warlord kebal dari semburan api!`, 'special');
        continue;
      }
      board[r][c]=null;
      destroyed++;
    }
    // Destroy enemy dragons in zone
    const enemyDragon=getDragonAt(r,c);
    if(enemyDragon&&enemyDragon.owner!==dragon.owner){
      destroyDragon(enemyDragon);
      destroyed++;
    }
  }
  addLog(`🔥 Naga ${dragon.owner==='w'?'Putih':'Hitam'} menyemburkan api! ${destroyed} bidak musuh hancur!`,'fire');
  pendingFireBreath=null;

  // Animate fire
  showFireAnimation(zone, ()=>{
    if (typeof renderBoard === 'function') renderBoard();
    if (typeof endTurn === 'function') endTurn();
    if (typeof checkGameOver === 'function') checkGameOver();
  });
}

function showFireAnimation(zone, cb) {
  animatingFire=true;
  const boardEl=document.getElementById('chessBoard');
  const isFlipped = (typeof isMultiplayer !== 'undefined' && isMultiplayer && myColor === 'b');
  if (boardEl) {
    zone.forEach(([r,c])=>{
      const idx = isFlipped ? (63 - (r*8+c)) : (r*8+c);
      if(boardEl.children[idx]) boardEl.children[idx].classList.add('fire-zone');
    });
  }
  setTimeout(()=>{
    if (boardEl) {
      zone.forEach(([r,c])=>{
        const idx = isFlipped ? (63 - (r*8+c)) : (r*8+c);
        if(boardEl.children[idx]) boardEl.children[idx].classList.remove('fire-zone');
      });
    }
    animatingFire=false;
    cb();
  }, 800);
}

function destroyDragon(d) {
  board[d.row][d.col]=null;
  dragons=dragons.filter(x=>x!==d);
  addLog(`💀 Naga ${d.owner==='w'?'Putih':'Hitam'} dikalahkan!`,'fire');
}

function executeUmaFusionSummon(owner, r, c) {
  board[r][c] = `${owner}U`;
  hasSummonedUma[owner] = true;
  addLog(`✨ FUSION! Pion dan Kuda ${owner==='w'?'Putih':'Hitam'} menyatu menjadi Uma Musume!`,'dragon');
  if (typeof renderBoard === 'function') renderBoard();
  if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
    // Keep turn during Golden Hour
  } else {
    if (typeof endTurn === 'function') endTurn();
  }
}

function executeWarlordFusionSummon(owner, r, c) {
  board[r][c] = `${owner}W`;
  addLog(`✨ FUSION! Raja dan Ratu ${owner==='w'?'Putih':'Hitam'} menyatu menjadi Warlord!`,'dragon');
  if (typeof renderBoard === 'function') renderBoard();
  if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
    // Keep turn during Golden Hour
  } else {
    if (typeof endTurn === 'function') endTurn();
  }
}

function executeWarlordPromote(owner, wr, wc, tr, tc, promoteTo) {
  board[tr][tc] = `${owner}${promoteTo}`;
  warlordCharges[owner]--;
  
  const pieceName = promoteTo === 'N' ? 'Kuda' : promoteTo === 'B' ? 'Gajah' : 'Benteng';
  addLog(`⚔️ Warlord mempromosikan Pion ke ${pieceName}!`, 'special');
  
  if (typeof isMultiplayer !== 'undefined' && isMultiplayer && owner === myColor) {
    sendMultiplayerMessage({
      type: 'warlord_promote',
      wr: wr,
      wc: wc,
      tr: tr,
      tc: tc,
      promoteTo: promoteTo
    });
  }
  
  pendingWarlordPromotion = null;
  renderBoard();
  
  if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
    // Keep turn during Golden Hour
  } else {
    if (typeof endTurn === 'function') endTurn();
  }
}
