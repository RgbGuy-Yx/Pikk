const axios = require('axios');

/**
 * Creates a client to communicate with the Python AI service.
 */
function createPythonServiceClient() {
  const client = axios.create({
    baseURL: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
    timeout: Number(process.env.PYTHON_SERVICE_TIMEOUT_MS) || 10000,
  });

  return {
    /**
     * Sends natural language text to the Python service for parsing.
     * @param {string} text - The message from WhatsApp.
     * @returns {Promise<Object>} - The parsed order or non_order intent.
     */
    async parseOrder(text) {
      try {
        const response = await client.post('/api/parse-order', { text });
        return response.data;
      } catch (error) {
        // Log the error for the developer
        console.error('Python Service Error [parseOrder]:', error.response?.data || error.message);
        
        // Return a safe fallback to keep the Node.js service running
        return { intent: 'non_order', items: [] };
      }
    }
  };
}

module.exports = {
  createPythonServiceClient,
};
