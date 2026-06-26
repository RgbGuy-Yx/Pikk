const axios = require('axios');
const FormData = require('form-data');

/**
 * Creates a client to communicate with the Python AI service.
 */
function createPythonServiceClient() {
  const baseURL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
  const timeout = Number(process.env.PYTHON_SERVICE_TIMEOUT_MS) || 30000;

  const client = axios.create({
    baseURL,
    timeout,
  });

  return {
    /**
     * Sends natural language text to the Python service for intent classification.
     * @param {string} text - The message from WhatsApp.
     * @param {string} [phone] - Customer phone for logging/context.
     * @returns {Promise<Object>} - The parsed intent result.
     */
    async parseIntent(text, phone) {
      try {
        const response = await client.post('/api/intent', { text, phone: phone || 'unknown' }, { timeout: 45000 });
        return response.data;
      } catch (error) {
        console.error('[pythonClient] parseIntent error:', error.response?.data || error.message);
        return { reply: 'Sorry, I had trouble processing that. Please try again.', intent: 'greeting', items: [], query: '' };
      }
    },

    /**
     * Sends binary audio buffer to the Python service for transcription.
     * @param {Buffer} audioBuffer - The audio buffer from Meta or mock.
     * @param {string} [filename] - The original filename.
     * @returns {Promise<Object>} - The transcription response { ok: boolean, transcript: string }.
     */
    async transcribeAudio(audioBuffer, filename) {
      const fname = filename || 'audio.ogg';
      const mimeType = fname.endsWith('.mp3') ? 'audio/mpeg' : 'audio/ogg';
      
      try {
        console.log(`[pythonClient] Transcribing audio: ${fname} (${audioBuffer.length} bytes, ${mimeType})`);
        
        const formData = new FormData();
        formData.append('file', audioBuffer, {
          filename: fname,
          contentType: mimeType,
        });

        const response = await client.post('/api/transcribe', formData, {
          headers: formData.getHeaders(),
          timeout: 30000,
        });

        console.log(`[pythonClient] Transcription response:`, response.data);
        return response.data;
      } catch (error) {
        const errMsg = error.response?.data?.detail || error.message;
        console.error('[pythonClient] transcribeAudio error:', errMsg);
        return { ok: false, transcript: '', error: errMsg };
      }
    },

    /**
     * Requests PDF invoice and UPI QR generation from the Python service.
     * @param {Object} invoicePayload - Order, customer, items, and payment data.
     * @returns {Promise<Object>} - Invoice asset URLs or an error object.
     */
    async generateInvoice(invoicePayload) {
      try {
        const response = await client.post('/generate-invoice', invoicePayload, {
          timeout: Number(process.env.PYTHON_INVOICE_TIMEOUT_MS) || 45000,
        });
        return response.data;
      } catch (error) {
        const errMsg = error.response?.data?.detail || error.message;
        console.error('[pythonClient] generateInvoice error:', errMsg);
        return { ok: false, error: errMsg };
      }
    }
  };
}

module.exports = {
  createPythonServiceClient,
};
