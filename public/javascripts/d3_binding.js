ko.bindingHandlers.d3 = {
    update:function (element, valueAccessor, allBindingsAccessor, viewModel) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        //var options = allBindingsAccessor().sparklineOptions || {};
        //jQuery(element).sparkline(value, options);
        console.log((value.duration)?value.duration():'nah');
        var properties=[].concat(value.properties||0)
        	, orig_data=value.data()
        	, recordCount=orig_data.length
        	, flattened = orig_data.reduce(function(a, b) {
        			//console.log(typeof a, a,b);
        			if(!Array.isArray(a)){
        				return [a].concat(b);
        			}
				    return a.concat(b);
				})
        	, max=(value.duration)?value.duration():d3.max(flattened)
        	, colors=['steelBlue', 'red', 'green', 'yellow', 'purple', 'orange', 'blue']
        	, w=800
        	, pad=1
        	, thickness=25
        	, h=(thickness+pad)*recordCount
        	, dist = d3.scale.linear().domain([0, recordCount]).range([0, h])//distribution
        	, mag = d3.scale.linear().domain([0, max]).rangeRound([10, w])//magnitude
	        , chart=d3.select(element).html('').select('svg');
	    //console.log(properties);
	    //console.log(flattened);
        if(chart.empty()){
            chart=d3
            .select(element)
            .append('svg')
            .attr("class", "chart")
            .attr("width", w+25)
            .attr("height", h+25)
			.append("g")
			.attr("transform", "translate(0,25)");
        }
        function drawBars(data,  barColor){
        	console.log('drawing bars');
        	barColor=barColor||'#000';
        	var layer=chart
	        	.append("g")
				//.attr("transform", "translate(0,25)");
	        //the bars
	        layer.selectAll("rect")
	            .data(data)
	            .enter()
	            .append("rect")
	            .attr("fill", barColor)
	            .attr("x", 0)
	            .attr("y", function(d, i) { return dist(i); })
	            .attr("width", function(d,i){return mag(d);})
	            .attr("height", thickness)
	            //.on("mouseover", function(d,i){console.log(orig_data[i].url());})
	            //.on("mouseout", function(d,i){});
	        //the text
	        /*layer.selectAll("text")
				.data(data)
				.enter().append("text")
				.attr("x", 2)
				.attr("y", function(d, i) { return dist(i)+thickness; })
				.attr("dx", ".35em") // padding-right
				.attr("dy", -6) // vertical-align: middle
				.attr("text-anchor", "start") // text-align: right
				.text(function(d, i) { return d+'ms'; });*/
		}
		properties.forEach(function(prop){
			drawBars(orig_data.map(function(x){return x[prop]||x;}), colors[prop]);
		})
		//drawBars(orig_data.map(function(x){return x[3];}), 'steelBlue');
		//drawBars(orig_data.map(function(x){return x[1];}), 'red');
		//the tick marks
		chart.selectAll("line")
			.data(mag.ticks(10))
			.enter().append("line")
			.attr("x1", mag)
			.attr("x2", mag)
			.attr("y1", 0)
			.attr("y2", h)
			.style("stroke", "#ccc");
		//tick labels
		chart.selectAll(".rule")
			.data(mag.ticks(10))
			.enter().append("text")
			.attr("class", "rule")
			.attr("x", mag)
			.attr("y", 0)
			.attr("dy", -3)
			.attr("text-anchor", "middle")
			.text(String);
		//Y-Axis
		chart.append("line")
		.attr("y1", 0)
		.attr("y2", h)
		.style("stroke", "#000");
    }
};
