const express = require("express");

const { signupPost, login, logout } = require("./handler");

const routes = express.Router();

routes.post("/register", signupPost);
routes.post("/login", login);
routes.post("/logout", logout);
// routes.get("/", hello);

// routes.get('/', (req, res) => {
//     res.send('Hello World!');
// })

module.exports = routes;
