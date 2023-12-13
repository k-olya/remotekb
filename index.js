// Install the required packages using: npm install express socket.io robotjs

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const { press, release } = require("./backend.js");

const PORT = 3000;

app.use(express.static(__dirname + "/public"));

io.on("connection", socket => {
  console.log("A user connected");

  socket.on("keydown", key => {
    console.log("Key down:", key);
    press(key);
  });

  socket.on("keyup", key => {
    console.log("Key up:", key);
    release(key);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
