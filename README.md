##Snappy PHP for node js
a new snappy PHP execution module / middleware 

Features
* Priority to fast response time for PHP requests
* Supports Websocket requests served by PHP scripts
* Transferring node sessions control to PHP 
* No dependencies (except for example)
* mimic Apache mod_php population of $_SERVER
* Highly configurable.

Note:
* File upload disabled at present.

####Install

    npm install sphp


####Use

    // Attach sPHP to static file server
    var sphp = require('sphp');
    app.use(sphp.express('example/'));

To use it with sesion control and websockets, please look at the example files.

####Configuration

######docRoot (default: ./public)
   sphp.docRoot='./my_files';

######cgiEngine (Default: php-cgi)

   sphp.cgiEngine='php-cgi';

######minSpareWorkers (Default: 2)

    sphp.minSpareWorkers=4;

######maxWorkers (Default: 10)

    sphp.maxWorkers=20;

######stepDowntime (Default: 360 seconds)

    sphp.stepDowntime=600;



The goal of this project is to serve PHP scripts with the best response time possible, while using nodes session control. 
It is achieved by pre-emptively spawning and loading of the PHP-CGI engine and holdning it there, until nedded.
Also it was important to stay close to the Apache mod_php global settings, to avoid migrating problems.

The foodprint is about 20MB / worker
