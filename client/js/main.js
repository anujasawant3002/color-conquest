// client/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const playerNameInput = document.getElementById('player-name-input');
    const createGameBtn = document.getElementById('create-game-btn');
    const gameIdInput = document.getElementById('game-id-input');
    const joinGameBtn = document.getElementById('join-game-btn');
    const gameIdDisplay = document.getElementById('game-id-display');
    const lobbPanel = document.getElementById('lobby');
    const gameBoardPanel = document.getElementById('game-board');
    const playerNameDisplay = document.getElementById('player-name');
    const playerColorDisplay = document.getElementById('player-color');
    const currentTurnDisplay = document.getElementById('current-turn');
    const messageBox = document.getElementById('message-box');
    
    // Initialize network manager
    const networkManager = new NetworkManager('http://localhost:3000');
    
    // Initialize game board (will be set up properly once game starts)
    let gameBoard = null;
    
    // Game state
    let gameState = {
      gameId: null,
      playerId: null,
      playerColor: null,
      players: []
    };
    
    // Event listeners
    createGameBtn.addEventListener('click', () => {
      const playerName = playerNameInput.value.trim() || 'Player';
      networkManager.createGame(playerName);
    });
    
    joinGameBtn.addEventListener('click', () => {
      const gameId = gameIdInput.value.trim().toUpperCase();
      const playerName = playerNameInput.value.trim() || 'Player';
      
      if (!gameId) {
        showMessage('Please enter a valid Game ID');
        return;
      }
      
      networkManager.joinGame(gameId, playerName);
    });
    
    // Network event handlers
    networkManager.onGameCreated = (data) => {
      gameState.gameId = data.gameId;
      gameState.playerId = data.playerId;
      gameState.playerColor = data.playerColor;
      
      gameIdDisplay.textContent = `Game ID: ${data.gameId}`;
      playerNameDisplay.textContent = playerNameInput.value.trim() || 'Player';
      
      const colorSample = document.createElement('span');
      colorSample.style.display = 'inline-block';
      colorSample.style.width = '20px';
      colorSample.style.height = '20px';
      colorSample.style.backgroundColor = data.playerColor;
      colorSample.style.marginLeft = '10px';
      playerColorDisplay.appendChild(colorSample);
      
      showMessage('Waiting for other players to join...', 'info');
    };
    
    networkManager.onGameJoined = (data) => {
      gameState.gameId = data.gameId;
      gameState.playerId = data.playerId;
      gameState.playerColor = data.playerColor;
      gameState.players = data.boardState.players;
      
      playerNameDisplay.textContent = playerNameInput.value.trim() || 'Player';
      
      const colorSample = document.createElement('span');
      colorSample.style.display = 'inline-block';
      colorSample.style.width = '20px';
      colorSample.style.height = '20px';
      colorSample.style.backgroundColor = data.playerColor;
      colorSample.style.marginLeft = '10px';
      playerColorDisplay.appendChild(colorSample);
      
      // Switch to game board view
      lobbPanel.classList.add('hidden');
      gameBoardPanel.classList.remove('hidden');
      
      // Initialize game board
      const boardCanvas = document.getElementById('board-canvas');
      gameBoard = new GameBoard(boardCanvas, data.boardState.size, networkManager);
      gameBoard.setGameId(data.gameId);  // Add this line
      gameBoard.updateBoard(data.boardState);
      
      // Update scores
      updateScores(data.boardState.players);
      
      // Update turn information
      updateTurnInfo(data.boardState.currentTurn);
    };
    
    networkManager.onBoardUpdated = (data) => {
      gameBoard.updateBoard(data.boardState);
      
      // Update scores
      updateScores(data.boardState.players);
      
      // Update turn information
      updateTurnInfo(data.boardState.currentTurn);
      
      // Highlight claimed territories
      if (data.claimedTerritories && data.claimedTerritories.length > 0) {
        gameBoard.highlightTerritory(data.claimedTerritories);
      }
    };
    
    networkManager.onPlayerJoined = (data) => {
      gameState.players.push({
        id: data.playerId,
        name: data.playerName,
        color: data.playerColor,
        territory: 0
      });
      
      updateScores(gameState.players);
      showMessage(`${data.playerName} joined the game`, 'info');
      
      // Switch to game board if not already there
      lobbPanel.classList.add('hidden');
      gameBoardPanel.classList.remove('hidden');
      
      // Initialize game board if not already initialized
      if (!gameBoard) {
        const boardCanvas = document.getElementById('board-canvas');
        gameBoard = new GameBoard(boardCanvas, 10, networkManager);
        gameBoard.setGameId(gameState.gameId);
      }
    };
    
    networkManager.onPlayerLeft = (data) => {
      // Remove player from players array
      gameState.players = gameState.players.filter(p => p.id !== data.playerId);
      
      // Update scores
      updateScores(gameState.players);
      
      showMessage('A player has left the game', 'warning');
    };
    
    networkManager.onGameOver = (data) => {
      const winner = data.scores[0];
      showMessage(`Game Over! ${winner.name} wins with ${winner.territory} territories!`, 'success');
      
      // Disable board interaction
      gameBoard.setInteractive(false);
    };
    
    networkManager.onError = (error) => {
      showMessage(error.message, 'error');
    };
    
    // Helper functions
    function updateScores(players) {
      const scoresList = document.getElementById('player-scores');
      scoresList.innerHTML = '';
      
      players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name}: ${player.territory}`;
        li.style.borderLeft = `4px solid ${player.color}`;
        scoresList.appendChild(li);
      });
    }
    
    function updateTurnInfo(currentTurnId) {
      const isMyTurn = currentTurnId === gameState.playerId;
      const currentPlayer = gameState.players.find(p => p.id === currentTurnId);
      
      if (currentPlayer) {
        currentTurnDisplay.textContent = isMyTurn ? 
          'Your turn!' : 
          `${currentPlayer.name}'s turn`;
        
        currentTurnDisplay.style.color = currentPlayer.color;
        currentTurnDisplay.style.fontWeight = isMyTurn ? 'bold' : 'normal';
      }
    }
    
    function showMessage(message, type = 'error') {
      messageBox.textContent = message;
      messageBox.classList.remove('hidden');
      
      // Set message type styling
      messageBox.style.backgroundColor = type === 'error' ? '#f8d7da' :
                                        type === 'success' ? '#d4edda' :
                                        type === 'warning' ? '#fff3cd' : '#d1ecf1';
      messageBox.style.color = type === 'error' ? '#721c24' :
                              type === 'success' ? '#155724' :
                              type === 'warning' ? '#856404' : '#0c5460';
      
      // Hide message after 5 seconds unless it's an error
      if (type !== 'error') {
        setTimeout(() => {
          messageBox.classList.add('hidden');
        }, 5000);
      }
    }
  });