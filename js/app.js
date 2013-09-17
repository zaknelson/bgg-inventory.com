var plot = $(".plot");
var plotContext = plot[0].getContext("2d");

// constants
var plotPadding = 50;
var mouseOverRadiusScale = 1.5;
var minRadiusSize = 5;
var orderedConditions = ["new", "likenew", "verygood", "good", "acceptable"];

// model
var games = [];
var mousedOverGame = null;
var clickedGame = null;
var pointRadius = 5;
var plotWidth = 500;
var plotHeight = 500;
var lastPoint = null;

// filters
var searchQuery = null;
var minPrice = 0;
var maxPrice = 50;
var minRank = 0;
var maxRank = 100;
var currency = "USD";
var currencySymbol = "$";
var conditions = {"new": true, "likenew": true, "verygood": true, "good": true, "acceptable": true};
var categories = {};

var eventToPoint = function(event) {
	if (!event) {
		return null;
	}
	event = event.originalEvent;
	var point = {};
	if (event.touches) {
		point.x = event.touches[0].pageX - parseInt($(".content").css("left"));
		point.y = event.touches[0].pageY;
	} else {
		point.x = event.offsetX === undefined ? event.layerX : event.offsetX;
		point.y = event.offsetY === undefined ? event.layerY : event.offsetY;
	}
	return point;
};

var pointToGame = function(point) {
	if (!point) {
		return null;
	}
	var rank = Math.round(((maxRank - minRank) * (point.x - plotPadding)) / plotWidth - .5) + minRank;
	var game = games[rank];
	if (game && 
		point.y >= plotPadding - pointRadius * mouseOverRadiusScale && 
		point.y <= plotHeight + plotPadding + pointRadius * mouseOverRadiusScale) {
		for (var i = 0; i < game.market_items.length; i++) {
			if (isFiltered(game, game.market_items[i])) {
				return game;
			}
		}
	}
	return null;;
};

var getFilteredMarketItems = function(game) {
	var marketItems = [];
	for (var i = 0; i < game.market_items.length; i++) {
		var marketItem = game.market_items[i];
		if (isFiltered(game, marketItem)) {
			marketItems.push(marketItem);
		}
	}
	return marketItems;
};

var marketItemToPoint = function(game, marketItem) {
	var point = {};
	point.x = (game.rank - minRank - .5) / (maxRank - minRank) * plotWidth + plotPadding;
	point.y = plotHeight - ((marketItem.price.value - minPrice) / (maxPrice - minPrice)) * plotHeight + plotPadding;
	return point;
};

var conditionToColor = function(condition, isBright) {
	var color = null;
	switch(condition) {
		case "new":
			color = isBright ? "rgba(52, 73, 94, 1)" : "#b7bfc6";
			break;
		case "likenew":
			color = isBright ? "rgba(52, 152, 219, 1)" : "#b7dbf2"
			break;
		case "verygood":
			color = isBright ? "rgba(46, 204, 113, 1)" : "#b5edcd";
			break;
		case "good":
			color = isBright ? "rgba(241, 196, 15, 1)" : "#f7e28d";
			break;
		case "acceptable":
			color = isBright ? "rgba(231, 76, 60, 1)" : "#f7c0ba";
			break;
		default:
			break;
	}
	return color;
};

var drawPoint = function(point, color, radius) {
	plotContext.beginPath();
	plotContext.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
	plotContext.fillStyle = color;
	plotContext.fill();
};

var doesGameContainSubstring = function(game, substring) {
	var substringParts = substring.toLowerCase().match(/\S+/g);
	var gameNameParts = game.name.toLowerCase().match(/\S+/g);
	for (var i = 0; i < substringParts.length; i++) {
		var substringPart = substringParts[i];
		var foundMatch = false;
		for (var j = 0; j < gameNameParts.length; j++) {
			var gameNamePart = gameNameParts[j];
			if (gameNamePart.slice(0, substringPart.length) === substringPart) { //does the game name start with the substring?
				foundMatch = true;
				break;
			}
		}
		if (!foundMatch) {
			return false;
		}
	}
	return true;
};

var isFiltered = function(game, marketItem) {
	return (game.rank <= maxRank &&
			game.rank >= minRank &&
		(!marketItem ||
			(marketItem.price.value <= maxPrice && 
			marketItem.price.value >= minPrice &&
			marketItem.price.currency === currency &&
			conditions[marketItem.condition])) &&
		(!searchQuery || doesGameContainSubstring(game, searchQuery)));
};

var drawAxisLabels = function() {
	$(".x-ticks").empty();
	$(".y-ticks").empty();
	for (var i = 0; i < 6; i++) {
		var rank = (minRank + i * (maxRank - minRank) / 5);
		rank = rank === 0 ? 1 : rank;
		var xTick = $('<div class="x-tick">#' + rank + '</div>');
		xTick.css("left", plotPadding + plotWidth / 5 * i - 15);
		$(".x-ticks").append(xTick);



		var yTick = $('<div class="y-tick">' + currencySymbol + (minPrice + i * (maxPrice - minPrice) / 5)  + '</div>');
		yTick.css("top", plotHeight + plotPadding - plotHeight / 5 * i - 5);
		$(".y-ticks").append(yTick);
	}
	
};

var drawPlot = function(point) {
	drawAxisLabels();
	plot.attr("width", plot.width());
	plot.attr("height", plot.height());
	plotContext.clearRect (0, 0, plot.width(), plot.height());
	var drawLater = [];
	for (var i = 0; i < games.length; i++) {
		var game = games[i];
		for (var j = 0; j < game.market_items.length; j++) {
			var marketItem = game.market_items[j];
			if (isFiltered(game, marketItem)) {
				var marketItemPoint = marketItemToPoint(game, marketItem);
				if (mousedOverGame) { // one game is moused over, display it only
					var isSelected = mousedOverGame === game;
					var radius = isSelected ? Math.max(pointRadius * mouseOverRadiusScale, minRadiusSize) : pointRadius;
					var color = conditionToColor(marketItem.condition, isSelected);
					if (isSelected) {
						drawLater.push({marketItemPoint:marketItemPoint, color:color, radius:radius})
					} else {
						drawPoint(marketItemPoint, color, radius);
					}
				} else if (	point && 
							point.x > plotPadding && point.x < plotWidth + plotPadding && 
							point.y > plotPadding && point.y < plotHeight + plotPadding) { // mouse is inside the plot, but no game is moused over
					var color = conditionToColor(marketItem.condition, false);
					drawPoint(marketItemPoint, color, pointRadius);
				} else { // mouse is outside the plot
					var color = conditionToColor(marketItem.condition, true);
					drawPoint(marketItemPoint, color, pointRadius);
				}
			}
		}
	}

	for (var i = 0; i < drawLater.length; i++) {
		drawPoint(drawLater[i].marketItemPoint, drawLater[i].color, drawLater[i].radius);
	}
};

var updateTooltipPrices = function(tooltip) {
	var priceList = tooltip.find(".prices");
	priceList.empty();

	var marketItems = getFilteredMarketItems(clickedGame);
	marketItems.sort(function(a, b) {
		return a.price.value - b.price.value;
	});

	var marketItemsByCondition = {};
	for (var i = 0; i < marketItems.length; i++) {
		var marketItem = marketItems[i];
		var arr = marketItemsByCondition[marketItem.condition];
		if (!arr) {
			arr = [];
			marketItemsByCondition[marketItem.condition] = arr;
		}
		arr.push(marketItem)
	}

	for (var i = 0; i < orderedConditions.length; i++) {
		var marketItemsForCondition = marketItemsByCondition[orderedConditions[i]];
		if (!marketItemsForCondition) {
			continue;
		}
		var div = $("<div></div>")
		for (var j = 0; j < marketItemsForCondition.length; j++) {
			var marketItem = marketItemsForCondition[j];
			var separator = j !== marketItemsForCondition.length - 1 ? ", " : "";
			var color = conditionToColor(marketItem.condition, true);
			var link = $('<a style="color:' + color + '" href="' + marketItem.link + '" target="_blank">' + Math.round(marketItem.price.value) + "</a>");
			var span = $('<span style="color:' + color + '"></span>');
			span.append(link);
			span.append(separator);
			div.append(span);
		}
		priceList.append(div);
	}
}

var showPlotTooltip = function(point, touch) {
	var tooltip = $(".content .tooltip");
	var game = mousedOverGame || clickedGame;
	if (game) {
		tooltip.find(".title").html("#" + game.rank + " " + game.name);
		tooltip.find(".categories").html(game.categories.join(", "));
		if (clickedGame) {
			tooltip.css("pointer-events", "auto");
			tooltip.find(".current-prices-text").show();
			tooltip.find(".current-prices-text a").attr("href", "http://boardgamegeek.com/geekstore.php3?action=listforsale&gameid=" + game.id);
			tooltip.find(".title-link").attr("href", "http://boardgamegeek.com/boardgame/" + game.id);
			updateTooltipPrices(tooltip);
		} else {
			tooltip.find(".current-prices-text").hide();
			tooltip.css("pointer-events", "none");
			tooltip.find(".prices").empty();
		}

		if (touch) {
			tooltip.css("top", plot.height() / 5 + "px");
		} else {
			tooltip.css("top", Math.min(point.y + 20, plot.height() - tooltip.height() - 40) + "px");
		}
		
		tooltip.css("left", Math.min(plot.width() - 400 - 35, point.x + 20) + "px");
		tooltip.show();
	} else {
		tooltip.hide();
	}
};

var update = function(point, touch) {
	plotWidth = plot.width() - plotPadding * 2;
	plotHeight = plot.height() - plotPadding * 2;
	pointRadius = (plotWidth / ((maxRank - minRank) * 2));
	lastPoint = point;

	if (!point) {
		mousedOverGame = null;
		clickedGame = null;
		$(".content .tooltip").hide();
	} else {
		showPlotTooltip(point, touch);
	}

	drawPlot(point);
};

var initGames = function() {
	$.getJSON("/api/v1/games", function(data) {
		games = data;
		update();
	});
};

var initWindowResizeHandler = function() {
	var resizeTimeoutId;
	window.onresize = function(){
		clearTimeout(resizeTimeoutId);
		resizeTimeoutId = setTimeout(function() {
			update();
		}, 50);
	};
};

var initKeyHandlers = function() {
	$(window.document).keydown(function(event) {
		if (event.keyCode === 27) { // ESC
			update();
		} else if (event.keyCode === 37 && clickedGame) { // left arrow
			var startingIndex = clickedGame.rank;
			var i = startingIndex - 2;
			i = (i < 0) ? maxRank : i;
			var done = false;
			while (i !== startingIndex && !done) {
				var game = games[i];
				if (getFilteredMarketItems(game).length) {
					mousedOverGame = game;
					clickedGame = game;
					var point = marketItemToPoint(game, game.market_items[0]);
					point.y = lastPoint.y;
					update(point);
					done = true;
					break;
				}
				i--;
				if (i === -1) {
					i = maxRank;
				}
			}
		} else if (event.keyCode === 39 && clickedGame) { // right arrow
			var startingIndex = clickedGame.rank
			var i = startingIndex;
			var done = false;
			while (i !== startingIndex-1 && !done) {
				var game = games[i];
				for (var j = 0; j < game.market_items.length; j++) {
					var marketItem = game.market_items[j];
					if (getFilteredMarketItems(game).length) {
						mousedOverGame = game;
						clickedGame = game;
						var point = marketItemToPoint(game, game.market_items[0]);
						point.y = lastPoint.y;
						update(point);
						done = true;
						break;
					}
				}
				i++;
				if (i === maxRank + 1) {
					i = 0;
				}
			}
		}
	})
};

var initPlot = function() {
	plot.on("mousemove mouseout", function(event) {
		if (!clickedGame) {
			var point = eventToPoint(event);
			mousedOverGame = pointToGame(point);
			update(point);
		}
	});

	plot.on("touchmove touchleave touchstart", function(event) {
		var point = eventToPoint(event);
		clickedGame = pointToGame(point);
		mousedOverGame = clickedGame;
		update(point, true);
		event.preventDefault();
	});

	$(".sidebar").click(function(event) {
		clickedGame = null;
		update();
	});

	plot.click(function(event) {
		if (clickedGame) {
			clickedGame = null;
			update();
		} else {
			var point = eventToPoint(event);
			clickedGame = pointToGame(point)
			update(point);
		}
	});
};

var initSidebar = function() {
	var tooltip = $(".global-tooltip");
	var priceSlider = $(".price-slider");
	var rankSlider = $(".rank-slider");

	$(".search-input").keyup(function() {
		searchQuery = $(".search-input").val();
		update();
	});

	$('.conditions input[type="checkbox"]').change(function(event) {
		$('.conditions .new input').is(":checked") ? 			conditions["new"] = true : 			conditions["new"] = false;
		$('.conditions .like-new input').is(":checked") ? 		conditions["likenew"] = true : 		conditions["likenew"] = false;
		$('.conditions .very-good input').is(":checked") ? 		conditions["verygood"] = true : 	conditions["verygood"] = false;
		$('.conditions .good input').is(":checked") ? 			conditions["good"] = true : 		conditions["good"] = false;
		$('.conditions .acceptable input').is(":checked") ?	 	conditions["acceptable"] = true : 	conditions["acceptable"] = false;
		update();
	});

	$(".currency-switch").change(function(event) {
		currency = $(".currency-switch").is(":checked") ? "USD" : "EUR";
		currencySymbol = currency === "USD" ? "$" : "€";
		update();
	});

	var showSliderTooltip = function(slider, str, value, maxValue) {
		// TODO, why is this necessary?
		var offset = -10;
		if (value === 5) {
			offset = -18;
		}
		tooltip.find(".title").html(str);
		tooltip.css("top", slider.offset().top - 60 + "px");
		tooltip.css("left", slider.offset().left + value / maxValue * slider.width() - tooltip.width() / 2 + offset + "px");
		tooltip.show();
	};

	priceSlider.slider({
		min: 0,
		max: 200,
		values: [0, 50],
		step: 5,
		range: true,
		orientation: "horizontal",
		slide: function(event, ui) {
			if (ui.values[0] === ui.values[1]) {
				return false;
			}
			showSliderTooltip(priceSlider, currencySymbol + (ui.value), ui.value, 200);
			minPrice = ui.values[0];
			maxPrice = ui.values[1];
			update();
		},
		start: function(event, ui) {
			showSliderTooltip(priceSlider, currencySymbol + ui.value, ui.value, 200)
		},
		stop: function(event, ui) {
			tooltip.hide();
		}});

	rankSlider.slider({
		min: 0,
		max: 500,
		values: [0, 100],
		step: 50,
		orientation: "horizontal",
		range: true,
		slide: function( event, ui ) {
			if (ui.values[0] === ui.values[1]) {
				return false;
			}
			showSliderTooltip(rankSlider, "#" + ui.value, ui.value, 500);
			minRank = ui.values[0];
			maxRank = ui.values[1];
			update();
		},
		start: function(event, ui) {
			showSliderTooltip(rankSlider, ui.value, ui.value, 500);
		},
		stop: function(event, ui) {
			tooltip.hide();
		}});

	$(".twitter-link").click(function() {
		window.open("https://twitter.com/intent/tweet?text=bgg-inventory.com - A visualization of popular games being sold on BoardGameGeek, by @_zaknelson", "", "height=400,width=600");
	});
};

var main = function() {
	initGames();
	initSidebar();
	initPlot();
	initWindowResizeHandler();
	initKeyHandlers();
};

main();