import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientUid: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'general' },
  read: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
