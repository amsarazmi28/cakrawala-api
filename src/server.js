const express = require("express");
const routes = require("./routes");
const cookieParser = require("cookie-parser");


const app = express();
const PORT = 8080;

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({
  extended: true,
}));

// Routes
app.use(routes);

app.listen(PORT, () => {
  console.log(`Server running on port: http://localhost:${PORT}/`);
});


// Tugas kita selanjutnya:
// file upload file dan text jadi satu aja
// store string ke sql langsung atau dibuat jadi file terus taruh di storage
// sql tetep jadi nambah table upload -> id, user id, text, bucket link, result
// upload file udah done, tinggal bikin api buat proses file ke cloud vision