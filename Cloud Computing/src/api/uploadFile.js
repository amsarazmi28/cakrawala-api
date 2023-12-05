const { Storage } = require("@google-cloud/storage");
const util = require("util");
const { format } = require("util");
const Multer = require("multer");
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const storage = new Storage({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
const bucket = storage.bucket(process.env.BUCKET_NAME);
const vision = require("@google-cloud/vision").v1;
const client = new vision.ImageAnnotatorClient();
// db
const db = require("../database");
require("dotenv").config();

// jwt
const jwt = require('jsonwebtoken');

const maxSize = 2 * 1024 * 1024;

const multerInstance = Multer({
  storage: Multer.memoryStorage(),
  limits: { fileSize: maxSize },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["text/plain", "image/jpeg", "image/png", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error("Tipe file yang diperbolehkan hanya document dan image!"));
    }

    cb(null, true);
  },
});

const processFile = multerInstance.single("file");
const processFileMiddleware = util.promisify(processFile);

// Function to generate a unique filename
function generateUniqueFileName(originalname) {
  const timestamp = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, "");
  const uniqueName = `${timestamp}_${originalname}`;
  return uniqueName;
}

// function decoded
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

function splitParagraf(paragraf) {
  // Mengganti semua \n dengan spasi
  paragraf = paragraf.replace(/\n/g, ' ');

  // Membagi paragraf menjadi kalimat-kalimat menggunakan regex
  var kalimatArray = paragraf.split(/[.!?]/);

  // Membersihkan array dari elemen yang kosong
  kalimatArray = kalimatArray.filter(function (kalimat) {
    return kalimat.trim() !== '';
  });

  return kalimatArray;
}

exports.upload = async (req, res) => {
  try {
    await processFileMiddleware(req, res);
    
    // jwt
    id = jwtDecoded(req.cookies.jwt);
    
    if (!req.file) {
      return res.status(400).send({ message: "Please upload a file!" });
    }

    const fileName = generateUniqueFileName(req.file.originalname);
    const folderUpload = "uploads";
    const outputPrefix = "results";
    const blob = bucket.file(`${folderUpload}/${fileName}`);
    const imagePath = path.join(folderUpload, fileName);

    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream.on("error", (err) => {
      res.status(500).send({ message: err.message });
    });


    blobStream.on("finish", async () => {

      if (req.file.mimetype.includes("image")) {

        // Membuat folder "uploads" jika belum ada
        if (!fs.existsSync(folderUpload)) {
          fs.mkdirSync(folderUpload);
        }

        // Save the uploaded image to a local folder
        fs.writeFileSync(imagePath, req.file.buffer);

        // Extract Text
        const [result] = await client.textDetection(imagePath);

        const textAnnotations = result.textAnnotations;
        const extractedText = textAnnotations[0] ? textAnnotations[0].description : "No text found in the image.";

        // Mben ae
        // if (extractedText.length >= 2000) {
          
        // }
        const splitedText = splitParagraf(extractedText);

        // Upload the extracted text to Google Cloud Storage
        const textFileName = `${fileName}_text.txt`;
        const textBlob = bucket.file(`${outputPrefix}/${textFileName}`);
        const textBlobStream = textBlob.createWriteStream({
          resumable: false,
        });

        const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
        const textPublicUrl = format(`https://storage.googleapis.com/${bucket.name}/${textBlob.name}`);

        textBlobStream.on("error", (err) => {
          res.status(500).send({ message: err.message });
        });

        textBlobStream.on("finish", async () => {
          // Hapus folder "uploads" dan file lokal setelah pemrosesan selesai
          rimraf.sync(folderUpload);

          res.status(200).send({
            message: "Uploaded the file and extracted text successfully: " + req.file.originalname,
            imageUrl: publicUrl,
            textUrl: textPublicUrl,
            extractedText: extractedText,
            splitedText: splitedText,
          });
        });

        await db.promise().query(`INSERT INTO uploads (raw_file, raw_filename, processed_file, processed_filename, result_file, user_id) VALUES('${publicUrl}', '${fileName}', '${textPublicUrl}', '${textFileName}' , 'generated by ai', ${id})`);

        textBlobStream.end(extractedText);

      } else if (req.file.mimetype.includes("pdf")) {
        const outputFileName = `${fileName}_text.txt`;

        const publicUrl = `gs://${bucket.name}/${folderUpload}/${fileName}`;
        const textPublicUrl = `gs://${bucket.name}/${outputPrefix}/${outputFileName}`;

        // HTTP URLs for display purposes
        const httpPublicUrl = `http://storage.googleapis.com/${bucket.name}/${folderUpload}/${fileName}`;
        const httpTextPublicUrl = `http://storage.googleapis.com/${bucket.name}/${outputPrefix}/${outputFileName}`;
        // ini aku tambahin output-1-to-1.json
        // const httpTextPublicUrl = `http://storage.googleapis.com/${bucket.name}/${outputPrefix}/${outputFileName}output-1-to-1.json`;
        //

        const inputConfig = {
          // Supported mime_types are: 'application/pdf' and 'image/tiff'
          mimeType: "application/pdf",
          gcsSource: {
            uri: publicUrl,
          },
        };

        const outputConfig = {
          mimeType: "text/plain",
          gcsDestination: {
            uri: textPublicUrl,
          },
        };

        const features = [{ type: "DOCUMENT_TEXT_DETECTION" }];

        const request = {
          requests: [
            {
              inputConfig: inputConfig,
              features: features,
              outputConfig: outputConfig,
            },
          ],
        };

        const [operation] = await client.asyncBatchAnnotateFiles(request);
        const [filesResponse] = await operation.promise();
        // console.log(filesResponse.responses[0]);
        const destinationUri = filesResponse.responses[0].outputConfig.gcsDestination.uri;
        // kita juga belum bisa extract text dari jsonnya
        // const extractedText = filesResponse.responses[0].fullTextAnnotation ? filesResponse.responses[0].fullTextAnnotation : "No text detected.";

        // ini masih belum bisa outputfilenamenya sementara gitu aja dulu
        await db.promise().query(`INSERT INTO uploads (raw_file, raw_filename, processed_file, processed_filename, result_file, user_id) VALUES('${publicUrl}', '${fileName}', '${textPublicUrl}', '${outputFileName}' , 'generated by ai', ${id})`);

        return res.status(200).send({
          message: "Uploaded the file and extracted text successfully: " + req.file.originalname,
          sourceUrl: httpPublicUrl,
          destinationUrl: httpTextPublicUrl,
        });
      }
    });

    blobStream.end(req.file.buffer);
  } catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(500).send({
        message: "File size cannot be larger than 2MB!",
      });
    }

    const fileName = req.file ? req.file.originalname : "Unknown File";
    res.status(500).send({
      message: `Could not upload the file: ${fileName}. ${err}`,
    });
  }
};
