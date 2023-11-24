const express = require("express");
const { requireAuthMember } = require("./middlewares")

const { signupPost, login, logout } = require("./api/auth");
const { upload } = require("./api/uploadFile");
const { uploadText } = require("./api/uploadText");

const routes = express.Router();

routes.post("/register", signupPost);
routes.post("/login", login);
routes.post("/logout", logout);

routes.post("/upload", upload);
routes.post("/uploadText", requireAuthMember, uploadText);
// routes.post("/uploadText", requireAuthMember);

module.exports = routes;
