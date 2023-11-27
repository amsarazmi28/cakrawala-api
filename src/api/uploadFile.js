const { Storage } = require("@google-cloud/storage");
const util = require("util");
const { format } = require("util");
const Multer = require("multer");
const storage = new Storage({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
const bucket = storage.bucket("cakrawala-storage");
// Mulai dari sini
const vision = require("@google-cloud/vision").v1;
const client = new vision.ImageAnnotatorClient();

const maxSize = 2 * 1024 * 1024;

const multerInstance = Multer({
  storage: Multer.memoryStorage(),
  limits: { fileSize: maxSize },
  // Mulai sini
  // filename: (req, file, cb) => {
  //   const uniqueFileName = generateUniqueFileName(file.originalname);
  //   cb(null, uniqueFileName);
  // },
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
  // const randomString = Math.random().toString(36).substring(2, 8);
  // const uniqueName = `${timestamp}_${randomString}_${originalname}`;
  const uniqueName = `${timestamp}_${originalname}`;
  return uniqueName;
}

// Upload to GS
exports.upload = async (req, res) => {
  try {
    await processFileMiddleware(req, res);

    // Check if req.file is undefined
    if (!req.file) {
      return res.status(400).send({ message: "Please upload a file!" });
    }

    // Create a new blob in the bucket and upload the file data.
    const fileName = generateUniqueFileName(req.file.originalname);
    const folderUpload = "uploads";
    const blob = bucket.file(`${folderUpload}/${fileName}`);
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream.on("error", (err) => {
      res.status(500).send({ message: err.message });
    });

    blobStream.on("finish", async (data) => {
      // Create URL for direct file access via HTTP.
      // ini perlu dibuat didalam folder uploads
      const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);

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
        const outputPrefix = "results";
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
        message: "Uploaded the file successfully: " + req.file.originalname,
        // message: "Json saved to: " + destinationUri,
        url: publicUrl,
      });
    });

    blobStream.end(req.file.buffer);
  } catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(500).send({
        message: "File size cannot be larger than 2MB!",
      });
    }

    // If there's an error and req.file is undefined
    const fileName = req.file ? req.file.originalname : "Unknown File";
    res.status(500).send({
      message: `Could not upload the file: ${fileName}. ${err}`,
    });
  }
};
