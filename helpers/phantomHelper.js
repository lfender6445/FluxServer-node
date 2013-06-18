var conf = require("../config.js")
	, childProcess = require('child_process')
	, binPath = conf.PHANTONJS_PATH||'phantomjs'
	, path = require('path')
	, fs= require('fs')
	, cradle = require('cradle')
	, Url = require("url")
	, db_url=Url.parse(process.env.CLOUDANT_URL||conf.COUCH_URL)
	, db_port=conf.COUCH_PORT
	, temp = require('temp')
	, util = require('util')

	, auth=(db_url.auth)?db_url.auth.split(':'):''
	, username=auth[0]||''
	, password=auth[1]||''
	, cradle_opts={cache: true, raw: false}
;
console.log("SPEED DB");
console.dir(conf.DB_DESIGN.speed);
if(auth!==''){
	cradle_opts.secure=true;
	cradle_opts.auth={ username: username, password: password };
	db_port=443;
}
console.log('couchdb host is %s',db_url.href);
var conn = new(cradle.Connection)(db_url.hostname, db_port, cradle_opts)
	, db = conn.database('speedreport')
;
db.exists(function (err, exists) {
	if (err) {
		console.log('error connecting to database', err);
		return;
	}
	if (exists) {
		console.log('speedreport database exists');
	} else {
		console.warn('speedreport database does not exists.');
		console.log('creating database');
		db.create();
	}
	console.log('creating design docs');
	Object.keys(conf.DB_DESIGN.speed).forEach(function(d){
		db.save(d, conf.DB_DESIGN.speed[d]);
	})
});
var headers=['Cache-Control','Expires'];

function normalizeReportData(data, callback){
	try{
		data.duration=data.responseTime-data.requestTime;
		data.blocked=0;
		data.latency=0;
		data.downloadTime=0;
		data.lifetime=0;
		data.pageLifetime=0;
		data.assetCount=data.assets.length;
		data.mimeTypes={};
		data.mimeGroups={};
		data.stacked=[];
		data.stackedProperties=['Blocking', 'Latency', 'Download time', 'Lifetime'];
		data.stackedColors=['steelblue', 'yellow', 'red', 'green'];
		data.assets.forEach(function(asset){
			asset.request.time=Date.parse(asset.request.time);
			asset.response.time=Date.parse(asset.response.time);
			asset.response.received=Date.parse(asset.response.received);
			asset.blocked=asset.request.time-data.requestTime;
			asset.latency=asset.response.received-asset.request.time;
			asset.latencyStacked=asset.blocked+asset.latency;
			asset.downloadTime=asset.response.time-asset.response.received;
			asset.downloadTimeStacked=asset.latencyStacked+asset.downloadTime;
			asset.lifetime=asset.response.time-asset.request.time;
			asset.pageLifetime=asset.response.time-data.requestTime;
			asset.stacked=[asset.blocked,asset.latencyStacked,asset.downloadTimeStacked, asset.pageLifetime];
			asset.mimeType=asset.response.contentType;
			if(asset.mimeType.indexOf(';')!==-1){
				asset.mimeType=asset.response.contentType.substring(0,asset.response.contentType.indexOf(';'));
			}
			asset.mimeGroup=asset.mimeType.substring(0,asset.mimeType.indexOf('/'));
			asset.isGzipped=false;
			asset.isCached=false;
			asset.response.headers.forEach(function(h){
				if(h.name==='Content-Encoding' && h.value==='gzip') asset.isGzipped=true;
				if(h.name==='Expires') {
					try{
						var d=Date.parse(h.value);
					}catch(e){
						doc.warnings("error processing Expires header for "+asset.request.url);
					}
				}
				if(headers.indexOf(h.name)!== -1){
				  asset.isCached=true;
				}
			});
			if(asset.isGzipped && asset.mimeGroup==="image"){
				doc.warnings.push("gzipping already-compressed binary data is counter-productive: "+asset.request.url)
			}

			data.blocked+=asset.blocked;
			data.latency+=asset.latency;
			data.downloadTime+=asset.downloadTime;
			data.lifetime+=asset.lifetime;
			data.pageLifetime+=asset.pageLifetime;
			data.stacked.push(asset.stacked);
			if(asset.mimeType in data.mimeTypes){
				data.mimeTypes[asset.mimeType].push(asset);
			}else{
				data.mimeTypes[asset.mimeType]=[asset];
			}
		})
		data.normalized=1;
	}catch(e){
		return callback(e, null);
	}
	return callback(null, data);
}
exports.normalizeReportData=normalizeReportData;
exports.getDatabaseHandle=function(){
	return db;
}
exports.speedReport=function(url,task,contentType, callback){
	task=task||'performance';
	contentType=contentType||'json';
	var childArgs = ["export DISPLAY="+conf.DISPLAY+" &&", conf.PHANTONJS_PATH, "--load-plugins=true", conf.SPEED_SCRIPT, url];
	// Process the data (note: error handling omitted)
	temp.open('speedreport-', function(err, info) {
	  if(err) console.error(err);
	  if(err) return callback(err, null);
		childArgs.push(info.path);
		console.log("running \"%s\"", childArgs.join(' '));
		childProcess.exec(childArgs.join(' '), function(err, stdout, stderr) {
			if(err) return callback(err, null);
			process.nextTick(function(){
				fs.readFile(info.path, function (err, data) {
					if (err) return callback(err, null);
					if(data){
						try{
							normalizeReportData(JSON.parse(data.toString()),function(err, data){
								db.save(data, function (err, res) {
									if (err) {
										console.error("there was an error saving the data", err);
										return callback(err, null);
									} else {
										console.log("data was saved successfully", res);
										return callback(null, res);
									}
								});
							});

						}catch(e){
							console.error("unable to parse JSON data", e);
							console.dir(data)
							return callback(e, null);
						}
					}else{
						console.error("our data object is empty!");
						return callback(new Error("the created object was empty"), null);
					}
				});
			})
		})
	});
}

exports.getSavedReport=function(id, callback){
	db.get(id, function (err, doc) {
		callback(err, doc);
	});
}
exports.getSavedReportList=function(url, callback){
	var options={};
	if(url)options.key=url;
	db.view('tests/byURL', options, function (err, doc) {
		if(err){
			callback(err, null);
		}else{
			callback(null, doc);
		}
  });
}
exports.getSavedReportListVerbose=function(url, callback){
	var options={limit:3};
	if(url)options.key=url;
	db.view('tests/normal', options, function (err, doc) {
		if(err){
			callback(err, null);
		}else{
			callback(null, doc);
		}
  });
}
exports.getSavedReportListAggregate=function(url, depth, callback){
	var options={
		group: true,
		reduce: true,
		group_level: depth||3
	}
	if(url){
	  options.startkey= [url];
	  options.endkey= [url, '\u9999'];
	}
	db.view('tests/byDistinctURL', options, function (err, doc) {
		if(err){
			callback(err, null);
		}else{
			callback(null, doc);
		}
  });
}