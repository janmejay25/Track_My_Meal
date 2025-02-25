document.addEventListener('DOMContentLoaded', function() {
    // Socket connection
    const socket = io();
    let currentOrderId = null;
    
    // DOM Elements
    const trackForm = document.getElementById('track-form');
    const orderIdInput = document.getElementById('order-id');
    const statusContainer = document.getElementById('status-container');
    const orderIdDisplay = document.getElementById('order-id-display');
    const statusLabel = document.getElementById('status-label');
    const timeDisplay = document.getElementById('time-display');
    const timeLabel = document.getElementById('time-label');
    const progressFill = document.getElementById('progress-fill');
    const progressSteps = document.querySelectorAll('.progress-step');
    const orderItemsContainer = document.getElementById('order-items-container');
    const orderTotalElement = document.getElementById('order-total');
    const optimalPickupTimeElement = document.getElementById('optimal-pickup-time');
    const travelTimeInput = document.getElementById('travel-time');
    const updateTravelBtn = document.getElementById('update-travel-btn');
    const newOrderBtn = document.getElementById('new-order-btn');
    
    // Track Order Form Submission
    trackForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const orderId = orderIdInput.value.trim();
      
      if (orderId) {
        trackOrder(orderId);
      }
    });
    
    // Function to track an order
    function trackOrder(orderId) {
      fetch(`/api/orders/track/${orderId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Order not found');
          }
          return response.json();
        })
        .then(order => {
          currentOrderId = order.orderId;
          displayOrderStatus(order);
          
          // Join the socket room for this order
          socket.emit('joinOrderRoom', order.orderId);
        })
        .catch(error => {
          alert('Error: ' + error.message);
        });
    }
    
    // Display order status
    function displayOrderStatus(order) {
      // Show the status container
      statusContainer.style.display = 'block';
      
      // Update order ID
      orderIdDisplay.textContent = order.orderId;
      
      // Update status
      statusLabel.textContent = capitalizeFirstLetter(order.status);
      statusLabel.className = 'status-label status-' + order.status;
      
      // Update time display
      const estimatedTime = new Date(order.estimatedReadyTime);
      timeDisplay.textContent = formatTime(estimatedTime);
      
      // Update progress bar
      updateProgressBar(order.status);
      
      // Update order details
      updateOrderDetails(order);
      
      // Update optimal pickup time
      const optimalTime = new Date(order.optimalPickupTime);
      optimalPickupTimeElement.textContent = formatDateTime(optimalTime);
      
      // Set travel time input
      travelTimeInput.value = order.customerTravelTime || 15;
    }
    
    // Update progress bar based on status
    function updateProgressBar(status) {
      const statusIndex = {
        'received': 0,
        'preparing': 1,
        'ready': 2,
        'completed': 3
      };
      
      const currentIndex = statusIndex[status];
      const progressPercentage = (currentIndex / (progressSteps.length - 1)) * 100;
      
      progressFill.style.width = `${progressPercentage}%`;
      
      // Update active steps
      progressSteps.forEach((step, index) => {
        if (index <= currentIndex) {
          step.classList.add('active');
        } else {
          step.classList.remove('active');
        }
      });
    }
    
    // Update order details
    function updateOrderDetails(order) {
      orderItemsContainer.innerHTML = '';
      
      order.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'order-item';
        itemElement.innerHTML = `
          <span>${item.quantity}x ${item.name}</span>
          <span>$${(item.price * item.quantity).toFixed(2)}</span>
        `;
        orderItemsContainer.appendChild(itemElement);
      });
      
      orderTotalElement.textContent = `$${order.totalAmount.toFixed(2)}`;
    }
    
    // Update travel time
    updateTravelBtn.addEventListener('click', function() {
      const travelTime = parseInt(travelTimeInput.value);
      
      if (currentOrderId && travelTime >= 5 && travelTime <= 60) {
        fetch(`/api/orders/${currentOrderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ customerTravelTime: travelTime })
        })
        .then(response => response.json())
        .then(updatedOrder => {
          // Update the optimal pickup time display
          const optimalTime = new Date(updatedOrder.optimalPickupTime);
          optimalPickupTimeElement.textContent = formatDateTime(optimalTime);
          
          showNotification('Travel time updated!');
        })
        .catch(error => {
          alert('Error updating travel time: ' + error.message);
        });
      } else {
        alert('Please enter a valid travel time between 5 and 60 minutes.');
      }
    });
    
    // Socket event for status updates
    socket.on('statusUpdate', (data) => {
      if (data.orderId === currentOrderId) {
        // Update status display
        statusLabel.textContent = capitalizeFirstLetter(data.status);
        statusLabel.className = 'status-label status-' + data.status;
        
        // Update time display
        const estimatedTime = new Date(data.estimatedReadyTime);
        timeDisplay.textContent = formatTime(estimatedTime);
        
        // Update progress bar
        updateProgressBar(data.status);
        
        // Update optimal pickup time
        const optimalTime = new Date(data.optimalPickupTime);
        optimalPickupTimeElement.textContent = formatDateTime(optimalTime);
        
        // Show notification
        showNotification(`Order status updated to: ${capitalizeFirstLetter(data.status)}`);
      }
    });
    
    // New Order Form
    newOrderBtn.addEventListener('click', function() {
      showNewOrderModal();
    });
    
    // Helper Functions
    function capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    function formatTime(date) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    function formatDateTime(date) {
      return date.toLocaleString([], { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    function showNotification(message) {
      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Trigger animation
      setTimeout(() => {
        notification.classList.add('show');
      }, 10);
      
      // Remove after 3 seconds
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);
    }
    
    // New Order Modal
    function showNewOrderModal() {
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'new-order-modal';
      
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>Place New Order</h2>
            <button class="close-modal">&times;</button>
          </div>
          <form id="new-order-form">
            <div class="form-group">
              <label for="customer-name">Your Name</label>
              <input type="text" id="customer-name" required>
            </div>
            <div class="form-group">
              <label for="customer-phone">Phone Number</label>
              <input type="tel" id="customer-phone" placeholder="Optional">
            </div>
            <div class="form-group">
              <label>Order Items</label>
              <div id="order-items">
                <div class="item-form" data-index="0">
                  <div class="item-form-header">
                    <h4>Item #1</h4>
                  </div>
                  <div class="form-group">
                    <label>Item Name</label>
                    <input type="text" class="item-name" required>
                  </div>
                  <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" class="item-quantity" min="1" value="1" required>
                  </div>
                  <div class="form-group">
                    <label>Price ($)</label>
                    <input type="number" class="item-price" min="0" step="0.01" required>
                  </div>
                  <div class="form-group">
                    <label>Special Instructions</label>
                    <textarea class="item-notes" rows="2"></textarea>
                  </div>
                </div>
              </div>
              <button type="button" id="add-item-btn" class="secondary">Add Another Item</button>
            </div>
            <div class="form-group">
              <label for="travel-time-new">Estimated Travel Time (minutes)</label>
              <input type="number" id="travel-time-new" min="5" max="60" value="15">
          </div>
          <button type="submit">Place Order</button>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Close modal handler
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', function() {
      closeModal(modal);
    });
    
    // Add item button handler
    const addItemBtn = document.getElementById('add-item-btn');
    const orderItemsContainer = document.getElementById('order-items');
    
    addItemBtn.addEventListener('click', function() {
      const itemIndex = orderItemsContainer.children.length;
      const newItem = document.createElement('div');
      newItem.className = 'item-form';
      newItem.dataset.index = itemIndex;
      
      newItem.innerHTML = `
        <div class="item-form-header">
          <h4>Item #${itemIndex + 1}</h4>
          <button type="button" class="remove-item">Remove</button>
        </div>
        <div class="form-group">
          <label>Item Name</label>
          <input type="text" class="item-name" required>
        </div>
        <div class="form-group">
          <label>Quantity</label>
          <input type="number" class="item-quantity" min="1" value="1" required>
        </div>
        <div class="form-group">
          <label>Price ($)</label>
          <input type="number" class="item-price" min="0" step="0.01" required>
        </div>
        <div class="form-group">
          <label>Special Instructions</label>
          <textarea class="item-notes" rows="2"></textarea>
        </div>
      `;
      
      orderItemsContainer.appendChild(newItem);
      
      // Remove item handler
      const removeBtn = newItem.querySelector('.remove-item');
      removeBtn.addEventListener('click', function() {
        orderItemsContainer.removeChild(newItem);
        updateItemNumbers();
      });
    });
    
    // Update item numbers after removal
    function updateItemNumbers() {
      const items = orderItemsContainer.querySelectorAll('.item-form');
      items.forEach((item, index) => {
        item.dataset.index = index;
        const headerText = item.querySelector('h4');
        headerText.textContent = `Item #${index + 1}`;
      });
    }
    
    // Form submission
    const form = document.getElementById('new-order-form');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Gather form data
      const customerName = document.getElementById('customer-name').value;
      const phone = document.getElementById('customer-phone').value;
      const travelTime = parseInt(document.getElementById('travel-time-new').value);
      
      // Gather items
      const itemElements = document.querySelectorAll('.item-form');
      const items = [];
      let totalAmount = 0;
      
      itemElements.forEach(item => {
        const name = item.querySelector('.item-name').value;
        const quantity = parseInt(item.querySelector('.item-quantity').value);
        const price = parseFloat(item.querySelector('.item-price').value);
        const notes = item.querySelector('.item-notes').value;
        
        items.push({
          name,
          quantity,
          price,
          notes
        });
        
        totalAmount += price * quantity;
      });
      
      // Create order object
      const orderData = {
        customerName,
        phone,
        items,
        totalAmount,
        customerTravelTime: travelTime
      };
      
      // Submit order
      fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      })
      .then(response => response.json())
      .then(order => {
        // Close modal
        closeModal(modal);
        
        // Show success message
        showNotification('Order placed successfully!');
        
        // Track the new order
        trackOrder(order.orderId);
      })
      .catch(error => {
        alert('Error placing order: ' + error.message);
      });
    });
  }
  
  // Close modal
  function closeModal(modal) {
    modal.style.display = 'none';
    document.body.removeChild(modal);
  }
  
  // Check for order ID in URL
  const urlParams = new URLSearchParams(window.location.search);
  const orderIdParam = urlParams.get('orderId');
  
  if (orderIdParam) {
    orderIdInput.value = orderIdParam;
    trackOrder(orderIdParam);
  }
});