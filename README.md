# 🎬 TikTok & X to WhatsApp Sticker Studio

Convierte videos/fotos de **TikTok** y **X (Twitter)** en **stickers animados oficiales para WhatsApp** (< 500 KB) y **extrae stickers de comentarios de TikTok**.

---

## ⚡ Características

- 🎥 **Videos a Sticker:** Convierte clips de TikTok y X recortando el tramo deseado con un reproductor interactivo.
- 🎭 **Extractor de Stickers de Comentarios:** Escanea cualquier publicación de TikTok y descarga todos los stickers compartidos en comentarios (.awebp, webp, gif) individualmente o en pack `.ZIP`.
- 📲 **Entrega Directa a WhatsApp:** Conexión segura con tu propio WhatsApp para recibir los stickers generados de inmediato.
- 🤖 **Modo Bot Automático:** Envíate cualquier enlace de TikTok o X a tu propio chat de WhatsApp y recibirás el sticker listo en 5 segundos.
- 📦 **Optimización Automática:** Formato oficial WebP 512x512 y compresión inteligente estricta (< 500 KB) para que WhatsApp nunca lo rechace.

---

## 📋 Requisitos Previos

- [Node.js](https://nodejs.org/) (v18 o superior)
- [FFmpeg](https://ffmpeg.org/download.html) y [yt-dlp](https://github.com/yt-dlp/yt-dlp) instalados en tu sistema.  
  *(En Windows puedes instalarlos con: `winget install Gyan.FFmpeg` y `winget install yt-dlp`)*

---

## 🚀 Instalación y Uso Rápido

1. **Clonar este repositorio:**
   ```bash
   git clone <URL_DE_TU_REPOSITORIO>
   cd "tiktok-x-to-whatsapp-stickers"
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar la aplicación:**
   ```bash
   npm start
   ```
   *(En Windows también puedes hacer doble clic en `Iniciar_Programa.bat`)*

4. Abre tu navegador en:
   👉 **`http://localhost:3000`**

---

## 🛠️ Modos de Uso

| Modo | Descripción |
| :--- | :--- |
| **Interfaz Web** | Abre `http://localhost:3000`, pega tu enlace, recorta el tramo del video o extrae stickers de comentarios con 1 clic. |
| **Bot en WhatsApp** | Con la app iniciada, mándate cualquier enlace a tu chat personal de WhatsApp y te responderá con el sticker. |
| **Terminal / CLI** | Ejecuta `npm run cli` o haz doble clic en `Convertir_Sticker_Rapido.bat`. |

---

## 📄 Licencia

MIT