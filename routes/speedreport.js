
/*
 * GET home page.
 */

var conf = require('../config')
	, childProcess = require('child_process')
	, path = require('path')
	, fs= require('fs')
	, temp = require('temp')
	, util = require('util')
	, phelper=require('../helpers/phantomHelper.js')
	, uuid = require('node-uuid')
	, amqp = require('amqp')
	, uuid = require('node-uuid')
	, url = process.env.CLOUDAMQP_URL || process.env.AMQP_URL
	//Connect to RabbitMQ and get reference to the connection.
	, connection = amqp.createConnection({url:url})
    , replyQueue
    , broker={};

console.log('AMQP url: %s',url);
connection.on('ready', function () {
      connection.queue('reports-reply', function (q) {
      	replyQueue=q;
        q.bind("#");
	       //console.log('subscribing to replyQueue', replyQueue);
	       replyQueue.subscribe(function (message, headers, deliveryInfo) {
	         if(!broker[message.key])return;
	         process.nextTick(function(){
		         var res=broker[message.key].res;
		         var req=broker[message.key].req;
		         if(message.error){
		         	process.nextTick(function(){
			         	console.error("reports-reply message contains an error",message.error);
			         	res.send(500, message.error);
		         	});
		         }else if(!message.data){
		         	process.nextTick(function(){
			         	console.error("reports-reply message contains no data",message, headers, deliveryInfo);
			         	res.send(500, "report contains no data");
		         	});
		         }else{
		         	process.nextTick(function(){
				         console.log('app',message.data);
				         phelper.getSavedReport(message.data.id, function (err, doc) {
							res.set('Content-Type', 'application/json');
				  			res.send(doc);
						});
			         });
			     }
			 });
	         process.nextTick(function(){
		         delete broker[message.key];
		     });
       });

      });


  });

exports.index = function(req, res){
  res.render('index', { title: 'SpeedReport', path: '/speedreport/report' });
};
exports.report = function(req, res){
	var url=req.param('url')
		, id=req.param('id');
    if(id){
		res.render(conf.SPEED_VIEW, {
			id: id
			, url: url
			, barWidth: '3px'
		});
	}else if(url){
		res.render(conf.SPEED_VIEW, {
			url: url
			, barWidth: '3px'
		});
	}else{
		res.redirect('/');
	}
}
exports.list = function(req, res){
	var url=req.param('url');
    phelper.getSavedReportList(url, function(err, doc){
    	if(err){
    		res.send(500, err)
    	}else{
    		doc=doc.sort(function(a,b){return (a.url===b.url)?a.value-b.value:0;})
    		doc.forEach(function(d){d.requestTime=new Date(d.requestTime)});
    		if(/\/data\//.test(req.path)){
    			res.send(doc);
    		}else{
				res.render('list',{items:doc});
    		}
    	}
    })
}
exports.compare = function(req, res){
	var fromID=req.param('from');
	var toID=req.param('to');
    phelper.getSavedReport(fromID, function (err, from) {
    	if(err) res.send(500, err);
		phelper.getSavedReport(fromID, function (err, to) {
    		if(err) res.send(500, err);
			res.send({from:from,to:to});
		});
	});
}
exports.aggregate = function(req, res){
	var url=req.param('url');
	var depth=req.param('depth');
    phelper.getSavedReportListAggregate(url, depth, function (err, doc) {
    	if(err){
			res.send(500, err);
		}else{
			res.set('Content-Type', 'application/json');
  			res.send(doc);
		}
	});
}
exports.data = function(req, res){
	var url=req.param('url')
		, id=req.param('id')
		, task = req.param('task')||'performance'
		, contentType='json';
	if(id){
		phelper.getSavedReport(id, function (err, doc) {
			if(err){
				res.send(500, err);
			}else{
				res.set('Content-Type', 'application/json');
	  			res.send(doc);
			}
		});
	}else if(url){
      var key=uuid.v1();
      //hold this spot
      broker[key]={req:req,res:res};
      connection.publish('reports-request', {key:key,url:url});
	}else{
		res.send(400, "invalid URL specified in search string");
	}
};
exports.stream=function(req, res){
	var url=req.param('url')
	    , t
	    , onLoadFinishedFired = false
	    , requests={}
	    , responses={}
	    , pageInfo={url:url, assets:[]};
	if(url){
		phantom.create(function(ph, err) {
		  return ph.createPage(function(page) {
			page.set('onResourceRequested', function (r) {
				console.log("onResourceRequested");
			    if(r)requests[r.id]=r;
			});
			page.set('onResourceReceived', function (r) {
				console.log("onResourceReceived");
			    if(r && !(r.id in responses)){
			        responses[r.id]=r;
			    } else {
			        for(var i in responses[r.id]){
			            if(responses[r.id].hasOwnProperty(i) && !(i in r)){
			                r[i]=responses[r.id][i];
			            }
			        }
			        r.received=responses[r.id].time;
			        pageInfo.assets.push({
			            request:requests[r.id],
			            response:r
			        });
			    }
			});
			page.set('onLoadFinished', function (status) {
			    pageInfo.requestTime=t;
			    pageInfo.responseTime=Date.now();
			    if (status !== 'success') {
			        res.send(400, 'Failed to load the address');
			    }else{
			    	res.send(JSON.stringify(pageInfo));
			    }
				ph.exit();
			});
			t = Date.now();
			return page.open(url);
		  });
		});
	}else{
		res.redirect('/');
	}	
}
