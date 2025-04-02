// server/game/Player.js
class Player {
    constructor(id, name, color) {
      this.id = id;
      this.name = name || `Player-${id.substring(0, 4)}`;
      this.color = color;
      this.territory = 0;
    }
  }
  
  module.exports = Player;