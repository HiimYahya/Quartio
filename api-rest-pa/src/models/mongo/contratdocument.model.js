const mongoose = require('mongoose');

const contratDocumentSchema = new mongoose.Schema({
  id_contrat_pg: { type: Number, required: true, unique: true, index: true },
  pdf_url:       { type: String, default: null },
  pdf_base64:    { type: String, default: null },
  hash_sha256:   { type: String, default: null },
  signatures: [
    {
      id_utilisateur_pg: { type: Number, required: true },
      prenom:            { type: String },
      nom:               { type: String },
      dataurl:           { type: String },
      signed_at:         { type: Date, default: Date.now },
      ip:                { type: String },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model('ContratDocument', contratDocumentSchema);
