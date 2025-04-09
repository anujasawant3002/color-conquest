// server/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const { Worker } = require('worker_threads');
const Game = require('./game/Game');
const Logger = require('./utils/Logger');
const TokenManager = require('./utils/TokenManager');
const ClockSync = require('./utils/ClockSync');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

// Handle favicon specifically to avoid 404
app.get('/favicon.ico', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../client/assets/favicon.ico'));
  } catch (err) {
    // If file doesn't exist, send a 204 No Content response
    res.status(204).end();
  }
});

const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active games
const activeGames = new Map();

// Initialize utilities
const tokenManager = new TokenManager();
const clockSync = new ClockSync();

// Initialize worker pool
const NUM_WORKERS = 4;
const workers = [];

for (let i = 0; i < NUM_WORKERS; i++) {
  const worker = new Worker(path.join(__dirname, 'workers/gameWorker.js'));
  
  worker.on('message', (data) => {
    handleWorkerMessage(data, worker.threadId);
  });
  
  worker.on('error', (err) => {
    Logger.log(`Worker ${worker.threadId} error: ${err.message}`);
  });
  
  workers.push({
    worker: worker,
    busy: false
  });
}

// Map to track which worker is handling which task
const pendingTasks = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  Logger.log(`Client connected: ${socket.id}`);

  // Handle clock synchronization
  socket.on('SYNC_TIME', (data) => {
    const syncData = clockSync.syncTime(socket.id, data.clientTime);
    socket.emit('TIME_SYNCED', syncData);
  });
  
  // Handle token requests
  socket.on('REQUEST_TOKEN', (data) => {
    const gameId = data.gameId;
    const game = activeGames.get(gameId);
    
    if (!game) {
      socket.emit('ERROR', { message: 'Game not found' });
      return;
    }
    
    // Only grant token if it's this player's turn
    const isPlayerTurn = game.currentTurn === socket.id;
    
    tokenManager.requestToken(socket.id, (granted) => {
      // Override token manager's decision if it's player's turn
      const finalGranted = isPlayerTurn ? true : granted;
      
      socket.emit('TOKEN_RESPONSE', { granted: finalGranted });
      
      if (finalGranted) {
        // Forcibly set this player as token holder
        tokenManager.setTokenHolder(socket.id);
        
        // Notify other players in the game
        socket.to(gameId).emit('TOKEN_STATUS', {
          holder: socket.id,
          holderName: game.getPlayerName(socket.id)
        });
      }
    });
  });
  
  // Handle token release
  socket.on('RELEASE_TOKEN', () => {
    tokenManager.releaseToken(socket.id);
  });

  // Handle game creation
  socket.on('CREATE_GAME', (data) => {
    const gameId = generateGameId();
    const game = new Game(gameId, data.boardSize || 10);
    const player = game.addPlayer(socket.id, data.playerName, getRandomColor());
    
    activeGames.set(gameId, game);
    socket.join(gameId);

    // Automatically give the token to the game creator
    tokenManager.setTokenHolder(socket.id);
    
    socket.emit('GAME_CREATED', {
      gameId: gameId,
      playerId: player.id,
      playerColor: player.color
    });

    // Add this to notify client they have the token
    socket.emit('TOKEN_RESPONSE', { granted: true });
    
    Logger.log(`Game created: ${gameId} by player ${player.id}`);
  });

  // Handle joining existing game
  socket.on('JOIN_GAME', (data) => {
    const gameId = data.gameId;
    const game = activeGames.get(gameId);
    
    if (!game) {
      socket.emit('ERROR', { message: 'Game not found' });
      return;
    }
    
    if (game.players.size >= 4) {
      socket.emit('ERROR', { message: 'Game is full' });
      return;
    }
    
    const player = game.addPlayer(socket.id, data.playerName, getRandomColor());
    socket.join(gameId);
    
    socket.emit('GAME_JOINED', {
      gameId: gameId,
      playerId: player.id,
      playerColor: player.color,
      boardState: game.getBoardState(),
      currentTokenHolder: tokenManager.tokenHolder,
      isYourTurn: game.currentTurn === socket.id
    });
    // If it's their turn, give them the token
    if (game.currentTurn === socket.id) {
      tokenManager.setTokenHolder(socket.id);
      socket.emit('TOKEN_RESPONSE', { granted: true });
      console.log(`Player ${socket.id} given token as current turn holder`);
    }
    
    // Notify other players
    socket.to(gameId).emit('PLAYER_JOINED', {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color
    });
    
    Logger.log(`Player ${player.id} joined game ${gameId}`);
  });

  // Handle placing a tile
  socket.on('PLACE_TILE', (data) => {
    const gameId = data.gameId;
    const game = activeGames.get(gameId);
    
    if (!game) {
      socket.emit('ERROR', { message: 'Game not found' });
      return;
    }
    
    // Check if player has the token
    if (!tokenManager.hasToken(socket.id)) {
      socket.emit('ERROR', { message: 'You don\'t have permission to place a tile' });
      return;
    }
    
    // Find available worker
    const availableWorker = workers.find(w => !w.busy);
    if (!availableWorker) {
      socket.emit('ERROR', { message: 'Server is busy, try again in a moment' });
      return;
    }
    
    // Mark worker as busy
    availableWorker.busy = true;
    
    // Adjust client timestamp to server time
    const serverTimestamp = clockSync.adjustToServerTime(socket.id, data.clientTimestamp || Date.now());
    
    // Create a unique task ID
    const taskId = `${socket.id}-${Date.now()}`;
    
    // Send task to worker
    availableWorker.worker.postMessage({
      type: 'PROCESS_MOVE',
      payload: {
        boardState: game.getBoardState(),
        x: data.x,
        y: data.y,
        playerId: socket.id,
        timestamp: serverTimestamp
      }
    });
    
    // Store task info
    pendingTasks.set(taskId, {
      workerId: availableWorker.worker.threadId,
      socket: socket,
      gameId: gameId,
      game: game,
      x: data.x,
      y: data.y
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    // Release token if player had it
    tokenManager.handleDisconnect(socket.id);
    
    // Remove time syncing data
    clockSync.removeClient(socket.id);
    
    // Find games this player is in
    for (const [gameId, game] of activeGames.entries()) {
      if (game.hasPlayer(socket.id)) {
        game.removePlayer(socket.id);
        
        // Notify other players
        socket.to(gameId).emit('PLAYER_LEFT', { playerId: socket.id });
        
        // If no players left, remove the game
        if (game.players.size === 0) {
          activeGames.delete(gameId);
          Logger.log(`Game ${gameId} ended - no players left`);
        }
        
        break;
      }
    }
    
    Logger.log(`Client disconnected: ${socket.id}`);
  });
});

// Handle worker messages
function handleWorkerMessage(data, threadId) {
  const { type, payload } = data;
  
  // Find the worker
  const worker = workers.find(w => w.worker.threadId === threadId);
  if (!worker) return;
  
  // Find pending task for this worker
  let taskInfo = null;
  let taskId = null;
  
  for (const [id, task] of pendingTasks.entries()) {
    if (task.workerId === threadId) {
      taskInfo = task;
      taskId = id;
      break;
    }
  }
  
  if (!taskInfo) {
    worker.busy = false;
    return;
  }
  
  switch (type) {
    case 'MOVE_PROCESSED':
      if (payload.success) {
        const { socket, gameId, game, x, y } = taskInfo;
        
        // Update game state
        game.updateBoard(payload.boardState);
        const nextPlayer = game.advanceTurn();
        
        // Release current token
        tokenManager.releaseToken(socket.id);

        // Automatically grant token to next player
        if (nextPlayer) {
          tokenManager.setTokenHolder(nextPlayer);
          
          // Notify the player it's their turn and they have the token
          const nextPlayerSocket = io.sockets.sockets.get(nextPlayer);
          if (nextPlayerSocket) {
            nextPlayerSocket.emit('TOKEN_RESPONSE', { granted: true });
            
            // Notify all players whose turn it is
            io.to(gameId).emit('TOKEN_STATUS', {
              holder: nextPlayer,
              holderName: game.getPlayerName(nextPlayer)
            });
          }
        }
        
        // Calculate territories
        worker.worker.postMessage({
          type: 'CALCULATE_TERRITORY',
          payload: {
            boardState: payload.boardState,
            lastMove: { x, y, playerId: socket.id }
          }
        });
        
        // Keep task pending for territory calculation
      } else {
        // Move failed, release worker
        worker.busy = false;
        pendingTasks.delete(taskId);
        
        // Notify player of failure
        taskInfo.socket.emit('ERROR', { message: payload.message });
        
        // Release token
        tokenManager.releaseToken(taskInfo.socket.id);
      }
      break;
      
    case 'TERRITORIES_CALCULATED':
      const { socket, gameId, game, x, y } = taskInfo;
      
      // Update claimed territories
      game.updateTerritories(payload);
      
      // Broadcast updated board to all players in the game
      io.to(gameId).emit('BOARD_UPDATED', {
        boardState: game.getBoardState(),
        lastMove: { x, y, playerId: socket.id },
        claimedTerritories: payload
      });
      
      // Check if game is over
      if (game.isGameOver()) {
        const scores = game.calculateScores();
        io.to(gameId).emit('GAME_OVER', { scores });
        activeGames.delete(gameId);
      }
      
      // Release token
      tokenManager.releaseToken(socket.id);
      
      // Clean up
      worker.busy = false;
      pendingTasks.delete(taskId);
      break;
  }
}

// Helper functions
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRandomColor() {
  const colors = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  Logger.log(`Server running on port ${PORT}`);
});