/*============================================================================*\
  Snappy PHP Script Launcher
  (c) Copyrights Paragi, Simon Riget 2013

  PHP script execution module for node
  Maintain a pool of ready workers for fast responcetime.

  Use as express middleware:
    app.use(sphp.express(<Document root>));  
  
  or direct call
    sphp.exec

  To attach to websocket server: 
    ws.on('connection',sphp.websocket(<options>));

  configure by setting the following variablws:
    sphp.cgiEngine        defaults to 'php-cgi'
    sphp.minSpareWorkers  defaults to 2
    sphp.maxWorkers       defaults to 10
    sphp.stepDowntime     defaults to 360
    sphp.overwriteWSPath  null
    
  Aspire to keep compability with scripts written for apache mod_php 
  Using node session controle and parsing it to PHP 

  
  notes:
    - Websockets has a differant request structure from a static page requests  

    
  To do:
    make php-fpm interface
    check 404 on php
    
\*============================================================================*/
process.versions.phpLauncher='0.3.2 - PHP preemptive';

var fs = require('fs');
var path = require("path");
var child_process = require("child_process");
var url=require('url');
// Define php object
var sphp ={};
module.exports = exports = sphp;

// Set defaults
sphp.docRoot='./public';

sphp.cgiEngine='php-cgi';
sphp.minSpareWorkers=2;
sphp.maxWorkers=10;
sphp.stepDowntime=360;
sphp.overwriteWSPath=null;

// Initialize
sphp.increaseTime=false;
sphp.maintenance=false;
sphp.cminSpareWorkers=sphp.minSpareWorkers;

// Find absolute path to this directory and add script name
sphp.preBurnerScript=module.filename.substring(0,module.filename.lastIndexOf("/"));
sphp.preBurnerScript+='/php_worker.php';

/*============================================================================*\
  Express Middleware to execute a PHP script.

  app.use(sphp.express(<PHP document root>));
  
  The script is expected to return a complete HTML responce. 
  The response will be partitioned into segments (using callback) of type:
    status 
    header
    data (including stderr) 
    end
    error 
      
\*============================================================================*/
sphp.express=function(docRoot){

  // Initiliaze once 
  if(sphp.docRoot) sphp.docRoot=docRoot;
  if(!sphp.worker){
    sphp.worker=[]; 
    sphp.maintain();
  }
  
  // Return middleware function
  return function(request, response, next){
    // Check file extention
    if(path.extname(request._parsedUrl.pathname).substring(1)!='php'){
      next();
      return 0;
    }

    // Launch script
    var headerSent=false;
    sphp.exec(request,function(event,data,param){
      // handle callbacks 
      switch (event){
      case 'status':
        if(headerSent) break;
        response.status(data);
        break;
      case 'header':
        if(headerSent) break;
        response.setHeader(data,param);
        break;
      case 'data':
        headerSent=true;
        response.write(data,'binary');
        break;
      case 'end':
        response.end();
        break;
      case 'error':
        console.error('PHP script launche error: %s',data);
        response.end();
        break;
      default:
        console.error("'PHP script unknown event: '%s'",event);
      }
    });
  }
  
}

/*============================================================================*\
  Execute PHP script
  
  Start a PHP session, by deploying a prespawned worker.

  Using the script php_worker.php as a launcher script, to set predefined globals
\*============================================================================*/
sphp.exec=function(request,callback){
  var deployed=false;
  var freeWorker=false;

  // Initiliaze once 
  if(!sphp.worker){
    sphp.worker=[]; 
    sphp.maintain();
  }

  // Parse URL for websocket calls
  if(typeof request._parsedUrl === 'undefined')
    request._parsedUrl=url.parse(request.socket.upgradeReq.url);

  // Check that script exists
  fs.exists(sphp.docRoot + request._parsedUrl.pathname, function(exists){
    // Deploy worker
    if(exists){
      // See if there is a free worker
      for(var i=sphp.worker.length-1;i>=0;i--){
        // Deploy worker
        if(sphp.worker[i].state=='ready') {
          // Set state
          sphp.worker[i].state='running';
          sphp.worker[i].time=(new Date).getTime();

          //Transfer conInfo request informastion to stdin
          sphp.worker[i].conInfo=sphp._getConInfo(request);
          sphp.worker[i].stdin.write(JSON.stringify(sphp.worker[i].conInfo));

          // Attach response handlers
          sphp._responseHandler(sphp.worker[i],callback)

          // Release input to worker (Let it run)
          sphp.worker[i].stdin.end();
          
          if(process.stdout.isTTY) 
            console.info("Deploying worker PID: ",sphp.worker[i].pid);
          
          deployed=true;
          break;
        }
      }

      // Too busy 
      if(!deployed){
        callback('status',503
          , "Sorry, too busy right now. Please try again later");
        callback('end');
      }

    // File not found
    }else{  
      callback('status',404, "Sorry, unable to locate file: "
        +sphp.docRoot + request._parsedUrl.pathname);
      callback('end');
      console.info("File not found (404): "
        +sphp.docRoot + request._parsedUrl.pathname);
    }      
  }); 
}

/*============================================================================*\
  Websocket: Attach on connection event

  Attach a "receive message" event handler 
  If its a php file, execute it

  The options are the ones uset to setup express-session:

  var expressSession = require('express-session');
  var sessionStore = new expressSession.MemoryStore();
  var server = app.listen(8080,'0.0.0.0');
  var ws = new require('ws').Server({server: server});
  var sessionOptions={
     store: sessionStore
    ,secret:'yes :c)'
    ,resave:false
    ,saveUninitialized:false
    ,rolling: true
    ,name: 'SID'
  }
  
  app.use(expressSession(sessionOptions));
  ws.on('connection',sphp.websocket(sessionOptions));

  options: store and name must be set.
      
\*============================================================================*/
sphp.websocket = function (opt){
  return function(socket) {
    //console.info("Client connected");

    // Handler for incomming messages
    socket.on('message', function(msg){
      var sid;
      var parts;
     
      // Create a pseudo request record 
      var request={
         socket: socket
        ,body:   msg.toString()
      };
      //console.info("Received ws message: ",request.body);

      // Parse POST body as JSON to PHP  
      socket.upgradeReq.headers['Content-Type']="application/json";
       //console.log("WS Headers: ",socket.upgradeReq.headers);
      // Find session cookie content, by name
      parts=unescape(socket.upgradeReq.headers.cookie).match(
        '(^|;)\\s*' + opt.name + '\\s*=\\s*([^;]+)');
      if(parts){
        sid=parts[0].split(/[=.]/)[1];
        // SID is serialised. Use value between s: and . as index (SID)
        if(sid.substr(0,2) == 's:') sid=sid.substr(2);
      }
      
      // Find session. Use value between s: and . as index (SID)
      opt.store.get(sid,function(error,data){
        if(data) request.session=data;
        // Execute php script
      
        sphp.exec(request,function output(event,data){
          // Handle returned data
          if(event=='data' && request.socket.upgradeReq.socket.writable) 
            request.socket.send(data,{"binary":false});
        });
      },request);
    });
  }
}

/*============================================================================*\
Maintain PHP workers

PHP workers are preforked and kept ready, to improve response time.
The number of workers are determined by the demand. When minSpareWorkers are not 
met do to demand, it is increased for a time. When it has not been needed for 
stepDownTime, it is decreased again. 

MinSpareWorkers: When a worker is spend (has run a script) it is terminated. If 
the number of spare workers are below minSpareWorkers, new workers are forked.

Allocating more workers, will only improve response time up to a point. When the
resources becomes depleted, the only option is to prioritise and queue the 
requests.

MaxWorkers: the number of workers that will never be exceed. Instead, the 
request will be queued for maxWait time. If it expires the request are rejected.

Global variables are transfered via stdin, rather than enviroment variables, in
order to mimic the settings of Apache mod_php. That requires the pressens of a
php script that populates GLOBALS with data from stdin.

stdin is used to hold the process, until needed.

The list of workers are ordered with the oldest last, so that length reflects 
the actual number of workers (Using add=>unshift delete=>splice)

Worker array objects layout: 
   state: enum ready, running, spend
   time: of last state change
   proc: handle to spawned process
   cminSpareWorkers: current dynamic minimum of spare workers
   increaseTime: Time that i changed

\*============================================================================*/
sphp.maintain=function(){

  var spares=0,workers=0;
  var proc;
  var job;

  // Count free workers
  for(var i in sphp.worker){
    // Find free workers
    if(sphp.worker[i].state=='ready') spares++
    workers++;
  }

  // increase number of workers
  if(spares<1 && workers<sphp.maxWorkers){
    if(sphp.increaseTime) sphp.cminSpareWorkers++;
    sphp.increaseTime=(new Date).getTime();

  // Decrease number of workers
  }else if((new Date).getTime()-sphp.increaseTime>sphp.stepDowntime*1000){
    if(sphp.cminSpareWorkers>sphp.minSpareWorkers) sphp.cminSpareWorkers--;
    sphp.increaseTime=(new Date).getTime();
  }

  // Start spare workers
  for(; spares < sphp.cminSpareWorkers && workers<sphp.maxWorkers; spares++){
    // Start a child process (needs closure to avoid mix-up)
    (function(){
      // Start child process and Append worker to array
      var proc=child_process.spawn(sphp.cgiEngine
            ,[sphp.preBurnerScript]
            ,{'cwd':sphp.docRoot,'env':{'preload':sphp.docRoot +'/'+ sphp.preLoadScript}});
      if(!proc.pid){
        console.error("Unable to start worker:" +sphp.cgiEngine);
        return;
      }
      // Some process settings
      proc.state='ready';    
      proc.time=(new Date).getTime();
      proc.stderr.setEncoding('utf8');  
      proc.stdout.setEncoding('binary');
      sphp.worker.unshift(proc);  
      // console.info("Starting worker PID: " + proc.pid);    

      // Attach end of process event
      proc.on('exit', function (error) {
        // Form debug message
        if(error && process.stdout.isTTY && proc.state=='ready'){
          var code=/\b[A-Z]+\b/g.exec(error);
          var str="Worker script ended: " + sphp.preBurnerScript; 
          str+="\n  PHP engine: "+sphp.cgiEngine;
          str+="\n  Worker PID: "+proc.pid;
          if(error)
            if(sphp.errorDescription[code])
              str+="\n  Ended with error (" + code + "): " 
                 + sphp.errorDescription[code];
            else  
             str+="\n  Ended with error code: " + error;
          console.error(str," after "+((new Date).getTime()-proc.time)/1000
            +" Seconds");
          throw new Error(str);    
        }    
        // delete process record (Cant delete the 'this' object)
        proc.state="dead";
        //use splice to avoid holes in array
        sphp.worker.splice(sphp.worker.indexOf(this),1);
        sphp.maintain();
      });
      
      proc.on('error', function (error) {
        // Form debug message
        if(process.stdout.isTTY){
          var code=/\b[A-Z]+\b/g.exec(error);
          var str="Failed to start PHP engine: "+sphp.cgiEngine;
          str+="\n  Preburner script: " + sphp.preBurnerScript; 
          str+="\n  Worker PID: "+proc.pid;
          if(error)
            if(sphp.errorDescription[code])
              str+="\n  Ended with error (" + code + "): " 
                 + sphp.errorDescription[code];
            else  
             str+="\n  Ended with error code: " + error;
          console.error(str," after "+((new Date).getTime()-proc.time)/1000
            +" Seconds");
          throw new Error(str);    
        }        
        // delete process record (Cant delete the 'this' object)
        proc.state="dead";
        //use splice to avoid holes in array
        sphp.worker.splice(sphp.worker.indexOf(this),1);
        sphp.maintain();
      });
    })();
    workers++;
  }

  // repport on workers
  if(process.stdout.isTTY){
    console.info("==========================================================================");
    console.info("PHP Workers spares:",spares," min:",sphp.cminSpareWorkers," Max:",sphp.maxWorkers);

    workers=0; spares=0;         
    for(var i in sphp.worker){
      workers++;
      console.info(i,"PID:",sphp.worker[i].pid," State:",sphp.worker[i].state
        ," age:",+((new Date).getTime()-sphp.worker[i].time)/1000+" Seconds");
      // Find free workers
      if(sphp.worker[i].state=='ready') spares++
    }
    console.info("==========================================================================");
  }
}

/*============================================================================*\
  Compose a connection information record on client request
\*============================================================================*/
sphp._getConInfo=function(request){
  var conInfo = {};

  // Websocket request
  if(typeof request.socket != 'undefined'
      && typeof request.socket.upgradeReq != 'undefined'
      && typeof request.socket.upgradeReq.headers != 'undefined'){
    conInfo.httpversion=request.socket.upgradeReq.httpVersion;
    conInfo.url=request._parsedUrl.href;
    conInfo.remoteport = request.socket._socket.remotePort;
    conInfo.header =request.socket.upgradeReq.headers;
    conInfo.pathname = sphp.overwriteWSPath || request._parsedUrl.pathname;
    conInfo.query = request._parsedUrl.query || '';
    conInfo.method='websocket';
    if(typeof request.body !== 'object') 
      try{ 
        conInfo.body=JSON.parse(request.body);
      }catch(e){}
    else      
      conInfo.body=request.body || '';
    conInfo.session=request.session;

  // Try basic HTTP request
  }else if(typeof request.method != 'undefined'
            && request.client
            && request.client.remotePort){
    conInfo.httpversion=request.httpVersion || '';
    conInfo.url=request.url || '';
    conInfo.remoteaddress = request.client.remoteAddress || '';
    conInfo.remoteport = request.client.remotePort || '';
    conInfo.header = request.headers || '';
    conInfo.pathname = request._parsedUrl.pathname || '';
    conInfo.query = request.query || ''
    conInfo.method=request.method || ''; 
    conInfo.body=request.body || '';
    conInfo.session = request.session;
    conInfo.files={};
    for(var f in request.files){
      conInfo.files[f]={};
      conInfo.files[f].name=request.files[f].name;
      conInfo.files[f].size=request.files[f].size;
      conInfo.files[f].tmp_name=request.files[f].path;
      conInfo.files[f].type=request.files[f].type;
    }

  // unrecognised
  }else 
    return '';
  
  // Add document root
  conInfo.docroot=path.resolve(sphp.docRoot);
  return conInfo;
}

/*============================================================================*\
  Handle output from the spawned process

  request body part and other information are parsed through stdin, to the php 
  process. body including multipart are interpreted by the server, before parsing
  it to the cgi.  
  Node provides for the uploaded files to be stored. they only need to be renamed
  and information passed.
 
  on reveiving data on stdid, all input is treated as headers, until end of 
  header section is send (double windows end of line: \n\r\n\r)
  
  Data are received in multi part blocks, with no regard to the content.
  eg. a data block might contain both headers, [end of header] and body
  
  The receiving callback function must have data separated in:
    status, header, data, error and end request.
  
  Status 200 OK is assumed, if not set.
  
  Note: if header contains a redirect (Location) the status must be set accordingly
 
  Quirks:
    1. php-cgi might send error text formatted in HTML before the headers
      Fix: 1. error messages are stores until headers are send. 
           2. a default header of Content-type: text/html (overwritten if other))
    2. php-cgi might send a header in one block and the line ending in another
      Fix: buffer all headers until end of header section are received
    3. the phpinfo() function requests pseudo pages for logo images.

    for strange 404 see http://woozle.org/~neale/papers/php-cgi.html
 
\*============================================================================*/
sphp._responseHandler= function (proc,callback){
  var buffer='';
  var errorBuffer='';
  var headersSent=false;
  var end=false; 
  var headers={'Content-type':'text/html'}; // Fix 1
  // Catch output from script and send it to client
  proc.stdout.on('data', function (data) {
    if(end) return;

    if(!headersSent){
      // Store headers until a end of header is received (\r\n\r\n)
      buffer+=data;
      // Pre-process headers
      if(data.indexOf('\r\n\r\n')){
        // Locate end of header section, Separate headers from body parts and 
        // divide headers into lines  
        var eoh=buffer.indexOf('\r\n\r\n');
        if(eoh>=0){
          var line=buffer.substr(0,eoh+2).split('\n');
          var div =-1;
          for(var i in line){
            // Split header into key, value pairs
            div = line[i].indexOf(":");
            if(div>0){
              // Handle redirect location header
              if(line[i].substr(0,div).toLowerCase()=='location'){
                callback('status',302);
                callback('header','Location',line[i].substr(div+2));
                end=true;
                callback('end');
                return;
              }

              // remove \r and duplicate headers so that last one counts
              headers[ line[i].substr(0,div) ] = line[i].substr(div+2).replace(/\r/g,'');
            }
          }

          // Send headers
          for(var i in headers) callback('header',i,headers[i]);
          headersSent=true;

          // Send error messages, if any was send before end of headers
          if(errorBuffer.length>0){
            callback('data',errorBuffer);
          }
          // Send body part if any
          if(buffer.length>eoh+4){
            callback('data',buffer.substr(eoh+4));
          }
        }        
      }
    
    // Body
    }else{;
      callback('data',data);
    }
  });

  // Error. Catch standard error output from script
  proc.stderr.on('data', function (data) {
    if(end) return;
    // Fix: Store error messages until headers are sent
    if(!headersSent){
      if(errorBuffer.length<4096) errorBuffer+=data.toString();
    }else{
      callback('data',data.toString());
    }
  });

  proc.stdout.on('close', function () {
    if(end) return;

    if(!headersSent){
      for(var i in headers) callback('header',i,headers[i]);
      headersSent=true;
    }
    if(errorBuffer.length>0) callback('data',errorBuffer);
    end=true;
    callback('end');
  });
}


/*============================================================================*\
  Error descriptions  
  
  Elaborations on system error codes
\*============================================================================*/

sphp.errorDescription={
   EACCES       : 'File access permission Permission denied'
  ,EADDRINUSE   : 'Network port already in use with this IP address'
  ,ECONNREFUSED : 'Connection refused by foreign host'
  ,ECONNRESET   : 'Connection was forcibly closed by remote peer'
  ,EEXIST       : 'File already exists'
  ,EISDIR       : 'File name is a directory name'
  ,EMFILE       : 'Maximum number of open files reached'
  ,ENOENT       : 'File does not exist'
  ,ENOTDIR      : 'Directory name is a file name'
  ,ENOTEMPTY    : 'Directory not empty'
  ,EPERM        : 'Elevated privileges required'
  ,EPIPE        : 'Connection cloaed by remote' 
  ,ETIMEDOUT    : 'Operation timed out'
}
