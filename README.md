<div align="center">

  <!-- Animated Header Banner -->
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,20,35,50&height=220&section=header&text=RAREANIMES%20API&fontSize=50&fontAlignY=38&animation=twinkling&desc=High-Speed%20REST%20API%20%26%20Stream%20Embed%20Unwrapper&descFontSize=20&descAlignY=62" width="100%" alt="RareAnimes API Header" />

  <!-- Animated Typing SVG -->
  <a href="https://github.com/ChavdaSujal">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&duration=3000&pause=1000&color=38BDF8&center=true&vCenter=true&width=650&lines=⚡+RareAnimes+Unofficial+REST+API;🚀+100%25+Sevalla%2C+Vercel+%26+Heroku+Ready;🎬+Direct+Razorshell+Embed+Stream+Unwrapper;👨‍💻+Developed+by+Sujal+Chavda+(@ChavdaSujal);📢+Join+Telegram+Channel+@Techwithmee" alt="Typing SVG" />
  </a>

  <br/><br/>

  <!-- Badges Row 1 -->
  <p>
    <a href="https://app.sevalla.com">
      <img src="https://img.shields.io/badge/Sevalla-Deploy%20Ready-6366F1?style=for-the-badge&logo=cloud&logoColor=white" alt="Sevalla" />
    </a>
    <a href="https://vercel.com">
      <img src="https://img.shields.io/badge/Vercel-Deploy%20Ready-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
    </a>
    <a href="https://t.me/Techwithmee">
      <img src="https://img.shields.io/badge/Telegram-@Techwithmee-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram Channel" />
    </a>
    <a href="https://github.com/ChavdaSujal">
      <img src="https://img.shields.io/badge/Developer-Sujal%20Chavda-blueviolet?style=for-the-badge&logo=github&logoColor=white" alt="Developer" />
    </a>
  </p>

</div>

---

## ⚡ Features

- 🚀 **100% Sevalla Ready**: Instant one-click deployment via **Dockerfile** or **Buildpacks**.
- ☁️ **Vercel & Heroku Compatible**: Multi-platform zero-config support.
- ⚡ **Ultra-Fast In-Memory Cache**: 2ms sub-millisecond responses.
- 🔓 **Zipper Embed Unwrapper**: Resolves protected zipper tokens to direct playable iframe stream links (`argon.razorshell.space`).
- 🌐 **Proxy Support**: Optional auto-rotation via `PROXY_LIST` for datacenter bypass.
- 🔎 **Full Search & Pagination**: Query any anime with dynamic pagination.

---

## 🚀 How to Deploy on Sevalla (app.sevalla.com)

1. Log in to [app.sevalla.com](https://app.sevalla.com/).
2. Click **Create** ➡️ **Application**.
3. Connect your GitHub account and select your repository: `rareanimes-api`.
4. Choose your deployment configuration:
   - **Build Strategy**: Select **Dockerfile** (or **Buildpacks** `heroku/builder:24` / `Node.js`).
   - **Branch**: `main`
   - **Port**: `3000` (auto-detected).
5. (Optional) In **Environment Variables**, you can add:
   - `PORT=3000`
   - `PROXY_LIST=...` (optional proxy rotation)
6. Click **Deploy Now**! 
Your API will be live instantly with a free SSL domain!

---

## 📡 API Endpoints

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/` or `/health` | `GET` | Health check & platform status |
| `/api/home?page=1` | `GET` | Home anime catalog with pagination |
| `/api/search?q=naruto&page=1` | `GET` | Search anime by keyword |
| `/api/anime/:slug` | `GET` | Anime details with auto-resolved stream embeds |
| `/api/unwrap?url=...` | `GET/POST` | Direct zipper token to stream link resolver |

---

## 👨‍💻 Author

- **Developer**: Sujal Chavda ([@ChavdaSujal](https://github.com/ChavdaSujal))
- **Telegram**: [@Techwithmee](https://t.me/Techwithmee)
- **License**: MIT
