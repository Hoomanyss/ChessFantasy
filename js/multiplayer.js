// ===== ONLINE MULTIPLAYER CONTROLLER (WEBRTC VIA PEERJS) =====

let peer = null;
let myReady = false;
let peerReady = false;

// Navigation & Screen transitions
function showMultiplayerMenu() {
  document.getElementById('mainMenuOptions').style.display = 'none';
  document.getElementById('lobbyPanel').style.display = 'none';
  document.getElementById('joinRoomPanel').style.display = 'none';
  document.getElementById('multiplayerOptions').style.display = 'flex';
}

function showMainMenu() {
  document.getElementById('multiplayerOptions').style.display = 'none';
  document.getElementById('lobbyPanel').style.display = 'none';
  document.getElementById('joinRoomPanel').style.display = 'none';
  document.getElementById('mainMenuOptions').style.display = 'flex';
}

function showJoinRoomPanel() {
  document.getElementById('multiplayerOptions').style.display = 'none';
  document.getElementById('lobbyPanel').style.display = 'none';
  document.getElementById('joinRoomPanel').style.display = 'flex';
  document.getElementById('joinRoomInput').value = '';
  document.getElementById('joinStatus').textContent = 'Masukkan 4 digit kode angka.';
}

function startCreateRoom() {
  document.getElementById('multiplayerOptions').style.display = 'none';
  document.getElementById('lobbyPanel').style.display = 'flex';
  
  // Generate random 4-digit code
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  document.getElementById('roomCodeDisplay').textContent = code;
  document.getElementById('lobbyStatus').textContent = 'Menghubungkan ke server PeerJS...';
  
  myReady = false;
  peerReady = false;
  updateStartButtonUI();
  
  // Create Host Peer
  if (peer) peer.destroy();
  
  peer = new Peer('chessf-room-' + code);
  
  peer.on('open', (id) => {
    document.getElementById('lobbyStatus').textContent = 'Room aktif! Menunggu lawan bergabung...';
  });
  
  peer.on('connection', (connection) => {
    conn = connection;
    isMultiplayer = true;
    myColor = 'w'; // Host plays White
    
    setupConnectionCallbacks(conn);
    
    document.getElementById('lobbyStatus').textContent = 'Pemain bergabung! Silakan menekan Start.';
    document.getElementById('lobbyStartBtn').disabled = false;
  });
  
  peer.on('error', (err) => {
    console.error(err);
    document.getElementById('lobbyStatus').textContent = 'Gagal membuat room. Coba lagi.';
  });
}

function submitJoinRoom() {
  const code = document.getElementById('joinRoomInput').value.trim();
  if (code.length !== 4) {
    document.getElementById('joinStatus').textContent = '⚠️ Kode harus 4 digit!';
    return;
  }
  
  document.getElementById('joinStatus').textContent = 'Menghubungkan ke room...';
  
  myReady = false;
  peerReady = false;
  updateStartButtonUI();
  
  if (peer) peer.destroy();
  
  peer = new Peer(); // Guest gets a random ID
  
  peer.on('open', (id) => {
    conn = peer.connect('chessf-room-' + code);
    
    conn.on('open', () => {
      isMultiplayer = true;
      myColor = 'b'; // Guest plays Black
      
      setupConnectionCallbacks(conn);
      
      document.getElementById('roomCodeDisplay').textContent = code;
      document.getElementById('joinRoomPanel').style.display = 'none';
      document.getElementById('lobbyPanel').style.display = 'flex';
      document.getElementById('lobbyStatus').textContent = 'Terhubung! Silakan menekan Start.';
      document.getElementById('lobbyStartBtn').disabled = false;
    });
    
    conn.on('error', (err) => {
      console.error(err);
      document.getElementById('joinStatus').textContent = '⚠️ Room tidak ditemukan atau gagal terhubung.';
    });
  });
  
  peer.on('error', (err) => {
    console.error(err);
    document.getElementById('joinStatus').textContent = '⚠️ Gagal inisialisasi jaringan.';
  });
}

function setupConnectionCallbacks(connection) {
  connection.on('data', (data) => {
    console.log('Received online message:', data);
    handleMultiplayerMessage(data);
  });
  
  connection.on('close', () => {
    addLog('🔌 Koneksi terputus! Lawan meninggalkan permainan.', 'special');
    alert('Koneksi terputus! Lawan keluar dari room.');
    leaveLobby();
  });
  
  connection.on('error', (err) => {
    console.error('Connection error:', err);
    leaveLobby();
  });
}

function toggleReady() {
  myReady = !myReady;
  sendMultiplayerMessage({ type: 'ready', value: myReady });
  updateStartButtonUI();
  checkStartMatch();
}

function updateStartButtonUI() {
  const btn = document.getElementById('lobbyStartBtn');
  if (!btn) return;
  
  if (myReady) {
    btn.classList.add('btn-start-ready');
    btn.style.background = '#28a745';
    btn.style.color = '#fff';
    btn.style.borderColor = '#218838';
    
    if (!peerReady) {
      btn.textContent = ' Waiting 1/2';
    } else {
      btn.textContent = ' Ready 2/2';
    }
  } else {
    btn.classList.remove('btn-start-ready');
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.textContent = '🎮 START (WAITING 1/2)';
  }
}

function checkStartMatch() {
  if (myReady && peerReady) {
    // Start game
    setTimeout(() => {
      startMultiplayerMatch();
    }, 500);
  }
}

function startMultiplayerMatch() {
  // Hide overlays
  document.getElementById('welcomeOverlay').style.display = 'none';
  
  // Reset game state
  gameMode = 'vsPlayer'; // Standard 2-player mode but synced
  playerCards = { w: [], b: [] };
  playerTurnCount = { w: 1, b: 0 };
  if (activeGoldenHour && activeGoldenHour.timerId) {
    clearInterval(activeGoldenHour.timerId);
  }
  activeGoldenHour = null;
  gameHistory = [];
  
  initBoard();
  saveHistoryState();
  
  addLog(`⚔️ Pertandingan online dimulai! Anda sebagai ${myColor === 'w' ? 'PUTIH' : 'HITAM'}.`, 'special');
  renderBoard();
}

function leaveLobby() {
  isMultiplayer = false;
  conn = null;
  if (peer) {
    peer.destroy();
    peer = null;
  }
  
  // Show welcome screen
  document.getElementById('welcomeOverlay').style.display = 'flex';
  showMainMenu();
}

// Network Message Sender
function sendMultiplayerMessage(data) {
  if (conn && conn.open) {
    conn.send(data);
  }
}

// Network Message Handler
function handleMultiplayerMessage(data) {
  if (!data) return;
  
  switch (data.type) {
    case 'ready':
      peerReady = data.value;
      updateStartButtonUI();
      checkStartMatch();
      break;
      
    case 'move':
      // Execute opponent move on local board
      // Find source cell piece
      const pieceOnSource = board[data.fr][data.fc];
      const isUmaMove = pieceOnSource && pieceOnSource[1] === 'U';
      const isCapture = board[data.tr][data.tc] && board[data.tr][data.tc][0] !== currentTurn;
      
      const dragon = getDragonAt(data.fr, data.fc);
      
      if (isUmaMove && isCapture) {
        // executeUmaKick handles turn ending itself
        executeUmaKick(data.fr, data.fc, data.tr, data.tc);
      } else if (dragon) {
        moveDragon(dragon, data.tr, data.tc);
      } else {
        movePiece(data.fr, data.fc, data.tr, data.tc, data.promoteTo);
      }
      break;
      
    case 'fire':
      // Execute opponent dragon fire breath
      const fireDragon = getDragonAt(data.dragonRow, data.dragonCol);
      if (fireDragon) {
        executeFireBreath(fireDragon, data.direction);
      }
      break;
      
    case 'card':
      // Execute opponent card usage
      const opponentColor = myColor === 'w' ? 'b' : 'w';
      
      // Make sure opponent hand has the card (mock insert if needed to pass check)
      if (!playerCards[opponentColor]) {
        playerCards[opponentColor] = [];
      }
      if (!playerCards[opponentColor].includes(data.cardId)) {
        playerCards[opponentColor].push(data.cardId);
      }
      
      useCard(opponentColor, data.cardId);
      break;

    case 'warlord_promote':
      const oppColor = myColor === 'w' ? 'b' : 'w';
      executeWarlordPromote(oppColor, data.wr, data.wc, data.tr, data.tc, data.promoteTo);
      break;

    case 'restart':
      addLog('🔄 Lawan memulai ulang permainan.', 'special');
      restartGame(true);
      break;
  }
}
