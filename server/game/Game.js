// server/game/Game.js
const Board = require('./Board');
const Player = require('./Player');
const TerritoryCalculator = require('./TerritoryCalculator');

class Game {
  constructor(id, boardSize = 10) {
    this.id = id;
    this.board = new Board(boardSize);
    this.players = new Map();
    this.currentTurn = null;
    this.gameStarted = false;
    this.territoryCalculator = new TerritoryCalculator(this.board);
  }

  addPlayer(id, name, color) {
    const player = new Player(id, name, color);
    this.players.set(id, player);
    
    // First player gets the first turn
    if (this.players.size === 1) {
      this.currentTurn = id;
    }
    
    // Start game if we have at least 2 players
    if (this.players.size >= 2) {
      this.gameStarted = true;
    }
    
    return player;
  }
  
  removePlayer(id) {
    this.players.delete(id);
    
    // If it was this player's turn, move to next player
    if (this.currentTurn === id) {
      this.advanceTurn();
    }
    
    // End game if less than 2 players
    if (this.players.size < 2) {
      this.gameStarted = false;
    }
  }
  
  hasPlayer(id) {
    return this.players.has(id);
  }
  
  placeTile(playerId, x, y) {
    // Check if it's this player's turn
    if (playerId !== this.currentTurn) {
      return { success: false, message: "Not your turn" };
    }
    
    // Check if the move is valid
    if (!this.board.isValidMove(x, y)) {
      return { success: false, message: "Invalid move" };
    }
    
    // Get player color
    const player = this.players.get(playerId);
    
    // Place the tile
    this.board.placeTile(x, y, player.color);
    
    // Calculate territories claimed by this move
    const claimedTerritories = this.territoryCalculator.calculateClaimedTerritories(x, y, player.color);
    
    // Update player's territory count
    player.territory += claimedTerritories.length;
    
    // Advance to next player's turn
    this.advanceTurn();
    
    return { 
      success: true, 
      claimedTerritories 
    };
  }
  
  advanceTurn() {
    // Get array of player IDs
    const playerIds = Array.from(this.players.keys());
    
    if (playerIds.length === 0) return;
    
    // Find current player index
    const currentIndex = playerIds.indexOf(this.currentTurn);
    
    // Move to next player
    const nextIndex = (currentIndex + 1) % playerIds.length;
    this.currentTurn = playerIds[nextIndex];
  }
  
  getBoardState() {
    return {
      size: this.board.size,
      tiles: this.board.tiles,
      currentTurn: this.currentTurn,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        territory: p.territory
      }))
    };
  }
  
  isGameOver() {
    // Game is over when board is full
    return this.board.isFull();
  }
  
  calculateScores() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      territory: p.territory
    })).sort((a, b) => b.territory - a.territory);
  }
}

module.exports = Game;