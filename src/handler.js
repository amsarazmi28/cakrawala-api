const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');

exports.signupPost = async (req, res) => {
    const {
        email,
        password
    } = req.body;

    const id = nanoid(16);

    if (email === '') {
        const response = res.send({
            status: 'Gagal',
            message: 'Silahkan isi email terlebih dahulu',
        });
        response.status(400);
        return response;
    }

    if (password === '') {
        const response = res.send({
            status: 'Gagal',
            message: 'Silahkan isi password terlebih dahulu',
        });
        response.status(400);
        return response;
    }
}