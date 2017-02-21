##Snappy PHP for node js
A snappy PHP module / middleware. 

Features:
* Middleware for node Express or stand alone php execution
* Fast response time favored over use of resources
* Websocket support: requests can be parsed to a PHP scripts
* Transfer of node session data to PHP's $_SESSION
* No dependencies (except for example)
* Mimic Apache mod_php population of $_SERVER
* Highly configurable.
* Comprehensive example of a server and a PHP websocket client
* **NEW:** load php library scripts premtively.

Note:
* **php-cgi** must be installed on the system. If its not in the PATH, cgiEngine must point to an executable binary. 
* File upload disabled at present.
* Compatible with module: express 4.13, express-session 1.12, body-parser 1.14, ws 0.8
* Since devDependencies dosen't work on all platforms (npm 3.4.0) these packages are included to make the example.js work. They should be removed in production.

####Install

    npm install sphp

####Use with express

    var express = require('express');
    var sphp = require('sphp');
    
    var app = express();
    var server = app.listen(8080);
    
    app.use(sphp.express('public/'));
    app.use(express.static('public/'));

####Use with ws (Websockets)

    var express = require('express');
    var sphp = require('sphp');
    
    var app = express();
    var server = app.listen(8080);
    var ws = new require('ws').Server({server: server});
    
    app.use(sphp.express('public/'));
    ws.on('connection',sphp.websocket());
    app.use(express.static('public/'));
    
####Use with express-session

    var express = require('express');
    var expressSession = require('express-session');
    var bodyParser = require('body-parser');
    var sessionStore = new expressSession.MemoryStore();
    var sphp = require('sphp');
    
    var app = express();
    var server = app.listen(8080);
    var sessionOptions={
         store: sessionStore
        ,secret:'yes :c)'
        ,resave:false
        ,saveUninitialized:false
        ,rolling: true
        ,name: 'SID'
    }

    app.use(expressSession(sessionOptions));
    app.use(function(request, response, next){ 
      // Save session data
      request.session.ip=request.client.remoteAddress;
      next();
    });
    app.use(bodyParser.json());      
    app.use(bodyParser.urlencoded({extended: true}));

    app.use(sphp.express('example/'));
    ws.on('connection',sphp.websocket(sessionOptions));
    app.use(express.static('example/'));

####Configuration
sPHP module variables are exposed, for easy configuration:

#####cgiEngine (Default: php-cgi)
Specify which binary file to use to execute PHP script. The executable must be in the environment PATH or use a full path to the executable file.

    sphp.cgiEngine='php';

#####docRoot (default: ./public)
Where to serve script files from. Might be relative or an absolute path. This is the variable set, when sphp.express is called with a parameter.

    sphp.docRoot='./my_files';

#####minSpareWorkers (Default: 2)
Define the minimum number of workers kept ready. 
Note that when calling PHP scripts through websockets, an additional concurrent worker is used. 


    sphp.minSpareWorkers=4;

#####maxWorkers (Default: 10)
The maximum number of workers allowed to start. This number will never be exceeded. Requests will instead be rejected.

Set this to limit the amount of RAM the server can use, when load is high. The footprint is about 20MB / worker as of php-cgi 5.4 php-gci

    sphp.maxWorkers=20;

#####stepDowntime (Default: 360 seconds)
The number of worker are increased dynamically, When the need arises. This is the time it takes before, the number of workers, are reduced by one.

    sphp.stepDowntime=1800;

#####overwriteWSPath (Default null)
Used to specify which script should serve a websocket request.
If null, the URL of the connection GET request is used.
The path is relative to docRoot.

    sphp.overwriteWSPath='/ws_serveice.php';

#####preLoadScript (Default null)
This can be used to preload libraries, before a page is requested, thus improving reaponcetime.
The preLoadScript variable contains a path to a php script, relative to docRoot.
Be aware that the script pointet to will be executed when the php engine is loaded eg. before a client has made a page request. non of the super globals are set to usefull values at this point. The script sould contain generic library function that are use system wide, as it will be loaded with all page.

    sphp.overwriteWSPath='library.php';

####Notes
This project is about serving PHP scripts with the best response time possible. Favouring response timer over use of resources. This is achieved by pre-emptively spawning and loading of the PHP-CGI engine and holding it there, until needed.

Other requirement are the ability to:
* use Websockets, served on the same port as the http server.
* use php scripts to serve websocket requests. (But not handling the connection itself)
* transfer session data from node drddion to php $_SESSION
* access session data within a websocket request.

####Bugfixes
* 0.3.13 Websocket body can now be either a string or an object
* 0.3.12 Documentation update
* 0.3.11 Documentation update
* 0.3.10 Preloading php library scripts, to improve responsetime
* 0.3.9  Documentation update
* 0.3.8  php_worker.php Typo
* 0.3.7  PHP session cookie disabled.
* 0.3.6  Websocket Error 'not opened' when script don't exists
* 0.3.5  open_basedir restriction, without specifying doc roor in php.ini

####Help
Please don't hesitate to submit an issue on github! It's the only way to make it better. 

But please be prepared to present a test case.

Contributions of almost any kind are welcome. 






