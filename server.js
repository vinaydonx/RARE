/**
 * Server Runner for RareAnimes API
 * Compatible with Sevalla, Vercel, Heroku, Docker & Local
 */
const app = require('./api/index');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`================================================================`);
  console.log(`⚡ RareAnimes High-Speed API (Sevalla, Vercel & Heroku Ready)`);
  console.log(`👨‍💻 Developed by Sujal Chavda (@ChavdaSujal)`);
  console.log(`🌐 Base URL:       http://${HOST}:${PORT}`);
  console.log(`📄 Home Page:      http://${HOST}:${PORT}/api/home?page=1`);
  console.log(`🔍 Search:         http://${HOST}:${PORT}/api/search?q=naruto`);
  console.log(`🎬 Anime Details:  http://${HOST}:${PORT}/api/anime/tomb-raider-king-season-1-hindi-dubbed-episodes-download-hd`);
  console.log(`🔓 Zipper Unwrap:  http://${HOST}:${PORT}/api/unwrap?url=...`);
  console.log(`================================================================`);
});
