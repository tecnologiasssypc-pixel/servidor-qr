require("dotenv").config();

const express = require("express");
const multer = require("multer");
const mysql = require("mysql2");
const QRCode = require("qrcode");
const path = require("path");

// Cloudinary
const { v2: cloudinary } = require("cloudinary");

const app = express();

// ======================
// CONFIG CLOUDINARY
// ======================
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

// ======================
// MIDDLEWARE
// ======================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir carpeta public
app.use(express.static(path.join(__dirname, "public")));

// ======================
// MULTER (MEMORIA, NO DISCO)
// ======================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ======================
// BASE DE DATOS
// ======================
const db = mysql.createConnection(process.env.MYSQL_PUBLIC_URL);

db.connect((err) => {
  if (err) {
    console.error("❌ Error de conexión a BD:", err);
  } else {
    console.log("✅ Conectado a la base de datos");
  }
});

// ======================
// RUTA PRINCIPAL
// ======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ======================
// SUBIR IMAGEN + QR
// ======================
app.post("/subir", upload.single("imagen"), async (req, res) => {
  try {
    if (!req.file) {
      return res.send("No se subió ninguna imagen");
    }

    // Subir a Cloudinary
    const subida = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "qr-app" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    const urlImagen = subida.secure_url;

    // Guardar en BD
    db.query(
      "INSERT INTO imagenes (ruta) VALUES (?)",
      [urlImagen],
      async (err, result) => {
        if (err) {
          console.error("Error BD:", err);
          return res.send("Error en base de datos");
        }

        const id = result.insertId;

        const baseUrl = process.env.BASE_URL || "http://localhost:3000";
        const url = `${baseUrl}/ver?id=${id}`;

        const qr = await QRCode.toDataURL(url);

        res.send(`
          <h2>QR generado</h2>
          <img src="${qr}" />
          <p>${url}</p>
        `);
      }
    );
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// ======================
// VER IMAGEN
// ======================
app.get("/ver", (req, res) => {
  const id = req.query.id;

  db.query(
    "SELECT * FROM imagenes WHERE id = ?",
    [id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.send("Error en la consulta");
      }

      if (!result.length) {
        return res.send("No encontrada");
      }

      res.send(`
        <h2>Imagen</h2>
        <img src="${result[0].ruta}" width="400">
      `);
    }
  );
});

// ======================
// SERVIDOR
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor en puerto " + PORT);
});