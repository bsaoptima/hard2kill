const { Server } = require('colyseus');
const { createServer } = require('http');
const express = require('express');
const cors = require('cors');
const { GameRoom } = require('./GameRoom');

const PORT = process.env.PORT || 2567;

const app = express();
app.use(cors());
app.use(express.json());

const gameServer = new Server({
  server: createServer(app),
});

// Register GameRoom
gameServer.define('game', GameRoom);

gameServer.listen(PORT);
console.log(`✅ Colyseus server running on ws://localhost:${PORT}`);
