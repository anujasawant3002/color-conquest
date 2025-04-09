// server/workers/gameWorker.js
const { parentPort } = require('worker_threads');

// Handle messages from main thread
parentPort.on('message', (data) => {
  const { type, payload } = data;
  
  switch (type) {
    case 'PROCESS_MOVE':
      const result = processMove(payload);
      parentPort.postMessage({
        type: 'MOVE_PROCESSED',
        payload: result
      });
      break;
      
    case 'CALCULATE_TERRITORY':
      const territories = calculateTerritories(payload);
      parentPort.postMessage({
        type: 'TERRITORIES_CALCULATED',
        payload: territories
      });
      break;
  }
});

/**
 * Process a player's move
 * @param {Object} data - Move data
 * @returns {Object} - Result of the move
 */
// In gameWorker.js, update the processMove function:

function processMove(data) {
  const { boardState, x, y, playerId } = data;
  
  // Check if the space is already occupied
  if (boardState.tiles[y][x] !== null) {
    return {
      success: false,
      message: 'Invalid move - space already occupied'
    };
  }
  
  // Clone the board state to avoid mutation
  const newBoardState = JSON.parse(JSON.stringify(boardState));
  
  // Get player color (either from player data or from the boardState)
  let playerColor = null;
  for (const player of newBoardState.players) {
    if (player.id === playerId) {
      playerColor = player.color;
      break;
    }
  }
  
  if (!playerColor) {
    return {
      success: false,
      message: 'Player not found'
    };
  }
  
  // Update the board with the player's color
  newBoardState.tiles[y][x] = playerColor;
  
  return {
    success: true,
    boardState: newBoardState
  };
}

/**
 * Calculate territories claimed by a move
 * @param {Object} data - Board data
 * @returns {Array} - Territories claimed
 */
function calculateTerritories(data) {
  const { boardState, lastMove } = data;
  const { x, y, playerId } = lastMove;
  
  // Simplified territory calculation
  // In a real implementation, this would have complex logic
  // to determine if a move enclosed a territory
  
  const territories = [];
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    
    // Check if this position is on the board
    if (nx >= 0 && nx < boardState[0].length && 
        ny >= 0 && ny < boardState.length) {
      
      // Check if empty
      if (boardState[ny][nx] === null) {
        const isEnclosed = checkIfEnclosed(boardState, nx, ny, playerId);
        if (isEnclosed) {
          territories.push({ x: nx, y: ny });
        }
      }
    }
  }
  
  return territories;
}

/**
 * Check if a position is enclosed by player's pieces
 * This is a simplified placeholder implementation
 */
function checkIfEnclosed(boardState, x, y, playerId) {
  // Simplified implementation
  // In a real game, this would be much more complex
  
  // Count surrounding tiles owned by the player
  let playerTileCount = 0;
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    
    if (nx >= 0 && nx < boardState[0].length && 
        ny >= 0 && ny < boardState.length) {
      
      const tile = boardState[ny][nx];
      if (tile && tile.playerId === playerId) {
        playerTileCount++;
      }
    }
  }
  
  // Simplified rule: if 3 or 4 sides are owned by the player, consider it enclosed
  return playerTileCount >= 3;
}

console.log('Game worker started');