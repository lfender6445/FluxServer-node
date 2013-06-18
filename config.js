var path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'local';
process.env.SPEED_BASE = '/speedreport';
process.env.LOAD_BASE = '/loadreport';
process.env.SPEED_SCRIPT=path.join(__dirname, '/public/javascripts/speedreport.js');
process.env.LOAD_SCRIPT=path.join(__dirname, '/public/javascripts/loadreport.js');
process.env.PHANTONJS_PATH = "/opt/loadreport-server/bin/phantomjs--linux-i686/bin/phantomjs";

if (process.env.NODE_ENV === 'local') {
	process.env.AMQP_URL = "amqp://localhost";
	process.env.COUCH_URL = 'http://localhost';
	process.env.COUCH_PORT = 5984;
} else if (process.env.NODE_ENV === 'local-multiple') {
	process.env.AMQP_URL = "amqp://10.11.14.2";
	process.env.COUCH_URL = 'http://10.11.14.3';
	process.env.COUCH_PORT = 5984;
}

process.env.DB_DESIGN = {
	speed: [{
			'_design/tests': {
				normal: {
					map: function(doc) {

						if (doc.url) {
							try {
								doc.warnings = [];
								doc.duration = doc.responseTime - doc.requestTime;
								doc.blocked = 0;
								doc.latency = 0;
								doc.downloadTime = 0;
								doc.lifetime = 0;
								doc.pageLifetime = 0;
								doc.assetCount = doc.assets.length;
								doc.mimeTypes = {};
								doc.mimeGroups = {};
								doc.stacked = [];
								doc.stackedProperties = ['Blocking', 'Latency', 'Download time', 'Lifetime'];
								doc.stackedColors = ['steelblue', 'yellow', 'red', 'green'];
								doc.assets.forEach(function(asset) {
									asset.request.time = Date.parse(asset.request.time);
									asset.response.time = Date.parse(asset.response.time);
									asset.response.received = Date.parse(asset.response.received);
									asset.blocked = asset.request.time - doc.requestTime;
									asset.latency = asset.response.received - asset.request.time;
									asset.latencyStacked = asset.blocked + asset.latency;
									asset.downloadTime = asset.response.time - asset.response.received;
									asset.downloadTimeStacked = asset.latencyStacked + asset.downloadTime;
									asset.lifetime = asset.response.time - asset.request.time;
									asset.pageLifetime = asset.response.time - doc.requestTime;
									asset.stacked = [asset.blocked, asset.latencyStacked, asset.downloadTimeStacked, asset.pageLifetime];
									asset.mimeType = asset.response.contentType;
									if (asset.mimeType.indexOf(';') !== -1) {
										asset.mimeType = asset.response.contentType.substring(0, asset.response.contentType.indexOf(';'));
									}
									asset.mimeGroup = asset.mimeType.substring(0, asset.mimeType.indexOf('/'));
									asset.isGzipped = false;
									asset.isCached = false;
									asset.response.headers.forEach(function(h) {
										if (h.name === 'Content-Encoding' && h.value === 'gzip') asset.isGzipped = true;
										if (h.name === 'Expires') {
											try {
												var d = Date.parse(h.value);
											} catch (e) {
												doc.warnings("error processing Expires header for " + asset.request.url);
											}
										}
										if (['Cache-Control', 'Expires'].indexOf(h.name) !== -1) {
											asset.isCached = true;
										}
									});
									if (asset.isGzipped && asset.mimeGroup === "image") {
										doc.warnings.push("gzipping already-compressed binary data is counter-productive: " + asset.request.url)
									}
								})
								doc.normalized = 1;
							} catch (e) {
								doc.error = e;
							}
							emit(doc.url, doc);
						}
					}
				},
				byURL: {
					map: function(doc) {
						if (doc.url) emit(doc.url, doc.requestTime);
					}
				},
				unnormalized: {
					map: function(doc) {
						if (!doc.normalized || doc.normalized < 1) emit(doc.id, doc.id);
					}
				},
				byDistinctURL: {
					map: function(doc) {
						if (doc.url) {
							var date = new Date(doc.requestTime);
							var newDoc = {
								duration: doc.duration || 0,
								blocked: doc.blocked || 0,
								latency: doc.latency || 0,
								downloadTime: doc.downloadTime || 0,
								lifetime: doc.lifetime || 0,
								assetCount: doc.assetCount || 0
							};
							emit([doc.url, date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()], newDoc);
						}
					},
					reduce: function(key, values, rereduce) {
						var count = values.length,
							combined = values.reduce(function(p, c, i, a) {
								p.duration += c.duration;
								p.blocked += c.blocked;
								p.latency += c.latency;
								p.downloadTime += c.downloadTime;
								p.lifetime += c.lifetime;
								p.assetCount += c.assetCount;
								return p;
							}, {
								duration: 0,
								blocked: 0,
								latency: 0,
								downloadTime: 0,
								lifetime: 0,
								assetCount: 0
							});
						return {
							duration: (combined.duration / count),
							blocked: (combined.blocked / count),
							latency: (combined.latency / count),
							downloadTime: (combined.downloadTime / count),
							lifetime: (combined.lifetime / count),
							assetCount: (combined.assetCount / count)
						};
					}
				}
			}
		}
	],
	load: [{
			'_design/tests': {
				all: {
					map: function(doc) {
						if (doc.url) emit(doc.url, doc);
					}
				}
			}
		}
	]
};
console.dir(process.env);