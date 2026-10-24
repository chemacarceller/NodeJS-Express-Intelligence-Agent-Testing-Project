const IAgentService = require('../services/iAgentService');

// Obtaining the IP and port data where Ollama is running
const host = process.env.HOST_OLLAMA || '127.0.0.1';
const port = process.env.PORT_OLLAMA || '11434';

// Determining the default model assigned to this intelligence agent
const default_model = process.env.DEFAULT_MODEL || 'llama3.2:latest';

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

        // Ensure that the 'this' keyword retains its context (referring to the current class)
        // when those functions are executed as callbacks or event handlers.
        this.sendMessage = this.sendMessage.bind(this);
        this.initAgent = this.initAgent.bind(this);
        this.createCustomModel = this.createCustomModel.bind(this);
        this.fixModelSystem = this.fixModelSystem.bind(this);
    }
    
    // Method that sends a message to the AI
    async sendMessage(req, res) {

        try {

            // We retrieve the conversation to which the message belongs
            const { sessionId, message, type, promptWrapper, model } = req.body;

            if (!sessionId) return res.status(500).json({ success: false, error:  "The sessionId is required" });
            if (!message)   return res.status(500).json({ success: true, message: "The message cannot be empty" });
            if (!type)      return res.status(500).json({ success: true, message: "The type is required" });
            if ((type === 'generate') && (! promptWrapper)) return res.status(500).json({ success: true, message: "The promptWrapper is required" });

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

            // Saving the response from the request to Ollama, whether via the chat method or the generate method
            let respuestaOllama = null;

            if (type === 'chat') {

                // If the operating mode is 'custom', the system prompt is injected.
                const systemPrompt = {
                    role: 'system',
                    content: this.modelSystem[sessionId]
                };

                // We add the systemPrompt as the first message if the model type is custom
                if ((this.modelType[sessionId] === 'custom') && (this.history[sessionId][0] != systemPrompt)) this.history[sessionId].unshift(systemPrompt);

                // The request is made to ollama.chat
                respuestaOllama = await this.ollama.chat({
                    model: theModel,
                    ...this.parameters[sessionId],
                    messages: this.history[sessionId],
                    stream: false 
                });

            } else if (type==='generate') {

                // The request is made to ollama.generate
                // In this case, since only one message is being sent, the systemPrompt goes into the system parameter.
                respuestaOllama = await this.ollama.generate({
                    model: theModel,
                    ...this.parameters[sessionId],
                    system : this.modelSystem[sessionId],
                    prompt: promptWrapper.replace('{{message}}', this.history[sessionId][0].content), 
                    stream: false
                }); 
            }
            else return res.status(500).json({ success: false, error:  "The type field is wrong" });

            if (this.mode[sessionId] === 'NormalNoDB' || this.mode[sessionId] === 'NormalDB')  this.history[sessionId].push({ role: 'assistant', content: respuestaOllama.message.content }); 
            if (this.mode[sessionId] === 'SimpleDB' || this.mode[sessionId] === 'NormalDB' || this.mode[sessionId] === 'Medium' || this.mode[sessionId] === 'Advanced') {
                // The AI's response will also be stored in the database on those cases   => Ollama_Chat collection







            }

            if ( type === 'chat' ) {

                // Respond to the HTTP client to close the request
                return res.status(200).json({ 
                    success: true, 
                    message: "Message sent successfully : " +  this.history[sessionId],
                    answer: respuestaOllama.message.content
                });
            }
            else if ( type==='generate' ) {

                // Respond to the HTTP client to close the request
                return res.status(200).json({ 
                    success: true, 
                    message: "Message sent successfully : " +  this.history[sessionId],
                    answer: respuestaOllama.response.trim() 
                });
            }

        } catch (error) {

            // Respond to the client in the event of an error
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in IAgent Failed to send the message',
                details: `Ollama error: ${realDetail}` 
            });
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
            const { sessionId, mode } = req.body;

            if (!sessionId) return res.status(500).json({ success: false, error:  "The sessionId is required" });
            if (!mode)      return res.status(500).json({ success: false, error:  "The mode is required" });

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
            





            



            // Respond to the HTTP client to close the request
            if (this.ollama == null) return res.status(500).json({ success: false, error: 'An object pointing to ollama is required' });
            else return res.status(200).json({ 
                    success: true, 
                    message: "Agent initialized successfully"
            });

        } catch (error) {

            // Respond to the client in the event of an error
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in IAgent Failed to initialize the agent',
                details: `Ollama error: ${realDetail}` 
            });
        }
    }

    // Function that creates or updates a custom model
    async createCustomModel(req, res) {

        try {

            const { sessionId, modelName, from, system, parameters } = req.body;

            if (!sessionId) return res.status(500).json({ success: false, error: 'The sessionId is required' });
            if (!modelName) return res.status(500).json({ success: false, error: 'The modelName is required' });

            // If the model is not specified, the default model is used
            let fromModel = from === '' ? default_model : from;

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
                message: `Model ${modelName} created successfully.`
            });

        } catch (error) {
        
            // Respond to the client in the event of an error
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in IAgent Failed to create the custom model',
                details: `Ollama error: ${realDetail}` 
            });
        }
    }

    // Function that sets the system propmpt and parameters of the model
    async fixModelSystem(req, res) {

        try {

            const { sessionId, system, parameters } = req.body;

            if (!sessionId) return res.status(500).json({ success: false, error: "The sessionId is required" });

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
                message: `Model ${this.model[sessionId]} fixed successfully.`
            });

        } catch (error) {
                
            // Respond to the client in the event of an error
            const realDetail = error.cause ? error.cause.message : error.message;

            return res.status(500).json({
                success: false,
                error: 'Error in IAgent Failed to fix the model',
                details: `Ollama error: ${realDetail}` 
            });

        }
    }
}

module.exports = IAgentController;