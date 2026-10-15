import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // lets phones on the same Wi-Fi open the app
    proxy: { '/api': 'http://localhost:5000' },
  },
});