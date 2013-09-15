var plot = $(".plot");
var plotContext = plot[0].getContext("2d");

var plotPadding = 40;

var allGames = [];
var games = [];
var highestPrice = 100;
var mousedOverGame = null;
var clickedGame = null;

// filters
var searchQuery = null;
var maxPrice = 50;
var upperRank = 1;
var lowerRank = 100;
var currency = "USD";
var conditions = {"new": true, "likenew": true, "verygood": true, "good": true, "acceptable": true};
var categories = {};

var gameCount = function() {
	return lowerRank - upperRank + 1;
};

var getPlotWidth = function() {
	return plot.attr("width") - plotPadding * 2;
};

var getPlotHeight = function() {
	return plot.attr("height") - plotPadding * 2;
};

var getPointRadius = function() {
	// TODO maybe cache this?
	return (getPlotWidth() / (gameCount() * 2));
};

var getCurrencySymbol = function() {
	return currency === "USD" ? "$" : "€";
};

var marketItemToPoint = function(game, marketItem) {
	var point = {};
	point.x = ((game.rank - .5) / gameCount()) * getPlotWidth() + plotPadding;
	point.y = getPlotHeight() - (marketItem.price.value / maxPrice) * getPlotHeight() + plotPadding;
	return point;
};

var areAnyFiltersApplied = function() {
	return searchQuery || 
		!$('.conditions .new input').is(":checked")  || 
		!$('.conditions .like-new input').is(":checked")  ||
		!$('.conditions .very-good input').is(":checked")  ||
		!$('.conditions .good input').is(":checked")  ||
		!$('.conditions .acceptable input').is(":checked") ;
};

var mouseEventToMarketItemsAndGame = function(event) {
	var result = {};
	var rank = Math.round((gameCount() * (event.offsetX - plotPadding)) / getPlotWidth() - .5)
	var game = games[rank];
	if (game && isFiltered(game) && event.offsetY  >= plotPadding && event.offsetY <= getPlotHeight() + plotPadding) {
		if (!areAnyFiltersApplied()) {
			result.game = game;
		} else {
			for (var i = 0; i < game.market_items.length; i++) {
				var marketItem = game.market_items[i];
				if (isFiltered(game, marketItem)) {
					result.game = game;
					break;
				}
			}
		}
	}
	return result;
};

var drawPoint = function(point, color, radius) {
	plotContext.beginPath();
	plotContext.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
	plotContext.fillStyle = color;
	plotContext.fill();
};

var drawMarketItem = function(event, game, marketItem) {
	var point = marketItemToPoint(game, marketItem)
	if (mousedOverGame) { // one game is moused over, display it only
		var isSelected = mousedOverGame === game;
		drawPoint(point, getColorForCondition(marketItem.condition, isSelected), isSelected ? Math.max(getPointRadius() * 1.5, 7) : getPointRadius());
	} else if (	event && 
				event.offsetX > plotPadding && event.offsetX < plot.width() - plotPadding && 
				event.offsetY > plotPadding && event.offsetY < plot.height() - plotPadding) { // mouse is inside the plot, but no game is moused over
		drawPoint(point, getColorForCondition(marketItem.condition, false), getPointRadius());
	} else {
		drawPoint(point, getColorForCondition(marketItem.condition, true), getPointRadius());
	}
};

var getColorForCondition = function(condition, isSelected) {
	var color = "#000"
	var opactity = isSelected ? "1.0" : "0.15"
	switch(condition) {
		case "new":
			color = "rgba(52, 73, 94, " + opactity + ")"
			break;
		case "likenew":
			color = "rgba(52, 152, 219, " + opactity + ")"
			break;
		case "verygood":
			color = "rgba(46, 204, 113, " + opactity + ")"
			break;
		case "good":
			color = "rgba(241, 196, 15, " + opactity + ")"
			break;
		case "acceptable":
			color = "rgba(231, 76, 60, " + opactity + ")"
			break;
		default:
			break;
	}
	return color;
};

var doesGameContainSubstring = function(game, substring) {
	var substringParts = substring.toLowerCase().match(/\S+/g);
	var gameNameParts = game.name.toLowerCase().match(/\S+/g);
	for (var i = 0; i < substringParts.length; i++) {
		var substringPart = substringParts[i];
		
		var foundMatch = false;
		for (var j = 0; j < gameNameParts.length; j++) {

			var gameNamePart = gameNameParts[j];
			if (gameNamePart.slice(0, substringPart.length) === substringPart) { //does the part start with the substring?
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
	return (game.rank >= upperRank && game.rank <= lowerRank &&
		(!marketItem ||
			(marketItem.price.value < maxPrice && 
			marketItem.price.currency == currency &&
			conditions[marketItem.condition])) &&
		(!searchQuery || doesGameContainSubstring(game, $(".search-input").val())));
};

var drawPlot = function(event) {
	plot.attr("width", plot.width());
	plot.attr("height", plot.height());
	plotContext.clearRect (0, 0, plot.width(), plot.height());
	for (var i = 0; i < games.length; i++) {
		var game = games[i];
		for (var j = 0; j < game.market_items.length; j++) {
			var marketItem = game.market_items[j];
			if (isFiltered(game, marketItem)) {
				drawMarketItem(event, game, marketItem);
			}
			if (marketItem.price.currency == currency &&
				conditions[marketItem.condition]) {
				
			}
		}
	}
};

var setPriceRanges = function() {
	for (var i = 0; i < games.length; i++) {
		var game = games[i];
		game.priceRange = {};
		for (var j = 0; j < game.market_items.length; j++) {
			var marketItem = game.market_items[j];
			var price = marketItem.price.value;
			if (!game.priceRange.min || price < game.priceRange.min) {
				game.priceRange.min = price;
			}
			if (!game.priceRange.max || price > game.priceRange.max) {
				game.priceRange.max = price;
			}
		}
	}
};

var getGames = function() {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "/api/v1/games", true);
	xhr.onload = function (e) {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				games = JSON.parse(xhr.responseText);
				setPriceRanges();
				drawPlot();
			} else {
				console.error(xhr.statusText);
			}
		}
	};
	xhr.onerror = function (e) {
		console.error(xhr.statusText);
	};
	xhr.send(null);
};

var update = function(event) {
	if (!event) {
		mousedOverGame = null;
		clickedGame = null;
		$(".content .tooltip").hide();
	} else {
		var mousedOver = mouseEventToMarketItemsAndGame(event);
		mousedOverGame = mousedOver.game || clickedGame;
		var tooltip = $(".content .tooltip");
		if (mousedOverGame) {

			tooltip.find(".title").html("#" + mousedOverGame.rank + " " + mousedOverGame.name);
			tooltip.find(".categories").html(mousedOverGame.categories.join(", "));
			if (clickedGame) {
				tooltip.css("pointer-events", "auto");
				tooltip.find(".title-link").attr("href", "http://boardgamegeek.com/boardgame/" + mousedOverGame.id);
				var currencySymbol = getCurrencySymbol();
				var priceList = tooltip.find(".prices");
				var marketItems = [];
				for (var i = 0; i < clickedGame.market_items.length; i ++) {
					var marketItem = clickedGame.market_items[i];
					if (isFiltered(clickedGame, marketItem)) {
						marketItems.push(marketItem);
					}
				}
				marketItems.sort(function(a, b) {
					return a.price.value - b.price.value;
				});
				var marketItemsByCondition = {};
				for (var i = 0; i < marketItems.length; i++) {
					var marketItem = marketItems[i];
					var entry = marketItemsByCondition[marketItem.condition];
					if (!entry) {
						entry = [];
						marketItemsByCondition[marketItems[i].condition] = entry;
					}
					entry.push(marketItem)
				}
				var orderedConditions = ["new", "likenew", "verygood", "good", "acceptable"];
				for (var i = 0; i < orderedConditions.length; i++) {
					var marketItems = marketItemsByCondition[orderedConditions[i]];
					if (!marketItems) {
						continue;
					}
					var div = priceList.append($("<div>"));
					for (var j = 0; j < marketItems.length; j++) {
						var marketItem = marketItems[j];
						var separator = j !==  marketItems.length - 1 ? ", " : "";
						div.append($('<span style="color:' + getColorForCondition(marketItem.condition, true) + '"><a style="color:' + getColorForCondition(marketItem.condition, true) + '" href="' + marketItem.link + '" target="_blank">' + Math.round(marketItem.price.value) + '</a>' + separator + '</span>'));
					}
					
				}
				//tooltip.find(".price-range").html(getCurrencySymbol() + Math.round(clickedGame.priceRange.min) + " - " + currencySymbol + Math.round(clickedGame.priceRange.max));
			} else {
				tooltip.css("pointer-events", "none");
				tooltip.find(".prices").empty();
				//tooltip.find(".price-range").html("");
			}
			if (event.offsetY + tooltip.height() > plot.height()) {
				tooltip.css("top", plot.height() - tooltip.height() - 35 + "px");
			} else {
				tooltip.css("top", event.offsetY - 35 + "px");
			}
			
			tooltip.css("left", Math.min(plot.width() - tooltip.width() - 35, event.offsetX + 20) + "px");
			tooltip.show();
		} else {
			tooltip.hide();
		}
	}

	drawPlot(event);
};

var initWindowResizeHandler = function() {
	var resizeTimeoutId;
	window.onresize = function(){
		clearTimeout(resizeTimeoutId);
		resizeTimeoutId = setTimeout(function() {
			drawPlot();
		}, 50);
	};
};

var initKeyHandlers = function() {
	$(window.document).keydown(function(event) {
		if (event.keyCode === 27) { // ESC
			update();
		} else if (event.keyCode === 37) { // left arrow
			var startingIndex = clickedGame ? clickedGame.rank : lowerRank + 1;
			var i = startingIndex - 2 < 0 ? lowerRank - 1 : startingIndex - 2;
			var done = false;
			while (i !== startingIndex && !done) {
				var game = games[i];
				for (var j = 0; j < game.market_items.length; j++) {
					var marketItem = game.market_items[j];
					if (isFiltered(game, marketItem)) {
						clickedGame = game;
						var fakeEvent = {};
						fakeEvent.offsetY = getPlotHeight() / 2;
						fakeEvent.offsetX = marketItemToPoint(game, marketItem).x
						update(fakeEvent);
						done = true;
						break;
					}
				}
				i--;
				if (i === -1) {
					i = lowerRank;
				}
			}
		} else if (event.keyCode === 39) { // right arrow
			var startingIndex = clickedGame ? clickedGame.rank : upperRank - 1;
			var i = startingIndex < 0 ? upperRank - 1 : startingIndex;
			var done = false;
			while (i !== startingIndex-1 && !done) {
				var game = games[i];
				for (var j = 0; j < game.market_items.length; j++) {
					var marketItem = game.market_items[j];
					if (isFiltered(game, marketItem)) {
						clickedGame = game;
						var fakeEvent = {};
						fakeEvent.offsetY = getPlotHeight() / 2;
						fakeEvent.offsetX = marketItemToPoint(game, marketItem).x
						update(fakeEvent);
						done = true;
						break;
					}
				}
				i++;
				if (i === lowerRank + 1) {
					i = upperRank - 1;
				}
			}
		}
	})
};

var initPlot = function() {
	plot.on("mousemove mouseout", function(event) {
		if (!clickedGame) {
			update(event);
		}
	});

	plot.click(function(event) {
		if (clickedGame) {
			clickedGame = null;
			update();
			return;
		}
		var result = mouseEventToMarketItemsAndGame(event);
		if (result.game) {
			clickedGame = result.game;
			update(event);
		}
	});
};

var initSidebar = function() {
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
		update();
	});


	var tooltip = $(".global-tooltip");
	var priceSlider = $(".price-slider");
	var rankSlider = $(".rank-slider");

	var updateSliderTooltip = function(slider, str, value) {
		// TODO, why is this necessary?
		var offset = -10;
		if (value === 5) {
			offset = -18;
		}
		tooltip.find(".title").html(str);
		tooltip.css("top", slider.offset().top - 60 + "px");
		tooltip.css("left", slider.offset().left + value * slider.width() / 5 - tooltip.width() / 2 + offset + "px");
		tooltip.show();
	};

	priceSlider.slider({
		min: 0,
		max: 5,
		value: 2,
		orientation: "horizontal",
		range: "min",
		slide: function(event, ui) {
			if (ui.value === 0) {
				return false;
			}
			updateSliderTooltip(priceSlider, getCurrencySymbol() + (ui.value * 50), ui.value)
			maxPrice = 25 * ui.value;
			update();
		},
		start: function(event, ui) {
			var currencySymbol = currency === "USD" ? "$" : "€";
			updateSliderTooltip(priceSlider, currencySymbol + (ui.value * 50), ui.value)
		},
		stop: function(event, ui) {
			tooltip.hide();
		}});

	rankSlider.slider({
		min: 0,
		max: 5,
		value: 1,
		orientation: "horizontal",
		range: "min",
		slide: function( event, ui ) {
			if (ui.value === 0) {
				return false;
			}
			updateSliderTooltip(rankSlider, ui.value * 100, ui.value);
			lowerRank = 100 * ui.value;
			update();
		},
		start: function(event, ui) {
			updateSliderTooltip(rankSlider, ui.value * 100, ui.value);
		},
		stop: function(event, ui) {
			tooltip.hide();
		}});

	$(".twitter-link").click(function() {
		window.open("https://twitter.com/intent/tweet?text=bgg-inventory.com: A visualization of games being sold on BoardGameGeek - @_zaknelson", "", "height=400,width=800");
	});
};

var initSidebarTooltip = function() {
	$(".footer .links img").mousemove(function(event) {
		
	});
	$(".footer .links img").mouseout(function(event) {
		$(".footer .tooltip").hide();
	});
};

var main = function() {
	getGames();
	initSidebar();
	initPlot();
	initWindowResizeHandler();
	initKeyHandlers();
};

main();