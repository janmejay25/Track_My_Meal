const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  items: [{
    name: String,
    quantity: Number,
    price: Number,
    notes: String
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['received', 'preparing', 'ready', 'completed'],
    default: 'received'
  },
  estimatedReadyTime: {
    type: Date
  },
  optimalPickupTime: {
    type: Date
  },
  customerTravelTime: {
    type: Number,
    default: 15 // Default 15 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the updatedAt field
OrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate a unique order ID
OrderSchema.pre('save', function(next) {
  if (this.isNew) {
    // Create a random 5-digit order ID
    const orderIdNum = Math.floor(10000 + Math.random() * 90000);
    this.orderId = `ORD-${orderIdNum}`;
  }
  next();
});

OrderSchema.add({
  orderId: {
    type: String,
    unique: true
  }
});

module.exports = mongoose.model('Order', OrderSchema);