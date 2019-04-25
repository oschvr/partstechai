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
    Authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJiZXRhLnBhcnRzdGVjaC5jb20iLCJleHAiOjE1NTY0ODYwOTksInBhcnRuZXIiOiJiZXRhX2Jvc2NoIiwidXNlciI6ImhhY2t0ZWFtXzMifQ.Xmh7OfLqVRFJiIK6_7R2axXtKf28Ss_iRNSGWcSZV_4'
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
    agent.add(`Do you want to find your car model or quote parts ?`);
    // agent.add(new Suggestion(`Search Car Model`));
    // agent.add(new Suggestion(`Find Parts`));

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
    agent.add(`Now, Do you want to find your car model or quote parts ?`);
    //agent.add(new Suggestion(`Search Car Model`));
    //agent.add(new Suggestion(`Find Parts`));

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
    //if(query === 'car'){
      agent.add(`We'll search for your car model starting by the year. Which year is it?`);

      agent.context.set({
        name: 'year',
        lifespan: 2,
        parameters: {
          year: year
        }
      });

    // } else {
    //   agent.add(`Type you car year, make & model.`);

    //   const make = agent.parameters.make;
    //   const model = agent.parameters.model;
    //   agent.context.set({
    //     name: 'parts',
    //     lifespan: 2,
    //     parameters: {
    //       year: year,
    //       make: make,
    //       model: model
    //     }
    //   });
    // }
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
          agent.add(`Almost there with your ${year} ${make}. What model is it?`);

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
    const make = agent.context.get('make').parameters.make;
    const model = agent.context.get('model').parameters.model;
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
          agent.add(`We're set ! We're looking parts for a ${year} ${make} ${model}. What part are you looking for?`);

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

    const parts = agent.parameters.parts; // Air Filter

    const apiUrl = `${host}/catalog/quote`;
    const body = {
      "searchParams": {
        "vehicleParams": {
          "yearId": Number(year),
          "makeId": makeId,
          "modelId": modelId,
          "subModelId": submodelId,
          "engineId": 5827,
          "engineName": "1.8L L4 DOHC CPRA PZEV",
          "engineParams": {
              "engineVinId": 1,
              "engineDesignationId": 5065,
              "engineVersionId": 66,
              "fuelTypeId": 5,
              "cylinderHeadTypeId": 6
          }
        },
        "keyword": parts,
      },
      "storeId": 1,
      "filters": []
    };

    // agent.add(`I'm looking for the best deals for ${parts}`)
    new Promise((resolve, reject) => {
      axios
        .post(apiUrl, body, { headers: headers })
        .then(response => response.data.parts)
        .then(parts => {
          console.log(parts[0], parts)
          return resolve();
        })
      .catch(err => {
        console.log('Parts Err', err);
        agent.add(`There was an error. Try again`);
        return reject(err);
      });
    });

    const resultParts = {
      "parts": [
          {
              "partId": "BBHK-5429WS",
              "partNumber": "5429WS",
              "partName": "Bosch Workshop Air Filter",
              "partsTechCatalogURL": "https://bcs.beta.partstech.com/Bosch-Air-Filter/details/BBHK-5429WS?part_term=6192",
              "brand": {
                  "brandID": "BBHK",
                  "brandName": "Bosch",
                  "id": 551,
                  "displayName": "Bosch"
              },
              "images": [
                  {
                      "preview": "https://img1.partstech.com/d1/images/8f/71/82/w110_8f7182dcc3cbb5c54382f2cb3c56696ae2e2cc96.png",
                      "full": "https://img1.partstech.com/d1/images/8f/71/82/8f7182dcc3cbb5c54382f2cb3c56696ae2e2cc96.png",
                      "medium": "https://img1.partstech.com/d1/images/8f/71/82/w400_8f7182dcc3cbb5c54382f2cb3c56696ae2e2cc96.png"
                  }
              ],
              "originalPart": null,
              "notes": [],
              "taxonomy": {
                  "partTypeId": 6192,
                  "partTypeName": "Air Filter",
                  "partTypeDescription": "An air filter for the air intake system of a vehicle's engine.",
                  "categoryId": 12,
                  "categoryName": "Air and Fuel Delivery",
                  "subCategoryId": 153,
                  "subCategoryName": "Filters"
              },
              "vehicleId": 287296,
              "vehicleName": "2014 Kia Optima Hybrid EX 2.4L L4 vin D DOHC  Theta II ELECTRIC/GAS",
              "attributes": [
                  {
                      "name": "Qty",
                      "label": "Quantity per vehicle",
                      "value": 1,
                      "type": "Both"
                  },
                  {
                      "name": "ItemQuantity",
                      "label": "Item Qty/Size/Weight",
                      "value": "1 Each",
                      "type": "Part"
                  }
              ],
              "rewards": []
          },
          {
              "partId": "BBHK-6057C",
              "partNumber": "6057C",
              "partName": "Bosch Cabin Filter, HEPA",
              "partsTechCatalogURL": "https://bcs.beta.partstech.com/Bosch-Cabin-Air-Filter/details/BBHK-6057C?part_term=6832",
              "brand": {
                  "brandID": "BBHK",
                  "brandName": "Bosch",
                  "id": 551,
                  "displayName": "Bosch"
              },
              "images": [
                  {
                      "preview": "https://img1.partstech.com/d1/images/74/fa/df/w110_74fadf8aabc8f3408d53832554844e3d6287c8d3.png",
                      "full": "https://img1.partstech.com/d1/images/74/fa/df/74fadf8aabc8f3408d53832554844e3d6287c8d3.png",
                      "medium": "https://img1.partstech.com/d1/images/74/fa/df/w400_74fadf8aabc8f3408d53832554844e3d6287c8d3.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d1/images/be/2c/d5/w110_be2cd5dd8e2e71be82acd58dad529eb90270265d.png",
                      "full": "https://img1.partstech.com/d1/images/be/2c/d5/be2cd5dd8e2e71be82acd58dad529eb90270265d.png",
                      "medium": "https://img1.partstech.com/d1/images/be/2c/d5/w400_be2cd5dd8e2e71be82acd58dad529eb90270265d.png"
                  }
              ],
              "originalPart": null,
              "notes": [],
              "taxonomy": {
                  "partTypeId": 6832,
                  "partTypeName": "Cabin Air Filter",
                  "partTypeDescription": "A filter used to filter all of the air that comes through the car's HVAC system to prevent pollutants from entering the vehicle's cabin",
                  "categoryId": 13,
                  "categoryName": "HVAC",
                  "subCategoryId": 153,
                  "subCategoryName": "Filters"
              },
              "vehicleId": 287296,
              "vehicleName": "2014 Kia Optima Hybrid EX 2.4L L4 vin D DOHC  Theta II ELECTRIC/GAS",
              "attributes": [
                  {
                      "name": "Qty",
                      "label": "Quantity per vehicle",
                      "value": 1,
                      "type": "Both"
                  },
                  {
                      "name": "ItemQuantity",
                      "label": "Item Qty/Size/Weight",
                      "value": "1 Piece",
                      "type": "Part"
                  }
              ],
              "rewards": [
                  {
                      "program": "extra Loyalty Program",
                      "points": 5,
                      "bonusPoints": 0
                  }
              ]
          },
          {
              "partId": "BBTS-AF1434",
              "partNumber": "AF1434",
              "partName": "Hastings Air Filter",
              "partsTechCatalogURL": "https://bcs.beta.partstech.com/Hastings-Air-Filter/details/BBTS-AF1434?part_term=6192",
              "brand": {
                  "brandID": "BBTS",
                  "brandName": "Hastings",
                  "id": 179,
                  "displayName": "Hastings"
              },
              "images": [
                  {
                      "preview": "https://img1.partstech.com/d6/images/06/6f/b9/w110_066fb9af819025eac1e8dfa57f60c609811dc66b.png",
                      "full": "https://img1.partstech.com/d6/images/06/6f/b9/066fb9af819025eac1e8dfa57f60c609811dc66b.png",
                      "medium": "https://img1.partstech.com/d6/images/06/6f/b9/w400_066fb9af819025eac1e8dfa57f60c609811dc66b.png"
                  }
              ],
              "originalPart": null,
              "notes": [],
              "taxonomy": {
                  "partTypeId": 6192,
                  "partTypeName": "Air Filter",
                  "partTypeDescription": "An air filter for the air intake system of a vehicle's engine.",
                  "categoryId": 12,
                  "categoryName": "Air and Fuel Delivery",
                  "subCategoryId": 153,
                  "subCategoryName": "Filters"
              },
              "vehicleId": 287296,
              "vehicleName": "2014 Kia Optima Hybrid EX 2.4L L4 vin D DOHC  Theta II ELECTRIC/GAS",
              "attributes": [
                  {
                      "name": "Qty",
                      "label": "Quantity per vehicle",
                      "value": 1,
                      "type": "Both"
                  }
              ],
              "rewards": []
          },
          {
              "partId": "BBWQ-33-2448",
              "partNumber": "33-2448",
              "partName": "K&N Air Filter",
              "partsTechCatalogURL": "https://bcs.beta.partstech.com/K-N-Air-Filter/details/BBWQ-33-2448?part_term=6192",
              "brand": {
                  "brandID": "BBWQ",
                  "brandName": "K&N",
                  "id": 388,
                  "displayName": "K&N"
              },
              "images": [
                  {
                      "preview": "https://img1.partstech.com/d6/images/ca/67/81/w110_ca6781ca027cedefb4a32865ce14cf2b3ef2b63d.png",
                      "full": "https://img1.partstech.com/d6/images/ca/67/81/ca6781ca027cedefb4a32865ce14cf2b3ef2b63d.png",
                      "medium": "https://img1.partstech.com/d6/images/ca/67/81/w400_ca6781ca027cedefb4a32865ce14cf2b3ef2b63d.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d6/images/20/1b/b5/w110_201bb5c12b02888ca49167703b706c261aeac2a1.png",
                      "full": "https://img1.partstech.com/d6/images/20/1b/b5/201bb5c12b02888ca49167703b706c261aeac2a1.png",
                      "medium": "https://img1.partstech.com/d6/images/20/1b/b5/w400_201bb5c12b02888ca49167703b706c261aeac2a1.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d6/images/e3/af/8a/w110_e3af8aca302a3caa501bf5b107e8843b1e633d68.png",
                      "full": "https://img1.partstech.com/d6/images/e3/af/8a/e3af8aca302a3caa501bf5b107e8843b1e633d68.png",
                      "medium": "https://img1.partstech.com/d6/images/e3/af/8a/w400_e3af8aca302a3caa501bf5b107e8843b1e633d68.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d2/images/d3/49/5e/w110_d3495eadaa88316b9d0f49c1a95255e35632cb2a.png",
                      "full": "https://img1.partstech.com/d2/images/d3/49/5e/d3495eadaa88316b9d0f49c1a95255e35632cb2a.png",
                      "medium": "https://img1.partstech.com/d2/images/d3/49/5e/w400_d3495eadaa88316b9d0f49c1a95255e35632cb2a.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d2/images/49/8c/dc/w110_498cdc5cba4dff53642e79d57478d4e36bc61ac7.png",
                      "full": "https://img1.partstech.com/d2/images/49/8c/dc/498cdc5cba4dff53642e79d57478d4e36bc61ac7.png",
                      "medium": "https://img1.partstech.com/d2/images/49/8c/dc/w400_498cdc5cba4dff53642e79d57478d4e36bc61ac7.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d2/images/6a/a6/9c/w110_6aa69c7db914a17343e709084b2258705af23164.png",
                      "full": "https://img1.partstech.com/d2/images/6a/a6/9c/6aa69c7db914a17343e709084b2258705af23164.png",
                      "medium": "https://img1.partstech.com/d2/images/6a/a6/9c/w400_6aa69c7db914a17343e709084b2258705af23164.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d2/images/0e/de/7e/w110_0ede7e77c05836bbfa944fe67c22d0f5899b2c37.png",
                      "full": "https://img1.partstech.com/d2/images/0e/de/7e/0ede7e77c05836bbfa944fe67c22d0f5899b2c37.png",
                      "medium": "https://img1.partstech.com/d2/images/0e/de/7e/w400_0ede7e77c05836bbfa944fe67c22d0f5899b2c37.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d2/images/5e/3c/ce/w110_5e3cce89b05a1db832351467a424cbe3c0288e23.png",
                      "full": "https://img1.partstech.com/d2/images/5e/3c/ce/5e3cce89b05a1db832351467a424cbe3c0288e23.png",
                      "medium": "https://img1.partstech.com/d2/images/5e/3c/ce/w400_5e3cce89b05a1db832351467a424cbe3c0288e23.png"
                  },
                  {
                      "preview": "https://img1.partstech.com/d2/images/98/3a/0e/w110_983a0ed06d5600737c1d28ba66c1aafd822afbbd.png",
                      "full": "https://img1.partstech.com/d2/images/98/3a/0e/983a0ed06d5600737c1d28ba66c1aafd822afbbd.png",
                      "medium": "https://img1.partstech.com/d2/images/98/3a/0e/w400_983a0ed06d5600737c1d28ba66c1aafd822afbbd.png"
                  }
              ],
              "originalPart": null,
              "notes": [],
              "taxonomy": {
                  "partTypeId": 6192,
                  "partTypeName": "Air Filter",
                  "partTypeDescription": "An air filter for the air intake system of a vehicle's engine.",
                  "categoryId": 12,
                  "categoryName": "Air and Fuel Delivery",
                  "subCategoryId": 153,
                  "subCategoryName": "Filters"
              },
              "vehicleId": 287296,
              "vehicleName": "2014 Kia Optima Hybrid EX 2.4L L4 vin D DOHC  Theta II ELECTRIC/GAS",
              "attributes": [
                  {
                      "name": "Qty",
                      "label": "Quantity per vehicle",
                      "value": 1,
                      "type": "Both"
                  },
                  {
                      "name": "ItemQuantity",
                      "label": "Item Qty/Size/Weight",
                      "value": "1 Each",
                      "type": "Part"
                  },
                  {
                      "name": "WarrantyDistance",
                      "label": "Warranty Distance",
                      "value": "1000000 Miles",
                      "type": "Part"
                  }
              ],
              "rewards": []
          },
      ],
      "filters": [
          {
              "name": "parts",
              "label": "Part Type",
              "options": [
                  {
                      "label": "Air Filter",
                      "value": 6192,
                      "active": false,
                      "count": 22
                  },
                  {
                      "label": "Cabin Air Filter",
                      "value": 6832,
                      "active": false,
                      "count": 24
                  }
              ]
          },
          {
              "name": "manufacturers",
              "label": "Manufacturer",
              "options": [
                  {
                      "label": "Bosch",
                      "value": 551,
                      "active": false,
                      "count": 3
                  },
                  {
                      "label": "Hastings",
                      "value": 179,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "K&N",
                      "value": 388,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Wix",
                      "value": 917,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Premium Guard",
                      "value": 4644,
                      "active": false,
                      "count": 3
                  },
                  {
                      "label": "MAHLE Original",
                      "value": 5996,
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "ATP",
                      "value": 7,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "DENSO Auto Parts",
                      "value": 206,
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "Pro-Tec",
                      "value": 268,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Purolator",
                      "value": 1233,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Baldwin",
                      "value": 702,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Luberfiner",
                      "value": 704,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Service Champ",
                      "value": 997,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Pronto",
                      "value": 23164,
                      "active": false,
                      "count": 3
                  },
                  {
                      "label": "AEM Induction",
                      "value": 4555,
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "Champ filters",
                      "value": 7748,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "PUREPRO",
                      "value": 7203,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Prime Guard Filters",
                      "value": 8075,
                      "active": false,
                      "count": 4
                  },
                  {
                      "label": "Warner Filters",
                      "value": 32268,
                      "active": false,
                      "count": 2
                  },
                  {
                      "label": "Parts Master Wix",
                      "value": 44310,
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "Fram",
                      "value": 460,
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "ECOGARD",
                      "value": 6584,
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "Auto Extra Wix",
                      "value": 44306,
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "Defense",
                      "value": 4937,
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "Federated Filters",
                      "value": 42380,
                      "active": false,
                      "count": 1
                  }
              ]
          },
          {
              "name": "data_version",
              "label": "Data Version",
              "options": [
                  {
                      "label": "Actual",
                      "value": "actual",
                      "active": true
                  },
                  {
                      "label": "Staged",
                      "value": "staged",
                      "active": false
                  }
              ]
          },
          {
              "name": "WarrantyTime",
              "label": "Warranty Time",
              "options": [
                  {
                      "label": "Unknown",
                      "value": "Unknown",
                      "active": false,
                      "count": 37
                  },
                  {
                      "label": "12 Months",
                      "value": "12 Months",
                      "active": false,
                      "count": 1
                  },
                  {
                      "label": "30 Days",
                      "value": "30 Days",
                      "active": false,
                      "count": 8
                  }
              ]
          },
          {
              "name": "WarrantyDistance",
              "label": "Warranty Distance",
              "options": [
                  {
                      "label": "Unknown",
                      "value": "Unknown",
                      "active": false,
                      "count": 44
                  },
                  {
                      "label": "1000000 Miles",
                      "value": "1000000 Miles",
                      "active": false,
                      "count": 2
                  }
              ]
          }
      ]
    };

    const newParts = resultParts.parts;
    agent.add('I found these offers:')
    newParts.map(part => {
      agent.add(new Card({
        title: `${part.partName}`,
        imageUrl: part.images[0].preview,
        text: part.taxonomy.partTypeDescription,
        buttonText: `Buy now`,
        buttonUrl: part.partsTechCatalogURL
      }));
    })

    agent.context.set({
      name: 'results',
      lifespan: 5,
      params: {
        results: resultParts
      }
    });
  }

  function searchResults(agent){
    const results = agent.context.get('results').parameters.results;
    console.log('Results =>', results);
    agent.add(`Thank you for searching with us. Bye`);
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
  intentMap.set('Results', searchResults);

  agent.handleRequest(intentMap);
});
