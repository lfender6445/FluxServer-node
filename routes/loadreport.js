/*
 * GET home page.
 */
var configs = require('../config'),
	childProcess = require('child_process'),
	path = require('path'),
	fs = require('fs'),
	temp = require('temp'),
	util = require('util'),
	cradle = require('cradle'),
	Url = require("url"),
	binPath = process.env.PHANTONJS_PATH||'phantomjs'
	db_url = Url.parse(process.env.CLOUDANT_URL || process.env.COUCH_URL),
	db_port = process.env.COUCH_PORT,
	db_name = 'load',
	auth = (db_url.auth) ? db_url.auth.split(':') : '',
	username = auth[0] || '',
	password = auth[1] || '',
	cradle_opts = {
		cache: true,
		raw: false
	};
if (auth !== '') {
	cradle_opts.secure = true;
	cradle_opts.auth = {
		username: username,
		password: password
	};
	db_port = 443;
}
console.log('couchdb host is %s', db_url.href, cradle_opts);
var conn = new(cradle.Connection)(db_url.hostname, db_port, cradle_opts),
	db = conn.database(db_name);

db.exists(function(err, exists) {
	if (err) {
		console.log('error connecting to database', err);
	} else if (exists) {
		console.log(db_name + ' database exists');
	} else {
		console.warn(db_name + ' database does not exists.');
		console.log('creating database');
		db.create();
		if (db_name in process.env.DB_DESIGN)
		/* populate design documents */
		console.log('creating design docs');
		Object.keys(process.env.DB_DESIGN[db_name]).forEach(function(d) {
			db.save(d, process.env.DB_DESIGN[db_name][d]);
		})
	} else {
		console.warn("No Database design docs for: " + db_name);
	}
});
exports.index = function(req, res) {
	res.render('index', {
		title: 'Load Report',
		path: process.env.LOAD_BASE+'/performance/json/data/'
	});
};
exports.report = function(req, res) {
	res.render('index', {
		title: 'Load Report',
		path: process.env.LOAD_BASE'/performance/json/data/'
	});
};
exports.data = function(req, res) {
	console.dir(req.params)
	var url = req.param('url'),
		task = req.param('task') || 'performance',
		format = req.param('format') || 'json',
		contentType = 'json';
	if (url) {
		//FIX: remove this hard reference
		var childArgs = [
			process.env.LOAD_SCRIPT, url, task, format
		];
		//childArgs.push(info.path);
		console.log("running \"%s\"", childArgs);
		childProcess.execFile(binPath, childArgs, function(err, stdout, stderr) {
			if (err) {
				res.send(500, err);
			} else {
				if (format === 'csv') {
					res.set('Content-Type', 'text/csv');
				} else {
					res.set('Content-Type', 'application/json');
				}
				res.send(stdout);
				if (stdout) {
					db.save(JSON.parse(stdout.toString()), function(err, res) {
						if (err) {
							console.error("there was an error saving the data", err);
						} else {
							console.log("data was saved successfully", res);
						}
					});
				} else {
					console.error("our data object is empty!");
				}
			}
		});
	} else {
		res.send(400, "invalid URL specified in search string");
	}
	//res.render('index', { title: req.params['task'] });
};