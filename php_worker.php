<?php
/* ======================================================================== *\
  Snappy PHP Script Launcher
  (c) Copyrights Paragi, Simon Riget 2013

  Pre burner for PHP script execution with note.js

  This script initialise various predefined globals in PHP
  The STDIN stream/socket contains a JSON encoded array, containing all relevant
  data.

  This is a close aproximation to the population of globals done by mod_php in Apache

  Version 0.1:  Simon Rigét - Basic funtionalaty in place. 

todo: 
  fake header()
  set ini open_basedir
  file upload
  
\* ======================================================================== */
// Configuration
$sw_name="PHP preburner 0.1.2";

// Avoid that the input socket times out, before it is used
ini_set ("default_socket_timeout","-1" );
// Disable PHP session 
ini_set('session.use_cookies', '0');
ini_set('session.name', 'SID');

// include pre load script
@include(getenv('preload'));

/* ======================================================================== *\
    Get client request and server information
    Data passed throug stdin
    including all http headers 
\* ======================================================================== */
$request=json_decode(file_get_contents("php://stdin"),true);

/* ======================================================================== *\
    Populate predefined global variables
\* ======================================================================== */
// _SERVER
$path=(isset($_SERVER['PATH'])?$_SERVER['PATH']:'/');
// Clear arrays
unset($_SERVER);
$argc=0;
$argv=[];

// Add HTTP headers
if(@is_array($request['header'])) foreach($request['header'] as $key=>$val)
  $_SERVER['HTTP_'.strtr(strtoupper($key),'-','_')]=$val;

$_SERVER['HTTP_COOKIE_PARSE_RAW']=@$request['header']['cookie'];
if(@$request['httpversion']) $_SERVER['SERVER_PROTOCOL'] = "HTTP/" . $request['httpversion'];
$_SERVER['REQUEST_METHOD']=@$request['method'];

// Add query information
if(@$request['url']){
  $_SERVER['QUERY_STRING']=substr($request['url'],strpos($request['url'],"?")+1);
  $_SERVER['REQUEST_URI']=$request['url'];
}
$_SERVER['REMOTE_ADDR']=@$request['remoteaddress'];
$_SERVER['REMOTE_HOST']=@$request['header']['host'];
$_SERVER['REMOTE_PORT']=@$request['remoteport'];

// Split address and port
if(@$_SERVER['HTTP_REFERER']){
  $url=parse_url($_SERVER['HTTP_REFERER']);
  if(@$url['port']) 
    $_SERVER['SERVER_PORT'] = ($url['port']);
  else
    $_SERVER['SERVER_PORT'] = 80;
  $_SERVER['SERVER_ADDR'] =$url['host'];
}
// Add script name and paths
if(@$request['pathname'][0]!='/') $request['pathname'] = '/' . $request['pathname'];
$_SERVER['SCRIPT_NAME']=$request['pathname'];
$_SERVER['DOCUMENT_ROOT']=@$request['docroot'];
$_SERVER['PHP_SELF']=$request['pathname'];
$_SERVER['SCRIPT_FILENAME']=$_SERVER['DOCUMENT_ROOT'] . $_SERVER['SCRIPT_NAME'];
$_SERVER['PATH']=$path;

// Add some predefined settings
$_SERVER['GATEWAY_INTERFACE']=$sw_name;
$_SERVER['SERVER_SOFTWARE'] = "PHP Appilation Server using Node.js and WS Websockets";

// Generate a signature
$_SERVER['SERVER_SIGNATURE']="$_SERVER[SERVER_SOFTWARE] Server with $_SERVER[GATEWAY_INTERFACE] at ". @$request['header']['host'];

// Servers session data
$_SESSION=@$request['session'];

// _GET
if(is_array($request['query']))
  $_GET=$request['query'];
else  
  parse_str($request['query'],$_GET);

// Process body data.
$_POST=@$request['body'];

// _FILES
$_FILES=@$request['files'];

// _COOKIE
if($_SERVER['HTTP_COOKIE_PARSE_RAW']) 
  foreach(explode(";",$_SERVER['HTTP_COOKIE_PARSE_RAW']) as $line){
    list($key,$val) = explode("=",$line);
    $_COOKIE[trim($key)]=urldecode(trim($val));
  }

// _REQUEST
$_REQUEST=(array)$_GET + (array)$_POST + (array)$_COOKIE;

/* ======================================================================== *\
    Go
\* ======================================================================== */
// Clean up
unset($key,$val,$line,$request,$sw_name,$default_script,$path,$url);
// echo print_r($GLOBALS,true)."</pre>";

// Run script
if(realpath($_SERVER['SCRIPT_FILENAME'])){
  chdir($_SERVER['DOCUMENT_ROOT']);
  require $_SERVER['SCRIPT_FILENAME'];
}else{
  trigger_error("File $_SERVER[SCRIPT_FILENAME] Missing", E_USER_ERROR);
}
?>
