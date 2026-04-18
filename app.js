const express = require("express");
const multer = require("multer");
const mysql = require("mysql2");
const QRCode = require("qrcode");
const path = require("path");

const app = express();

// ======================
// MIDDLEWARE
// ======================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ======================
// MULTER CONFIG
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
// BASE DE DATOS
// ======================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
  port: process.env.DB_PORT
});

db.connect((err) => {
  if (err) {
    console.error("❌ Error de conexión a BD:", err.message);
  } else {
    console.log("✅ Conectado a la base de datos");
  }
});
app.use(express.static(path.join(__dirname, "public")));
// ======================
// RUTA PRINCIPAL (SOLUCION A "Cannot GET /")
// ======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ======================
// SUBIR IMAGEN + QR
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
        return res.send("Error en base de datos");
      }

      const id = result.insertId;

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
// INICIO SERVIDOR
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor en puerto " + PORT);
});