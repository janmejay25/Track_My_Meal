document.addEventListener('DOMContentLoaded', function() {
    // Socket connection
    const socket = io();
    
    // DOM Elements
    const ordersContainer = document.getElementById('orders-container');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const pendingCountEl = document.getElementById('pending-count');
    const readyCountEl = document.getElementById('ready-count');
    const avgTimeEl = document.getElementById('avg-time');
    const orderModal = document.getElementById('order-modal');
    const orderDetailsContent = document.getElementById('order-details-content');
    const closeModalBtn = document.querySelector('.close-modal');
    const notificationSound = document.getElementById('notification-sound');
    
    // Current order ID for modal
    let currentOrderId = null;
    let currentFilter = 'all';
    let orders = [];
    
    // Fetch all orders
    fetchOrders();
    
    function fetchOrders() {
      fetch('/api/orders')
        .then(response => response.json())
        .then(data => {
          orders = data;
          renderOrders();
          updateMetrics();
        })
        .catch(error => {
          console.error('Error fetching orders:', error);
          ordersContainer.innerHTML = `<div class="error">Error loading orders. Please try again.</div>`;
        });
    }
    
    // Render orders
    function renderOrders() {
      // Clear container
      ordersContainer.innerHTML = '';
      
      // Filter orders
      let filteredOrders = orders;
      if (currentFilter !== 'all') {
        filteredOrders = orders.filter(order => order.status === currentFilter);
      }
      
      // Check if no orders
      if (filteredOrders.length === 0) {
        ordersContainer.innerHTML = `<div class="loading">No ${currentFilter !== 'all' ? currentFilter : ''} orders found.</div>`;
        return;
      }
      
      // Sort orders: received first, then preparing, then ready, then completed
      // Within same status, sort by created date (newest first)
      const statusOrder = {
        'received': 0,
        'preparing': 1,
        'ready': 2,
        'completed': 3
      };
      
      filteredOrders.sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      // Create order cards
      filteredOrders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = `order-card ${order.status}`;
        orderCard.dataset.id = order._id;
        
        // Format time
        const createdTime = new Date(order.createdAt);
        const formattedTime = createdTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Get item count and first item
        const itemCount = order.items.length;
        const firstItem = order.items[0]?.name || 'Unknown item';
        const itemPreview = itemCount > 1 
          ? `${firstItem} and ${itemCount - 1} more item${itemCount - 1 > 1 ? 's' : ''}`
          : firstItem;
        
        orderCard.innerHTML = `
          <div class="order-header">
            <span class="order-id">${order.orderId}</span>
            <span class="order-time">${formattedTime}</span>
          </div>
          <div class="order-customer">
            <strong>${order.customerName}</strong>
          </div>
          <div class="order-items-preview">
            ${itemPreview}
          </div>
          <div class="order-footer">
            <span class="order-total">$${order.totalAmount.toFixed(2)}</span>
            <button class="order-view-btn">View Details</button>
          </div>
        `;
        
        // Add click handler
        const viewBtn = orderCard.querySelector('.order-view-btn');
        viewBtn.addEventListener('click', () => {
          showOrderDetails(order);
        });
        
        ordersContainer.appendChild(orderCard);
      });
    }
    
    // Show order details modal
    function showOrderDetails(order) {
      currentOrderId = order._id;
      
      // Format dates
      const createdAt = new Date(order.createdAt);
      const formattedCreatedAt = createdAt.toLocaleString();
      
      const estimatedReadyTime = new Date(order.estimatedReadyTime);
      const formattedEstimatedTime = estimatedReadyTime.toLocaleString();
      
      // Set values in the UI
      orderDetailsContent.innerHTML = `
        <div class="order-details-header">
          <h3>Order ${order.orderId}</h3>
          <span class="status-label status-${order.status}">${capitalizeFirstLetter(order.status)}</span>
        </div>
        
        <div class="order-details-info">
          <div>
            <p><strong>Customer:</strong> ${order.customerName}</p>
            <p><strong>Phone:</strong> ${order.phone || 'Not provided'}</p>
            <p><strong>Created:</strong> ${formattedCreatedAt}</p>
          </div>
          <div>
            <p><strong>Status:</strong> ${capitalizeFirstLetter(order.status)}</p>
            <p><strong>Est. Ready:</strong> ${formattedEstimatedTime}</p>
            <p><strong>Travel Time:</strong> ${order.customerTravelTime} minutes</p>
          </div>
        </div>
        
        <div class="order-details-section">
          <h3>Order Items</h3>
          <table class="order-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.name} ${item.notes ? `<small>(${item.notes})</small>` : ''}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.price.toFixed(2)}</td>
                  <td>$${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="order-items-total">
            Total: $${order.totalAmount.toFixed(2)}
          </div>
        </div>
      `;
      
      // Set estimated time input to current value
      const timeUpdateInput = document.getElementById('time-update-input');
      timeUpdateInput.value = formatDateTimeForInput(estimatedReadyTime);
      
      // Show modal
      orderModal.style.display = 'block';
      
      // Highlight current status button
      const statusButtons = document.querySelectorAll('.status-btn');
      statusButtons.forEach(btn => {
        if (btn.dataset.status === order.status) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
    
    // Close modal
    closeModalBtn.addEventListener('click', () => {
      orderModal.style.display = 'none';
      currentOrderId = null;
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target === orderModal) {
        orderModal.style.display = 'none';
        currentOrderId = null;
      }
    });
    
    // Status update buttons
    document.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentOrderId) return;
        
        const newStatus = btn.dataset.status;
        
        fetch(`/api/orders/${currentOrderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        })
        .then(response => response.json())
        .then(updatedOrder => {
          // Update order in the local array
          const index = orders.findIndex(o => o._id === updatedOrder._id);
          if (index !== -1) {
            orders[index] = updatedOrder;
          }
          
          // Rerender
          renderOrders();
          updateMetrics();
          
          // Highlight current status button
          document.querySelectorAll('.status-btn').forEach(statusBtn => {
            statusBtn.classList.toggle('active', statusBtn.dataset.status === newStatus);
          });
          
          // Update status label in modal
          const statusLabel = orderDetailsContent.querySelector('.status-label');
          statusLabel.className = `status-label status-${newStatus}`;
          statusLabel.textContent = capitalizeFirstLetter(newStatus);
        })
        .catch(error => {
          alert('Error updating order status: ' + error.message);
        });
      });
    });
    
    // Time update button
    const updateTimeBtn = document.getElementById('update-time-btn');
    updateTimeBtn.addEventListener('click', () => {
      if (!currentOrderId) return;
      
      const timeInput = document.getElementById('time-update-input');
      const newTime = timeInput.value;
      
      if (!newTime) {
        alert('Please select a valid time');
        return;
      }
      
      fetch(`/api/orders/${currentOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estimatedReadyTime: new Date(newTime) })
      })
      .then(response => response.json())
      .then(updatedOrder => {
        // Update order in the local array
        const index = orders.findIndex(o => o._id === updatedOrder._id);
        if (index !== -1) {
          orders[index] = updatedOrder;
        }
        
        // Update time display in modal
        const timeEl = orderDetailsContent.querySelector('p:contains("Est. Ready:")');
        if (timeEl) {
          timeEl.innerHTML = `<strong>Est. Ready:</strong> ${new Date(updatedOrder.estimatedReadyTime).toLocaleString()}`;
        }
        
        alert('Estimated ready time updated successfully!');
      })
      .catch(error => {
        alert('Error updating ready time: ' + error.message);
      });
    });
    
    // Filter buttons
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        currentFilter = filter;
        
        // Update active state
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Rerender
        renderOrders();
      });
    });
    
    // Update metrics
    function updateMetrics() {
      const pendingCount = orders.filter(o => o.status === 'received' || o.status === 'preparing').length;
      const readyCount = orders.filter(o => o.status === 'ready').length;
      
      // Calculate average preparation time (for completed orders)
      const completedOrders = orders.filter(o => o.status === 'completed');
      let avgPrepTime = 0;
      
      if (completedOrders.length > 0) {
        const totalMinutes = completedOrders.reduce((total, order) => {
          const created = new Date(order.createdAt);
          const updated = new Date(order.updatedAt);
          const diffMinutes = Math.round((updated - created) / (1000 * 60));
          return total + diffMinutes;
        }, 0);
        
        avgPrepTime = Math.round(totalMinutes / completedOrders.length);
      }
      
      // Update UI
      pendingCountEl.textContent = pendingCount;
      readyCountEl.textContent = readyCount;
      avgTimeEl.textContent = avgPrepTime;
    }
    
    // Socket events
    socket.on('newOrder', (order) => {
      // Add to local array
      orders.unshift(order);
      
      // Play notification sound
      playNotificationSound();
      
      // Show desktop notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Order Received!', {
          body: `New order from ${order.customerName}`
        });
      }
      
      // Rerender and update metrics
      renderOrders();
      updateMetrics();
    });
    
    socket.on('orderUpdated', (updatedOrder) => {
      // Update in local array
      const index = orders.findIndex(o => o._id === updatedOrder._id);
      if (index !== -1) {
        orders[index] = updatedOrder;
        
        // Rerender and update metrics
        renderOrders();
        updateMetrics();
        
        // If the modal is open and showing this order, update it
        if (currentOrderId === updatedOrder._id && orderModal.style.display === 'block') {
          showOrderDetails(updatedOrder);
        }
      }
    });
    
    // Helper Functions
    function capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    function formatDateTimeForInput(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    function playNotificationSound() {
      notificationSound.play().catch(e => console.log('Error playing sound:', e));
    }
    
    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    
    // Extend jQuery-like functionality
    Element.prototype.contains = function(text) {
      return this.textContent.includes(text);
    };
  });