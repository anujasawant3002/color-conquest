// client/js/GameBoard.js
class GameBoard {
    constructor(canvas, size, networkManager) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.size = size;
      this.networkManager = networkManager;
      this.gameId = null;
      this.tileSize = 40; // pixels per tile
      this.interactive = true;
      
      // Set canvas dimensions
      this.canvas.width = size * this.tileSize;
      this.canvas.height = size * this.tileSize;
      
      // Board state
      this.tiles = Array(size).fill().map(() => Array(size).fill(null));
      this.territories = Array(size).fill().map(() => Array(size).fill(null));
      this.players = [];
      this.currentTurn = null;
      
      // Animation properties
      this.animating = false;
      this.highlightedCells = [];
      this.highlightAlpha = 1;
      this.highlightTimer = null;
      
      // Add event listener
      this.canvas.addEventListener('click', this.handleClick.bind(this));
      
      // Initial render
      this.render();
    }
    
    setGameId(gameId) {
      this.gameId = gameId;
    }
    
    setInteractive(interactive) {
      this.interactive = interactive;
    }
    
    updateBoard(boardState) {
      this.size = boardState.size;
      this.tiles = boardState.tiles;
      this.territories = boardState.territories || Array(this.size).fill().map(() => Array(this.size).fill(null));
      this.players = boardState.players;
      this.currentTurn = boardState.currentTurn;
      
      this.render();
    }
    
    handleClick(event) {
      if (!this.interactive || !this.gameId) return;
      
      // Get click coordinates relative to canvas
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / this.tileSize);
      const y = Math.floor((event.clientY - rect.top) / this.tileSize);
      
      // Check if valid move
      if (x >= 0 && x < this.size && y >= 0 && y < this.size && this.tiles[y][x] === null) {
        this.networkManager.placeTile(this.gameId, x, y);
      }
    }
    
    highlightTerritory(cells) {
      // Clear any existing highlight
      clearTimeout(this.highlightTimer);
      
      // Set new highlighted cells
      this.highlightedCells = cells;
      this.highlightAlpha = 1;
      this.animating = true;
      
      // Start animation
      this.animateHighlight();
    }
    
    animateHighlight() {
      // Decrease alpha over time
      this.highlightAlpha -= 0.02;
      
      // Render with highlight
      this.render();
      
      if (this.highlightAlpha > 0) {
        // Continue animation
        this.highlightTimer = setTimeout(() => {
          requestAnimationFrame(this.animateHighlight.bind(this));
        }, 20);
      } else {
        // End animation
        this.animating = false;
        this.highlightedCells = [];
      }
    }
    
    render() {
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw grid
      this.ctx.strokeStyle = '#ddd';
      this.ctx.lineWidth = 1;
      
      for (let i = 0; i <= this.size; i++) {
        // Vertical lines
        this.ctx.beginPath();
        this.ctx.moveTo(i * this.tileSize, 0);
        this.ctx.lineTo(i * this.tileSize, this.size * this.tileSize);
        this.ctx.stroke();
        
        // Horizontal lines
        this.ctx.beginPath();
        this.ctx.moveTo(0, i * this.tileSize);
        this.ctx.lineTo(this.size * this.tileSize, i * this.tileSize);
        this.ctx.stroke();
      }
      
      // Draw territories
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          const territoryColor = this.territories[y][x];
          if (territoryColor) {
            // Create a lighter version of the color for territories
            this.ctx.fillStyle = this.lightenColor(territoryColor, 30);
            this.ctx.fillRect(
              x * this.tileSize, 
              y * this.tileSize, 
              this.tileSize, 
              this.tileSize
            );
          }
        }
      }
      
      // Draw tiles
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          const tileColor = this.tiles[y][x];
          if (tileColor) {
            this.ctx.fillStyle = tileColor;
            this.ctx.beginPath();
            this.ctx.arc(
              x * this.tileSize + this.tileSize/2, 
              y * this.tileSize + this.tileSize/2, 
              this.tileSize/2 - 2, 
              0, 
              Math.PI * 2
            );
            this.ctx.fill();
          }
        }
      }
      
      // Draw highlighted cells
      if (this.animating && this.highlightedCells.length > 0) {
        this.ctx.fillStyle = `rgba(255, 255, 0, ${this.highlightAlpha})`;
        for (const [x, y] of this.highlightedCells) {
          this.ctx.fillRect(
            x * this.tileSize, 
            y * this.tileSize, 
            this.tileSize, 
            this.tileSize
          );
        }
      }
    }
    
    lightenColor(color, percent) {
      // Convert hex to RGB
      let r, g, b;
      if (color.startsWith('#')) {
        r = parseInt(color.substring(1, 3), 16);
        g = parseInt(color.substring(3, 5), 16);
        b = parseInt(color.substring(5, 7), 16);
      } else if (color.startsWith('rgb')) {
        const matches = color.match(/\d+/g);
        r = parseInt(matches[0]);
        g = parseInt(matches[1]);
        b = parseInt(matches[2]);
      } else {
        return color;
      }
      
      // Lighten
      r = Math.min(255, r + Math.floor(percent / 100 * (255 - r)));
      g = Math.min(255, g + Math.floor(percent / 100 * (255 - g)));
      b = Math.min(255, b + Math.floor(percent / 100 * (255 - b)));
      
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  console.log(`Clicked on (${x}, ${y}), Interactive: ${this.interactive}, Game ID: ${this.gameId}`);
