// const { nanoid } = require('nanoid');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const db = require("../database");
require("dotenv").config();

//* Create Token
const maxExpire = 3 * 24 * 60 * 60;
const createToken = (id) =>
  jwt.sign({ id }, process.env.SECRET_STRING, {
    expiresIn: maxExpire,
  });

//* Register
exports.signupPost = async (req, res) => {
  const { email, password } = req.body;

  // const id = nanoid(16);

  if (!email || !password) {
    const response = res.send({
      status: "Gagal",
      message: "Semua ketentuan wajib diisi!",
    });
    response.status(400);
    return response;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(req.body.email)) {
    return res.status(400).json({ error: "Alamat email tidak valid" });
  }

  if (password.length < 6) {
    const response = res.send({
      status: "Gagal",
      message: "Panjang password harus 6 karakter atau lebih!",
    });
    response.status(400);
    return response;
  }

  const [rows] = await db.promise().query(`SELECT * FROM users WHERE email = '${req.body.email}'`);
  if (rows.length !== 0) {
    return res.status(500).json({ message: "User with that email is already exist" });
  }

  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(password, salt);

  await db.promise().query(`INSERT INTO users (email, password) VALUES('${email}', '${hashedPassword}')`);

  const response = res.send({
    status: "Sukses",
    message: "User baru berhasil ditambahkan.",
  });
  response.status(201);
  return response;
};

//* Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    const response = res.send({
      status: "Gagal",
      message: "Semua ketentuan wajib diisi!",
    });
    response.status(400);
    return response;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(req.body.email)) {
    return res.status(400).json({ error: "Alamat email tidak valid" });
  }

  if (email.length < 6) {
    const response = res.send({
      status: "Gagal",
      message: "Panjang email harus 6 karakter atau lebih!",
    });
    response.status(400);
    return response;
  }

  if (password.length < 6) {
    const response = res.send({
      status: "Gagal",
      message: "Panjang password harus 6 karakter atau lebih!",
    });
    response.status(400);
    return response;
  }

  const [rows] = await db.promise().query(`SELECT * FROM users WHERE email = '${req.body.email}'`);
  if (rows.length !== 0) {
    const auth = bcrypt.compare(password, rows[0].password);
    if (auth) {
      const token = createToken(rows[0].id);
      res.cookie("jwt", token, { httpOnly: false, maxAge: maxExpire * 1000 });
      const response = res.status(200).json({
        message: "Logged in!",
        user_id: rows[0].id,
        token: token,
      });
      return response;
    }
    const response = res.status(404).json({ message: "Password salah!" });
    return response;
  }
  const response = res.status(404).json({ message: "Email tidak ditemukan!" });
  return response;
};

//* Logout
exports.logout = (req, res) => {
  res.cookie("jwt", "", { maxAge: 1 });
  const response = res.status(200).json({ message: "Logout sukses!" });
  return response;
};
