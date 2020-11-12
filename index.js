const Discord = require("discord.js");
const config = require("./config.json");

const fs = require('fs')

let inventory = {};
let storeinv = {};
let allrules = {};
let knownrules = {};
let locations = {};
let playerInfo = {};

let adminChannelId = '';
let tradingSpaceChannelId = '';
let statusChannelId = '';
let inventoryChannelId = '';
let storeChannelId = '';
let debugChannelId = '';

const client = new Discord.Client();
const prefix = '!';

client.login(config.BOT_TOKEN);

client.on('ready', () => {
	loadDataFromFiles();
	console.log('Ready');
});

client.on('message', message => {
	if (message.author.bot)
		return;
	
	const commandBody = message.content.slice(prefix.length);
	const args = commandBody.split(' ');
	const command = args.shift().toLowerCase();
	
	if (message.channel.type == 'text') {
		
		if (command === 'buy') {	// Purchase item from the store
			return purchaseFromShop(message, args);
		}
		else if (command === 'store') {	// Display store inventory
			return displayStoreInventory(message, args);
		}
		else if (command === 'inventory') {	// Display the current player's inventory
			return displayPlayerInventory(message, args);
		}
		else if (command === 'trade') {	// Begin the trading process
			return initiateTrade(message, args);
		}
		else if (command === 'rules') {	// Send the player a DM with their known rules
			return displayKnownRules(message, args);
		}
		else if (command === 'move') {	// Move the current player to a location of their choice
			return move(message, args);
		}
		else if (command === 'backup') {	// Backup the current info to the .json files
			return saveDataToFiles();
		}
		else if (command === 'help') {	// DM the current player the list of basic commands
			return sendCommandReference(message, args);
		}
		else if (command === 'info') {	// Display current info about a player
			return displayPlayerInformation(message, args);
		}
	}
	else if (message.channel.type === 'dm') {
		if (command == 'rules') {
			return displayKnownRules(message, args);
		}
		else if (command == 'help') {
			return sendCommandReference(message, args);
		}
		else if (command == 'bugreport') {
			return bugReport(message, args);
		}
	}
});

// Command Functions
// Method of purchasing items from the store
function purchaseFromShop(message, args) {
	// Command Formatting: !buy <number> <item_name>
	if (args.length == 2) {
		if (args[0] > 0) {	// Player requested a positive amount of the item
			if (storeinv[args[1]]) { // Requested item exists
				if (storeinv[args[1]]['quantity'] == 0) {	// Store is sold out
					var messageTitle = `Purchase Failed`;
					var messageBody = `Sorry ${message.author}, I\'m fresh out of ${args[1]}s`;
					var flavorText = `I can\'t seem to keep these from flying off of the shelves!`;
					return message.channel.send(generateFailedEmbed(messageTitle, messageBody, flavorText));
				}					
				else if (storeinv[args[1]]['quantity'] < args[0]) {	// Store has insufficient stock of the requested item
					var messageTitle = `Purchase Failed`;
					var messageBody = `Sorry ${message.author}, I only have ${storeinv[args[1]]['quantity']} ${args[1]}(s)`;
					var flavorText = `How much do you think I can fit behind this counter?`;
					return message.channel.send(generateFailedEmbed(messageTitle, messageBody, flavorText));
				}
					
				if (storeinv[args[1]]["price"] * args[0] <= inventory[message.author.username]["PUBLIC"]["TOKENS"]) {	// Player has enough money to afford the requested items
					// Lower store inventory to ensure no item duplication
					storeinv[args[1]]['quantity'] = storeinv[args[1]]['quantity'] - args[0];
				
					var messageTitle = `Purchase Confirmation`;
					var messageBody = `${message.author} do you want to purchase ${args[0]} ${args[1]}(s) for ${storeinv[args[1]]["price"] * args[0]} tokens?`;
					var flavorText = `I have the finest wares, but do you want them?`;
					
					message.channel.send(generateSuccessEmbed(messageTitle, messageBody, flavorText)).then(async msg => {
    
						await msg.react('✅');
						await msg.react('❌');
						
						//generic filter customize to your own wants
						const filter = (reaction, user) => user.id === message.author.id;
						const options = { errors: ["time"], time: 30000, max: 1 };
						msg.awaitReactions(filter, options)
						.then(collected => {
							const first = collected.first();
							if(first.emoji.name === '✅') {
								msg.delete();

								// Adjust the inventories of the store & the player
								inventory[message.author.username]['PUBLIC']['TOKENS'] = inventory[message.author.username]['PUBLIC']['TOKENS'] - storeinv[args[1]]["price"] * args[0];

								// Get it to add the things to inventory correctly
								inventory[message.author.username]['PUBLIC'][args[1]] = parseInt(inventory[message.author.username]['PUBLIC'][args[1]]) + parseInt(args[0]);
								
								message.channel.send(generateSuccessEmbed(`Purchase Complete`, `${message.author.username} purchased ${args[0]} ${args[1]}(s) for ${storeinv[args[1]]["price"]} token(s) each`, `Good doing business with you my friend.`));
							} else if (first.emoji.name === '❌') {
								// Return the reserved items to the store inventory
								storeinv[args[1]]['quantity'] = parseInt(storeinv[args[1]]['quantity']) + parseInt(args[0]);
								msg.delete();
								message.channel.send(generateFailedEmbed(`Purchase Declined`, ``, `C'mon man, I thought you wanted these. You came to me to buy them after all...`));
							}
						})
						.catch(err => { 
							//time up, no reactions 
							// Return the reserved items to the store inventory
							storeinv[args[1]]['quantity'] = parseInt(storeinv[args[1]]['quantity']) + parseInt(args[0]);
							msg.delete();
							message.channel.send(generateFailedEmbed(`Purchase Failed`, `Purchase time period expired`, `C'mon man, I don't have all day, react faster next time.`));
						});
					});
				}
				else {	// Player cannot afford the requested number of the item
					var messageTitle = `Purchase Failed`;
					var messageBody = `Sorry ${message.author}, you are a little light on coin to afford ${args[0]} ${args[1]}(s)`;
					var flavorText = `I'm trying to run a business here buddy, and I sure as hell don't work for free.`;
					return message.channel.send(generateFailedEmbed(messageTitle, messageBody, flavorText));
				}
			}
			else {	// Requested item does not exist
				var messageTitle = `Purchase Failed`;
				var messageBody = `Sorry ${message.author}, I don't think I have ever heard of a ${args[1]}`;
				var flavorText = `Try picking an item that is for sale jackass`;
				return message.channel.send(generateFailedEmbed(messageTitle, messageBody, flavorText));
			}
		}
		else {	// Player requested a negative amount of the item
			var messageTitle = `Purchase Failed`;
			var messageBody = `What kind of shenanigans are you trying to pull ${message.author}?`;
			var flavorText = `You know what you tried to do.`;
			return message.channel.send(generateFailedEmbed(messageTitle, messageBody, flavorText));
		}	
	}
	else {
		return message.channel.send(generateFailedEmbed('Failed to Purchase', 'invalid number of arguments', 'You just gotta say what and how much you wanna buy'));
	}
}

// Displays the current inventory of the store
function displayStoreInventory(message, args) {
	if (args.length == 0) {
		var messageTitle = 'The Store';
		var messageBody = '';
		var flavorText = `Welcome to the store friend, stay as long as you like.`;
		var fields = [];
		
		for (x in storeinv) {
			var currField = {"name": x, "value": `Quantity: ${storeinv[x]["quantity"]}\n\t\tPrice ${storeinv[x]["price"]}`};
			fields.push(currField);
		}
			
		return message.channel.send(generateEmbedWithFields(messageTitle, messageBody, flavorText, '#00ff00', fields));
	}
	else {
		return message.channel.send(generateFailedEmbed('Failed to Retrieve Store Inventory', 'invalid number of arguments', 'This one doesn\'t need any arguments, how hard is that to understand?'));
	}
}

// Displays a player's inventory
function displayPlayerInventory(message, args) {
	if (args.length == 0) {
		var messageTitle = `${message.author.username}\'s inventory is`;
		var messageBody = ``;
		var flavorText = "These are your things, there are many like them but these are yours.";
		var fields = [];
		
		for (x in inventory[message.author.username]["PUBLIC"]) {
			// An item is present in an inventory (does not have a quantity of 0)
			if (inventory[message.author.username]["PUBLIC"][x] != 0){
				// Check if an item is an array (A member of a collection ie: cards) if so, display the quantity, not the details of items in the collection
				if (!inventory[message.author.username]["PUBLIC"][x].hasOwnProperty("0")){
					// Display the quantity of an item not in a collection
					var currField = {"name": x, "value": `${inventory[message.author.username]["PUBLIC"][x]}`};
					fields.push(currField);
				}
				else {
					// Display the quantity of a collection of a single item type, not the details
					var currField = {"name": x, "value": `${Object.keys(inventory[message.author.username]["PUBLIC"][x]).length}`};
					fields.push(currField);
				}
			}
		}
				
		return message.channel.send(generateEmbedWithFields(messageTitle, messageBody, flavorText, '#00ff00', fields));
	}
	else {
		return message.channel.send(generateFailedEmbed('Failed to Retrieve Inventory', 'invalid number of arguments', 'This one doesn\'t need any arguments, how hard is that to understand?'));
	}
}

// Begins the trading process between two players
function initiateTrade(message, args) {
	
	if (message.mentions.users.size != 1) {
		return message.channel.send(generateFailedEmbed('Failed to Initiate Trade', 'You need to tag a single user to trade with them', 'A second party is needed for trading, that\'s just how it be'));
	}
	if (args.length = 1 && message.author.id != message.mentions.users.first().id) {
		// DM person regarding trade
		var messageBody = `Trade Time with ${message.mentions.users.first().username}`;
		client.users.cache.get(message.author.id).send(messageBody).then(async msg => {
			const filter = (reaction, user) => user.id === message.author.id;
			const options = { errors: ["time"], time: 300000, max: 1 }; // 5 Minute time limit for specifying trades
			
		});
	}
	else {
		return message.channel.send(generateFailedEmbed('Trade initialization failed', 'To begin the trading process, use the command !trade @<username>', 'If you wanna trade with people, you gotta play by the rules'));
	}
}

// Sends a player all of their known rules
function displayKnownRules(message, args) {
	
	if (args.length > 0) {
		return message.channel.send(generateFailedEmbed('Rules Failed', 'To see all rules you know, use the command !rules', '^ read this ^'));
	}
			
	var messageTitle = `Known Rules`;
	var messageBody = `${message.author}\'s known rules are:`;
	var flavorText = `Shh these are valuable, don't accidentally trade them all away ;)`;
			
	for (x in allrules["PUBLIC"]) {
		messageBody = messageBody + `\n\t- ${x} ${allrules["PUBLIC"][x]}`;
	}
			
	for (x in allrules["PRIVATE"]) {
		// A private rule is known by the sender
		if (knownrules[message.author.username][x] == true){
			messageBody = messageBody + `\n\t- ${x} ${allrules["PRIVATE"][x]}`;
		}
	}
			
	return client.users.cache.get(message.author.id).send(generateSpecialEmbed(messageTitle, messageBody, flavorText));
}

// Moves a player from a location to another location
function move(message, args) {
	if (args.length != 1) {
		return message.channel.send(generateFailedEmbed('Failed Move', 'You must specify exactly 1 location to move to', 'Movement can be hard, just get good'));
	}
			
	// Change this to make it case sensitive or not
	if (locations[args[0]]) {
		var messageTitle = `Move`;
		var messageBody = `Welcome to ${args[0]}`;
		var flavorText = locations[args[0]]["FLAVOR_TEXT"];
		message.channel.send(generateSuccessEmbed(messageTitle, messageBody, flavorText));
	}
	else {
		return message.channel.send(generateFailedEmbed('Failed Move', 'INVALID LOCATION SPECIFIED', 'Now you done fucked up'));
	}
}

// Sends the command reference to a person in a DM
function sendCommandReference(message, args) {
	return client.users.cache.get(message.author.id).send(generateHelpEmbed());
}

// Displays the current information of a player
function displayPlayerInformation(message, args) {
	if (args.length != 0) {
		return message.channel.send(generateFailedEmbed(`Failed Info Retrieval`, `Incorrect number of arguments`, `Try being better next time`));
	}
	
	var messageTitle = `${message.author.username}'s Current Information`;
	var messageBody = ``;
	var flavorText = `Looking into someones information eh? Awfully nosy of you if I do say so myself.`;
	var fields = [];
	
	for (x in playerInfo[message.author.username]["PUBLIC"]) {
		let currField = {"name": `${x}`, "value": `${playerInfo[message.author.username]["PUBLIC"][x]}`};	// Fix this later
		fields.push(currField);
	}
	
	
	return message.channel.send(generateEmbedWithFields(messageTitle, messageBody, flavorText, '#00ff00', fields));
}

// Submits a bug report for a specified issue
function bugReport(message, args) {
	var report = message.content.substr(parseInt(prefix.length) + parseInt('bugReport'.length) + 1);
	console.log(report);
	return message.channel.send(generateSpecialEmbed(`Bug Report Logged`, `'${report}' has been added to the list of reported bugs`, `Big McThanky`));
}

// Adds a new player to the game (For Admin Use) ---------- (TODO) ---------
function addNewPlayerToGame(username) {
	if (inventory[username]) {	// Player is already in the game
		// Make Angry Embed message here
		return;
	}
	else {	// Player is not yet in the game
		// Add Player's stuff to the .json files
	}
}

// Bot will ignore any messages sent within specified channels (For Admin Use) ---------- (TODO) ---------
function ignoreTextChannel(channels) {
	
}

// Bot will reset the game, wiping all data (For Admin Use) ---------- (TODO) ---------
function resetGame() {
	
}

// Sets the admin channel to the channel that the message to call this was written in (For Admin Use) ---------- (TODO) ---------
function setAdminChannel(){
	
}

// Sets the trading channel to the channel that the message to call this was written in (For Admin Use) ---------- (TODO) ---------
function setTradingChannel(){
	
}

// Sets the status/information channel to the channel that the message to call this was written in (For Admin Use) ---------- (TODO) ---------
function setStatusChannel(){
	
}

// Sets the inventory channel to the channel that the message to call this was written in (For Admin Use) ---------- (TODO) ---------
function setInventoryChannel(){
	
}

// Sets the store channel to the channel that the message to call this was written in (For Admin Use) ---------- (TODO) ---------
function setStoreChannel(){
	
}

// Sets the debug channel to the channel that the message to call this was written in (For Admin Use) ---------- (TODO) ---------
function setDebugChannel(){
	
}


// Utility Functions
// Loads all the relevant data from the json files into the program
function loadDataFromFiles() {
	fs.readFile('inventory.json', 'utf-8', (err, data) => {
		if (err) throw err;

		inventory = JSON.parse(data);
	});
	fs.readFile('store_inventory.json', 'utf-8', (err, data) => {
		if (err) throw err;

		storeinv = JSON.parse(data);
	});
	fs.readFile('all_rules.json', 'utf-8', (err, data) => {
		if (err) throw err;

		allrules = JSON.parse(data);
	});
	fs.readFile('knownRules.json', 'utf-8', (err, data) => {
		if (err) throw err;

		knownrules = JSON.parse(data);
	});
	
	fs.readFile('locations.json', 'utf-8', (err, data) => {
		if (err) throw err;

		locations = JSON.parse(data);
	});
	
	fs.readFile('playerInformation.json', 'utf-8', (err, data) => {
		if (err) throw err;
		
		playerInfo = JSON.parse(data);
	});
}

// Saves all the relevant data to the json files
function saveDataToFiles() {
	console.log('Data Backup Started');
	let data = JSON.stringify(inventory, undefined, 4);
	fs.writeFile('inventory.json', data, (err) => { 
		if (err) throw err; 
	}); 
	
	data = JSON.stringify(storeinv, undefined, 4);
	fs.writeFile('store_inventory.json', data, (err) => { 
		if (err) throw err; 
	}); 
	
	data = JSON.stringify(allrules, undefined, 4);
	fs.writeFile('all_rules.json', data, (err) => { 
		if (err) throw err; 
	}); 
	
	data = JSON.stringify(knownrules, undefined, 4);
	fs.writeFile('knownRules.json', data, (err) => { 
		if (err) throw err; 
	}); 
	
	data = JSON.stringify(locations, undefined, 4);
	fs.writeFile('locations.json', data, (err) => { 
		if (err) throw err; 
	}); 
	console.log('Data Backup Finished');
}

// Creates a basic embed for successful actions
function generateSuccessEmbed(title, description, footer) {
	return generateEmbed(title, description, footer, '#00ff00');
}

// Creates a basic embed for failed actions
function generateFailedEmbed(title, description, footer) {
	return generateEmbed(title, description, footer, '#ff0000');
}

// Creates a basic embed for special messages
function generateSpecialEmbed(title, description, footer) {
	return generateEmbed(title, description, footer, '#0000ff');
}

// Creates an embed of a specified color with the ability to have fields
function generateEmbedWithFields(title, description, footer, color, fields){
	var newEmbed = generateEmbed(title, description, footer, color);
	newEmbed.addFields(fields);
	return newEmbed;
}

// Generates a specialized embed for the list of common commands
function generateHelpEmbed() {
	var newEmbed = new Discord.MessageEmbed()
		.setColor('#c8c8c8')
		.setTitle('Haggle Bot Help')
		.setDescription('Basic Commands')
		.addFields(
			{ name: 'View what is in the store', value: '!store'},
			{ name: 'Purchase something from the store', value: '!buy <amount> <item>'},
			{ name: 'View your inventory', value: '!inventory'},
			{ name: 'Begin trading with someone', value: '!trade @<person>'},
			{ name: 'View what rules you know', value: '!rules'},
			{ name: 'Move somewhere else', value: '!move <location>'},
			{ name: 'Backup the game files', value: '!backup'},
			{ name: 'View basic command list', value: '!help'}
		)
		.setFooter('Heres a quick cheat sheet buddy');
		
	return newEmbed;
}

// Generates an embed with specified info
function generateEmbed(title, description, footer, color) {
	var newEmbed = new Discord.MessageEmbed()
		.setColor(color)
		.setTitle(title)
		.setDescription(description)
		.setFooter(footer);
		
	return newEmbed;
}

