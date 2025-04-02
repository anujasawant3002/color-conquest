// server/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const Game = require('./game/Game');
const Logger = require('./utils/Logger');

// Initialize Express app
const app = express();
app.use(cors());
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

// Socket.IO connection handler
io.on('connection', (socket) => {
  Logger.log(`Client connected: ${socket.id}`);

  // Handle game creation
  socket.on('CREATE_GAME', (data) => {
    const gameId = generateGameId();
    const game = new Game(gameId, data.boardSize || 10);
    const player = game.addPlayer(socket.id, data.playerName, getRandomColor());
    
    activeGames.set(gameId, game);
    socket.join(gameId);
    
    socket.emit('GAME_CREATED', {
      gameId: gameId,
      playerId: player.id,
      playerColor: player.color
    });
    
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
      boardState: game.getBoardState()
    });
    
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
    
    const result = game.placeTile(socket.id, data.x, data.y);
    
    if (result.success) {
      // Broadcast updated board to all players in the game
      io.to(gameId).emit('BOARD_UPDATED', {
        boardState: game.getBoardState(),
        lastMove: { x: data.x, y: data.y, playerId: socket.id },
        claimedTerritories: result.claimedTerritories
      });
      
      // Check if game is over
      if (game.isGameOver()) {
        const scores = game.calculateScores();
        io.to(gameId).emit('GAME_OVER', { scores });
        activeGames.delete(gameId);
      }
    } else {
      socket.emit('ERROR', { message: result.message });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
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