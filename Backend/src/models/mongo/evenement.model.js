const mongoose = require('mongoose');

const evenementSchema = new mongoose.Schema({
  titre:        { type: String, required: true },
  description:  { type: String },
  type:         { type: String },
  date_debut:   { type: Date, required: true },
  date_fin:     { type: Date },
  lieu:         { type: String },
  capacite_max: { type: Number },
  statut:       { type: String, enum: ['planifie', 'en_cours', 'termine', 'annule'], default: 'planifie' },
  // Référence vers PostgreSQL
  id_utilisateur_pg: { type: Number, required: true },
  medias: [{ url: String, type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Evenement', evenementSchema);
