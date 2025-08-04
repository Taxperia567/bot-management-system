import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://localhost:3001/api'; // Gerçek IP adresi ile değiştirilecek

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const accessKey = await SecureStore.getItemAsync('accessKey');
        if (accessKey) {
          config.headers.Authorization = `Bearer ${accessKey}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token geçersiz, logout yap
          this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  async verifyKey(accessKey) {
    try {
      const response = await this.client.post('/auth/verify-key', { accessKey });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getBots() {
    try {
      const response = await this.client.get('/bots');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getBotDetail(botId) {
    try {
      const response = await this.client.get(`/bot/${botId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async controlBot(botId, action) {
    try {
      const response = await this.client.post(`/bot/${botId}/control`, {
        action,
        source: 'mobile'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateBotFiles(botId, files) {
    try {
      const response = await this.client.post(`/bot/${botId}/files`, { files });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    await SecureStore.deleteItemAsync('accessKey');
  }
}

export default new ApiService();