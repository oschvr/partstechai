// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const axios = require('axios');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements


exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  
  // =========================================================> API
  // =========> Auth
  function getAccessToken(){
    const apiUrl = `https://api.beta.partstech.com/oauth/access`;
    const headers = {
      'Accept': 'application/json',
    }
    const body = {
      "accessType": "user",
      "credentials": {
        "user": {
          "id": "demo_helen",
          "key": "e2a5497a74104c7facfc31c682b4db62"
        },
        "partner": {
          "id": "test_partner",
          "key": "97687715735f4b7da49d39bc19d0e532"
        }
      }
    };
    return new Promise((resolve, reject) => {
      axios
        .post(apiUrl, body, headers)
        .then(response => {
          console.log('Auth => ', response.data);
          return resolve(response);
        })
        .catch(err => {
          console.log('Auth Err => ', err);
          return reject(err);
        })
    });
  }
  const host = `https://api.beta.partstech.com`;
  const headers = {
    'Accept': 'application/json',
    Authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJiZXRhLnBhcnRzdGVjaC5jb20iLCJleHAiOjE1NTY0MjIxNTQsInBhcnRuZXIiOiJ0ZXN0X3BhcnRuZXIiLCJ1c2VyIjoiZGVtb19oZWxlbiJ9.0tax1hFKudM5XNZ8VjJXAGRsMCSd00ixT9CvGTqix9o'
  }
  
  // ===========> Support
  // ===========> Catalog


  // =========================================================> Agent
  const agent = new WebhookClient({ request, response });
  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  function optOutQuerySelection(agent){
    agent.add(`Let's move on.`);
    agent.add(`Do you want to find your car model or find parts ?`);
    agent.add(new Suggestion(`Search Car Model`));
    agent.add(new Suggestion(`Find Parts`));

    const query = agent.parameters.query;
    agent.context.set({
      name: 'query',
      lifespan: 2,
      parameters: {
        query: query
      }
    });
  }

  function optInQuerySelection(agent){
    let email = agent.parameters.email;
    agent.add(`We've sent a discount to ${email}. Thank you!`)
    agent.add(`Now, Do you want to find your car model or find parts ?`);
    agent.add(new Suggestion(`Search Car Model`));
    agent.add(new Suggestion(`Find Parts`));

    const query = agent.parameters.query;
    agent.context.set({
      name: 'query',
      lifespan: 2,
      parameters: {
        query: query
      }
    });
  }

  // ===========> Taxonomy

  /**
    Part Types:
    Spark plugs
    Alternators
    Oxygen Sensors
    Wiper Blades
    Vehicle Batteries
    Fuel Pumps

    Vehicles:
    2010-2015, BMW, 325
    2010-2015, BMW, 328
    2010-2015, Volkswagen, Jetta
    2010-2015, Volkswagen, Passat

    Sample search:
    https://beta.partstech.com/searchresult?availability[]=1&data_version[]=actual&part_text=Spark%20Plug&part_text_id=7212&selected_distributor=2501-149371&vehicle=268184
   */

  function searchSelection(agent){
    let query = agent.context.get('query').parameters.query;
    const year = agent.parameters.year;
    if(query === 'car'){
      agent.add(`We'll search for your car model starting by the year. Which year is it?`);

      agent.context.set({
        name: 'year',
        lifespan: 2,
        parameters: {
          year: year
        }
      });

    } else {
      agent.add(`Type you car year, make & model.`);

      const make = agent.parameters.make;
      const model = agent.parameters.model;
      agent.context.set({
        name: 'parts',
        lifespan: 2,
        parameters: {
          year: year,
          make: make,
          model: model
        }
      });
    }
  }

  function searchMakes(agent) {

    const year = agent.context.get('year').parameters.year;
    const apiUrl = `${host}/taxonomy/vehicles/makes?year=${year}&model=`;
    return new Promise((resolve, reject) => {
      axios
        .get(apiUrl, { headers: headers })
        .then(response => {
          agent.add(`Noted, ${year}. Which make (brand) is your car?`);
          const makes = response.data;

          agent.context.set({
            name: 'make',
            lifespan: 2,
            parameters: {
              makes: makes
            }
          });
          return resolve(response);
        })
        .catch(err => {
          console.log('Makes Err', err);
          agent.add(`There was an error. Try again`);
          return reject(err);
        });
    });
  }

  /**
   * Search the models
   * @param {object} agent 
   */
  function searchModels(agent) {
    const year = agent.context.get('year').parameters.year;
    const makes = agent.context.get('make').parameters.makes;

    const make = agent.parameters.make;

    var makeId = '';
    for (var i=0;i<makes.length;i+=1) {
      if(makes[i].makeName === make){
        makeId = makes[i].makeId;
      }
    }

    const apiUrl = `${host}/taxonomy/vehicles/models?year=${year}&make=${makeId}&submodel`;
    return new Promise((resolve, reject) => {
      axios
        .get(apiUrl, { headers: headers })
        .then(response => {
          agent.add(`Almost there with your ${make}. What model is it?`);

          const models = response.data;
          
          agent.context.set({
            name: 'make',
            lifespan: 5,
            parameters: {
              make: make,
              makes: makes,
              makeId: makeId
            }
          });
          agent.context.set({
            name: 'model',
            lifespan: 5,
            parameters: {
              models: models,
            }
          });
          return resolve(response);
        })
        .catch(err => {
          console.log('Models Err', err);
          agent.add(`There was an error. Try again`);
          return reject(err);
        });
    });
  }

  /**
   * Get Submodels
   * @param {Object} agent 
   */
  function searchSubmodel(agent) {
    const year = agent.context.get('year').parameters.year;
    const make = agent.context.get('make').parameters.make;
    const makeId = agent.context.get('make').parameters.makeId;
    const models = agent.context.get('model').parameters.models;

    const model = agent.parameters.model;
    
    var modelId = '';
    for (var i=0;i<models.length;i+=1) {
      if(models[i].modelName === model){
        modelId = models[i].modelId;
      }
    }

    const apiUrl = `${host}/taxonomy/vehicles/submodels?year=${year}&make=${makeId}&model=${modelId}&engine=`;

    return new Promise((resolve, reject) => {
      axios
        .get(apiUrl, { headers: headers })
        .then(response => {
          agent.add(`Lastly, we need the submodel/line for your ${year} ${make}`);

          const submodels = response.data;

          agent.context.set({
            name: 'model',
            lifespan: 5,
            parameters: {
              model: model,
              models: models,
              modelId: modelId
            }
          });
          agent.context.set({
            name: 'submodel',
            lifespan: 5,
            parameters: {
              submodels: submodels,
            }
          });
          return resolve(response);
        })
        .catch(err => {
          console.log('Submodels Err', err);
          agent.add(`There was an error. Try again`);
          return reject(err);
        });
    });
  }

  /**
   * Get Engine
   * @param {Object} agent 
   */
  function searchEngine(agent) {
    const year = agent.context.get('year').parameters.year;
    const makeId = agent.context.get('make').parameters.makeId;
    const modelId = agent.context.get('model').parameters.modelId;
    const submodels = agent.context.get('submodel').parameters.submodels;
    
    const submodel = agent.parameters.submodel;
    
    var submodelId = '';
    for (var i=0;i<submodels.length;i+=1) {
      if(submodels[i].submodelName === submodel){
        submodelId = submodels[i].submodelId;
      }
    }

    const apiUrl = `${host}/taxonomy/vehicles/engines?year=${year}&make=${makeId}&model=${modelId}&submodel=${submodelId}`;

    return new Promise((resolve, reject) => {
      axios
        .get(apiUrl, { headers: headers })
        .then(response => {
          agent.add(`We're set ! ¿What are you looking for?`);

          const engines = response.data;
          const engine = engines[0];

          agent.context.set({
            name: 'submodel',
            lifespan: 5,
            parameters: {
              submodels: submodels,
              submodel: submodel,
              submodelId: submodelId
            }
          });

          agent.context.set({
            name: 'engine',
            lifespan: 5,
            parameters: {
              engine: engine.engineName,
              engineId: engine.engineId,
              engineParams: engine.engineParams
            }
          });
          return resolve(response);
        })
        .catch(err => {
          console.log('Engine Err', err);
          agent.add(`There was an error. Try again`);
          return reject(err);
        });
    });
  }

  /**
   * Search for a part with a keyword
   * @param {Object} agent 
   */
  function searchParts(agent){
    const year = agent.context.get('year').parameters.year;
    const makeId = agent.context.get('make').parameters.makeId;
    const modelId = agent.context.get('model').parameters.modelId;
    const submodelId = agent.context.get('submodel').parameters.submodelId;
    const engine = agent.context.get('engine').parameters;

    const apiUrl = `${host}/catalog/quote`;
    const body = {
      "searchParams": {
        "vehicleParams": {
          "yearId": Number(year),
          "makeId": makeId,
          "modelId": modelId,
          "subModelId": submodelId,
          "engineId": engine.engineId,
          "engineParams": engine.engineParams,
        },
        "keyword": agent.parameters.parts,
      },
      "storeId": 1,
      "filters": []
    };
    
    return new Promise((resolve, reject) => {
      axios
        .post(apiUrl, body, { headers: headers })
        .then(response => {
          agent.add(`Here's the result parts`);
          let parts = response.data.parts;
          let part = parts[0];
          console.log(part);
          
          agent.add(`${part.partName} - $ ${part.price.list}: ${part.partsTechCatalogURL}`);

          // agent.add(new Card({
          //   title: `${part.partName} - $ ${part.price.list}`,
          //   imageUrl: 'https://i2.wp.com/www.langem.org/wp-content/uploads/2018/04/placeholder.png?w=480',
          //   text: part.taxonomy.partTypeDescription,
          //   buttonText: `Buy now (In Stock ${part.quantity})`,
          //   buttonUrl: part.partsTechCatalogURL
          // }));
          
          // agent.context.set({
          //   name: 'parts',
          //   lifespan: 5,
          //   parameters: {
          //     parts: parts,
          //   }
          // });

          return resolve(response);
        })
        .catch(err => {
          console.log('Parts Err', err);
          agent.add(`There was an error. Try again`);
          return reject(err);
        });
      });
  }


  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);

  intentMap.set('OptOut', optOutQuerySelection);
  intentMap.set('GetEmail', optInQuerySelection);

  intentMap.set('Query', searchSelection);

  intentMap.set('Year', searchMakes);
  intentMap.set('Make', searchModels);
  intentMap.set('Model', searchSubmodel);
  intentMap.set('Submodel', searchEngine);

  intentMap.set('Parts', searchParts);

  agent.handleRequest(intentMap);
});
