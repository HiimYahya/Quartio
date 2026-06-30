const mongoose = require('mongoose');

// Stocke les données de signature et le document PDF final
// PostgreSQL garde les métadonnées (statut, points, parties)
// Ce modèle est la preuve archivée de l'accord signé
const contratDocumentSchema = new mongoose.Schema({
  id_contrat_pg: { type: Number, required: true, unique: true, index: true },
  pdf_url:       { type: String, default: null },   // URL Cloudinary si uploadé
  pdf_base64:    { type: String, default: null },   // PDF signé encodé en base64
  hash_sha256:   { type: String, default: null },   // Hash SHA-256 du PDF signé
  signatures: [
    {
      id_utilisateur_pg: { type: Number, required: true },
      prenom:            { type: String },
      nom:               { type: String },
      dataurl:           { type: String },  // image/png base64 de la signature canvas
      signed_at:         { type: Date, default: Date.now },
      ip:                { type: String },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model('ContratDocument', contratDocumentSchema);
