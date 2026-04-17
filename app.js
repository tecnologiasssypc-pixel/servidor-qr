const express = require("express");
const multer = require("multer");
const mysql = require("mysql2");
const QRCode = require("qrcode");
const path = require("path");

const app = express();

// ======================
// CONFIGURACIÓN GENERAL
// ======================

// Servir imágenes
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================
// MULTER (SUBIDA DE ARCHIVOS)
// ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({ storage });

// ======================
// CONEXIÓN A BASE DE DATOS (PRODUCCIÓN)
// ======================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("Error de conexión a BD:", err);
  } else {
    console.log("Conectado a la base de datos");
  }
});

// ======================
// SUBIR IMAGEN Y GENERAR QR
// ======================
app.post("/subir", upload.single("imagen"), async (req, res) => {
  if (!req.file) {
    return res.send("No se subió ninguna imagen");
  }

  const ruta = req.file.path;

  db.query(
    "INSERT INTO imagenes (ruta) VALUES (?)",
    [ruta],
    async (err, result) => {
      if (err) {
        console.error(err);
        return res.send("Error en la base de datos");
      }

      const id = result.insertId;

      // URL pública (Render)
      const baseUrl = process.env.BASE_URL;
      const url = `${baseUrl}/ver?id=${id}`;

      try {
        const qr = await QRCode.toDataURL(url);

        res.send(`
          <h2>QR generado</h2>
          <img src="${qr}" />
          <p>${url}</p>
        `);
      } catch (error) {
        console.error(error);
        res.send("Error generando QR");
      }
    }
  );
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
        return res.send("Error en la consulta");
      }

      if (!result.length) {
        return res.send("No encontrada");
      }

      res.send(`
        <h2>Imagen</h2>
        <img src="/${result[0].ruta}" width="400">
      `);
    }
  );
});

// ======================
// INICIO DEL SERVIDOR (RENDER)
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor en puerto " + PORT);
});
