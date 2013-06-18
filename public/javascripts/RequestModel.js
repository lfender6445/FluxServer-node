    function HTTPEventModel(r) {
        r = r || {};
        var that = this;
        that.id = ko.observable(r.id);
        that.headers = ko.observableArray(r.headers);
        that.time = ko.observable(r.time);
        that.url = ko.observable(r.url);
        that.milliseconds = ko.computed(function () {
            return Date.parse(that.time())
        }, that);
        return that;
    }
    function RequestModel(r) {
        r = r || {};
        var that = new HTTPEventModel(r);
        that.method = ko.observable(r.method);
        return that;
    }
    ;
    function ResponseModel(r) {
        r = r || {};
        var that = new HTTPEventModel(r);
        that.received = ko.observable(Date.parse(r.received || r.time));
        that.bodySize = ko.observable(r.bodySize || 0);
        that.contentType = ko.observable(r.contentType || "text/html; charset=UTF-8");
        that.redirectURL = ko.observable(r.redirectURL);
        that.stage = ko.observable(r.stage || "start");
        that.status = ko.observable(r.status || 200);
        that.statusText = ko.observable(r.statusText || "OK");
        return that;
    }
    ;
    function AssetModel(req, res) {
        if (req.id !== res.id || req.url !== res.url) {
            throw "error";
        }
        var that = this;
        that.request = ko.observable(new RequestModel(req));
        that.response = ko.observable(new ResponseModel(res));
        that.id = ko.observable(req.id);
        that.url = ko.observable(/([^?#&\s]+)/.exec(req.url)[1]);
        that.contentType= ko.computed(function(){
            return this.response().contentType();
        }, that);
        that.startTime = ko.computed(function () {
            return this.request().milliseconds()
        }, that);
        that.receivedTime = ko.computed(function () {
            return this.response().received()
        }, that);
        that.endTime = ko.computed(function () {
            return this.response().milliseconds()
        }, that);
        that.duration = ko.computed(function () {
            return this.endTime() - this.startTime()
        }, that);
        that.downloadTime = ko.computed(function () {
            return this.endTime() - this.receivedTime()
        }, that);
        that.blocking = ko.observable(0);
        that.lifetime = ko.computed(function () {
            return this.blocking() + this.duration()
        }, that);
        /*that.blocking = ko.computed(function () {
            return this.startTime() - this.request().milliseconds()
        }, that);*/
        that.latency = ko.computed(function () {
            return this.receivedTime() - this.startTime()
        }, that);
        that.tooltip = ko.computed(function () {
            var tip = that.url();
            if (tip.length > 120)tip = tip.substring(0, 120) + '...';
            tip += ' \n(' + that.response().bodySize() + ' bytes)';
            return tip;
        }, that);
    }
    function PageModel(r) {
        r = r || {};
        var that = new RequestModel(r), assets = r.assets.sort(function (a, b) {
            return (a.request.id !== b.request.id) ? a.request.id - b.request.id : ((a.response.stage === 'end') ? 1 : -1);
        });
        that.startTime = ko.observable(r.requestTime);
        that.endTime = ko.observable(r.responseTime);
        that.assets = ko.observableArray([]);
        that.distinctContentTypes = ko.observableArray([]);
        that.duration = ko.computed(function () {
            return that.endTime() - that.startTime()
        });

        for (var a = 0, al = assets.length; a < al; a++) {
            var raa = r.assets[a], 
                asset = new AssetModel(raa.request, raa.response),
                time=Date.parse(raa.request.time);
            console.log(that.startTime(), asset.startTime(), time)
            asset.blocking(asset.startTime() - that.startTime());
            that.assets.push(asset);
        }
        that.urls = ko.computed(function () {
            return that.assets().reduce(function (result, current, index, array) {
                result.push(current.url());
                return result;
            }, [])
        });
        that.contentTypes = ko.computed(function () {
            return that.assets().reduce(function (result, current, index, array) {
                var t=current.response().contentType();
                if(/;/.test(t)){
                    t=t.substring(0,t.indexOf(';'));
                }
                if(t in result){
                    result[t]++;
                }else{
                    result[t]=1;
                }
                return result;
            }, {})
        });
        that.contentTypesKeys=ko.computed(function () {
            return Object.keys(that.contentTypes());
        });
        that.contentTypesValues=ko.computed(function () {
            return that.contentTypesKeys().reduce(function (result, current, index, array) {
                result.push(that.contentTypes()[current]);
                return result;
            }, [])
        });
        that.blockings = ko.computed(function () {
            return that.assets().reduce(function (result, current, index, array) {
                result.push(current.blocking());
                return result;
            }, [])
        });
        that.latencies = ko.computed(function () {
            return that.assets().reduce(function (result, current, index, array) {
                result.push(current.latency());
                return result;
            }, [])
        });
        that.downloadTimes = ko.computed(function () {
            return that.assets().reduce(function (result, current, index, array) {
                result.push(current.downloadTime());
                return result;
            }, [])
        });
        that.durations = ko.computed(function () {
            return that.assets().reduce(function (result, current, index, array) {
                result.push(current.duration());
                return result;
            }, [])
        });
        that.stacked = ko.computed(function () {
            return that.assets().reduce(function (result, current, index, array) {
                result.push([current.blocking(), current.latency(), current.downloadTime(), current.duration(), current.lifetime()]);
                return result;
            }, [])
        });
        that.sizes = ko.computed(function () {
            return that.assets().reduce(function (result, current, index, array) {
                result.push(current.response().bodySize());
                return result;
            }, [])
        });
        that.tooltipFormatter = function (el, o, v) {
            var tooltip = "";
            if (v) {
                tooltip = that.assets()[v[0].offset].tooltip() + ': ' + v[0].value + 'ms';
            }
            return tooltip;
        };
        that.tooltipFormatterType = function (el, o, v) {
            var tooltip = "";
            if (v) {
                tooltip = that.assets()[v[0].offset].tooltip() + ': ' + v[0].value;
            }
            return tooltip;
        };
        that.tooltipFormatterBytes = function (el, o, v) {
            var tooltip = "";
            if (v) {
                tooltip = that.assets()[v[0].offset].tooltip() + ': ' + v[0].value + ' bytes';
            }
            return tooltip;
        };
        that.tooltipFormatterStacked = function (el, o, v) {
            var tooltip = "", asset = that.assets()[v[0].offset];
            //console.log(v);
            if (v) {
                tooltip = asset.tooltip() + ':'
                        + '<br/>Blocking: ' + v[3].value + 'ms'
                        + '<br/>Latency: ' + v[2].value + 'ms'
                        + '<br/>Download Time: ' + v[1].value + 'ms'
                        + '<br/>Duration: ' + v[0].value + 'ms'
            }
            return tooltip;
        };
        //that.assets.sort(function(a,b){return a.id()-b.id();});
        return that;
    }
