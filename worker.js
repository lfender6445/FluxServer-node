var configs = require('./config');
var amqp = require('amqp');
var uuid = require('node-uuid');
var url = process.env.CLOUDAMQP_URL || process.env.AMQP_URL; // default to localhost
var reqQueue = 'speedreport-request';
var replyQueue = 'speedreport-request';
var connection = amqp.createConnection({url: url}); // create the connection
var phelper=require('./helpers/phantomHelper.js');

connection.on('ready', function () {
    connection.queue('reports-request', function (q) {
        q.bind("#");
        q.subscribe(function (message) {
         var url=message.url
          , task = message.task||'performance'
          , contentType=message.contentType||'json';
          console.log("worker received request for %s",url)
        if(url){
          phelper.speedReport(url,task,contentType,function(err, data){
            if(err)console.error(err)
            if(err){
              connection.publish('reports-reply', {key:message.key,error:err});
            }else{
              connection.publish('reports-reply', {key:message.key,data:data});
            }
          })
        }else{
          connection.publish('reports-reply', {key:message.key,error:'no URL specified'});
        }
       });
      });
});
