   // client/js/NetworkManager.js
class NetworkManager {
  constructor(serverUrl) {
    this.socket = io(serverUrl);
    this.setupSocketListeners();
    
    // Token and sync properties
    this.hasToken = false;
    this.tokenHolder = null;
    this.timeOffset = 0;
    this.lastSyncTime = 0;
    
    // Event callbacks - to be set by the main app
    this.onGameCreated = null;
    this.onGameJoined = null;
    this.onBoardUpdated = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onGameOver = null;
    this.onError = null;
    this.onTokenReceived = null;
    this.onTokenReleased = null;
    this.onTokenStatusChange = null;
    
    // Start time sync
    this.syncTime();
    setInterval(() => this.syncTime(), 60000); // Sync every minute
  }
  
  setupSocketListeners() {
    this.socket.on('GAME_CREATED', (data) => {
      if (this.onGameCreated) this.onGameCreated(data);
    });
    
    this.socket.on('GAME_JOINED', (data) => {
      // Set token holder if available
      if (data.currentTokenHolder) {
        this.tokenHolder = data.currentTokenHolder;
      }
      
      if (this.onGameJoined) this.onGameJoined(data);
    });

     // In NetworkManager.js's setupSocketListeners method, add:
     this.socket.on('TURN_CHANGED', (data) => {
     // Update whose turn it is
     this.currentTurn = data.currentTurn;
  
     // If it's my turn, request the token
     if (this.socket.id === data.currentTurn && !this.hasToken) {
     this.requestToken(this.gameId);
      }
     });
    
    this.socket.on('BOARD_UPDATED', (data) => {
      if (this.onBoardUpdated) this.onBoardUpdated(data);
    });
    
    this.socket.on('PLAYER_JOINED', (data) => {
      if (this.onPlayerJoined) this.onPlayerJoined(data);
    });
    
    this.socket.on('PLAYER_LEFT', (data) => {
      if (this.onPlayerLeft) this.onPlayerLeft(data);
    });
    
    this.socket.on('GAME_OVER', (data) => {
      if (this.onGameOver) this.onGameOver(data);
    });
    
    this.socket.on('ERROR', (data) => {
      if (this.onError) this.onError(data);
    });
    
    // Token management
    this.socket.on('TOKEN_RESPONSE', (data) => {
      this.hasToken = data.granted;
      
      if (this.hasToken) {
        if (this.onTokenReceived) this.onTokenReceived();
      } else {
        if (this.onTokenReleased) this.onTokenReleased();
      }
    });
    
    this.socket.on('TOKEN_STATUS', (data) => {
      this.tokenHolder = data.holder;
      
      if (this.onTokenStatusChange) {
        this.onTokenStatusChange(data);
      }
    });
    
    // Time synchronization
    this.socket.on('TIME_SYNCED', (data) => {
      const now = Date.now();
      const roundTripTime = now - data.clientSentTime;
      const oneWayLatency = Math.floor(roundTripTime / 2);
      
      // Calculate and store offset
      this.timeOffset = data.serverTime - data.clientSentTime - oneWayLatency;
      this.lastSyncTime = now;
      
      console.log(`Time synchronized, offset: ${this.timeOffset}ms, latency: ${oneWayLatency}ms`);
    });
  }
  
  // Time synchronization
  syncTime() {
    this.socket.emit('SYNC_TIME', {
      clientTime: Date.now()
    });
  }
  
  // Get synchronized server time
  getServerTime() {
    return Date.now() + this.timeOffset;
  }
  
  // Token management
  requestToken(gameId) {
    return new Promise((resolve) => {
      this.socket.emit('REQUEST_TOKEN', { gameId });
      this.socket.once('TOKEN_RESPONSE', (data) => {
        this.hasToken = data.granted;
        resolve(data.granted);
      });
    });
  }
  
  releaseToken() {
    this.socket.emit('RELEASE_TOKEN');
    this.hasToken = false;
    
    if (this.onTokenReleased) {
      this.onTokenReleased();
    }
  }
  
  // Game creation/joining
  createGame(playerName, boardSize = 10) {
    this.socket.emit('CREATE_GAME', {
      playerName,
      boardSize
    });
  }
  
  joinGame(gameId, playerName) {
    this.socket.emit('JOIN_GAME', {
      gameId,
      playerName
    });
  }
  
  // Game actions
 // In NetworkManager.js - replace the placeTile method with this:
placeTile(gameId, x, y) {
  console.log("Placing tile, hasToken:", this.hasToken);
  if (!this.hasToken) {
    console.log("No token, requesting one");
    this.requestToken(gameId).then(granted => {
      console.log("Token request response:", granted);
      if (granted) {
        // Now we have the token, send the placement
        this.socket.emit('PLACE_TILE', {
          gameId,
          x,
          y,
          clientTimestamp: Date.now()
        });
      }else {
        console.log("Token request denied");
      }
    });
    return false;
  }
  
  // We already have the token, just place the tile
  console.log("Already have token, placing tile");
  this.socket.emit('PLACE_TILE', {
    gameId,
    x,
    y,
    clientTimestamp: Date.now()
  });
  
  return true;
}
  disconnect() {
    this.socket.disconnect();
  }
}