
var server = require('http').createServer()
  , url = require('url')
  , WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ server: server })
  , express = require('express')
  , app = express()
  , port = 8080;
 
app.use(express.static('example/'));

wss.on('connection', function connection(ws) {
  var location = url.parse(ws.upgradeReq.url, true);
  // you might use location.query.access_token to authenticate or share sessions
  // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
console.log('Connected');
  ws.on('message', function incoming(message) {
    ws.send('Got it');
    console.log('received: %s', message);
  });

  ws.send('something');
});

server.on('request', app);
server.listen(8080, function () { console.log('Listening on ' + server.address().port) });


/*============================================================================*\
  Load modules
\*============================================================================*
var express = require('express');
var expressSession = require('express-session');
var sphp = require('./sphp.js');
var app = express();
var server = require('http').createServer(app);
var ws = new require('ws').Server({server: server});


// Middleware
//app.use(expressSession({secret:'yes :c)',resave:false,saveUninitialized:false}));
//app.use(sphp.express('example/'));
app.use(express.static('example/'));


// Start server
app.listen(8080,'0.0.0.0');

// Attach "receive message" event handler opon websocket connection
wss.on('connection', function(socket) {
  console.info("Client connected");

  // Handler for incomming messages
  socket.on('message', function(request) {
    console.info("Received ws message: ",request);
    var responce="Reply";
    socket.send(JSON.stringify(responce),{"binary":false},function(){});
  });
  
  socket.on('close', function(request) {
    console.info('Websocket connection closed: %s');
  });

});

wss.on('close', function(socket) {
  console.info("WS Connection closed");
});
wss.on('error', function(socket) {
  console.info("WS Connection error");
});

*/
console.info('running');


