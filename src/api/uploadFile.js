const { Storage } = require("@google-cloud/storage");
const util = require("util");
const { format } = require("util");
const Multer = require("multer");
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const storage = new Storage({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
const bucket = storage.bucket("cakrawala-storage");
const vision = require("@google-cloud/vision").v1;
const client = new vision.ImageAnnotatorClient();

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

exports.upload = async (req, res) => {
  try {
    await processFileMiddleware(req, res);

    if (!req.file) {
      return res.status(400).send({ message: "Please upload a file!" });
    }

    const fileName = generateUniqueFileName(req.file.originalname);
    const folderUpload = "uploads";
    const outputPrefix = "results";
    const blob = bucket.file(`${folderUpload}/${fileName}`);
    const imagePath = path.join(folderUpload, fileName);

    // Membuat folder "uploads" jika belum ada
    if (!fs.existsSync(folderUpload)) {
      fs.mkdirSync(folderUpload);
    }

    // Save the uploaded image to a local folder
    fs.writeFileSync(imagePath, req.file.buffer);

    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream.on("error", (err) => {
      res.status(500).send({ message: err.message });
    });

    blobStream.on("finish", async () => {
      const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);

      if (req.file.mimetype.includes("image")) {

        // Extract Text

        const [result] = await client.textDetection(imagePath);

        const textAnnotations = result.textAnnotations;
        const extractedText = textAnnotations[0] ? textAnnotations[0].description : "No text found in the image.";

        // Upload the extracted text to Google Cloud Storage
        const textFileName = `${fileName}_text.txt`;
        const textBlob = bucket.file(`${outputPrefix}/${textFileName}`);
        const textBlobStream = textBlob.createWriteStream({
          resumable: false,
        });

        textBlobStream.on("error", (err) => {
          res.status(500).send({ message: err.message });
        });

        textBlobStream.on("finish", async () => {
          // Hapus folder "uploads" dan file lokal setelah pemrosesan selesai
          rimraf.sync(folderUpload);

          const textPublicUrl = format(`https://storage.googleapis.com/${bucket.name}/${textBlob.name}`);
          res.status(200).send({
            message: "Uploaded the file and extracted text successfully: " + req.file.originalname,
            imageUrl: publicUrl,
            textUrl: textPublicUrl,
            extractedText: extractedText,
          });
        });

        textBlobStream.end(extractedText);
      } else if (req.file.mimetype.includes("pdf")) {

        // Extract Text

        try {
          // Make the file public
          await bucket.file(req.file.originalname).makePublic();
        } catch (makePublicError) {
          // Mulai dari sini
          /**
           * TODO(developer): Uncomment the following lines before running the sample.
           */
          // Bucket where the file resides
          const bucketName = "cakrawala-storage";
          // Path to PDF file within bucket
          // const fileName = `${blob.name}`;
          // The folder to store the results
          const outputFileName = `processed_${fileName}`;
  
          const gcsSourceUri = `gs://${bucketName}/${folderUpload}/${fileName}`;
          console.log(gcsSourceUri);
          const gcsDestinationUri = `gs://${bucketName}/${outputPrefix}/${outputFileName}`;
  
          const inputConfig = {
            // Supported mime_types are: 'application/pdf' and 'image/tiff'
            mimeType: "application/pdf",
            gcsSource: {
              uri: gcsSourceUri,
            },
          };
          const outputConfig = {
            gcsDestination: {
              uri: gcsDestinationUri,
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
          const destinationUri = filesResponse.responses[0].outputConfig.gcsDestination.uri;
          console.log("Json saved to: " + destinationUri);
          // end
          return res.status(500).send({
            // message: "Json saved to: " + destinationUri,
            message: `Uploaded the file successfully: ${req.file.originalname}, but public access is denied!`,
            url: publicUrl,
          });
        }

        res.status(200).send({
          message: "Uploaded the PDF file and extracted text successfully: " + req.file.originalname,
          pdfUrl: publicUrl,
          textUrl: textPublicUrl,
        });
      } else {
        // For other document types (e.g., MS Word), handle accordingly
        res.status(200).send({
          message: "Uploaded the file successfully: " + req.file.originalname,
          url: publicUrl,
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
