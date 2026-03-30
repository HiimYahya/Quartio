const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  titre:            { type: String, required: true },
  description:      { type: String },
  type:             { type: String },
  statut:           { type: String, enum: ['ouvert', 'en_cours', 'resolu', 'ferme'], default: 'ouvert' },
  priorite:         { type: String, enum: ['basse', 'normale', 'haute', 'critique'], default: 'normale' },
  date_signalement: { type: Date, default: Date.now },
  date_resolution:  { type: Date },
  est_synchronise:  { type: Boolean, default: false },
  // Référence PostgreSQL (utilisateur qui signale)
  id_utilisateur_pg: { type: Number, required: true },
  // Référence MongoDB message source (optionnel)
  id_message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
}, { timestamps: true });

module.exports = mongoose.model('Incident', incidentSchema);
