// ===== RENDER & UI UPDATES =====
function cellSize() {
  const w = window.innerWidth;
  if(w<=560) return 36;
  if(w<=780) return 44;
  return 64;
}

function renderBoard() {
  const boardEl = document.getElementById('chessBoard');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  const sz = cellSize();
  boardEl.style.gridTemplateColumns = `repeat(8,${sz}px)`;
  boardEl.style.gridTemplateRows    = `repeat(8,${sz}px)`;

  const isFlipped = (typeof isMultiplayer !== 'undefined' && isMultiplayer && myColor === 'b');

  // Update top coordinates (letters: a-h or h-a)
  const topCoords = document.querySelector('.top-coords');
  if (topCoords) {
    const letters = isFlipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
    topCoords.innerHTML = '<div class="coord-label"></div>' + letters.map(l => `<div class="coord-label">${l}</div>`).join('');
  }
  
  // Update side coordinates (numbers: 8-1 or 1-8)
  const sideCoords = document.querySelector('.side-coords');
  if (sideCoords) {
    const numbers = isFlipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
    sideCoords.innerHTML = numbers.map(n => `<div class="coord-label">${n}</div>`).join('');
  }

  for(let i=0;i<64;i++) {
    const r = isFlipped ? Math.floor((63 - i) / 8) : Math.floor(i / 8);
    const c = isFlipped ? (63 - i) % 8 : i % 8;

    const cell = document.createElement('div');
    cell.className = 'cell ' + ((r+c)%2===0?'light':'dark');
    cell.dataset.r = r; cell.dataset.c = c;

    if(selectedCell && selectedCell[0]===r && selectedCell[1]===c) cell.classList.add('selected');
    if(isValidMove(r,c)) cell.classList.add(board[r][c] && board[r][c][0]!==currentTurn?'valid-capture':'valid-move');

    if (typeof pendingWarlordPromotion !== 'undefined' && pendingWarlordPromotion !== null) {
      const wr = pendingWarlordPromotion.r;
      const wc = pendingWarlordPromotion.c;
      const isPawn = board[r][c] === `${currentTurn}P`;
      const isWithin3x3 = Math.abs(r - wr) <= 1 && Math.abs(c - wc) <= 1;
      if (isPawn && isWithin3x3) {
        cell.classList.add('warlord-promote-ready');
      }
    }

    const piece = board[r][c];
    if (piece && (piece[1] === 'K' || piece[1] === 'W')) {
      const owner = piece[0];
      const opponent = owner === 'w' ? 'b' : 'w';
      if (isSquareThreatened(r, c, opponent)) {
        cell.classList.add('king-danger');
      }
    }
    if(piece) {
      const el = document.createElement('div');
      let classStr = 'piece';
      if (piece === 'wD') classStr += ' dragon-white';
      if (piece === 'bD') classStr += ' dragon-black';
      if (piece === 'wU') classStr += ' uma-white';
      if (piece === 'bU') classStr += ' uma-black';
      el.className = classStr;
      el.style.fontSize = (sz*0.6)+'px';
      
      if (piece === 'wU') {
        const img = document.createElement('img');
        img.src = 'assets/uma_white.png';
        img.style.width = '85%';
        img.style.height = '85%';
        img.style.objectFit = 'contain';
        el.appendChild(img);
      } else if (piece === 'bU') {
        const img = document.createElement('img');
        img.src = 'assets/uma_black.png';
        img.style.width = '85%';
        img.style.height = '85%';
        img.style.objectFit = 'contain';
        el.appendChild(img);
      } else {
        el.textContent = PIECE_EMOJIS[piece]||piece;
      }
      
      cell.appendChild(el);
    }

    cell.addEventListener('click', ()=> {
      if (typeof onCellClick === 'function') onCellClick(r,c);
    });
    cell.addEventListener('mouseenter', (e)=>showTooltip(e,r,c));
    cell.addEventListener('mouseleave', ()=>hideTooltip());

    boardEl.appendChild(cell);
  }

  // Summon pulse overlay
  if(pendingSummon) {
    const cells = boardEl.children;
    [[pendingSummon.topRow,pendingSummon.leftCol],[pendingSummon.topRow,pendingSummon.leftCol+1],
     [pendingSummon.topRow+1,pendingSummon.leftCol],[pendingSummon.topRow+1,pendingSummon.leftCol+1]].forEach(([rr,cc])=>{
      if(rr>=0&&rr<8&&cc>=0&&cc<8) {
        const idx = isFlipped ? (63 - (rr*8+cc)) : (rr*8+cc);
        if(cells[idx]) cells[idx].classList.add('summon-ready');
      }
    });
  }

  updateTurnUI();
  updateDragonStatus();
  updateHPBars();
  if (typeof renderCards === 'function') {
    renderCards();
  }
}

function updateTurnUI() {
  const dot = document.getElementById('turnDot');
  if (dot) {
    dot.className = 'turn-dot ' + (currentTurn==='w'?'white':'black');
  }
  const turnText = document.getElementById('turnText');
  if (turnText) {
    turnText.textContent = currentTurn==='w'?'Putih':'Hitam';
  }
  const moveCountEl = document.getElementById('moveCount');
  if (moveCountEl) {
    moveCountEl.textContent = `Langkah ke-${moveCount}`;
  }
}

function updateDragonStatus() {
  const el = document.getElementById('dragonStatus');
  if (!el) return;
  if(dragons.length===0) { el.textContent='Belum ada naga terpanggil.'; return; }
  el.innerHTML = dragons.map(d=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="font-size:16px;">🐉</span>
      <span style="font-size:11px;color:${d.owner==='w'?'var(--gold)':'#ff6644'}">
        ${d.owner==='w'?'PUTIH':'HITAM'} — <span style="color:#cc88ff">Aktif</span>
      </span>
    </div>
  `).join('');
}

function updateHPBars() {
  whitePieceCount = countPieces('w');
  blackPieceCount = countPieces('b');
  
  const hpWhite = document.getElementById('hpWhite');
  if (hpWhite) hpWhite.style.width = (whitePieceCount/initialPieces*100)+'%';
  
  const hpBlack = document.getElementById('hpBlack');
  if (hpBlack) hpBlack.style.width = (blackPieceCount/initialPieces*100)+'%';
  
  const hpWhiteNum = document.getElementById('hpWhiteNum');
  if (hpWhiteNum) hpWhiteNum.textContent = whitePieceCount;
  
  const hpBlackNum = document.getElementById('hpBlackNum');
  if (hpBlackNum) hpBlackNum.textContent = blackPieceCount;
}

// ===== ACTIONS AREA =====
function updateActionsArea(ctx){
  const area=document.getElementById('actionsArea');
  if (!area) return;
  area.innerHTML='';

  if(!ctx){ area.innerHTML='<div style="font-size:11px;color:var(--text-muted);">Pilih bidak...</div>'; return; }



  if(ctx.type==='summon'){
    const btn=document.createElement('button');
    btn.className='btn primary';
    btn.innerHTML='🐉 Summon Naga!';
    btn.onclick=()=>{ if(pendingSummon) executeSummon(pendingSummon); };
    area.appendChild(btn);
    const skip=document.createElement('button');
    skip.className='btn';
    skip.textContent='Lewati';
    skip.onclick=()=>{
      pendingSummon=null;
      renderBoard();
      area.innerHTML='';
      if (typeof endTurn === 'function') endTurn();
    };
    area.appendChild(skip);
    return;
  }

  if(ctx.type==='dragon'){
    const d=ctx.dragon;
    const fireBtn=document.createElement('button');
    fireBtn.className='btn fire-btn';
    fireBtn.innerHTML='🔥 Semburan Api!';
    if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
      fireBtn.disabled = true;
      fireBtn.style.opacity = '0.5';
      fireBtn.style.cursor = 'not-allowed';
      fireBtn.title = 'Tidak bisa menggunakan skill saat Golden Hour';
    } else {
      fireBtn.onclick=()=>startFireBreath(d);
    }
    area.appendChild(fireBtn);
    return;
  }

  if(ctx.type==='piece'){
    const info=document.createElement('div');
    info.style.cssText='font-size:11px;color:var(--text-muted);margin-bottom:6px;';
    info.textContent=`${PIECE_EMOJIS[ctx.piece]} ${COLS[ctx.c]}${8-ctx.r} — ${validMoves.length} langkah`;
    area.appendChild(info);

    if (ctx.piece[1] === 'W') {
      const chargeCount = warlordCharges[currentTurn] || 0;
      const promoteBtn = document.createElement('button');
      promoteBtn.className = 'btn';
      promoteBtn.style.marginTop = '4px';
      promoteBtn.innerHTML = `⚔️ Promosi Bidak (${chargeCount}/2)`;
      
      if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
        promoteBtn.disabled = true;
        promoteBtn.style.opacity = '0.5';
        promoteBtn.style.cursor = 'not-allowed';
        promoteBtn.title = 'Tidak bisa menggunakan skill saat Golden Hour';
      } else if (chargeCount <= 0) {
        promoteBtn.disabled = true;
        promoteBtn.style.opacity = '0.5';
        promoteBtn.style.cursor = 'not-allowed';
      } else {
        promoteBtn.onclick = () => startWarlordPromotion(ctx.r, ctx.c);
      }
      area.appendChild(promoteBtn);
    }
  }
}

function startFireBreath(dragon){
  showDirectionButtons(dragon);
}

function cancelFireBreath(){
  pendingFireBreath=null;
  renderBoard();
  updateActionsArea(null);
}

function startWarlordPromotion(r, c) {
  pendingWarlordPromotion = { r, c };
  renderBoard();

  const area = document.getElementById('actionsArea');
  if (!area) return;
  area.innerHTML = '';

  const info = document.createElement('div');
  info.style.cssText = 'font-size: 11px; color: var(--gold); margin-bottom: 8px; font-weight: bold; text-align: center; width: 100%;';
  info.textContent = 'PILIH PION YANG DIHIGHLIGHT DI SEKITAR WARLORD';
  area.appendChild(info);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Batal';
  cancelBtn.onclick = () => {
    pendingWarlordPromotion = null;
    selectedCell = null;
    validMoves = [];
    updateActionsArea(null);
    renderBoard();
  };
  area.appendChild(cancelBtn);
}

function showWarlordPromoChoices(tr, tc) {
  const area = document.getElementById('actionsArea');
  if (!area) return;
  area.innerHTML = '';

  const label = document.createElement('div');
  label.style.cssText = 'font-size: 11px; color: var(--gold); margin-bottom: 8px; font-weight: bold; width: 100%; text-align: center;';
  label.textContent = 'PROMOSI PION KE:';
  area.appendChild(label);

  const choices = [
    { type: 'N', name: 'Kuda', emoji: PIECE_EMOJIS[`${currentTurn}N`] },
    { type: 'B', name: 'Gajah', emoji: PIECE_EMOJIS[`${currentTurn}B`] },
    { type: 'R', name: 'Benteng', emoji: PIECE_EMOJIS[`${currentTurn}R`] }
  ];

  choices.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'margin: 4px; display: inline-flex; align-items: center; gap: 4px;';
    btn.innerHTML = `<span style="font-size: 16px;">${ch.emoji}</span> ${ch.name}`;
    btn.onclick = () => {
      if (pendingWarlordPromotion) {
        executeWarlordPromote(currentTurn, pendingWarlordPromotion.r, pendingWarlordPromotion.c, tr, tc, ch.type);
      }
    };
    area.appendChild(btn);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.style.cssText = 'margin: 4px;';
  cancelBtn.textContent = 'Batal';
  cancelBtn.onclick = () => {
    pendingWarlordPromotion = null;
    selectedCell = null;
    validMoves = [];
    updateActionsArea(null);
    renderBoard();
  };
  area.appendChild(cancelBtn);
}

function showDirectionButtons(dragon, activeDirection = null) {
  const area = document.getElementById('actionsArea');
  if (!area) return;
  area.innerHTML = '';

  const label = document.createElement('div');
  label.style.cssText = 'font-size: 11px; color: var(--gold); margin-bottom: 8px; font-weight: bold; width: 100%; text-align: center;';
  label.textContent = 'PILIH ARAH SEMBURAN:';
  area.appendChild(label);

  const directions = [
    { name: '↖️', code: 'UL' }, { name: '⬆️', code: 'U' }, { name: '↗️', code: 'UR' },
    { name: '⬅️', code: 'L' },  { name: ' ', code: 'none' }, { name: '➡️', code: 'R' },
    { name: '↙️', code: 'DL' }, { name: '⬇️', code: 'D' }, { name: '↘️', code: 'DR' }
  ];

  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 40px); gap: 6px; justify-content: center; margin-bottom: 10px;';

  const isFlipped = (typeof isMultiplayer !== 'undefined' && isMultiplayer && myColor === 'b');

  directions.forEach(dir => {
    if (dir.code === 'none') {
      const empty = document.createElement('div');
      grid.appendChild(empty);
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;';
    btn.textContent = dir.name;
    
    // Determine the logical direction from the visual button
    let logicalCode = dir.code;
    if (isFlipped) {
      const opposites = {
        'UL': 'DR', 'U': 'D', 'UR': 'DL',
        'L': 'R', 'R': 'L',
        'DL': 'UR', 'D': 'U', 'DR': 'UL'
      };
      logicalCode = opposites[dir.code] || dir.code;
    }

    if (logicalCode === activeDirection) {
      btn.style.background = 'var(--gold-dark)';
      btn.style.color = 'var(--dark-bg)';
      btn.style.borderColor = 'var(--gold)';
    }

    btn.onclick = () => {
      previewFireBreath(dragon, logicalCode);
    };
    grid.appendChild(btn);
  });

  area.appendChild(grid);

  if (activeDirection) {
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn fire-btn';
    confirmBtn.style.marginBottom = '6px';
    confirmBtn.innerHTML = '🔥 Konfirmasi Semburan!';
    confirmBtn.onclick = () => {
      executeFireBreath(dragon, activeDirection);
    };
    area.appendChild(confirmBtn);
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Batal';
  cancelBtn.onclick = () => {
    pendingFireBreath = null;
    renderBoard();
    updateActionsArea({ type: 'dragon', dragon });
  };
  area.appendChild(cancelBtn);
}

function previewFireBreath(dragon, direction) {
  renderBoard();
  pendingFireBreath = dragon;
  const zone = getFireBreathZone(dragon, direction);
  const boardEl = document.getElementById('chessBoard');
  const isFlipped = (typeof isMultiplayer !== 'undefined' && isMultiplayer && myColor === 'b');
  if (boardEl) {
    zone.forEach(([r,c]) => {
      const idx = isFlipped ? (63 - (r*8+c)) : (r*8+c);
      if(boardEl.children[idx]) boardEl.children[idx].classList.add('fire-zone');
    });
  }
  showDirectionButtons(dragon, direction);
}

// ===== PROMOTION =====
function showPromoModal(owner){
  const modal=document.getElementById('promoModal');
  const opts=document.getElementById('promoOptions');
  if (!modal || !opts) return;
  opts.innerHTML='';
  const pieces=['Q','R','B','N'];
  const names={'Q':'Ratu','R':'Benteng','B':'Gajah','N':'Kuda'};
  for(const t of pieces){
    const btn=document.createElement('button');
    btn.className='promo-btn';
    const emoji=document.createElement('div');
    emoji.className='promo-emoji';
    emoji.textContent=PIECE_EMOJIS[`${owner}${t}`];
    const name=document.createElement('div');
    name.className='promo-name';
    name.textContent=names[t];
    btn.appendChild(emoji); btn.appendChild(name);
    btn.onclick=()=>{
      board[pendingPromotion.r][pendingPromotion.c]=`${owner}${t}`;
      modal.style.display='none';
      
      // Sync promotion in multiplayer mode!
      if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
        sendMultiplayerMessage({
          type: 'move',
          fr: pendingPromotion.fr_original,
          fc: pendingPromotion.fc_original,
          tr: pendingPromotion.r,
          tc: pendingPromotion.c,
          promoteTo: t
        });
      }
      
      pendingPromotion=null;
      addLog(`👑 Promosi ke ${names[t]}!`,'special');
      if (typeof finishMoveActions === 'function') finishMoveActions();
    };
    opts.appendChild(btn);
  }
  modal.style.display='flex';
}

// ===== GAME OVER OVERLAY =====
function showGameOver(msg){
  gameOver=true;
  const boardEl=document.getElementById('chessBoard');
  if (!boardEl) return;
  const overlay=document.createElement('div');
  overlay.className='board-message';
  overlay.innerHTML=`<h2>🏆 ${msg}</h2><p>Permainan Selesai!</p>`;
  const restartBtn=document.createElement('button');
  restartBtn.className='btn primary';
  restartBtn.textContent='Main Lagi';
  restartBtn.onclick=()=>{
    if (typeof restartGame === 'function') restartGame();
  };
  overlay.appendChild(restartBtn);
  boardEl.appendChild(overlay);
  addLog(`🏆 ${msg}`,'special');
}

// ===== LOG =====
function buildBottomActions(){
  const area=document.getElementById('bottomActions');
  if (!area) return;
  area.innerHTML = '';
  const restartBtn=document.createElement('button');
  restartBtn.className='btn';
  restartBtn.style.marginRight='8px';
  restartBtn.textContent='🔄 Mulai Ulang';
  restartBtn.onclick=restartGame;
  area.appendChild(restartBtn);

  const modeBtn=document.createElement('button');
  modeBtn.className='btn';
  modeBtn.textContent='🎮 Pilih Mode';
  modeBtn.onclick=showWelcomeScreen;
  area.appendChild(modeBtn);
}

function addLog(msg,type=''){
  const area=document.getElementById('logArea');
  if (!area) return;
  const entry=document.createElement('div');
  entry.className='log-entry'+(type?' '+type:'');
  entry.textContent=msg;
  area.insertBefore(entry,area.firstChild);
  while(area.children.length>30) area.removeChild(area.lastChild);
}

// ===== TOOLTIP =====
function showTooltip(e,r,c){
  const piece=board[r][c];
  const dragon=getDragonAt(r,c);
  const tooltip=document.getElementById('tooltip');
  if (!tooltip) return;
  let text='';
  if(dragon) text=`🐉 Naga ${dragon.owner==='w'?'Putih':'Hitam'}\nAktif — bisa semburkan api`;
  else if(piece) {
    const names={P:'Pion',N:'Kuda',B:'Gajah',R:'Benteng',Q:'Ratu',K:'Raja',U:'Uma Musume',W:'Warlord'};
    text=`${PIECE_EMOJIS[piece]} ${names[piece[1]]||piece[1]} ${piece[0]==='w'?'Putih':'Hitam'}\n${COLS[c]}${8-r}`;
  } else return;
  tooltip.textContent=text;
  tooltip.style.display='block';
  tooltip.style.left=(e.clientX+12)+'px';
  tooltip.style.top=(e.clientY-10)+'px';
}

function hideTooltip(){
  const tooltip = document.getElementById('tooltip');
  if (tooltip) {
    tooltip.style.display='none';
  }
}

// ===== RENDER EFFECT CARDS =====
function renderCards() {
  const area = document.getElementById('cardsArea');
  if (!area) return;
  area.innerHTML = '';

  // Show active Golden Hour timer widget inside the panel if Golden Hour is active
  if (typeof activeGoldenHour !== 'undefined' && activeGoldenHour !== null) {
    const timerCard = document.createElement('div');
    timerCard.style.cssText = `
      width: 100%;
      background: linear-gradient(135deg, #8a6a1a, #c8a84b);
      border: 2px solid var(--gold-light);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(200, 168, 75, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      animation: pulseGold 1.5s ease-in-out infinite;
      box-sizing: border-box;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 10px; font-weight: bold; color: #000; letter-spacing: 1px; text-transform: uppercase;';
    title.textContent = '⏱️ Golden Hour Aktif';

    const timerNum = document.createElement('div');
    timerNum.id = 'goldenHourTimerSide';
    timerNum.style.cssText = 'font-family: "Cinzel Decorative", cursive; font-size: 24px; font-weight: 900; color: #000; text-shadow: 0 0 10px rgba(255,255,255,0.6);';
    timerNum.textContent = activeGoldenHour.timeLeft.toFixed(1) + 's';

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: 8px; font-weight: bold; color: rgba(0,0,0,0.8); line-height: 1.2;';
    desc.textContent = 'Gerak bebas! Bidak Anda tidak bisa memakan lawan.';

    timerCard.appendChild(title);
    timerCard.appendChild(timerNum);
    timerCard.appendChild(desc);
    area.appendChild(timerCard);
    return;
  }

  const cards = playerCards[currentTurn] || [];
  
  if (cards.length === 0) {
    const emptyText = document.createElement('div');
    emptyText.style.cssText = 'font-size:11px;color:var(--text-muted);text-align:center;width:100%;padding:10px 0;';
    emptyText.textContent = currentTurn === 'w' ? 'Putih tidak memiliki kartu.' : 'Hitam tidak memiliki kartu.';
    area.appendChild(emptyText);
    return;
  }

  const cardDetails = {
    'rewind': {
      name: 'Rewind',
      desc: 'Rewind for 3 turn',
      emoji: '⏮️',
      color: '#ffffff'
    },
    'golden_hour': {
      name: 'Golden Hour',
      desc: 'Free Move for 5 second but cannot kill other piece',
      emoji: '⏱️',
      color: '#ffffff'
    }
  };

  cards.forEach(cardId => {
    const details = cardDetails[cardId];
    if (!details) return;

    const cardEl = document.createElement('div');
    cardEl.className = 'effect-card';
    
    const isAIDeciding = gameMode === 'vsAI' && currentTurn === 'b';
    if (isAIDeciding || gameOver) {
      cardEl.classList.add('disabled');
    } else {
      cardEl.onclick = (e) => {
        e.stopPropagation();
        if (typeof useCard === 'function') {
          useCard(currentTurn, cardId);
        }
      };
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'card-inner-title';
    titleEl.textContent = details.name;
    cardEl.appendChild(titleEl);

    const imgEl = document.createElement('div');
    imgEl.className = 'card-img-container';
    if (cardId === 'rewind') {
      imgEl.innerHTML = `<span style="font-size:28px;color:#333;display:flex;align-items:center;justify-content:center;height:100%;">${details.emoji}</span>`;
    } else if (cardId === 'golden_hour') {
      imgEl.innerHTML = `<span style="font-size:28px;color:#d89810;display:flex;align-items:center;justify-content:center;height:100%;">${details.emoji}</span>`;
    }
    cardEl.appendChild(imgEl);

    const descEl = document.createElement('div');
    descEl.className = 'card-desc-container';
    descEl.textContent = details.desc;
    cardEl.appendChild(descEl);

    area.appendChild(cardEl);
  });
}
