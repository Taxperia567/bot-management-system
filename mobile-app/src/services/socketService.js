import io from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3001'; // Gerçek IP adresi ile değiştirilecek

export const initializeSocket = (accessKey) => {
  const socket = io(API_BASE_URL, {
    query: { accessKey }
  });

  socket.on('connect', () => {
    console.log('Socket bağlantısı kuruldu');
    socket.emit('register', { type: 'mobile', accessKey });
  });

  socket.on('disconnect', () => {
    console.log('Socket bağlantısı kesildi');
  });

  socket.on('error', (error) => {
    console.error('Socket hatası:', error);
  });

  return socket;
};