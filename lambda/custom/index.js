const Alexa = require('ask-sdk');
const skillName = 'Greeting Sender';
const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');

const LaunchRequestHandler = {
	canHandle(handlerInput) {
		return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
	},
	handle(handlerInput) {
		const speechText = `Welcome to ${skillName}, you can say hello! How can I help?`;

		return handlerInput.responseBuilder
			.speak(speechText)
			.reprompt(speechText)
			.withSimpleCard(skillName, speechText)
			.getResponse();
	},
};

const GetAnotherHelloHandler = {
	canHandle(handlerInput){
		return(
			handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
			(handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent' ||
			handlerInput.requestEnvelope.request.intent.name === 'SimpleHelloIntent'));
	},
	async handle(handlerInput){
		const greeting = getGreeting();
		const speechText = `Here's your greeting: ${greeting['greeting']}. That's hello in ${greeting['language']}. To share a greeting at any time, just say share this greeting. What would you like to do?`;
		const repromptOutput = `${getRandomYesNoQuestion()}`;
		const cardText = `${greeting['greeting']}! That's hello in ${greeting['language']}`;

		//Saving greeting as a persistent & session attribute, so we can retrieve it later if the customer would like to share it.
		saveGreeting(handlerInput,greeting);

		return handlerInput.responseBuilder
			.speak(speechText)
			.reprompt(repromptOutput)
			.withSimpleCard(skillName, cardText)
			.getResponse();
	}
};

const NoIntentHandler = {
	canHandle(handlerInput){
		return(
			handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent'
		);
	},
	handle(handlerInput){
		const speechText = getRandomGoodbye();
		return handlerInput.responseBuilder
			.speak(speechText)
			.getResponse();
	}
};

//Respond to the utterance "what can I buy"
const WhatCanIBuyIntentHandler = {
	canHandle(handlerInput){
		return (handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
    handlerInput.requestEnvelope.request.intent.name === 'WhatCanIBuyIntent');
	},
	handle(handlerInput){
		//Get the list of products available for in-skill purchase
		const locale = handlerInput.requestEnvelope.request.locale;
		const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();
		return monetizationClient.getInSkillProducts(locale).then(function(res){
			//res contains the list of all ISP products for this skill.
			// We now need to filter this to find the ISP products that are available for purchase (NOT ENTITLED)
			const purchasableProducts = res.inSkillProducts.filter(
				record => record.entitled === 'NOT_ENTITLED' &&
        record.purchasable === 'PURCHASABLE'
			);

			// Say the list of products
			if (purchasableProducts.length > 0){
				//One or more products are available for purchase. say the list of products
				const speechText = `Products available for purchase at this time are ${getSpeakableListOfProducts(purchasableProducts)}. 
                            To learn more about a product, say 'Tell me more about' followed by the product name. 
                            If you are ready to buy, say, 'Buy' followed by the product name. So what can I help you with?`;
				const repromptOutput = 'I didn\'t catch that. What can I help you with?';
				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.getResponse();
			}
			else{
				// no products are available for purchase. Ask if they would like to hear another greeting
				const speechText = 'There are no products to offer to you right now. Sorry about that. Would you like a greeting instead?';
				const repromptOutput = 'I didn\'t catch that. What can I help you with?';
				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.getResponse();
			}
		});
	}
};

//Respond to the utterance "tell me more about sharing pack"
const TellMeMoreAboutSharingPackIntentHandler = {
	canHandle(handlerInput){
		return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
    handlerInput.requestEnvelope.request.intent.name === 'TellMeMoreAboutSharingPackIntent';
	},
	handle(handlerInput){
		const locale = handlerInput.requestEnvelope.request.locale;
		const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();

		return monetizationClient.getInSkillProducts(locale).then(function(res){
			// Filter the list of products available for purchase to find the product with the reference name "Greetings_Pack"
			const sharingPackProduct = res.inSkillProducts.filter(
				record => record.referenceName === 'Sharing_Pack'
			);

			if (sharingPackProduct.length > 0 && sharingPackProduct[0].purchasable === 'PURCHASABLE') {
				//Customer is interested in learning about Sharing Pack. Make upsell.
				const speechText = 'Sure.';
				return makeUpsell(speechText,sharingPackProduct,handlerInput);
			}
			else{
				//Not a valid product, or the product is not available for purchase.
				const speechText = `Sorry. You can't buy this right now. ${getRandomYesNoQuestion()}`;
				const repromptOutput = `${getRandomYesNoQuestion()}`;

				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.getResponse();
			}
		});
	}
};

//Respond to the utterance "buy sharing pack"
const BuySharingPackIntentHandler = {
	canHandle(handlerInput){
		return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
		handlerInput.requestEnvelope.request.intent.name === 'BuySharingPackIntent';
	},
	handle(handlerInput){
		const locale = handlerInput.requestEnvelope.request.locale;
		const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();

		return monetizationClient.getInSkillProducts(locale).then(function(res){
			// Filter the list of products available for purchase to find the product with the reference name "Greetings_Pack"
			const sharingPackProduct = res.inSkillProducts.filter(
				record => record.referenceName === 'Sharing_Pack'
			);

			if (sharingPackProduct.length > 0 && sharingPackProduct[0].purchasable === 'PURCHASABLE') {
				//Customer is interested in learning about Sharing Pack. Make upsell.
				return makeBuyOffer(sharingPackProduct,handlerInput);
			}
			else{
				//Not a valid product, or the product is not available for purchase.
				const speechText = `Sorry. You can't buy this right now. ${getRandomYesNoQuestion()}`;
				const repromptOutput = `${getRandomYesNoQuestion()}`;

				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.getResponse();
			}
		});
	}
};

const BuyResponseHandler = {
	canHandle(handlerInput){
		return handlerInput.requestEnvelope.request.type === 'Connections.Response' &&
        (handlerInput.requestEnvelope.request.name === 'Buy' ||
        handlerInput.requestEnvelope.request.name === 'Upsell');
	},
	async handle(handlerInput){
		const locale = handlerInput.requestEnvelope.request.locale;
		const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();
		const productId = handlerInput.requestEnvelope.request.payload.productId;
		const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
		const greeting = persistentAttributes.hasOwnProperty('greeting') ? persistentAttributes.greeting : { language: 'english', greeting: 'Good Morning' };

		return monetizationClient.getInSkillProducts(locale).then(function(res){
			const product = res.inSkillProducts.filter(
				record => record.productId === productId
			);

			if (handlerInput.requestEnvelope.request.status.code === '200'){
				let speechText;
				let repromptOutput;

				// check the Buy status - accepted, declined, already purchased, or something went wrong.
				switch (handlerInput.requestEnvelope.request.payload.purchaseResult){
				case 'ACCEPTED':
					if (persistentAttributes.lastIntent === 'SharingGreetingIntent'){
						speechText = `This gives you 5 sharing coins you can use to share greetings with your friends. ${simulateShareGreeting(greeting)}. You now have a total of ${getCoinsAvailable(handlerInput)} sharing coins available. ${getRandomYesNoQuestion()}`;
						repromptOutput = `I have shared the greeting - ${greeting['greeting']}, which is hello in ${greeting['language']} with your favorite friend. ${getRandomYesNoQuestion()}`;
						// cardText = `${greeting['greeting']} - hello in ${greeting['language']} was shared with your favorite friend`;
						useCoin(handlerInput);
						updateInventory(handlerInput);
					}
					else{
						speechText = `This gives you 5 sharing coins you can use to share greetings with your friends. You now have a total of ${getCoinsAvailable(handlerInput)} sharing coins available. To share a greeting at any time, just say - share greeting. ${getRandomYesNoQuestion()}`;
						repromptOutput = `${getRandomYesNoQuestion()}`;
					}

					break;
				case 'DECLINED':
					speechText = `No Problem. ${getRandomYesNoQuestion()}`;
					repromptOutput = `${getRandomYesNoQuestion()}`;
					break;
				case 'ALREADY_PURCHASED':
					speechText = 'You have already purchased the Sharing Pack To share a greeting with a friend at any time, just say share this greeting. What would you like to do?';
					repromptOutput = 'To share a greeting at any time, just say share this greeting. You can also say give me another greeting. What would you like to do?';
					break;
				default:
					speechText = `Something unexpected happened, but thanks for your interest in the ${product[0].name}.`;
					break;
				}
				//respond back to the customer

				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.getResponse();

			}
			else {
				// Request Status Code NOT 200. Something has failed with the connection.
				console.log(
					`Connections.Response indicated failure. error: + ${handlerInput.requestEnvelope.request.status.message}`
				);
				return handlerInput.responseBuilder
					.speak('There was an error handling your purchase request. Please try again or contact us for help.')
					.getResponse();
			}
		});
	}
};

//Respond to the utterance "what have I bought"
const PurchaseHistoryIntentHandler = {
	canHandle(handlerInput) {
		return (
			handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'PurchaseHistoryIntent'
		);
	},
	async handle(handlerInput) {
		const locale = handlerInput.requestEnvelope.request.locale;
		const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();
		const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

		return monetizationClient.getInSkillProducts(locale).then(function(res) {
			const entitledProducts = getAllEntitledProducts(res.inSkillProducts);
			const sharingPackProduct = res.inSkillProducts.filter(
				record => record.referenceName === 'Sharing_Pack'
			);
			if (entitledProducts && entitledProducts.length > 0) {
				if (persistentAttributes.coinsAvailable > 0){
					//Customer has coins available.
					const speechText = `You bought the following items: ${getSpeakableListOfProducts(entitledProducts)}. You have ${getCoinsAvailable(handlerInput)} sharing coins available. To share a greeting at any time, just say share this greeting. ${getRandomYesNoQuestion()}`;
					const repromptOutput = `You asked me for a what you've bought, here's a list ${getSpeakableListOfProducts(entitledProducts)}. You have ${getCoinsAvailable(handlerInput)} sharing coins available. ${getRandomYesNoQuestion()}`;

					return handlerInput.responseBuilder
						.speak(speechText)
						.reprompt(repromptOutput)
						.getResponse();
				}
				else{
					//Customer is out of coins.
					const speechText = `You bought the following items: ${getSpeakableListOfProducts(entitledProducts)}, but you're out of sharing coins.`;
					return makeUpsell(speechText,sharingPackProduct,handlerInput);
				}
			}
			else{
				const speechText = 'You haven\'t purchased anything yet. To learn more about the products you can buy, say - what can I buy. How can I help?';
				const repromptOutput = `You asked me for a what you've bought, but you haven't purchased anything yet. You can say - what can I buy, or say yes to get another greeting. ${getRandomYesNoQuestion()}`;

				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.getResponse();
			}
		});
	}
};

//Respond to the utterance "cancel/refund sharing pack"
const RefundSharingPackIntentHandler = {
	canHandle(handlerInput) {
		return (
			handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'RefundSharingPackIntent'
		);
	},
	handle(handlerInput) {
		const locale = handlerInput.requestEnvelope.request.locale;
		const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();

		return monetizationClient.getInSkillProducts(locale).then(function(res) {
			const sharingPackProduct = res.inSkillProducts.filter(
				record => record.referenceName === 'Sharing_Pack'
			);
			if (isEntitled(sharingPackProduct)) {
				//Customer has bought the Sharing Pack at some point
				return handlerInput.responseBuilder
					.addDirective({
						type: 'Connections.SendRequest',
						name: 'Cancel',
						payload: {
							InSkillProduct: {
								productId: sharingPackProduct[0].productId
							}
						},
						token: 'correlationToken'
					})
					.getResponse();
			}
			else{
				//Customer has never bought the Sharing Pack
				const speechText = 'It looks like you haven\'t purchased the Sharing Pack yet. To learn more about the products you can buy, say - what can I buy. How can I help?';
				const repromptOutput = `${getRandomYesNoQuestion()}`;

				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.getResponse();
			}
		});
	}
};

const CancelProductResponseHandler = {
	canHandle(handlerInput) {
		return handlerInput.requestEnvelope.request.type === 'Connections.Response' &&
      handlerInput.requestEnvelope.request.name === 'Cancel';
	},
	handle(handlerInput) {
		const locale = handlerInput.requestEnvelope.request.locale;
		const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();
		const productId = handlerInput.requestEnvelope.request.payload.productId;
		let speechText;
		let repromptOutput;

		return monetizationClient.getInSkillProducts(locale).then(function(res) {
			const product = res.inSkillProducts.filter(
				record => record.productId === productId
			);

			console.log(
				`PRODUCT = ${JSON.stringify(product)}`
			);

			if (handlerInput.requestEnvelope.request.status.code === '200') {
				//Alexa handles the speech response immediately following the cancellation request.
				//It then passes the control to our CancelProductResponseHandler() along with the status code (ACCEPTED, DECLINED, NOT_ENTITLED)
				//We use the status code to stitch additional speech at the end of Alexa's cancellation response.
				//Currently, we have the same additional speech (getRandomYesNoQuestion)for accepted, canceled, and not_entitled. You may edit these below, if you like.
				if (handlerInput.requestEnvelope.request.payload.purchaseResult === 'ACCEPTED') {
					//The cancellation confirmation response is handled by Alexa's Purchase Experience Flow.
					//Simply add to that with getRandomYesNoQuestion()
					speechText = `${getRandomYesNoQuestion()}`;
					repromptOutput = getRandomYesNoQuestion();
				}
				else if (handlerInput.requestEnvelope.request.payload.purchaseResult === 'DECLINED') {
					speechText = `${getRandomYesNoQuestion()}`;
					repromptOutput = getRandomYesNoQuestion();
				}
				else if (handlerInput.requestEnvelope.request.payload.purchaseResult === 'NOT_ENTITLED') {
					//No subscription to cancel.
					//The "No subscription to cancel" response is handled by Alexa's Purchase Experience Flow.
					//Simply add to that with getRandomYesNoQuestion()
					speechText = `${getRandomYesNoQuestion()}`;
					repromptOutput = getRandomYesNoQuestion();
				}
				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.getResponse();
			}
			// Something failed.
			console.log(
				`Connections.Response indicated failure. error: ${handlerInput.requestEnvelope.request.status.message}`
			);

			return handlerInput.responseBuilder
				.speak('There was an error handling your purchase request. Please try again or contact us for help.')
				.getResponse();
		});
	},
};

//Respond to the utterance "share greeting"
const ShareGreetingIntentHandler = {
	canHandle(handlerInput) {
		return handlerInput.requestEnvelope.request.type === 'IntentRequest'
			&& handlerInput.requestEnvelope.request.intent.name === 'ShareGreetingIntent';
	},
	async handle(handlerInput) {
		const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
		const locale = handlerInput.requestEnvelope.request.locale;
		const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();

		return monetizationClient.getInSkillProducts(locale).then(function(res){
			// Filter the list of products available for purchase to find the product with the reference name "Greetings_Pack"
			const sharingPackProduct = res.inSkillProducts.filter(
				record => record.referenceName === 'Sharing_Pack'
			);
			const greeting = persistentAttributes.hasOwnProperty('greeting') ? persistentAttributes.greeting : { language: 'english', greeting: 'Good Morning' };

			if (persistentAttributes.coinsAvailable > 0){
				//Customer has enough coins available.
				//Simulate greeting share with friend,
				//and update coin count (useCoin)

				const speechText = `${simulateShareGreeting(greeting)} ${getRandomYesNoQuestion()}`;
				const repromptOutput = `I have shared the greeting - ${greeting['greeting']}, which is hello in ${greeting['language']} with your favorite friend. ${getRandomYesNoQuestion()}`;
				const cardText = `${greeting['greeting']} - hello in ${greeting['language']} was shared with your favorite friend`;

				useCoin(handlerInput);

				return handlerInput.responseBuilder
					.speak(speechText)
					.reprompt(repromptOutput)
					.withSimpleCard(skillName, cardText)
					.getResponse();
			}
			else{
				//Customer is out of coins. Make upsell.
				const speechText = 'Darn it. Looks like you are out of sharing coins';
				saveGreeting(handlerInput,greeting);
				return makeUpsell(speechText,sharingPackProduct,handlerInput);
			}
		});
	},
};

//Respond to the utterance "how many coins remaining"
const CoinInventoryIntentHandler = {
	canHandle(handlerInput) {
		return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'CoinInventoryIntent';
	},
	async handle(handlerInput) {
		const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
		if (persistentAttributes.coinsAvailable > 0) {
			//Customer has enough coins available.
			const speechText = `You now have ${persistentAttributes.coinsAvailable} sharing coins available. ${getRandomYesNoQuestion()}`;
			const repromptOutput = `${getRandomYesNoQuestion()}`;
			return handlerInput.responseBuilder
				.speak(speechText)
				.reprompt(repromptOutput)
				.getResponse();
		}
		else{
			//Customer is out of coins. Make upsell.
			const locale = handlerInput.requestEnvelope.request.locale;
			const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();

			return monetizationClient.getInSkillProducts(locale).then(function(res){
				// Filter the list of products available for purchase to find the product with the reference name "Greetings_Pack"
				const sharingPackProduct = res.inSkillProducts.filter(
					record => record.referenceName === 'Sharing_Pack'
				);
				const speechText = 'Darn it. Looks like you are out of coins';
				return makeUpsell(speechText,sharingPackProduct,handlerInput);
			});
		}
	},
};

const HelpIntentHandler = {
	canHandle(handlerInput) {
		return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
	},
	handle(handlerInput) {
		const speechText = 'You can say hello to me! How can I help?';

		return handlerInput.responseBuilder
			.speak(speechText)
			.reprompt(speechText)
			.withSimpleCard(skillName, speechText)
			.getResponse();
	},
};

const CancelAndStopIntentHandler = {
	canHandle(handlerInput) {
		return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
	},
	handle(handlerInput) {
		const speechText = getRandomGoodbye();

		return handlerInput.responseBuilder
			.speak(speechText)
			.withSimpleCard(skillName, speechText)
			.getResponse();
	},
};

const SessionEndedRequestHandler = {
	canHandle(handlerInput) {
		return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
	},
	handle(handlerInput) {
		console.log(
			`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`
		);

		return handlerInput.responseBuilder.getResponse();
	},
};

const ErrorHandler = {
	canHandle() {
		return true;
	},
	handle(handlerInput, error) {
		console.log(
			`Error handled: ${error.message}`
		);

		return handlerInput.responseBuilder
			.speak('Sorry, I can\'t understand the command. Please say again.')
			.reprompt('Sorry, I can\'t understand the command. Please say again.')
			.getResponse();
	},
};

// *****************************************
// *********** HELPER FUNCTIONS ************
// *****************************************

function randomize(array){
	const randomItem = array[Math.floor(Math.random() * array.length)];
	return randomItem;
}

function getGreeting() {
	const greetings = [
		{ language: 'hindi', greeting: 'Namaste' },
		{ language: 'french', greeting: 'Bonjour' },
		{ language: 'spanish', greeting: 'Hola' },
		{ language: 'japanese', greeting: 'Konichiwa' },
		{ language: 'italian', greeting: 'Ciao' }
	];
	return randomize(greetings);
}

function getRandomGoodbye() {
	const goodbyes = [
		'OK.  Goodbye!',
		'Have a great day!',
		'Come back again soon!'
	];
	return randomize(goodbyes);
}

function getRandomYesNoQuestion() {
	const questions = [
		'Would you like another greeting?',
		'Can I give you another greeting?',
		'Do you want to hear another greeting?'
	];
	return randomize(questions);
}

function getRandomLearnMorePrompt() {
	const questions = [
		'Want to learn more about it?',
		'Should I tell you more about it?',
		'Want to learn about it?',
		'Interested in learning more about it?'
	];
	return randomize(questions);
}

function getSpeakableListOfProducts(entitleProductsList) {
	const productNameList = entitleProductsList.map(item => item.name);
	let productListSpeech = productNameList.join(', '); // Generate a single string with comma separated product names
	productListSpeech = productListSpeech.replace(/_([^_]*)$/, 'and $1'); // Replace last comma with an 'and '
	return productListSpeech;
}

function isProduct(product) {
	return product && product.length > 0;
}
function isEntitled(product) {
	return isProduct(product) && product[0].entitled === 'ENTITLED';
}

function getAllEntitledProducts(inSkillProductList) {
	const entitledProductList = inSkillProductList.filter(
		record => record.entitled === 'ENTITLED'
	);
	return entitledProductList;
}

function makeUpsell(preUpsellMessage,greetingsPackProduct,handlerInput){
	let upsellMessage = `${preUpsellMessage}. ${greetingsPackProduct[0].summary}. ${getRandomLearnMorePrompt()}`;

	return handlerInput.responseBuilder
		.addDirective({
			type: 'Connections.SendRequest',
			name: 'Upsell',
			payload: {
				InSkillProduct: {
					productId: greetingsPackProduct[0].productId
				},
				upsellMessage
			},
			token: 'correlationToken'
		})
		.getResponse();
}

function makeBuyOffer(theProduct,handlerInput){
	return handlerInput.responseBuilder
		.addDirective({
			type: 'Connections.SendRequest',
			name: 'Buy',
			payload: {
				InSkillProduct: {
					productId: theProduct[0].productId
				}
			},
			token: 'correlationToken'
		})
		.getResponse();
}

function getCoinsAvailable(handlerInput){
	const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
	return sessionAttributes.coinsAvailable;
}

async function updateInventory(handlerInput){
	const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
	const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();

	if (persistentAttributes.coinsUsed === undefined) persistentAttributes.coinsUsed = 0;
	if (persistentAttributes.coinsPurchased === undefined) persistentAttributes.coinsPurchased = 0;

	const locale = handlerInput.requestEnvelope.request.locale;
	const monetizationClient = handlerInput.serviceClientFactory.getMonetizationServiceClient();

	return monetizationClient.getInSkillProducts(locale).then(function(res){
		const sharingPackProduct = res.inSkillProducts.filter(
			record => record.referenceName === 'Sharing_Pack'
		);

		const coinsPurchased = (sharingPackProduct[0].activeEntitlementCount * 5);

		if (persistentAttributes.coinsPurchased > coinsPurchased) {
			// THIS CAN HAPPEN IF A CUSTOMER RETURNS AN ACCIDENTAL PURCHASE.
			// YOU SHOULD RESET THEIR TOTALS TO REFLECT THAT RETURN.
			persistentAttributes.coinsPurchased = coinsPurchased;

			if (persistentAttributes.coinsUsed > coinsPurchased) {
				// IF THE USER HAS USED MORE coins THAN THEY HAVE PURCHASED,
				// SET THEIR TOTAL "USED" TO THE TOTAL "PURCHASED."
				persistentAttributes.coinsUsed = coinsPurchased;
			}
		}
		else if (persistentAttributes.coinsPurchased < coinsPurchased) {
			// THIS SHOULDN'T HAPPEN UNLESS WE FORGOT TO MANAGE OUR INVENTORY PROPERLY.
			persistentAttributes.coinsPurchased = coinsPurchased;
		}
		persistentAttributes.coinsAvailable = persistentAttributes.coinsPurchased - persistentAttributes.coinsUsed;
		sessionAttributes.coinsAvailable = persistentAttributes.coinsAvailable;
		handlerInput.attributesManager.savePersistentAttributes();
		// handlerInput.attributesManager.saveSessionAttributes();
	});
}

async function useCoin(handlerInput) {
	const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
	const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();

	persistentAttributes.coinsAvailable -= 1;
	persistentAttributes.coinsUsed += 1;

	sessionAttributes.coinsAvailable = persistentAttributes.coinsAvailable;
	handlerInput.attributesManager.savePersistentAttributes();
}

function simulateShareGreeting(greeting){
	// TODO: You can replace this code with sharing service of your choice.
	return `Alright. I have shared the greeting - ${greeting['greeting']}, which is hello in ${greeting['language']} with your favorite friend.`;
}

async function saveGreeting(handlerInput,greeting) {
	const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
	const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();

	persistentAttributes.greeting = greeting;
	sessionAttributes.greeting = greeting;

	handlerInput.attributesManager.savePersistentAttributes();
}

// *****************************************
// *********** Interceptors ************
// *****************************************
const LogResponseInterceptor = {
	process(handlerInput) {
		console.log(
			`RESPONSE = ${JSON.stringify(handlerInput.responseBuilder.getResponse())}`
		);
	}
};

const LogRequestInterceptor = {
	process(handlerInput) {
		console.log(
			`REQUEST ENVELOPE = ${JSON.stringify(handlerInput.requestEnvelope)}`
		);
	}
};

const recordLastIntentRequestInterceptor ={
	async process(handlerInput) {
		const attributesManager = handlerInput.attributesManager;
		const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
		const sessionAttributes = await attributesManager.getSessionAttributes() || {};
		let lastIntent;

		switch (handlerInput.requestEnvelope.request.type){
		case 'LaunchRequest':
			lastIntent = 'LaunchRequest';
			break;
		case 'Connections.Response':
			lastIntent = 'Connections.Response';
			break;
		case 'SessionEndedRequest':
			lastIntent = 'SessionEndedRequest';
			break;
		default:
			lastIntent = handlerInput.requestEnvelope.request.intent.name;
			break;
		}

		persistentAttributes.lastIntent = lastIntent;
		sessionAttributes.lastIntent = lastIntent;
		handlerInput.attributesManager.savePersistentAttributes();
	}
};
const LoadGreetingRequestInterceptor = {
	async process(handlerInput) {
		const attributesManager = handlerInput.attributesManager;
		const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
		const greeting = persistentAttributes.hasOwnProperty('greeting') ? persistentAttributes.greeting : '';

		if (greeting) {
			attributesManager.savePersistentAttributes();
		}
	}
};

const UpdateInventoryInterceptor = {
	async process(handlerInput) {
		await updateInventory(handlerInput);
	},
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
	.addRequestHandlers(
		LaunchRequestHandler,
		GetAnotherHelloHandler,
		NoIntentHandler,
		WhatCanIBuyIntentHandler,
		TellMeMoreAboutSharingPackIntentHandler,
		BuySharingPackIntentHandler,
		ShareGreetingIntentHandler,
		BuyResponseHandler,
		PurchaseHistoryIntentHandler,
		RefundSharingPackIntentHandler,
		CoinInventoryIntentHandler,
		CancelProductResponseHandler,
		HelpIntentHandler,
		CancelAndStopIntentHandler,
		SessionEndedRequestHandler
	)
	.addErrorHandlers(ErrorHandler)
	.addRequestInterceptors(
		LoadGreetingRequestInterceptor,
		LogRequestInterceptor,
		UpdateInventoryInterceptor,
		recordLastIntentRequestInterceptor)
	.addResponseInterceptors(
		LogResponseInterceptor)
	.withPersistenceAdapter(
		new persistenceAdapter.S3PersistenceAdapter({bucketName:process.env.S3_PERSISTENCE_BUCKET}))
	.withApiClient(new Alexa.DefaultApiClient())
	.lambda();