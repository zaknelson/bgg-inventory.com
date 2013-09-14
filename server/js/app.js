//DOM
var sidebar = document.getElementById("sidebar");
var canvas = document.getElementById("plot");
var context = canvas.getContext("2d");
var searchInput = document.getElementById("searchInput");
var conditionNew = document.getElementById("newCheckbox");
var conditionLikeNew = document.getElementById("likeNewCheckbox");
var conditionVeryGood = document.getElementById("veryGoodCheckbox");
var conditionGood = document.getElementById("goodCheckbox");
var conditionAcceptable = document.getElementById("acceptableCheckbox");
var currencyCheckbox = document.getElementById("currencyCheckbox");
var plotTooltip = document.getElementById("plotTooltip");
var tooltipRankAndTitle = document.getElementById("tooltipRankAndTitle");

var canvasPadding = 50;

var allGames = [];
var games = [];
var highestPrice = 100;
var selectedGame = null;
var clickedGame = null;

// filters
var searchQuery = null;
var maxPrice = 50;
var upperRank = 1;
var lowerRank = 100;
var currency = "USD";
var conditions = {"new":true, "likenew":true, "verygood":true, "good":true, "acceptable":true};
var categories = {};

var gameCount = function() {
	return lowerRank - upperRank + 1;
};

var getPlotWidth = function() {
	return canvas.width - canvasPadding * 2;
};

var getPlotHeight = function() {
	return canvas.height - canvasPadding * 2;
};

var getPointRadius = function() {
	// TODO maybe cache this?
	return (getPlotWidth() / (gameCount() * 2));
};

var marketItemToPoint = function(game, marketItem) {
	var point = {};
	point.x = ((game.rank - .5) / gameCount()) * getPlotWidth() + canvasPadding;
	point.y = getPlotHeight() - (marketItem.price.value / maxPrice) * getPlotHeight() + canvasPadding;
	return point;
};

var areAnyFiltersApplied = function() {
	return searchQuery || 
		!conditionNew.checked || 
		!conditionLikeNew.checked ||
		!conditionVeryGood.checked ||
		!conditionGood.checked ||
		!conditionAcceptable.checked;
};

var pointToMarketItemsAndGame = function(point) {
	var result = {};
	var rank = Math.round((gameCount() * (point.x - canvasPadding)) / getPlotWidth() - .5)
	var game = games[rank];
	if (game && isFiltered(game) && point.y >= canvasPadding && point.y <= getPlotHeight() + canvasPadding) {
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

		//if (result.game) {
			//console.log((-point.y + canvasPadding + getPlotHeight()) / getPlotHeight() * highestPrice);
			//console.log(result.game)
		//}
	}
	return result;
};

var drawPoint = function(point, color, radius) {
	context.beginPath();
	context.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
	context.fillStyle = color;
	context.fill();
	//context.lineWidth = 1;
	//context.strokeStyle = '#333';
	//context.stroke();
};

var drawMarketItem = function(game, marketItem) {
	var point = marketItemToPoint(game, marketItem)
	if (selectedGame) {
		var isSelected = selectedGame === game;
		drawPoint(point, getColorForCondition(marketItem.condition, isSelected), isSelected ? getPointRadius() * 1.2 : getPointRadius());
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

var getHighestPrice = function()  {
	for (var i = 0; i < games.length; i++) {
		var game = games[i];
		for (var j = 0; j < game.market_items.length; j++) {
			var marketItem = game.market_items[j];
			if (isFiltered(game, marketItem) && marketItem.price.value > highestPrice && marketItem.price.value < maxPrice) {
				highestPrice = marketItem.price.value;
			}
		}
	}
	//console.log(highestPrice);
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
		(!searchQuery || doesGameContainSubstring(game, searchInput.value)));
};

var drawCanvas = function(event) {
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;
	context.clearRect (0, 0, canvas.width, canvas.height);
	for (var i = 0; i < games.length; i++) {
		var game = games[i];
		for (var j = 0; j < game.market_items.length; j++) {
			var marketItem = game.market_items[j];
			if (isFiltered(game, marketItem)) {
				drawMarketItem(game, marketItem);
			}
			if (marketItem.price.currency == currency &&
				conditions[marketItem.condition]) {
				
			}
		}
	}
};

var getCategories = function() {
	for (var i = 0; i < games.length; i++) {
		var game = games[i];
		//for (var j = 0; j < game.categories.length; j++) {
			//categories
			
		//}
	}

	//$('#categories').append('<div class="category"><label class="checkbox checked " for="checkbox2"><input type="checkbox" id="newCheckbox" value="" checked="checked"  data-toggle="checkbox" /> New</label></div>'
};

var getGames = function() {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "/api/v1/games", true);
	xhr.onload = function (e) {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				games = JSON.parse(xhr.responseText);
				//getHighestPrice();
				getCategories();
				drawCanvas();
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

var updateSelected = function(event) {
	if (!event) {
		selectedGame = null;
		plotTooltip.style.display = "none";
		return;
	}

	var point = {};
	point.x = event.layerX;
	point.y = event.layerY;
	var result = pointToMarketItemsAndGame(point);

	if (result.game) {
		//console.log(result.game.rank);
		selectedGame = result.game;
	} else {
		selectedGame = null;
	}
	if (result.marketItems) {
		//console.log(result.marketItems);
	}


	if (selectedGame) {
		plotTooltip.style.display = "block";
		
		if (!clickedGame) {
			tooltipRankAndTitle.innerHTML = "#" + selectedGame.rank + " " + selectedGame.name;
			plotTooltip.style.top  = event.layerY - 25 + "px";
			plotTooltip.style.left = Math.min(canvas.width - plotTooltip.clientWidth, event.layerX + 10) + "px" ;
		} else {
			plotTooltip.style.height = "200px";
			plotTooltip.style["min-width"] = "500px";
		}
		//plotTooltip.style.left = Math.max(-300, event.layerX  - 10 -plotTooltip.clientWidth) + "px" ;
	} else {
		plotTooltip.style.display = "none";
	}
};

var update = function(event) {
	updateSelected(event);
	drawCanvas();
};

var initEventHandlers = function() {
	var resizeTimeoutId;
	window.onresize = function(){
		clearTimeout(resizeTimeoutId);
		resizeTimeoutId = setTimeout(function() {
			drawCanvas();
		}, 50);
	};
	canvas.onmousemove = function(event) {
		if (!clickedGame)
		update(event);
	};
	canvas.onmouseout = function(event) {
		if (!clickedGame)
		update(event);
	};

	canvas.onclick = function(event) {
		if (clickedGame) {
			clickedGame = null;
			update();
			return
		}
		var point = {};
		point.x = event.layerX;
		point.y = event.layerY;
		var result = pointToMarketItemsAndGame(point);

		if (result.game) {
			clickedGame = result.game;
		}
		
		updateSelected(event);
	};

	sidebar.onmousemove = function() {
		//update();
	};
	searchInput.onkeyup = function() {
		searchQuery = searchInput.value;
		update();
	};

	conditionNew.onchange = function(event) {
		conditionNew.checked ? conditions["new"] = true : conditions["new"] = false;
		update();
	};

	conditionLikeNew.onchange = function(event) {
		conditionLikeNew.checked ? conditions["likenew"] = true : conditions["likenew"] = false;
		update();
	};

	conditionVeryGood.onchange = function(event) {
		conditionVeryGood.checked ? conditions["verygood"] = true : conditions["verygood"] = false;
		update();
	};

	conditionGood.onchange = function(event) {
		conditionGood.checked ? conditions["good"] = true : conditions["good"] = false;
		update();
	};

	conditionAcceptable.onchange = function(event) {
		conditionAcceptable.checked ? conditions["acceptable"] = true : conditions["acceptable"] = false;
		update();
	};

	currencyCheckbox.onchange = function(event) {
		currency = currencyCheckbox.checked ? "USD" : "EUR";
		update();
	};

	    // jQuery UI Sliders
    var $slider = $("#price-slider");
    if ($slider.length) {
      $slider.slider({
        min: 0,
        max: 5,
        value: 2,
        orientation: "horizontal",
        range: "min",
        slide: function( event, ui ) {
			if (ui.value === 0) {
				return false;
			}
			maxPrice = 25 * ui.value;
			update();
		}
      }).addSliderSegments($slider.slider("option").max);
    }

        var $slider = $("#rank-slider");
    if ($slider.length) {
      $slider.slider({
        min: 0,
        max: 5,
        value: 1,
        orientation: "horizontal",
        range: "min",
        slide: function( event, ui ) {
			if (ui.value === 0) {
				return false;
			}
			lowerRank = 100 * ui.value;
			update();
		}
      }).addSliderSegments($slider.slider("option").max);
    }



};

var main = function() {
	getGames();
	initEventHandlers();
};

main();