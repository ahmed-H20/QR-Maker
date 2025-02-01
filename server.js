
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const qr = require("qrcode");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = "https://q3.up.railway.app/";

app.use(cors());

// Create Folder to save QR images
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Create Database
const db = new sqlite3.Database("./urls.db", (err) => {
    if (err) {
        console.error("❌ Error opening database:", err.message);
    } else {
        console.log("✅ Database connected.");
        db.run(`CREATE TABLE IF NOT EXISTS urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original TEXT NOT NULL,
            short TEXT NOT NULL UNIQUE,
            qrPath TEXT
        )`);
    }
});

app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.post("/shorten", (req, res) => {
    const { original, short } = req.body;
    if (!original || !short) {
        return res.status(400).json({ error: "❌ يجب إدخال الرابط الأصلي والمختصر." });
    }
    
    // const shortUrl = `https://q3.up.railway.app/${short}`;
    // const qrFilename = `${short.split('/').pop()}.png`;
    // const qrPath = path.join(uploadDir, qrFilename);

    const shortUrl = `${BASE_URL}/${short.split('/').pop()}`;
    const qrFilename = `${short.split('/').pop()}.png`;
    const qrPath = path.join(uploadDir, qrFilename);

    // Create QR
    qr.toFile(qrPath, short, { errorCorrectionLevel: "H" }, (err) => {
        if (err) {
            console.error("❌ Error generating QR Code:", err);
            return res.status(500).json({ error: "❌  حدث خطأ أثناء إنشاء QR Code." });
        }

        db.run("INSERT INTO urls (original, short, qrPath) VALUES (?, ?, ?)", 
            [original, short, `/uploads/${qrFilename}`], (err) => {
            if (err) {
                console.error("❌ Error inserting into database:", err);
                return res.status(500).json({ error: "❌ حدث خطأ أثناء حفظ البيانات." });
            }

            res.json({ 
                message: "✅ الرابط المختصر تم إنشاؤه بنجاح!", 
                original, 
                short: shortUrl, 
                qr: `/uploads/${qrFilename}` 
            });
            console.log(res)
        });
    });
});

// Get All urls
app.get("/urls", (req, res) => {
    db.all("SELECT * FROM urls", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "❌ حدث خطأ أثناء جلب البيانات." });
        }

        rows = rows.map(row => ({
            ...row,
            short: `${BASE_URL}${row.short}`
        }));

        res.json(rows);
    });
});

// Redirect fake url to Original Url 
app.get("/:short", (req, res) => {
    const short = req.params.short;
    db.get("SELECT original FROM urls WHERE short = ?", [short], (err, row) => {
        if (err || !row) {
            return res.status(404).send("❌ الرابط غير موجود.");
        }
        res.redirect(row.original);
    });
});


// app.get("/:reshort", (req, res) => {
//     const short = req.params.short;
//     db.get("SELECT original FROM urls WHERE short = ?", [short], (err, row) => {
//         if (err || !row) {
//             return res.status(404).send("❌ الرابط غير موجود.");
//         }
//         res.send(row.original); // إرجاع الرابط كنص بدلاً من التوجيه
//     });
// });

app.listen(PORT, () => console.log(`🚀 Server running on ${BASE_URL}`));
