const express = require("express");
const { requireAuthMember } = require("./middlewares");

const { signupPost, login, logout, sendVerificationEmail, forgotPassword } = require("./api/auth");
const { upload } = require("./api/uploadFile");
const { uploadText } = require("./api/uploadText");

const routes = express.Router();

routes.post("/register", signupPost);
routes.post("/login", login);
routes.post("/logout", logout);

// Email verification route
routes.post('/verify-email', sendVerificationEmail);

// Forgot password route
routes.post('/forgot-password', forgotPassword);

routes.post("/upload", requireAuthMember, upload);
routes.post("/uploadText", requireAuthMember, uploadText);
// routes.post("/uploadText", requireAuthMember);

module.exports = routes;
