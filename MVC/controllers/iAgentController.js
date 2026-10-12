class IAgentController {

    // Working modes...
    // NormalDB -> Using conversation history with DB
    // NormalNoDB -> Using conversation history without DB
    // SimpleDB -> Without using conversation history with DB
    // SimpleNoDB -> Without using conversation history without DB
    // Medium -> Using conversation with medium algorithm difficulty with DB
    // Advanced -> Using conversation with medium algorithm difficulty with DB

    constructor(model) {
        
        // The model is defined in IAgentRoutes and passed to the constructor.
        // since it depends exclusively on the machine where the intelligence agent is running
        this.model=model;

        // Access the message history of a conversation to pass it on to the AI.
        this.history = {};

        // The mode is stored for each of the conversation IDs.
        // It is defined every time a new conversation is created.
        this.mode = {};

        // Ensure that the 'this' keyword retains its context (referring to the current class)
        // when those functions are executed as callbacks or event handlers.
        this.sendMessage = this.sendMessage.bind(this);
        this.initAgent = this.initAgent.bind(this);
    }
    

    // Method that sends a message to the AI
    async sendMessage(req, res) {

        try {

            // We retrieve the conversation to which the message belongs
            const { sessionId, message } = req.body;

            if (!message) return res.status(400).json({ error: 'The message cannot be empty.' });
            
            // The function saves the history to the database and uses it in the conversation.
            switch (this.mode[sessionId]) {
                case 'SimpleNoDB' : 
                    this.history[sessionId] = [{ role: 'user', content: message }];
                    break;
                case 'NormalNoDB' :
                    if (!this.history[sessionId]) this.history[sessionId] = [];
                    this.history[sessionId].push({ role: 'user', content: message }); 
                    break;
                case 'SimpleDB' : 
                    // Se almacena los mensajes en base de datos aunque no se haga uso de ellos
                    this.history[sessionId] = [{ role: 'user', content: message }];
                    break;
                case 'Medium' :
                    // Se almacena los mensajes en base de datos y se aplica un mecanismo de nivel medio para generar el historial
                    break;
                case 'Advanced' :
                    // Se almacena los mensajes en base de datos y se aplica un mecanismo de nivel avanzado para generar el historial
                    break;
                default: 
                case 'NormalDB' :
                    // Here, the message needs to be saved to the database aunque no se hace uso de ello
                    if (!this.history[sessionId]) this.history[sessionId] = [];
                    this.history[sessionId].push({ role: 'user', content: message }); 
                    break;
            }
        
            const { default: ollama } = await import('ollama');

            const respuestaOllama = await ollama.chat({
                model: this.model,
                messages: this.history[sessionId],
                stream: false
            });

            if (this.mode[sessionId] === 'NormalNoDB' || this.mode[sessionId] === 'NormalDB')  this.history[sessionId].push({ role: 'assistant', content: respuestaOllama.message.content }); 
            if (this.mode[sessionId] === 'SimpleDB' || this.mode[sessionId] === 'NormalDB' || this.mode[sessionId] === 'Medium' || this.mode[sessionId] === 'Advanced') {
                // Se almacenara en base de datos la respuesta de la IA
            }

            return res.json({ answer: respuestaOllama.message.content });

        } catch (error) {
            console.error("--- ERROR IN SENDMESSAGE BACKEND OLLAMA ---", error); 
            return res.status(500).json({ error: error.message });
        }
    }

    // Method that initializes the AI ​​Agent for a conversation
    async initAgent (req, res) {
        try {

            // Defines the AI's operating mode for that specific conversation.
            // Receive the conversation identifier and mode
            const { sessionId, mode } = req.body;

            // The mode is added to the array of modes for the class corresponding to the conversation ID.
            this.mode[sessionId] = mode;

            // Returns an indication that initialization has been performed.
            return res.status(200).json({ 
                success: true, 
                message: "Agent initialized successfully" 
            });

        } catch (error) {
            console.error("--- ERROR IN INITAGEN BACKEND OLLAMA ---", error); 
            return res.status(500).json({ error: error.message });
        }
    }
}

module.exports = IAgentController;