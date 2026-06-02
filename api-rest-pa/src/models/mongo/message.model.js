const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  type:         { type: String, enum: ['texte', 'image', 'video', 'fichier'], default: 'texte' },
  contenu:      { type: String },
  media_url:    { type: String },
  date_envoi:   { type: Date, default: Date.now },
  est_supprime: { type: Boolean, default: false },
  // Références PostgreSQL
  id_utilisateur_pg:  { type: Number, required: true },
  // Référence MongoDB conversation
  id_conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
