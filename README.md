##Snappy PHP for node js
a snappy PHP execution module / middleware 

#Work in progress


Features
* Snappy response time to PHP requests
* Serves Websocket requests
* Transferring node sessions to PHP 
* No dependencies
* Aim to mimic Apache mod_php global settings
* Highly configurable.


####Install

    npm install sphp

Then copy or link php_burner.php to working directory

Set execution time to unlimited in php.ini (Preferably a local copy in working directory)

####use

    server=require('express');


The goal of this project is to make a mechanism to serve PHP scripts with the best response time possible, while using nodes session control. 
It is achieved by pre-emptively spawning and loading of the PHP-CGI engine and holdning it there, until nedded.
Also it was important to stay close to the Apache mod_php global settings, to avoid migrating problems.
(A logical next step would be to utilise the fast CGI php engine, and let I handle the spawning of workers)
Snappy PHP

