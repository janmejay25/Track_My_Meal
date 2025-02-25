const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const moment = require('moment');

// Get all orders (for restaurant dashboard)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get specific order by orderId (for customer tracking)
router.get('/track/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new order
router.post('/', async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    
    // Calculate estimated ready time (default: 30 minutes from now)
    const estimatedReadyTime = moment().add(30, 'minutes').toDate();
    newOrder.estimatedReadyTime = estimatedReadyTime;
    
    // Calculate optimal pickup time based on estimated ready time and customer travel time
    const optimalPickupTime = moment(estimatedReadyTime).subtract(
      newOrder.customerTravelTime || 15, 'minutes'
    ).toDate();
    newOrder.optimalPickupTime = optimalPickupTime;
    
    const savedOrder = await newOrder.save();
    
    // Emit socket event for new order
    const io = req.app.get('io');
    io.emit('newOrder', savedOrder);
    
    res.status(201).json(savedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update order status
router.patch('/:id', async (req, res) => {
  try {
    const { status, estimatedReadyTime, customerTravelTime } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Update status if provided
    if (status) {
      order.status = status;
    }
    
    // Update estimated ready time if provided
    if (estimatedReadyTime) {
      order.estimatedReadyTime = new Date(estimatedReadyTime);
    }
    
    // Update customer travel time if provided
    if (customerTravelTime) {
      order.customerTravelTime = customerTravelTime;
      
      // Recalculate optimal pickup time
      const optimalPickupTime = moment(order.estimatedReadyTime).subtract(
        order.customerTravelTime, 'minutes'
      ).toDate();
      order.optimalPickupTime = optimalPickupTime;
    }
    
    const updatedOrder = await order.save();
    
    // Emit socket event for status update
    const io = req.app.get('io');
    io.to(order.orderId).emit('statusUpdate', {
      orderId: order.orderId,
      status: order.status,
      estimatedReadyTime: order.estimatedReadyTime,
      optimalPickupTime: order.optimalPickupTime
    });
    
    // Also emit to restaurant dashboard
    io.emit('orderUpdated', updatedOrder);
    
    res.json(updatedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;