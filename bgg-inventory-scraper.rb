require "json"
require "open-uri"
require "nokogiri"

#
# Model
#

class JSONable
	def to_json a=nil
		hash = {}
		self.instance_variables.each do |var|
			hash[var[1...var.length]] = self.instance_variable_get var
		end
		JSON.generate hash
	end
end

class Price <JSONable
	attr_accessor :currency
	attr_accessor :value

	def self.parse_price_from_xml xml
		price = Price.new
		price.currency = xml.attr("currency")
		price.value = xml.attr("value").to_s.to_f
		price
	end
end

class MarketItem < JSONable
	attr_accessor :price
	attr_accessor :link
	attr_accessor :condition

	def self.parse_market_item_from_xml xml
		begin
			market_item = MarketItem.new
			market_item.price = Price.parse_price_from_xml(xml.css("price"))
			market_item.link = xml.css("link").attr("href")
			market_item.condition = xml.css("condition").attr("value")
			market_item
		rescue
			puts "Errors parsing market item: " + xml
		end
	end
end

class Game < JSONable
	attr_accessor :id
	attr_accessor :name
	attr_accessor :rank
	attr_accessor :market_items
	attr_accessor :categories

	def self.parse_game_from_xml xml
		game = Game.new
		game.id = xml.css('item')[0].attr("id")
		game.name = xml.css('name[type="primary"]')[0].attr("value")
		game.market_items = []
		game.categories = []
		xml.css("marketplacelistings > listing").each do |listing|
			market_item = MarketItem.parse_market_item_from_xml(listing)
			game.market_items.push(market_item) if market_item
		end
		xml.css('link[type="boardgamecategory"]').each do |category|
			game.categories.push(category.attr("value"));
		end
		game
	end
end

def fetch url
	sleep 1
	Nokogiri::HTML(open(url))
end

def fetch_top_games game_limit
	print "Fetching top games..."
	page = 1
	top_game_ids = []
	while top_game_ids.length < game_limit
		print "."
		doc = fetch("http://boardgamegeek.com/browse/boardgame/page/#{page}?sort=rank")
		before_count = top_game_ids.length
		doc.css("#row_ a").each do |link|
			href = link.attr("href")
			if href and href.start_with?("/boardgame/") and link.content.length > 0
				id = href
				id.slice!("/boardgame/")
				id = id[0...id.index("/")]
				top_game_ids.push(id) if not top_game_ids.include?(id)
			end
		end
		if before_count == top_game_ids.length
			puts "Error scraping games: " + doc
			exit 1
		end
		page += 1
	end
	puts

	games = []
	rank = 1
	top_game_ids[0...game_limit].each do |id|
		puts "Fetching game #{id}"
		game = Game.parse_game_from_xml(fetch("http://www.boardgamegeek.com/xmlapi2/thing?id=#{id}&marketplace=1"))
		game.rank = rank
		games.push(game)
		rank += 1
	end
	
	games
end

def main
	games = fetch_top_games(500)
	File.open("model/games.json", "w") { |file| file.write(games.to_json) }
end

main()

