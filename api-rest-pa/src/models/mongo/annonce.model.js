const mongoose = require('mongoose');

const annonceSchema = new mongoose.Schema({
  titre:            { type: String, required: true },
  description:      { type: String },
  type:             { type: String },
  est_payant:       { type: Boolean, default: false },
  cout_points:      { type: Number, default: 0 },
  categorie:        { type: String },
  type_concerne:    { type: String },
  statut:           { type: String, enum: ['active', 'inactive', 'archivee'], default: 'active' },
  date_publication: { type: Date, default: Date.now },
  // Référence vers PostgreSQL (id de l'utilisateur créateur)
  id_utilisateur_pg: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Annonce', annonceSchema);
