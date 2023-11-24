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


// tugas kita selanjutnya