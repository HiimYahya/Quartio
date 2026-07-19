const multer = require('multer');

const TYPES_AUTORISES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!TYPES_AUTORISES.includes(file.mimetype)) {
    const err = new Error('Type de fichier non autorisé (jpeg, png, webp, gif uniquement)');
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = upload;
