import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountSidebar, { AccountPageHeader, AccountProfilePanel } from './AccountSidebar';
import './Offers.css';

const Offers = ({ setUser }) => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);
  const [userType, setUserType] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponEmail, setCouponEmail] = useState('');
  const [emailCoupons, setEmailCoupons] = useState(null);
  const [emailCouponError, setEmailCouponError] = useState('');
  const [emailCouponLoading, setEmailCouponLoading] = useState(false);
  const [redeemingCouponId, setRedeemingCouponId] = useState(null);
  const [sellerRewards, setSellerRewards] = useState([]);
  const [sellerPoints, setSellerPoints] = useState(0);
  const [totalCodesIssued, setTotalCodesIssued] = useState(0);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardError, setRewardError] = useState('');
  const [rewardForm, setRewardForm] = useState({ name: '', points_cost: '', value_amount: '', currency: 'EGP' });
  const [sellerProducts, setSellerProducts] = useState([]);
  const [productOrders, setProductOrders] = useState([]);
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
    setUserType(storedUserType);
    
    if (storedUser) {
      fetchOffers(storedUser.id);
      fetchSellerRewards(storedUser.id);
      fetchSellerMarketplace();
      if (storedUser.gps) {
        setForm(prev => ({ ...prev, gps: storedUser.gps }));
      }
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
      fetchSellerRewards(userData.id),
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

  const fetchSellerRewards = async (sellerId) => {
    try {
      const response = await fetch('http://localhost:4000/api/v2/merchant/rewards', {
        headers: { Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load discount rewards');
      setSellerRewards(data.rewards || []);
      setSellerPoints(data.seller?.points || 0);
      setTotalCodesIssued(data.total_codes_issued || 0);
    } catch (loadError) {
      setRewardError(loadError.message || 'Failed to load discount rewards');
    }
  };

  const fetchSellerMarketplace = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}` };
      const [productsResponse, ordersResponse] = await Promise.all([
        fetch('http://localhost:4000/api/v2/seller/products', { headers }),
        fetch('http://localhost:4000/api/v2/seller/product-orders', { headers })
      ]);
      const [productsData, ordersData] = await Promise.all([
        productsResponse.json(),
        ordersResponse.json()
      ]);
      if (!productsResponse.ok) throw new Error(productsData.error || 'Failed to load products');
      if (!ordersResponse.ok) throw new Error(ordersData.error || 'Failed to load product orders');
      setSellerProducts(productsData.products || []);
      setProductOrders(ordersData.orders || []);
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

  const handleRewardFormChange = (event) => {
    setRewardForm(current => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleCouponsByEmail = async (event) => {
    event.preventDefault();
    try {
      setEmailCouponLoading(true);
      setEmailCouponError('');
      setEmailCoupons(null);
      const response = await fetch('http://localhost:4000/api/v2/merchant/coupons/user-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `******'greenovation_token') || ''}`
        },
        body: JSON.stringify({ email: couponEmail.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to find active coupons');
      setEmailCoupons(data.coupons || []);
    } catch (lookupError) {
      setEmailCouponError(lookupError.message || 'Failed to find active coupons');
    } finally {
      setEmailCouponLoading(false);
    }
  };

  const handleRedeemCustomerCoupon = async (couponId) => {
    try {
      setRedeemingCouponId(couponId);
      setEmailCouponError('');
      const response = await fetch(`http://localhost:4000/api/v2/merchant/coupons/${couponId}/redeem`, {
        method: 'POST',
        headers: { Authorization: `******'greenovation_token') || ''}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Coupon could not be redeemed');
      setEmailCoupons(current => current.map(coupon => (
        coupon.id === couponId
          ? { ...coupon, ...data.coupon, redeemed_by_name: userData.name }
          : coupon
      )));
    } catch (redeemError) {
      setEmailCouponError(redeemError.message || 'Coupon could not be redeemed');
    } finally {
      setRedeemingCouponId(null);
    }
  };

  const handleCreateReward = async (event) => {
    event.preventDefault();
    try {
      setRewardSaving(true);
      setRewardError('');
      const response = await fetch('http://localhost:4000/api/v2/merchant/rewards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}`
        },
        body: JSON.stringify(rewardForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create discount reward');
      setRewardForm({ name: '', points_cost: '', value_amount: '', currency: 'EGP' });
      await fetchSellerRewards(userData.id);
    } catch (createError) {
      setRewardError(createError.message || 'Failed to create discount reward');
    } finally {
      setRewardSaving(false);
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

  const handleCouponLookup = async (event) => {
    event.preventDefault();
    if (!couponCode.trim()) return;
    try {
      setCouponLoading(true);
      setCouponResult(null);
      const response = await fetch('http://localhost:4000/api/v2/merchant/coupons/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}`
        },
        body: JSON.stringify({ code: couponCode.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Coupon not found');
      setCouponResult({ ...data.coupon, valid: data.valid });
    } catch (lookupError) {
      setCouponResult({ error: lookupError.message });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleCouponRedeem = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/v2/merchant/coupons/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}`
        },
        body: JSON.stringify({ code: couponCode.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Coupon could not be redeemed');
      setCouponResult({ ...data.coupon, effective_status: 'REDEEMED', valid: false });
      setCouponCode('');
    } catch (redeemError) {
      setError(redeemError.message);
    }
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
          <p>Coupon verification and redemption are available after Greenovation verifies this business.</p>
        </section>
      )}
      <section className="seller-rewards-panel" aria-labelledby="seller-rewards-title">
        <div className="seller-rewards-heading">
          <div><p className="dashboard-label">DISCOUNT PROGRAM</p><h2 id="seller-rewards-title">Points and discount codes</h2></div>
          <div className="seller-reward-stats">
            <div><span>Seller points</span><strong>{Number(sellerPoints).toLocaleString()}</strong></div>
            <div><span>Codes issued</span><strong>{Number(totalCodesIssued).toLocaleString()}</strong></div>
          </div>
        </div>
        {rewardError && <p className="seller-reward-error" role="alert">{rewardError}</p>}
        <form className="seller-reward-form" onSubmit={handleCreateReward}>
          <label>Reward name<input name="name" value={rewardForm.name} onChange={handleRewardFormChange} maxLength="255" required /></label>
          <label>Points required<input name="points_cost" type="number" min="1" step="1" value={rewardForm.points_cost} onChange={handleRewardFormChange} required /></label>
          <label>Discount value<input name="value_amount" type="number" min="0.01" step="0.01" value={rewardForm.value_amount} onChange={handleRewardFormChange} required /></label>
          <label>Currency<select name="currency" value={rewardForm.currency} onChange={handleRewardFormChange}><option value="EGP">EGP</option><option value="USD">USD</option></select></label>
          <button type="submit" disabled={rewardSaving || sellerStatus !== 'VERIFIED'}>{rewardSaving ? 'Saving...' : 'Add discount reward'}</button>
        </form>
        <div className="seller-reward-list">
          {sellerRewards.length ? sellerRewards.map(reward => (
            <article className="seller-reward-row" key={reward.id}>
              <strong>{reward.name}</strong>
              <span>{reward.points_cost} points</span>
              <span>{reward.value_amount} {reward.currency || ''} off</span>
              <span>{reward.codes_issued} codes issued</span>
            </article>
          )) : <p>No discount rewards created yet.</p>}
        </div>
      </section>
      <section className="seller-products-panel" aria-labelledby="seller-products-title">
        <div className="seller-rewards-heading">
          <div><p className="dashboard-label">POINTS SHOP</p><h2 id="seller-products-title">Products and pickup orders</h2></div>
        </div>
        {marketplaceError && <p className="seller-reward-error" role="alert">{marketplaceError}</p>}
        <div className="seller-product-orders" id="product-orders">
          <h3>Pickup orders ({productOrders.filter(order => order.status === 'pending').length} awaiting confirmation)</h3>
          <p className="seller-product-orders-account">
            Orders for seller account #{userData.id} ({userData.name || 'Seller'}).
          </p>
          {productOrders.length ? productOrders.map(order => (
            <article className="seller-product-order-row" key={order.id}>
              <div><strong>{order.product_name}</strong><span>{order.points_cost} points · {order.user_name} ({order.user_email})</span></div>
              <span className={`product-order-status ${order.status}`}>{order.status}</span>
              {order.status === 'pending' && (
                <div className="seller-product-order-actions">
                  <button type="button" disabled={updatingOrderId === order.id} onClick={() => handleProductOrderUpdate(order, 'approved')}>Confirm order and deduct points</button>
                  <button type="button" disabled={updatingOrderId === order.id} onClick={() => handleProductOrderUpdate(order, 'rejected')}>Reject and release stock</button>
                </div>
              )}
              {order.status === 'approved' && (
                <>
                  <span>Confirmed; customer points deducted.</span>
                  <button type="button" disabled={updatingOrderId === order.id} onClick={() => handleProductOrderUpdate(order, 'fulfilled')}>Mark picked up</button>
                </>
              )}
            </article>
          )) : <p>No pickup orders for this seller account. Check that you are signed in as seller #5 and refresh this page.</p>}
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
      <section className="coupon-lookup-panel" aria-labelledby="coupon-lookup-title">
        <h2 id="coupon-lookup-title">Coupon / Discount Code</h2>
        <p className="coupon-lookup-intro">Find this seller's active coupons by customer email, then redeem a selected coupon.</p>
        <form className="coupon-lookup-form" onSubmit={handleCouponsByEmail}>
          <input
            type="email"
            value={couponEmail}
            onChange={event => setCouponEmail(event.target.value)}
            placeholder="Customer email"
            aria-label="Customer email"
            required
          />
          <button type="submit" disabled={emailCouponLoading || sellerStatus !== 'VERIFIED'}>
            {emailCouponLoading ? 'Searching...' : 'Find Active Coupons'}
          </button>
        </form>
        {emailCouponError && <p className="coupon-lookup-error" role="alert">{emailCouponError}</p>}
        {emailCoupons && (
          <div className="seller-customer-coupons" aria-live="polite">
            {emailCoupons.length ? emailCoupons.map(coupon => {
              const redeemed = coupon.status === 'REDEEMED';
              return (
                <article className={`coupon-lookup-result ${redeemed ? 'invalid' : 'valid'}`} key={coupon.id}>
                  <strong>{redeemed ? 'USED - Coupon Redeemed' : 'ACTIVE - Valid Coupon'}</strong>
                  <p>Customer: {coupon.user_name || coupon.user_email}</p>
                  <p>Reward: {coupon.reward_name || 'Discount'} - {coupon.value_amount ?? coupon.reward_value ?? 0} {coupon.currency || 'points'}</p>
                  <p>Coupon: {coupon.public_reference}</p>
                  {redeemed
                    ? <p>Used: {coupon.redeemed_at ? new Date(coupon.redeemed_at).toLocaleString() : 'Just now'}{coupon.redeemed_by_name ? ` by ${coupon.redeemed_by_name}` : ''}</p>
                    : coupon.expires_at && <p>Expires: {new Date(coupon.expires_at).toLocaleString()}</p>}
                  <button
                    type="button"
                    disabled={redeemed || redeemingCouponId === coupon.id}
                    onClick={() => handleRedeemCustomerCoupon(coupon.id)}
                  >
                    {redeemed ? 'Used' : redeemingCouponId === coupon.id ? 'Checking...' : 'Check / Use Coupon'}
                  </button>
                </article>
              );
            }) : <p>No active coupons for this customer at your store.</p>}
          </div>
        )}
        {sellerStatus !== 'VERIFIED' && <p className="coupon-lookup-disabled">Coupon search will be available after Seller verification.</p>}
        <p className="coupon-lookup-intro">Or search using a discount code:</p>
        <form className="coupon-lookup-form" onSubmit={handleCouponLookup}>
          <input value={couponCode} onChange={event => setCouponCode(event.target.value)} placeholder="Search discount code" aria-label="Discount code" />
          <button type="submit" disabled={couponLoading || !couponCode.trim()}>{couponLoading ? 'Searching...' : 'Search Coupon'}</button>
        </form>
        {couponResult?.error && <p className="coupon-lookup-error">{couponResult.error}</p>}
        {couponResult && !couponResult.error && (
          <div className={`coupon-lookup-result ${couponResult.valid ? 'valid' : 'invalid'}`}>
            <strong>{
              couponResult.valid
                ? 'ACTIVE - Valid Coupon'
                : (couponResult.effective_status || couponResult.status)?.toUpperCase() === 'REDEEMED'
                  ? 'USED - Coupon Already Redeemed'
                  : (couponResult.effective_status || couponResult.status)?.toUpperCase() === 'EXPIRED'
                    ? 'EXPIRED - Coupon Expired'
                    : 'INVALID - Coupon Cannot Be Used'
            }</strong>
            <p>Customer: {couponResult.user_name || 'Not available'}</p>
            {couponResult.user_profile_image && <img className="coupon-customer-image" src={couponResult.user_profile_image} alt="Customer profile" />}
            <p>Reward: {couponResult.reward_value ?? couponResult.value_amount ?? 0}</p>
            {couponResult.final_weight && <p>Final weight: {couponResult.final_weight} kg</p>}
            {couponResult.redeemed_at && <p>Used: {new Date(couponResult.redeemed_at).toLocaleString()}{couponResult.redeemed_by_name ? ` by ${couponResult.redeemed_by_name}` : ''}</p>}
            {!couponResult.redeemed_at && couponResult.expires_at && <p>Expires: {new Date(couponResult.expires_at).toLocaleString()}</p>}
            {couponResult.valid && <button type="button" onClick={handleCouponRedeem}>Redeem Coupon</button>}
          </div>
        )}
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