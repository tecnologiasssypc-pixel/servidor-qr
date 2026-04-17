const express = require("express");
const multer = require("multer");
const mysql = require("mysql2");
const QRCode = require("qrcode");

const app = express();

// Servir imágenes
app.use("/uploads", express.static("uploads"));

// Config subida
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + ".jpg");
  }
});

const upload = multer({ storage });

// Conexión BD
const db = mysql.createConnection({
  host: "localhost",
  user: "appuser",
  password: "TorreMorelos2026*",
  database: "qr_app"
});

// Subir imagen y generar QR
app.post("/subir", upload.single("imagen"), async (req, res) => {
  const ruta = req.file.path;

  db.query("INSERT INTO imagenes (ruta) VALUES (?)", [ruta], async (err, result) => {
    const id = result.insertId;

    const url = `http://192.168.1.100:3000/ver?id=${id}`;

    const qr = await QRCode.toDataURL(url);

    res.send(`
      <h2>QR generado</h2>
      <img src="${qr}">
      <p>${url}</p>
    `);
  });
});

// Ver imagen
app.get("/ver", (req, res) => {
  const id = req.query.id;

  db.query("SELECT * FROM imagenes WHERE id = ?", [id], (err, result) => {
    if (!result.length) return res.send("No encontrada");

    res.send(`<img src="/${result[0].ruta}" width="400">`);
  });
});

app.listen(3000, () => console.log("Servidor en puerto 3000"));
