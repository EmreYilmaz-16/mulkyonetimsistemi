const app = require('./app');
const { pool } = require('./config/database');

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL bağlantısı başarılı');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API sunucusu http://0.0.0.0:${PORT}/api/v1 adresinde çalışıyor`);
    });
  } catch (err) {
    console.error('❌ Başlatma hatası:', err.message);
    process.exit(1);
  }
};

start();
