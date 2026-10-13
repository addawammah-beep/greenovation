import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import AccountSidebar, { AccountPageHeader, AccountProfilePanel } from './AccountSidebar';
import "./profile.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const DEFAULT_REQUEST_POSITION = [30.0444, 31.2357];

const RequestMapView = ({ position }) => {
  const map = useMap();
  map.setView(position, 14);
  return null;
};

const RequestLocationMarker = ({ position, onChange }) => {
  useMapEvents({
    click(event) {
      onChange([event.latlng.lat, event.latlng.lng]);
    }
  });

  return <Marker position={position}><Popup>Request location</Popup></Marker>;
};

function Profile({ setUser }) {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [userType, setUserType] = useState(null);
  const [requests, setRequests] = useState([]);
  const [offers, setOffers] = useState([]); // سيتم تخزين العروض هنا
  const [loading, setLoading] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ material_type: '', weight: '', location: '', description: '', gps: '' });
  const [requestMapPosition, setRequestMapPosition] = useState(DEFAULT_REQUEST_POSITION);
  const [confirmingRequestId, setConfirmingRequestId] = useState(null);
  const [requestActionError, setRequestActionError] = useState('');
  const [requestCreateError, setRequestCreateError] = useState('');
  const [coupons, setCoupons] = useState([]);

  const getCompletionDuration = (request) => {
    if (!request.collected_at || !request.completed_at) return null;
    const durationMs = new Date(request.completed_at) - new Date(request.collected_at);
    if (!Number.isFinite(durationMs) || durationMs < 0) return null;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  };

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("greenovation_user"));
    const storedUserType = localStorage.getItem("greenovation_user_type");
    setUserData(storedUser);
    setUserType(storedUserType);

    if (storedUser) {
      fetchUserData(storedUser, storedUserType);
    }
  }, []);

  const fetchUserData = async (user, type) => {
    try {
      setLoading(true);
      if (type === "user") {
        // جلب طلبات المستخدم العادي
        const res = await fetch(`http://localhost:4000/api/requests/user/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setRequests(data);
        }
        const token = localStorage.getItem('greenovation_token');
        const couponsResponse = await fetch('http://localhost:4000/api/v2/user/coupons', {
          headers: { Authorization: `Bearer ${token || ''}` }
        });
        if (couponsResponse.ok) {
          const couponData = await couponsResponse.json();
          setCoupons(couponData.coupons || []);
          if (couponData.points !== undefined) {
            const updatedUser = { ...user, points: Number(couponData.points) };
            setUserData(updatedUser);
            localStorage.setItem('greenovation_user', JSON.stringify(updatedUser));
          }
        }
      } else if (type === "collector") {
        // جلب العروض المتاحة للمجمعين فقط من قاعدة البيانات
        const res = await fetch(`http://localhost:4000/api/offers`); // افترضنا أن هذا المسار يجلب كل العروض
        if (res.ok) {
          const data = await res.json();
          setOffers(data);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('greenovation_user');
    localStorage.removeItem('greenovation_user_type');
    localStorage.removeItem('greenovation_token');
    setUser(null);
    navigate('/');
  };

  if (!userData) return <h2>Please login first.</h2>;

  const completedRequests = requests.filter(request => String(request.status).toLowerCase() === 'completed');
  const assignedRequests = requests.filter(request => (
    (request.status === 'assigned' || request.status === 'in_progress') && request.collector_id
  ));
  const openRequests = requests.filter(request => (
    String(request.status).toLowerCase() !== 'completed' && !assignedRequests.some(assigned => assigned.id === request.id)
  ));
  const activeCoupons = coupons.filter(coupon => coupon.coupon_group === 'active');
  const inactiveCoupons = coupons.filter(coupon => coupon.coupon_group === 'inactive');

  const renderCoupon = (coupon) => (
    <article key={coupon.id} className="coupon-card">
      <div className="coupon-card-header">
        <strong>{coupon.code || coupon.public_reference}</strong>
        <span>{coupon.status === 'REDEEMED' ? 'Used' : 'Expired'}</span>
      </div>
      <p><b>Reward:</b> {coupon.reward_value ?? coupon.points_earned ?? 0} points</p>
      {coupon.final_weight && <p><b>Final weight:</b> {coupon.final_weight} kg</p>}
      <p><b>Created:</b> {new Date(coupon.created_at).toLocaleString()}</p>
      {coupon.redeemed_at && <p><b>Used:</b> {new Date(coupon.redeemed_at).toLocaleString()}{coupon.redeemed_by_name ? ` by ${coupon.redeemed_by_name}` : ''}</p>}
      {!coupon.redeemed_at && coupon.expires_at && <p><b>Expires:</b> {new Date(coupon.expires_at).toLocaleString()}</p>}
    </article>
  );

  const renderRequestCard = (request, showCompletionDetails = false) => (
    <article key={request.id} className="profile-request-card">
      <div className="profile-request-card-header">
        <strong>Request #{request.id}</strong>
        <span className={`profile-request-status ${request.status}`}>{request.status}</span>
      </div>
      <div className="profile-request-details">
        <p><b>Material:</b> {request.material_type || 'Not provided'}</p>
        <p><b>Weight:</b> {request.weight ?? request.estimated_weight} kg</p>
        <p><b>Location:</b> {request.location}</p>
        {request.description && <p><b>Description:</b> {request.description}</p>}
        {showCompletionDetails && (
          <>
            <p><b>Collector:</b> {request.collector_name || 'Not provided'}</p>
            <p><b>Completed:</b> {request.completed_at ? new Date(request.completed_at).toLocaleString() : 'Not provided'}</p>
            {request.collected_weight && <p><b>Collected quantity:</b> {request.collected_weight} kg (requested: {request.weight ?? request.estimated_weight} kg)</p>}
            {getCompletionDuration(request) && <p><b>Duration:</b> {getCompletionDuration(request)}</p>}
          </>
        )}
        {!showCompletionDetails && request.collector_name && (
          <p><b>Collector:</b> {request.collector_name}</p>
        )}
          {request.collector_profile_image && <img className="collector-profile-thumb" src={request.collector_profile_image} alt="Collector" />}
          {request.status === 'assigned' && <div className="profile-request-actions"><button type="button" onClick={() => handleRequestDecision(request.id, 'accept')}>Select Collector</button><button type="button" onClick={() => handleRequestDecision(request.id, 'reject')}>Reject</button></div>}
          {['AWAITING_USER_CONFIRMATION', 'completion_pending', 'waiting_user_weight_confirmation'].includes(request.status) && <div className="profile-request-actions"><p><b>Collector Actual Weight:</b> {request.actual_weight ?? request.collected_weight} kg</p><button type="button" disabled={confirmingRequestId === request.id} onClick={() => handleRequestDecision(request.id, 'confirm')}>{confirmingRequestId === request.id ? 'Saving...' : 'Confirm Weight'}</button><button type="button" disabled={confirmingRequestId === request.id} onClick={() => handleRequestDecision(request.id, 'dispute')}>Dispute Weight</button></div>}
          {['pending', 'CREATED'].includes(request.status) && request.collector_candidates?.length > 0 && (
            <div className="collector-candidates">
              <p><b>Collectors interested in this request:</b></p>
              {request.collector_candidates.map(candidate => (
                <div key={candidate.id} className="collector-candidate-row">
                  {candidate.profile_image && <img src={candidate.profile_image} alt="Collector" className="collector-profile-thumb" />}
                  <a href={`/collector-profile/${candidate.id}`} className="collector-profile-link">{candidate.name || 'Collector'}</a>
                  <button type="button" onClick={() => handleSelectCollector(request.id, candidate.id)}>Select</button>
                </div>
              ))}
            </div>
          )}
      </div>
    </article>
  );

  const handleRequestInput = (event) => {
    setRequestForm({ ...requestForm, [event.target.name]: event.target.value });
  };

  const resolveRequestCity = async (position) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position[0]}&lon=${position[1]}`);
      const data = await response.json();
      const address = data.address || {};
      return address.city || address.town || address.village || address.municipality || 'Selected location';
    } catch (geocodeError) {
      return 'Selected location';
    }
  };

  const handleRequestMapLocation = async (position) => {
    setRequestMapPosition(position);
    const city = await resolveRequestCity(position);
    setRequestForm(previous => ({
      ...previous,
      location: city,
      gps: `${position[0].toFixed(6)},${position[1].toFixed(6)}`
    }));
  };

  const handleRequestGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => handleRequestMapLocation([coords.latitude, coords.longitude]),
      () => console.error('Failed to get GPS location')
    );
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    setRequestCreateError('');
    try {
      const token = localStorage.getItem('greenovation_token');
      const response = await fetch('http://localhost:4000/api/v2/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          material_type: requestForm.material_type,
          estimated_weight: parseFloat(requestForm.weight),
          location: requestForm.location,
          description: requestForm.description,
          gps: requestForm.gps || null
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const message = response.status === 403
          ? 'This session does not have permission to create user requests. Sign out and sign back in with a user account, then try again.'
          : data.error || 'Failed to create request';
        throw new Error(message);
      }
      setRequests([data.request || data, ...requests]);
      setRequestForm({ material_type: '', weight: '', location: '', description: '', gps: '' });
      setShowRequestForm(false);
    } catch (requestError) {
      setRequestCreateError(requestError.message || 'Failed to create request');
      console.error(requestError);
    }
  };

  const handleRequestDecision = async (requestId, action) => {
    const endpoint = action === 'confirm' || action === 'reject-completion' ? 'confirm-completion' : 'respond';
    const requestAction = action === 'confirm' ? 'confirm' : action === 'reject-completion' ? 'reject' : action;
    try {
      setConfirmingRequestId(requestId);
      setRequestActionError('');
      const token = localStorage.getItem('greenovation_token');
      const isWeightDecision = action === 'confirm' || action === 'dispute';
      if (isWeightDecision && !token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch(isWeightDecision
        ? `http://localhost:4000/api/v2/requests/${requestId}/weight-confirmation`
        : `http://localhost:4000/api/requests/${endpoint}`, {
        method: isWeightDecision ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: isWeightDecision
          ? JSON.stringify({ action })
          : JSON.stringify({ request_id: requestId, user_id: userData.id, action: requestAction })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = response.status === 403 && isWeightDecision
          ? 'This session does not have user permissions to confirm weight. Sign out and sign back in with a user account, then try again.'
          : data.error || 'Unable to update request';
        throw new Error(message);
      }
      if (!data.request) throw new Error('The server did not return the updated request. Please refresh and check its status.');
      setRequests(current => current.map(request => String(request.id) === String(requestId) ? { ...request, ...data.request } : request));
      if (data.user) {
        const updatedUser = { ...userData, ...data.user };
        setUserData(updatedUser);
        localStorage.setItem('greenovation_user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      setRequestActionError(error.message);
    } finally {
      setConfirmingRequestId(null);
    }
  };

  const handleSelectCollector = async (requestId, collectorId) => {
    try {
      setRequestActionError('');
      const response = await fetch('http://localhost:4000/api/requests/select-collector', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, user_id: userData.id, collector_id: collectorId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to select collector');
      setRequests(current => current.map(request => request.id === requestId
        ? { ...request, ...data.request, collector_id: collectorId, status: 'in_progress' }
        : request));
    } catch (error) {
      setRequestActionError(error.message || 'Failed to select collector');
    }
  };

  return (
    <div className="account-layout">
      <AccountSidebar userData={userData} userType={userType} onSignOut={handleSignOut} onRefresh={() => fetchUserData(userData, userType)} refreshing={loading} sections={userType === 'user' ? [{ id: 'requests', label: 'My Requests' }] : [{ id: 'offers', label: 'Available Offers' }]} />
      <main className="account-main profile-container">
      <AccountPageHeader title="My Profile" />
      <AccountProfilePanel userData={userData} userType={userType} />
      {requestActionError && <p className="profile-request-action-error" role="alert">{requestActionError}</p>}
      
      <div className="profile-card">
        {userType === "user" && (
          <>
            <section className="points-balance-row" aria-label="Points balance">
              <div>
                <span>Total points</span>
                <strong>{Number(userData.points || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong>
              </div>
            </section>
            <section className="user-request-section completed-requests-section">
              <div className="user-request-section-heading"><p className="dashboard-label">HISTORY</p><h2>Completed Requests</h2><p>Requests collected and completed successfully.</p></div>
              <div className="profile-request-grid">{completedRequests.length ? completedRequests.map(request => renderRequestCard(request, true)) : <p className="profile-empty-state">No completed requests yet.</p>}</div>
            </section>
            <section className="user-request-section coupons-section">
              <div className="user-request-section-heading"><p className="dashboard-label">REWARDS</p><h2>My Coupons</h2><p>Use an active coupon at a participating seller.</p></div>
              <div className="coupon-columns">
                <div><h3>Active Coupons</h3><div className="coupon-grid">{activeCoupons.length ? activeCoupons.map(renderCoupon) : <p className="profile-empty-state">No active coupons.</p>}</div></div>
                <div><h3>Used / Expired Coupons</h3><div className="coupon-grid">{inactiveCoupons.length ? inactiveCoupons.map(renderCoupon) : <p className="profile-empty-state">No used or expired coupons.</p>}</div></div>
              </div>
            </section>
            <section className="user-request-section add-request-section">
              <div className="user-request-section-heading"><p className="dashboard-label">NEW COLLECTION</p><h2>Add a Request</h2><p>Create a new recycling collection request from your dashboard.</p></div>
              <button type="button" className="profile-add-request-button" onClick={() => { setShowRequestForm(!showRequestForm); setRequestCreateError(''); }}>{showRequestForm ? 'Cancel' : '+ New Request'}</button>
              {showRequestForm && (
                <form className="profile-request-form" onSubmit={handleCreateRequest}>
                  {requestCreateError && <p className="profile-request-action-error" role="alert">{requestCreateError}</p>}
                  <label>Material Type<select name="material_type" value={requestForm.material_type} onChange={handleRequestInput} required><option value="">Select material type</option><option value="plastic">Plastic</option><option value="paper">Paper</option><option value="metal">Metal</option><option value="glass">Glass</option><option value="organic">Organic</option><option value="other">Other</option></select></label>
                  <label>Weight (kg)<input type="number" name="weight" min="0.1" step="0.1" value={requestForm.weight} onChange={handleRequestInput} required /></label>
                  <div className="profile-request-location-field">
                    <label>Location</label>
                    <input name="location" value={requestForm.location} onChange={handleRequestInput} placeholder="Select a location on the map" required />
                    <label>GPS Coordinates</label>
                    <div className="profile-request-map">
                      <MapContainer center={requestMapPosition} zoom={14} className="map">
                        <RequestMapView position={requestMapPosition} />
                        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <RequestLocationMarker position={requestMapPosition} onChange={handleRequestMapLocation} />
                      </MapContainer>
                    </div>
                    <button type="button" className="profile-gps-button" onClick={handleRequestGPS}>Use My Current Location</button>
                  </div>
                  <label>Description<textarea name="description" value={requestForm.description} onChange={handleRequestInput} rows="4" /></label>
                  <button type="submit" className="profile-save-button">Submit Request</button>
                </form>
              )}
            </section>
            <section id="requests" className="user-request-section pending-requests-section">
              <div className="user-request-section-heading"><p className="dashboard-label">OPEN WORK</p><h2>Requests Not Completed</h2><p>Requests still waiting for a collector.</p></div>
              <div className="profile-request-grid">{openRequests.length ? openRequests.map(request => renderRequestCard(request)) : <p className="profile-empty-state">No open requests.</p>}</div>
            </section>
            <section className="user-request-section assigned-requests-section">
              <div className="user-request-section-heading"><p className="dashboard-label">ASSIGNED WORK</p><h2>Requests Assigned to a Collector</h2><p>A collector has selected these requests, but they are not completed yet.</p></div>
              <div className="profile-request-grid">{assignedRequests.length ? assignedRequests.map(request => renderRequestCard(request)) : <p className="profile-empty-state">No assigned requests.</p>}</div>
            </section>
          </>
        )}

        {/* قسم البائع */}
        {userType === "seller" && (
          <div className="profile-info">
            <h2>Seller Information</h2>
            <p><b>Name:</b> {userData.name}</p>
            <p><b>Email:</b> {userData.email}</p>
            <p><b>Phone:</b> {userData.phone || 'Not provided'}</p>
            <p><b>Registry:</b> {userData.registry}</p>
            <p><b>Location:</b> {userData.gps || 'Not provided'}</p>
            <p><b>Points:</b> {userData.points || 0}</p>
          </div>
        )}

        {/* قسم المجمع (Collector) - هنا تظهر العروض */}
        {userType === "collector" && (
          <>
            <div className="profile-info">
              <h2>Collector Information</h2>
              <p><b>Name:</b> {userData.name}</p>
              <p><b>Email:</b> {userData.email}</p>
              <p><b>Phone:</b> {userData.phone || 'Not provided'}</p>
              <p><b>Registry:</b> {userData.registry || 'Not provided'}</p>
              <p><b>Location:</b> {userData.gps || 'Not provided'}</p>
              <p><b>Points:</b> {userData.points || 0}</p>
            </div>

            <div className="offers-section">
              <h3>Available Offers for You</h3>
              {loading ? (
                <p>Loading offers...</p>
              ) : offers.length > 0 ? (
                <div className="offers-grid">
                  {offers.map((offer) => (
                    <div key={offer.id} className="offer-item-card">
                      <h4>💰 {offer.title}</h4>
                      <p><b>Material:</b> {offer.material_type}</p>
                      <p><b>Price:</b> {offer.price} EGP</p>
                      <p><b>Location:</b> {offer.location}</p>
                      <div className="expiry-tag">
                        ⏱️ Valid for: {offer.duration} days
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{color: '#666', fontStyle: 'italic'}}>No available offers at the moment.</p>
              )}
            </div>
          </>
        )}
      </div>
      </main>
    </div>
  );
}

export default Profile;