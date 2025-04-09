// server/utils/ClockSync.js
class ClockSync {
    constructor() {
      this.clientOffsets = new Map(); // Maps playerId to their time offset from server
    }
    
    /**
     * Calculate and store the time offset for a client
     * @param {string} playerId - The ID of the player
     * @param {number} clientTime - The timestamp from the client
     * @returns {Object} - Sync data to send back to client
     */
    syncTime(playerId, clientTime) {
      const serverTime = Date.now();
      const offset = serverTime - clientTime;
      
      this.clientOffsets.set(playerId, offset);
      
      return {
        clientSentTime: clientTime,
        serverTime: serverTime,
        offset: offset
      };
    }
    
    /**
     * Adjust a client timestamp to server time
     * @param {string} playerId - The ID of the player
     * @param {number} clientTime - Client timestamp
     * @returns {number} - Adjusted timestamp in server time
     */
    adjustToServerTime(playerId, clientTime) {
      const offset = this.clientOffsets.get(playerId) || 0;
      return clientTime + offset;
    }
    
    /**
     * Remove a client from tracking
     * @param {string} playerId - The ID of the player to remove
     */
    removeClient(playerId) {
      this.clientOffsets.delete(playerId);
    }
  }
  
  module.exports = ClockSync;