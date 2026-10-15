import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountSidebar, { AccountPageHeader, AccountProfilePanel } from './AccountSidebar';
import './Offers.css';

const Offers = ({ setUser }) => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [productOrders, setProductOrders] = useState([]);
  const [sellerTaxPoints, setSellerTaxPoints] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', points_cost: '', stock: '' });
  const [productSaving, setProductSaving] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  
  // Added duration to the form state to be saved in DB
  const [form, setForm] = useState({
    title: '',
    description: '',
    gps: '',
    material_type: 'plastic',
    duration: '7' 
  });

  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();
  const sellerStatus = String(userData?.account_status || '').toUpperCase();

  // Live timer update every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("greenovation_user"));
    const storedUserType = localStorage.getItem("greenovation_user_type");
    
    if (!storedUser || storedUserType !== 'seller') {
      navigate('/');
      return;
    }
    
    setUserData(storedUser);
    
    if (storedUser) {
      fetchOffers(storedUser.id);
      fetchSellerMarketplace();
      const refreshTimer = setInterval(() => {
        if (document.visibilityState === 'visible') fetchSellerMarketplace();
      }, 10000);
      if (storedUser.gps) {
        setForm(prev => ({ ...prev, gps: storedUser.gps }));
      }
      return () => clearInterval(refreshTimer);
    }
  }, [navigate]);

  // Fetches saved offers from the database
  const fetchOffers = async (sellerId = userData?.id) => {
    if (!sellerId) return;
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:4000/api/offers/${sellerId}`);
      const data = await response.json();
      
      if (response.ok) {
        setOffers(data);
      } else {
        setError(data.error || 'Failed to fetch offers');
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch offers');
      setLoading(false);
    }
  };

  const refreshSellerData = async () => {
    await Promise.all([
      fetchOffers(userData.id),
      fetchSellerMarketplace()
    ]);
  };

  const handleSignOut = () => {
    localStorage.removeItem('greenovation_user');
    localStorage.removeItem('greenovation_user_type');
    localStorage.removeItem('greenovation_token');
    setUser(null);
    navigate('/');
  };

  const fetchSellerMarketplace = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}` };
      const [productsResponse, ordersResponse, taxPointsResponse] = await Promise.all([
        fetch('http://localhost:4000/api/v2/seller/products', { headers }),
        fetch('http://localhost:4000/api/v2/seller/product-orders', { headers }),
        fetch('http://localhost:4000/api/v2/seller/tax-points', { headers })
      ]);
      const [productsData, ordersData, taxPointsData] = await Promise.all([
        productsResponse.json(),
        ordersResponse.json(),
        taxPointsResponse.json()
      ]);
      if (!productsResponse.ok) throw new Error(productsData.error || 'Failed to load products');
      if (!ordersResponse.ok) throw new Error(ordersData.error || 'Failed to load product orders');
      if (!taxPointsResponse.ok) throw new Error(taxPointsData.error || 'Failed to load seller tax points');
      setSellerProducts(productsData.products || []);
      setProductOrders(ordersData.orders || []);
      setSellerTaxPoints(taxPointsData.tax_points);
      setMarketplaceError('');
    } catch (loadError) {
      setMarketplaceError(loadError.message || 'Failed to load seller products and orders');
    }
  };

  const handleProductFormChange = (event) => {
    setProductForm(current => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleCreateProduct = async (event) => {
    event.preventDefault();
    try {
      setProductSaving(true);
      setMarketplaceError('');
      const response = await fetch('http://localhost:4000/api/v2/seller/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}`
        },
        body: JSON.stringify(productForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create product');
      setSellerProducts(current => [data.product, ...current]);
      setProductForm({ name: '', description: '', points_cost: '', stock: '' });
    } catch (saveError) {
      setMarketplaceError(saveError.message || 'Failed to create product');
    } finally {
      setProductSaving(false);
    }
  };

  const handleProductAvailability = async (product) => {
    try {
      setMarketplaceError('');
      const response = await fetch(`http://localhost:4000/api/v2/seller/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}`
        },
        body: JSON.stringify({ active: !product.active })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update product');
      setSellerProducts(current => current.map(item => item.id === product.id ? data.product : item));
    } catch (updateError) {
      setMarketplaceError(updateError.message || 'Failed to update product');
    }
  };

  const handleProductStock = async (product, change) => {
    const stock = product.stock + change;
    if (stock < 0) return;
    try {
      setMarketplaceError('');
      const response = await fetch(`http://localhost:4000/api/v2/seller/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}`
        },
        body: JSON.stringify({ stock })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update product stock');
      setSellerProducts(current => current.map(item => item.id === product.id ? data.product : item));
    } catch (updateError) {
      setMarketplaceError(updateError.message || 'Failed to update product stock');
    }
  };

  const handleProductOrderUpdate = async (order, status) => {
    try {
      setUpdatingOrderId(order.id);
      setMarketplaceError('');
      const response = await fetch(`http://localhost:4000/api/v2/seller/product-orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}`
        },
        body: JSON.stringify({ status })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.error && data.error !== 'Failed to update product order'
          ? data.error
          : `Failed to update product order (HTTP ${response.status})`;
        console.error('Seller product order update failed:', response.status, data);
        throw new Error(message);
      }
      setProductOrders(current => current.map(item => item.id === order.id ? { ...item, ...data.order } : item));
      if (status === 'rejected' && order.product_id) {
        await fetchSellerMarketplace();
      }
    } catch (updateError) {
      setMarketplaceError(updateError.message || 'Failed to update product order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.title || !form.description) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      // POST request to save the offer in the database
      const response = await fetch('http://localhost:4000/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          seller_id: userData.id,
          duration: parseInt(form.duration)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update UI with the newly saved offer from DB
        setOffers([data.offer, ...offers]);
        setForm({
          title: '',
          description: '',
          gps: form.gps,
          material_type: 'plastic',
          duration: '7'
        });
        setShowForm(false);
        setError('');
        alert('Offer saved to database successfully!');
      } else {
        setError(data.error || 'Failed to save offer');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
  };

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGetGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setForm({ ...form, gps: `${latitude},${longitude}` });
        },
        (error) => {
          setError("Failed to get GPS location");
          console.error("Geolocation error:", error);
        }
      );
    } else {
      setError("Browser does not support geolocation");
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const handleDeleteOffer = async (offerId) => {
    if (showDeleteConfirm !== offerId) {
      setShowDeleteConfirm(offerId);
      return;
    }

    try {
      const response = await fetch(`http://localhost:4000/api/offers/${offerId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setOffers(offers.filter(offer => offer.id !== offerId));
        setShowDeleteConfirm(null);
        alert('Offer deleted from database successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete offer');
      }
    } catch (err) {
      setError('Failed to delete offer');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#28a745';
      case 'inactive': return '#6c757d';
      case 'sold': return '#000000';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return '🟢 Active';
      case 'inactive': return '⚫ Inactive';
      case 'sold': return '💰 Sold';
      default: return status;
    }
  };

  const getMaterialIcon = (type) => {
    switch (type) {
      case 'plastic': return '[Plastic]';
      case 'paper': return '[Paper]';
      case 'metal': return '[Metal]';
      case 'glass': return '[Glass]';
      case 'organic': return '[Organic]';
      default: return '[Recycle]';
    }
  };

  // Logic to calculate remaining time from the DB 'created_at' field
  const getTimeRemaining = (createdAt, durationDays) => {
    const start = new Date(createdAt).getTime();
    const expiry = start + (durationDays * 24 * 60 * 60 * 1000);
    const distance = expiry - now.getTime();

    if (distance < 0) return "Expired";

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  if (!userData) {
    return <div className="offers-container">
      <div className="auth-message">
        <h2>🔒 Authentication Required</h2>
        <p>Please log in as a seller to access this page.</p>
        <button onClick={() => navigate('/')} className="home-btn">Go to Home</button>
      </div>
    </div>;
  }

  return (
    <div className="account-layout">
      <AccountSidebar
        userData={userData}
        userType="seller"
        sections={[
          { id: 'product-orders', label: 'Pickup orders' },
          { id: 'offers', label: 'My Offers' }
        ]}
        onRefresh={refreshSellerData}
        refreshing={loading}
        onSignOut={handleSignOut}
      />
      <main className="account-main offers-container">
      <AccountPageHeader title="Seller Dashboard" label="SELLER PORTAL" />
      <AccountProfilePanel userData={userData} userType="seller" />
      <div className="seller-profile-image-wrap">
        {userData.profileImage || userData.profile_image ? (
          <img
            className="seller-profile-image"
            src={userData.profileImage || userData.profile_image}
            alt="Seller profile"
          />
        ) : (
          <div className="seller-profile-image seller-profile-placeholder" aria-label="Seller profile placeholder">
            {String(userData.name || 'S').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {sellerStatus !== 'VERIFIED' && (
        <section className="seller-verification-notice" role="status">
          <h2>Seller account status: {sellerStatus || 'PENDING_VERIFICATION'}</h2>
          <p>Product listings are available after Greenovation verifies this business.</p>
        </section>
      )}
      <section className="seller-products-panel" aria-labelledby="seller-products-title">
        <div className="seller-products-heading">
          <div><p className="dashboard-label">POINTS SHOP</p><h2 id="seller-products-title">Products and pickup orders</h2></div>
        </div>
        {marketplaceError && <p className="seller-marketplace-error" role="alert">{marketplaceError}</p>}
        <div className="seller-product-orders" id="product-orders">
          <section className="seller-tax-points" aria-labelledby="seller-tax-points-title">
            <h3 id="seller-tax-points-title">Tax deduction points</h3>
            <p>Awaiting admin verification: <strong>{Number(sellerTaxPoints?.eligible_points || 0).toLocaleString()}</strong> points from {sellerTaxPoints?.eligible_orders || 0} completed pickups.</p>
            <p>Verified by admin: <strong>{Number(sellerTaxPoints?.verified_points || 0).toLocaleString()}</strong> points ({sellerTaxPoints?.verified_orders || 0} orders).</p>
            <small>Only customer pickups count. Verification records points toward a tax deduction; it does not calculate a currency amount.</small>
          </section>
          <h3>Pickup orders ({productOrders.filter(order => order.status === 'pending').length} awaiting confirmation)</h3>
          <p>Confirm within 24 hours. Customers pick up confirmed orders from your store.</p>
          <p className="seller-product-orders-account">
            Orders for seller account #{userData.id} ({userData.name || 'Seller'}).
          </p>
          {productOrders.length ? productOrders.map(order => (
            <article className="seller-product-order-row" key={order.id}>
              <div><strong>{order.product_name}</strong><span>{order.points_cost} points · {order.user_name} ({order.user_email})</span></div>
              <span className={`product-order-status ${order.status}`}>
                {order.status === 'pending'
                  ? `Awaiting confirmation · ${new Date(order.expires_at).toLocaleString()} deadline`
                  : order.status === 'approved'
                    ? 'Confirmed · awaiting customer pickup'
                    : order.status === 'fulfilled'
                      ? 'Picked up'
                      : order.status === 'cancelled'
                        ? 'Cancelled by customer'
                        : order.status === 'expired'
                          ? 'Expired · points and stock released'
                          : 'Rejected · points and stock released'}
              </span>
              {order.status === 'pending' && (
                <div className="seller-product-order-actions">
                  <button type="button" disabled={updatingOrderId === order.id} onClick={() => handleProductOrderUpdate(order, 'approved')}>Confirm and prepare for pickup</button>
                  <button type="button" disabled={updatingOrderId === order.id} onClick={() => handleProductOrderUpdate(order, 'rejected')}>Reject and release stock</button>
                </div>
              )}
              {order.status === 'approved' && (
                <>
                  <span>Customer points are reserved; have them pick up this order at your store.</span>
                  <button type="button" disabled={updatingOrderId === order.id} onClick={() => handleProductOrderUpdate(order, 'fulfilled')}>Confirm customer pickup</button>
                </>
              )}
            </article>
          )) : <p>No pickup orders for this seller account.</p>}
        </div>
        <form className="seller-product-form" onSubmit={handleCreateProduct}>
          <label>Product name<input name="name" value={productForm.name} onChange={handleProductFormChange} maxLength="255" required /></label>
          <label>Points cost<input name="points_cost" type="number" min="1" step="1" value={productForm.points_cost} onChange={handleProductFormChange} required /></label>
          <label>Stock<input name="stock" type="number" min="0" step="1" value={productForm.stock} onChange={handleProductFormChange} required /></label>
          <label className="seller-product-description">Description<textarea name="description" value={productForm.description} onChange={handleProductFormChange} rows="2" /></label>
          <button type="submit" disabled={productSaving || sellerStatus !== 'VERIFIED'}>{productSaving ? 'Saving...' : 'Add product'}</button>
        </form>
        <div className="seller-product-list">
          <h3>My products</h3>
          {sellerProducts.length ? sellerProducts.map(product => (
            <article className="seller-product-row" key={product.id}>
              <strong>{product.name}</strong>
              <span>{product.points_cost} points</span>
              <span>{product.stock} in stock</span>
              <span>{product.active ? 'Active' : 'Hidden'}</span>
              <button type="button" disabled={product.stock === 0} onClick={() => handleProductStock(product, -1)}>−1 stock</button>
              <button type="button" onClick={() => handleProductStock(product, 1)}>+1 stock</button>
              <button type="button" onClick={() => handleProductAvailability(product)}>{product.active ? 'Hide listing' : 'Show listing'}</button>
            </article>
          )) : <p>No products listed yet.</p>}
        </div>
      </section>
      <div className="offer-actions">
        <button 
          onClick={() => setShowForm(!showForm)}
          className="add-offer-btn"
        >
          {showForm ? 'Cancel' : '➕ Add New Offer'}
        </button>
      </div>

      {showForm && (
        <div className="offer-form-container">
          <div className="offer-form">
            <h3>Create New Offer</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Company*</label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleInputChange}
                    placeholder="e.g., Plastic Bottles - 50kg"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Price (EGP)*</label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Material Type*</label>
                  <select
                    name="material_type"
                    value={form.material_type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="plastic">[Plastic]</option>
                    <option value="paper">[Paper]</option>
                    <option value="metal">[Metal]</option>
                    <option value="glass">[Glass]</option>
                    <option value="organic">[Organic]</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Location*</label>
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleInputChange}
                    placeholder="Pickup location"
                    required
                  />
                </div>
              </div>

              {/* Duration field to control expiry logic in DB */}
              <div className="form-group">
                <label>Offer Duration (Max 7 Days)*</label>
                <select 
                  name="duration" 
                  value={form.duration} 
                  onChange={handleInputChange}
                  required
                >
                  <option value="1">1 Day</option>
                  <option value="3">3 Days</option>
                  <option value="5">5 Days</option>
                  <option value="7">7 Days (1 Week)</option>
                </select>
              </div>

              <div className="form-group">
                <label>GPS Coordinates</label>
                <div className="gps-input-group">
                  <input
                    type="text"
                    name="gps"
                    value={form.gps}
                    onChange={handleInputChange}
                    placeholder="latitude,longitude"
                  />
                  <button
                    type="button"
                    onClick={handleGetGPS}
                    className="gps-btn"
                  >
                    📍 Get GPS
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  placeholder="Describe the materials and conditions"
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-btn">Create Offer</button>
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      <div className="offers-section" id="offers">
        <h2>📦 My Offers</h2>
        
        {loading ? (
          <div className="loading">Loading offers...</div>
        ) : offers.length === 0 ? (
          <div className="no-offers">
            <h3>No offers yet</h3>
            <p>Start by creating your first recycling offer!</p>
          </div>
        ) : (
          <div className="offers-grid">
            {offers.map(offer => (
              <div key={offer.id} className="offer-card">
                <div className="offer-header">
                  <span className="offer-id">#{offer.id}</span>
                  <span 
                    className="offer-status"
                    style={{ backgroundColor: getStatusColor(offer.status) }}
                  >
                    {getStatusText(offer.status)}
                  </span>
                </div>
                
                <div className="offer-content">
                  <div className="offer-title">
                    <span className="material-icon">{getMaterialIcon(offer.material_type)}</span>
                    <h3>{offer.title}</h3>
                  </div>
                  
                  {/* <div className="offer-price">
                    <span className="price-label">Price:</span>
                    <span className="price-value">EGP {offer.price}</span>
                  </div>
                   */}
                  <div className="offer-info">
                    <p>📍 {offer.location}</p>
                    {offer.gps && (
                      <p>🗺️ GPS: {typeof offer.gps === 'object' ? `${offer.gps.x}, ${offer.gps.y}` : offer.gps}</p>
                    )}
                    {offer.description && (
                      <p>📝 {offer.description}</p>
                    )}
                  </div>
                  
                  <div className="offer-meta">
                    <small>Created: {new Date(offer.created_at).toLocaleDateString()}</small>
                    <div className="countdown" style={{marginTop: '8px', color: '#d9534f', fontWeight: 'bold'}}>
                       ⏱️ Expires in: {getTimeRemaining(offer.created_at, offer.duration || 7)}
                    </div>
                  </div>
                </div>
                
                <div className="offer-actions">
                  {showDeleteConfirm === offer.id ? (
                    <div className="confirm-delete">
                      <span>Are you sure?</span>
                      <button
                        onClick={() => handleDeleteOffer(offer.id)}
                        className="confirm-yes"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="confirm-no"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDeleteOffer(offer.id)}
                      className="delete-btn"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default Offers;