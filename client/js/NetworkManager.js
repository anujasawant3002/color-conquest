// client/js/NetworkManager.js
class NetworkManager {
    constructor(serverUrl) {
      this.socket = io(serverUrl);
      this.socket.on('BOARD_UPDATED', (data) => {
        console.log("Board updated:", data);
        if (this.onBoardUpdated) this.onBoardUpdated(data);
      });
      this.setupSocketListeners();
      
      // Event callbacks - to be set by the main app
      this.onGameCreated = null;
      this.onGameJoined = null;
      this.onBoardUpdated = null;
      this.onPlayerJoined = null;
      this.onPlayerLeft = null;
      this.onGameOver = null;
      this.onError = null;
    }
    
    setupSocketListeners() {
      this.socket.on('GAME_CREATED', (data) => {
        if (this.onGameCreated) this.onGameCreated(data);
      });
      
      this.socket.on('GAME_JOINED', (data) => {
        if (this.onGameJoined) this.onGameJoined(data);
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
    }
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
    placeTile(gameId, x, y) {
    this.socket.emit('PLACE_TILE', {
    gameId,
    x,
    y
    });
    }
    disconnect() {
    this.socket.disconnect();
    }
    }