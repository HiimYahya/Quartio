const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  type:         { type: String, enum: ['privee', 'groupe', 'publique'], default: 'privee' },
  nom:          { type: String },
  date_creation: { type: Date, default: Date.now },
  // IDs des participants (référence PostgreSQL)
  participants_pg: [{ type: Number }],
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
