const crypto = require('crypto');
const IAgentService = require('../services/iAgentService');

// Obtaining the IP and port data where Ollama is running
const host = process.env.HOST_OLLAMA || '127.0.0.1';
const port = process.env.PORT_OLLAMA || '11434';

// Determining the default model assigned to this intelligence agent
const default_model = process.env.DEFAULT_MODEL || 'llama3.2:latest';

const timeOut = process.env.TIMEOUT || 999999;

class IAgentController {

    // Working modes...
    // NormalDB -> Using conversation history with DB
    // NormalNoDB -> Using conversation history without DB
    // SimpleDB -> Without using conversation history with DB
    // SimpleNoDB -> Without using conversation history without DB
    // Medium -> Using conversation with medium algorithm difficulty with DB
    // Advanced -> Using conversation with medium algorithm difficulty with DB

    constructor() {

        // Object of the IAgentService class through which access to the database is managed
        this.iAgentService = new IAgentService();

        // Object that stores an instance of the Ollama client
        this.ollama = null;
        
        // The default model is defined in .env and passed to the constructor
        this.initialModel=default_model;

        // Model to be used for that session, Each session has a default model assigned to it
        // being able to change it in a specific call to the AI
        this.model = {}

        // Model to be used for that session
        // The model type can be 'default' or 'custom'; 'default' means there is no system prompt
        // "Custom" means that the model comes personalized
        this.modelType = {}

        // Model to be used for that session,
        // If it's 'custom', the system prompt would go here
        this.modelSystem ={}

        // Parameters to be used for that session,
        // Object containing the parameters of a model
        this.parameters={}

        // Access the message history of a conversation to pass it on to the AI
        this.history = {};

        // The mode is stored for each of the conversation IDs.
        // It is defined every time a new conversation is created.
        this.mode = {};

        // Tracks whether a given conversation is currently active
        // A timer is triggered every X minutes that deactivates the activity status of a conversation
        this.activity = {};

        // Class property to store active timers
        this.timers = new Map();

        // Expired Sessions array
        this.expiredSessions = []

        // Ensure that the 'this' keyword retains its context (referring to the current class)
        // when those functions are executed as callbacks or event handlers.
        this.sendMessage = this.sendMessage.bind(this);
        this.initAgent = this.initAgent.bind(this);
        this.createCustomModel = this.createCustomModel.bind(this);
        this.fixModelSystem = this.fixModelSystem.bind(this);
        this.expiredSessionConsult = this.expiredSessionConsult.bind(this);
        this.closureNotify = this.closureNotify.bind(this);
    }

    // Code to execute when the timer expires
    #executeAction(id) {

        // If the session is active, we set it to false and create a new timer
        if (this.activity[id] === true) {

            this.activity[id] = false;
            this.timers.delete(id);
            this.timeoutActivate(id, timeOut);

        } else {

            // If it was false, it means we should close the session
            this.timers.delete(id);

            // We remove all information about that conversation from memory
            delete this.model[id];
            delete this.modelType[id];
            delete this.modelSystem[id];
            delete this.parameters[id];
            delete this.history[id];
            delete this.mode[id];
            delete this.activity[id];

            // We push the id inside the expiredSessions Array
            // So that the length is always under 100000 when it is full we remove the first entry
            if (this.expiredSessions.length >= 99999) this.expiredSessions.shift()
            this.expiredSessions.push(id);

            console.log("EXPIRED SESSIONS : " + this.expiredSessions)
        }
    }


    // This function activates a timeout for a session
    timeoutActivate(id, timeMs) {

        // If they already have it, we do nothing
        if (this.timers.has(id)) return;
    
        // We start the timer
        this.timers.set(id, setTimeout(() => {
            this.#executeAction(id);
        }, timeMs));
    }

    // Function to manually cancel the timer
    timeoutCancel(id) {
        if (this.timers.has(id)) {
            clearTimeout(this.timers.get(id));
            this.timers.delete(id);
        }
    }


    // Method that initializes the AI ​​Agent for a conversation
    async initAgent (req, res) {
        
        try {

            if (!this.ollama) {

                // Initialize and connect an Ollama client
                // Dynamically import the Ollama class from the official Node.js library.
                const { Ollama } = await import('ollama');

                // Creates a new instance of the Ollama client and stores it in a property of the current class (this.ollama)
                this.ollama = new Ollama({ host: `http://${host}:${port}` });
            }

            // Defines the AI's operating mode for that specific conversation.
            // Receive the conversation identifier and mode
            const { mode } = req.body;

            if (!mode) throw new Error("The mode parameter is required");

            // Secure UUID generation using the native Node.js module
            const serverSessionId = crypto.randomUUID ? crypto.randomUUID() 
                : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            const sessionId = serverSessionId;

            // If the sessionId is in the list of expired sessions, we do not allow it to continue
            if (this.expiredSessions.includes(sessionId)) throw new Error("Session has expired");

            // We indicate that there is activity in that conversation
            this.activity[sessionId] = true;

            // We set a timeout for that conversation to check where the session is over
            this.timeoutActivate(sessionId, timeOut);

            // The mode is added to the array of modes for the class corresponding to the conversation ID.
            this.mode[sessionId] = mode;

            // The model is added to the array of models for the class corresponding to the conversation ID.
            this.model[sessionId] = this.initialModel;

            // Initial value for the model type
            this.modelType[sessionId] = 'default';

            // Initial value for the model system text
            this.modelSystem[sessionId] = '';

            // Initial value for the model parameters
            this.parameters[sessionId] = {}

            // The initialization data for this conversation is stored or updated in the database if it exist
            





            



            // Si tenemos un objeto que apunte a ollama devolvemos con exito el sessionId
            if (this.ollama == null) throw new Error('An object pointing to ollama is required');
            else return res.status(200).json({ 
                    success: true, 
                    sessionId : serverSessionId,
                    message: "Agent initialized successfully"
            });

        } catch (error) {

            // If a message is generated, we send the data along with a 500 error code, including the error and details.
            // We also set success to false. Since it is a 500 error, response.ok will be false.
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in the Intelligence Agent Module Failed to initialize the agent',
                details: `${realDetail}`
            });
        }
    }


    // Function that creates or updates a custom model
    async createCustomModel(req, res) {

        try {

            const { sessionId, modelName, from, system, parameters } = req.body;

            // from, system, parametres can be empty
            if (!sessionId) throw new Error('The sessionId is required');
            if (!modelName) throw new Error('The modelName is required');

            // We check if sessionId exist then indicate the session has activity otherwise we throw an error
            if (sessionId in this.activity) this.activity[sessionId] = true;
            else throw new Error("Session activity record not found. Please initialize the agent first.");

            // If the sessionId is in the list of expired sessions, we do not allow it to continue
            if (this.expiredSessions.includes(sessionId)) throw new Error("Session has expired");

            // If the model is not specified, the default model is used
            let fromModel = from === '' ? default_model : from;

            // Ollama doesnt exits
            if (this.ollama == null) throw new Error('An object pointing to ollama is required');

            // We make the request to create the custom model
            const response = await this.ollama.create({
                model: modelName,
                from: fromModel,
                system: system,
                parameters: parameters,
                stream: false
            });

            // Updates or reassigns the model to the session
            this.model[sessionId] = modelName;

            // The conversation configuration in the database is updated to incorporate the new model







            // Respond to the HTTP client to close the request
            return res.status(200).json({ 
                success: true, 
                message: `Model created successfully.`
            });

        } catch (error) {
        
            // If a message is generated, we send the data along with a 500 error code, including the error and details.
            // We also set success to false. Since it is a 500 error, response.ok will be false.
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in Intelligence Agent Module Failed to create the custom model',
                details: `${realDetail}` 
            });
        }
    }

    
    // Function that sets the system propmpt and parameters of the model
    fixModelSystem(req, res) {

        try {

            const { sessionId, system, parameters } = req.body;

            // system, parameters can be empty
            if (!sessionId) throw new Error('The sessionId is required');

            // just in case...
            this.modelSystem[sessionId] = system || '';
            this.parameters[sessionId] = parameters || {};

            // We check if sessionId exist then indicate the session has activity otherwise we throw an error
            if (sessionId in this.activity) this.activity[sessionId] = true;
            else throw new Error("Session activity record not found. Please initialize the agent first.");

            // If the sessionId is in the list of expired sessions, we do not allow it to continue
            if (this.expiredSessions.includes(sessionId)) throw new Error("Session has expired");

            // Set the model type to custom
            this.modelType[sessionId]='custom';

            // Adding the model system prompt
            this.modelSystem[sessionId] = system;

            // Set the model parameters
            this.parameters[sessionId] = parameters;

            // The conversation configuration in the database is updated to incorporate the new model changes
            
            








            // Respond to the HTTP client to close the request
            return res.status(200).json({ 
                success: true, 
                message: `Model fixed successfully.`
            });

        } catch (error) {
                
            // If a message is generated, we send the data along with a 500 error code, including the error and details.
            // We also set success to false. Since it is a 500 error, response.ok will be false.
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in Intelligence Agent Module Failed to fix the model',
                details: `${realDetail}`
            });

        }
    }    

    // Method that sends a message to the AI
    async sendMessage(req, res) {

        try {

            // We retrieve the conversation to which the message belongs
            const { sessionId, message, type, promptWrapper, model } = req.body;

            // model can be empty
            if (!sessionId)  throw new Error('The sessionId is required')
            if (!message || message.trim() == '')  throw new Error("The message cannot be empty");
            if (!type)  throw new Error("The type is required");
            if ((type === 'generate') && (! promptWrapper))  throw new Error("The promptWrapper is required")

            // We check if sessionId exist then indicate the session has activity otherwise we throw an error
            if (sessionId in this.activity) this.activity[sessionId] = true;
            else throw new Error("Session activity record not found. Please initialize the agent first.");

            // If the sessionId is in the list of expired sessions, we do not allow it to continue
            if (this.expiredSessions.includes(sessionId)) throw new Error("Session has expired");

            // Storing the model to be used for sending this message, by default the model assigned to the conversation
            let theModel = this.model[sessionId];

            // If the function has been called with a model specified, that model will be used but only for sending this message
            if (model != '') theModel = model;
            
            // Saves the history to the database and uses it in the conversation depending on the working mode
            switch (this.mode[sessionId]) {

                case 'SimpleNoDB' : 
                    this.history[sessionId] = [{ role: 'user', content: message }];
                    break;
                case 'NormalNoDB' :
                    if (!this.history[sessionId]) this.history[sessionId] = [];
                    this.history[sessionId].push({ role: 'user', content: message }); 
                    break;
                case 'SimpleDB' : 
                    // Messages are stored in the database, even if they are not used   => Ollama_Chat collection








                    this.history[sessionId] = [{ role: 'user', content: message }];
                    break;
                case 'Medium' :
                    // Messages are stored in a database, and an intermediate-level mechanism is applied to generate the history.   => Ollama_Chat collection
                    






                    break;
                case 'Advanced' :
                    // Messages are stored in a database, and an intermediate-level mechanism is applied to generate the history.   => Ollama_Chat collection
                    
                    
                    
               
                    

                    
                    break;
                default: 
                case 'NormalDB' :
                    // Here, the message needs to be saved to the database although it is not used  => Ollama_Chat collection








                    if (!this.history[sessionId]) this.history[sessionId] = [];
                    this.history[sessionId].push({ role: 'user', content: message }); 
                    break;
            }

            // Ollama doesnt exits
            if (!this.ollama) throw new Error("Ollama client is not initialized.");

            // Saving the response from the request to Ollama, whether via the chat method or the generate method
            let responseOllama = null;
            let textResponse = ""; 

            if (type === 'chat') {

                // If the operating mode is 'custom', the system prompt is injected.
                const systemPrompt = {
                    role: 'system',
                    content: this.modelSystem[sessionId]
                };

                // We add the systemPrompt as the first message if the model type is custom
                const areIdentical = (objA, objB) => {
                    if (!objA || !objB) return false;
                    const keysA = Object.keys(objA);
                    if (keysA.length !== Object.keys(objB).length) return false;
                    return keysA.every(key => objA[key] === objB[key]);
                };
                if (this.modelType[sessionId] === 'custom' && !areIdentical(this.history[sessionId][0], systemPrompt)) {
                    this.history[sessionId].unshift(systemPrompt);
                }

                // The request is made to ollama.chat
                responseOllama = await this.ollama.chat({
                    model: theModel,
                    ...this.parameters[sessionId],
                    messages: this.history[sessionId],
                    stream: false 
                });

                textResponse = responseOllama.message.content;

            } else if (type==='generate') {

                // The request is made to ollama.generate
                // In this case, since only one message is being sent, the systemPrompt goes into the system parameter.
                responseOllama = await this.ollama.generate({
                    model: theModel,
                    ...this.parameters[sessionId],
                    system : this.modelSystem[sessionId],
                    prompt: promptWrapper.replace('{{message}}', message), 
                    stream: false
                }); 

                textResponse = responseOllama.response.trim(); 
            }
            else  throw new Error("The type field is wrong");

            if (this.mode[sessionId] === 'NormalNoDB' || this.mode[sessionId] === 'NormalDB') { 
                this.history[sessionId].push({ role: 'assistant', content: textResponse }); 
            } 
            if (this.mode[sessionId] === 'SimpleDB' || this.mode[sessionId] === 'NormalDB' || this.mode[sessionId] === 'Medium' || this.mode[sessionId] === 'Advanced') {
                // The AI's response will also be stored in the database on those cases   => Ollama_Chat collection







            }

            // Respond to the HTTP client to close the request
            return res.status(200).json({ 
                success: true, 
                message: "Message sent successfully",
                history: this.history[sessionId],
                answer: textResponse
            });

        } catch (error) {

            // If a message is generated, we send the data along with a 500 error code, including the error and details.
            // We also set success to false. Since it is a 500 error, response.ok will be false.
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in Intelligence Agent Module Failed to send the message',
                details: `${realDetail}`
            });
        }
    }

    // Function that consults the expired session
    async expiredSessionConsult(req, res) {

        try {

            const { sessionId } = req.body;

            // Validation
            if (!sessionId) throw new Error('The sessionId is required')

            // If the sessionId is in the list of expired sessions, we return the message to show, it is not an error message 
            // it is a info message with status 'expired'
            if (this.expiredSessions.includes(sessionId)) {
                return res.status(200).json({ 
                    success: true,
                    status: 'expired', 
                    msg: "A lack of activity has been detected and the session has been closed; you must start over." 
                });
            }

            // If it is not expired we return the status active
            return res.status(200).json({ 
                success: true,
                msg : '',
                status: 'active' 
            });

        } catch (error) {

            // If a message is generated, we send the data along with a 500 error code, including the error and details.
            // We also set success to false. Since it is a 500 error, response.ok will be false.
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in Intelligence Agent Module during expired session consultation',
                details: `${realDetail}`
            });
        }
    }

    // Method that carries out the closure of requested sessions
    async closureNotify(req, res) {

         try {

            const { activeSessionIds } = req.body;

            if (!activeSessionIds) throw new Error('The Array activeSessionIds is required')

            // For each ID, we set its activity status to false and release the resources
            activeSessionIds.forEach( (sessionId) => {
                this.activity[sessionId] = false;
                this.#executeAction(sessionId);
            })

            return res.sendStatus(204); 

        } catch (error) {

            // If a message is generated, we send the data along with a 500 error code, including the error and details.
            // We also set success to false. Since it is a 500 error, response.ok will be false.
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in Intelligence Agent Module during closure notification process',
                details: `${realDetail}`
            });
        }
    }

}

module.exports = IAgentController;