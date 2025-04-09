// server/utils/TokenManager.js
class TokenManager {
    constructor() {
      this.tokenHolder = null;
      this.tokenQueue = [];
      this.pendingRequests = new Map(); // Maps playerId to their callback
    }
    
    /**
     * Request the token for a player
     * @param {string} playerId - The ID of the player requesting the token
     * @param {Function} callback - Called with true if token is granted, false otherwise
     */
    requestToken(playerId, callback) {
      // If no one has the token, give it to the requester
      if (this.tokenHolder === null) {
        this.tokenHolder = playerId;
        callback(true);
        return;
      }
      
      // If player already has the token
      if (this.tokenHolder === playerId) {
        callback(true);
        return;
      }
      
      // Add to queue
      this.tokenQueue.push(playerId);
      this.pendingRequests.set(playerId, callback);
      
      // Notify the current token holder that someone is waiting
      return false;
    }
    
    /**
     * Release the token held by a player
     * @param {string} playerId - The ID of the player releasing the token  
     * @returns {boolean} - Whether the token was successfully released
     */
    releaseToken(playerId) {
      // Can only release if you have the token
      if (this.tokenHolder !== playerId) {
        return false;
      }
      
      // Give token to next player in queue
      if (this.tokenQueue.length > 0) {
        const nextPlayerId = this.tokenQueue.shift();
        this.tokenHolder = nextPlayerId;
        
        // Notify the player who was waiting
        const callback = this.pendingRequests.get(nextPlayerId);
        if (callback) {
          callback(true);
          this.pendingRequests.delete(nextPlayerId);
        }
      } else {
        this.tokenHolder = null;
      }
      
      return true;
    }
    
    /**
     * Check if a player has the token
     * @param {string} playerId - The ID of the player
     * @returns {boolean} - Whether the player has the token
     */
    hasToken(playerId) {
      return this.tokenHolder === playerId;
    }
    
    /**
     * Handle disconnection of a player
     * @param {string} playerId - The ID of the disconnected player
     */
    handleDisconnect(playerId) {
      // If disconnected player had token, release it
      if (this.tokenHolder === playerId) {
        this.releaseToken(playerId);
      }
      
      // Remove from queue if waiting
      const queueIndex = this.tokenQueue.indexOf(playerId);
      if (queueIndex !== -1) {
        this.tokenQueue.splice(queueIndex, 1);
      }
      
      // Clean up pending request
      this.pendingRequests.delete(playerId);
    }

    // Add this method to your TokenManager class
   setTokenHolder(socketId) {
   this.tokenHolder = socketId;
}
  }
  
  module.exports = TokenManager;