const { response } = require('express');
const jwt = require('jsonwebtoken');
const db = require("../database");

function jwtDecoded(reqCookie) {
    // jwt decode
    const token = reqCookie;
    var id;
    jwt.verify(token, process.env.SECRET_STRING, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Failed to authenticate token' });
        }

        // The decoded payload is available in the 'decoded' object
        id = decoded.id;
    });
    return id;
}



exports.getHistory = async(req, res) => {
    // jwt
    id = jwtDecoded(req.cookies.jwt);

    const [rows] = await db.promise().query('SELECT * FROM uploads WHERE user_id = ?', [id]);
    if (rows.length) {
        const response = res.status(201).send({
            status: "Sukses",
            message: rows,
          });
        
        return response;
    } else{
        const response = res.status(201).send({
            status: "Sukses",
            message: "Belum ada history yang ditemukan!",
          });
        
        return response;
    }
}

exports.deleteHistory = async (req, res) => {
    try {
        const id = req.params.id;
        const [rows] = await db.promise().query(`SELECT * FROM uploads WHERE id = ?`, [id]);

        if (rows.length) {
            // The ID of your GCS bucket
            const bucketName = process.env.BUCKET_NAME;

            // The ID of your GCS file
            const raw_filename = `uploads/${rows[0].raw_filename}`;
            const processed_filename = `results/${rows[0].processed_filename}`;

            // Imports the Google Cloud client library
            const { Storage } = require('@google-cloud/storage');

            // Creates a client
            const storage = new Storage();

            // Delete raw file
            await storage.bucket(bucketName).file(raw_filename).delete();

            // Delete processed file
            await storage.bucket(bucketName).file(processed_filename).delete();

            // Delete Sql
            await db.promise().query(`DELETE FROM uploads WHERE id = ?`, [rows[0].id]);

            const response = res.status(201).send({
                status: "Sukses",
                message: "Files deleted successfully",
            });

            return response;
        } else {
            const response = res.status(404).send({
                status: "Gagal",
                message: "No history found with the given ID",
            });

            return response;
        }
    } catch (error) {
        console.error(error);
        const response = res.status(500).send({
            status: "Gagal",
            message: "Internal Server Error",
        });

        return response;
    }
};