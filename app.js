require("dotenv").config();

const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const QRCode = require("qrcode");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");

const app = express();

// ======================
// CLOUDINARY
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
app.use(express.static(path.join(__dirname, "public")));

// ======================
// MULTER
// ======================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ======================
// NEON (POSTGRES)
// ======================


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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
    const { identificador } = req.body;

    if (!req.file || !identificador) {
      return res.status(400).send("Faltan datos");
    }

    // Subir a Cloudinary
    const subida = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          public_id: identificador,
          folder: "qr-app"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    const urlImagen = subida.secure_url;

    // Guardar en Neon
    await pool.query(
      "INSERT INTO imagenes (identificador, url) VALUES ($1, $2)",
      [identificador, urlImagen]
    );

    // Generar QR
    const qrLink = `${process.env.BASE_URL}/img/${identificador}`;
    const qr = await QRCode.toDataURL(qrLink);

    res.json({
      mensaje: "OK",
      qr: qr
    });

  } catch (err) {
    console.error(err);

    // Manejo de duplicados
    if (err.code === "23505") {
      return res.status(400).send("El identificador ya existe");
    }

    res.status(500).send("Error del servidor");
  }
});

// ======================
// MOSTRAR IMAGEN
// ======================
app.get("/img/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT url FROM imagenes WHERE identificador = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.send("Imagen no encontrada");
    }

    res.redirect(result.rows[0].url);

  } catch (err) {
    res.status(500).send("Error");
  }
});

// ======================
app.listen(3000, () => console.log("Servidor activo en puerto 3000"));