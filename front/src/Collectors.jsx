import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import AccountSidebar from './AccountSidebar';
import './Collectors.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const DEFAULT_MAP_POSITION = [30.0444, 31.2357];

const parseLocation = (location) => {
  if (!location) return null;
  if (typeof location === 'object') {
    const values = [location.y, location.x];
    if (values.some(value => !Number.isFinite(Number(value)))) return null;
    return [Number(values[0]), Number(values[1])];
  }

  const locationText = String(location).trim();
  const values = locationText.replace(/[()]/g, '').split(',').map(value => Number(value.trim()));

  if (values.length !== 2 || values.some(value => !Number.isFinite(Number(value)))) return null;
  return locationText.startsWith('(') && locationText.endsWith(')')
    ? [Number(values[1]), Number(values[0])]
    : [Number(values[0]), Number(values[1])];
};

const parseRequestLocation = (location) => {
  return parseLocation(location);
};

const sameId = (firstId, secondId) => String(firstId) === String(secondId);
const hasRequestStatus = (request, ...statuses) => statuses.includes(String(request.status || '').toUpperCase());

const getDistanceInKm = (firstPosition, secondPosition) => {
  if (!firstPosition || !secondPosition) return null;
  const toRadians = value => (value * Math.PI) / 180;
  const [firstLat, firstLng] = firstPosition.map(toRadians);
  const [secondLat, secondLng] = secondPosition.map(toRadians);
  const latitudeDelta = secondLat - firstLat;
  const longitudeDelta = secondLng - firstLng;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const RecenterMap = ({ position }) => {
  const map = useMap();
  map.setView(position, 14);
  return null;
};

const CollectorLocationMarker = ({ position, onChange }) => {
  useMapEvents({
    click(event) {
      onChange([event.latlng.lat, event.latlng.lng]);
    }
  });

  return (
    <Marker position={position}>
      <Popup>Collector location</Popup>
    </Marker>
  );
};

const Collectors = ({ setUser }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);
  const [userType, setUserType] = useState(null);
  const [collectorLocation, setCollectorLocation] = useState('');
  const [collectorCity, setCollectorCity] = useState('');
  const [mapPosition, setMapPosition] = useState(DEFAULT_MAP_POSITION);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', registry: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [requestFilter, setRequestFilter] = useState('all');
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [distanceLimit, setDistanceLimit] = useState('all');
  const [requestSort, setRequestSort] = useState('distance');
  const [operationLoadingId, setOperationLoadingId] = useState(null);
  const [collectorDashboard, setCollectorDashboard] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const updateStoredUser = (updatedUser) => {
    const normalizedUser = {
      ...updatedUser,
      profileImage: updatedUser.profileImage || updatedUser.profile_image || '',
      location_name: updatedUser.location_name || ''
    };
    setUserData(normalizedUser);
    localStorage.setItem('greenovation_user', JSON.stringify(normalizedUser));
  };

  const saveCollectorProfile = async (changes) => {
    const response = await fetch(`http://localhost:4000/collectors/${userData.id}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save profile');
    updateStoredUser(data.user);
  };

  const handleProfileInput = (event) => {
    setProfileForm({ ...profileForm, [event.target.name]: event.target.value });
  };

  const handleProfileSave = async () => {
    try {
      setSavingProfile(true);
      await saveCollectorProfile(profileForm);
      setIsEditingProfile(false);
      setError('');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const updateCity = async (position) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position[0]}&lon=${position[1]}`);
      const data = await response.json();
      const address = data.address || {};
      const city = address.city || address.town || address.village || address.municipality || 'Selected location';
      setCollectorCity(city);
      return city;
    } catch (geocodeError) {
      setCollectorCity('Selected location');
      return 'Selected location';
    }
  };

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("greenovation_user"));
    const storedUserType = localStorage.getItem("greenovation_user_type");
    
    if (!storedUser || storedUserType !== 'collector') {
      navigate('/');
      return;
    }

    const refreshRequests = () => {
      if (document.visibilityState === 'visible') fetchRequests(true);
    };

    const refreshInterval = window.setInterval(refreshRequests, 10000);
    window.addEventListener('focus', refreshRequests);
    document.addEventListener('visibilitychange', refreshRequests);
    
    const normalizedStoredUser = {
      ...storedUser,
      profileImage: storedUser.profileImage || storedUser.profile_image || ''
    };
    setUserData(normalizedStoredUser);
    setUserType(storedUserType);
    setProfileForm({
      name: normalizedStoredUser.name || '',
      phone: normalizedStoredUser.phone || '',
      registry: normalizedStoredUser.registry || ''
    });
    setCollectorCity(normalizedStoredUser.location_name || '');
    
    if (normalizedStoredUser) {
      fetchRequests();
      fetchCollectorDashboard();
      // Load collector's saved location
      if (normalizedStoredUser.gps) {
        const gpsStr = typeof normalizedStoredUser.gps === 'object' ? `${normalizedStoredUser.gps.x}, ${normalizedStoredUser.gps.y}` : normalizedStoredUser.gps;
        setCollectorLocation(gpsStr);
        const savedPosition = parseLocation(normalizedStoredUser.gps) || DEFAULT_MAP_POSITION;
        setMapPosition(savedPosition);
        if (!normalizedStoredUser.location_name) {
          updateCity(savedPosition).then((city) => {
            fetch(`http://localhost:4000/collectors/${normalizedStoredUser.id}/profile`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ location_name: city })
            }).catch((saveError) => setError(saveError.message));
          });
        }
      }
    }

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshRequests);
      document.removeEventListener('visibilitychange', refreshRequests);
    };
  }, [navigate]);

  const fetchRequests = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem('greenovation_token');
      if (!token) {
        setError('Please sign in again to access assigned collection requests.');
        if (!silent) setLoading(false);
        return;
      }
      const response = await fetch('http://localhost:4000/api/v2/collector/requests?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        setRequests((data.requests || []).map(request => ({
          ...request,
          weight: request.weight ?? request.estimated_weight
        })));
      } else {
        setError(data.error || 'Failed to fetch requests');
      }
      if (!silent) setLoading(false);
    } catch (err) {
      console.error('Failed to refresh collector requests:', err);
      setError('Failed to fetch requests');
      if (!silent) setLoading(false);
    }
  };

  const fetchCollectorDashboard = async () => {
    const token = localStorage.getItem('greenovation_token');
    if (!token) return;
    try {
      const response = await fetch('http://localhost:4000/api/v2/collector/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) setCollectorDashboard((await response.json()).dashboard);
    } catch (dashboardError) {
      console.error('Failed to load collector dashboard:', dashboardError);
    }
  };

  const refreshCollectorData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchRequests(true), fetchCollectorDashboard()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('greenovation_user');
    localStorage.removeItem('greenovation_user_type');
    localStorage.removeItem('greenovation_token');
    setUser(null);
    navigate('/');
  };

  const handleCollectRequest = async (requestId) => {
    try {
      if (!collectorLocation) {
        setError('Please set your location first');
        return;
      }

      const response = await fetch('http://localhost:4000/api/requests/collect', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          collector_id: userData.id,
          collector_location: collectorLocation
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update request status in local state
        setRequests(current => current.map(req => req.id === requestId ? {
          ...req,
          has_requested: true,
          collector_candidates: [
            ...(req.collector_candidates || []).filter(candidate => candidate.id !== userData.id),
            { id: userData.id, name: userData.name, profile_image: userData.profileImage }
          ]
        } : req));
        alert(data.message || 'Your request to collect was sent to the user.');
        await fetchRequests();
      } else {
        setError(data.error || 'Failed to collect request');
      }
    } catch (err) {
      setError(err.message || 'Failed to collect request');
    }
  };

  const getDeviceLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser does not support geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(new Error(error.code === error.PERMISSION_DENIED
        ? 'Location permission is required to start the trip.'
        : error.code === error.TIMEOUT
          ? 'Could not get your current location in time. Please try again.'
          : 'Could not get your current location. Please try again.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const runCollectorOperation = async (requestId, operation) => {
    try {
      setOperationLoadingId(requestId);
      setError('');
      const position = await getDeviceLocation();
      const body = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      if (operation === 'weight') {
        const request = requests.find(item => item.id === requestId);
        const enteredWeight = window.prompt(`Actual collected weight in kg (estimate: ${request?.weight || 'unknown'} kg):`, request?.weight || '');
        if (enteredWeight === null) return;
        body.actual_weight = Number(enteredWeight);
      }
      const endpoint = operation === 'start'
        ? `/api/v2/requests/${requestId}/trip/start`
        : operation === 'arrival'
          ? `/api/v2/requests/${requestId}/arrival`
          : `/api/v2/requests/${requestId}/weight`;
      const response = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('greenovation_token') || ''}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        const retryMessage = data.retryable
          ? `${data.error} Please wait a moment and try again.`
          : data.error;
        throw new Error(retryMessage || 'Operation could not be completed');
      }
      setRequests(current => current.map(request => request.id === requestId ? { ...request, ...data.request } : request));
      await fetchRequests();
      await fetchCollectorDashboard();
    } catch (operationError) {
      setError(operationError.message || 'Operation could not be completed');
    } finally {
      setOperationLoadingId(null);
    }
  };

  const handleGetGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const nextPosition = [latitude, longitude];
          setCollectorLocation(`${latitude},${longitude}`);
          setMapPosition(nextPosition);
          updateCity(nextPosition).then((city) => {
            saveCollectorProfile({ gps: `${latitude},${longitude}`, location_name: city }).catch((saveError) => setError(saveError.message));
          });
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

  const handleMapLocationChange = (position) => {
    setMapPosition(position);
    setCollectorLocation(`${position[0].toFixed(6)},${position[1].toFixed(6)}`);
    updateCity(position).then((city) => {
      saveCollectorProfile({ gps: `${position[0]},${position[1]}`, location_name: city }).catch((saveError) => setError(saveError.message));
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CREATED': return '#ffc107';
      case 'pending': return '#ffc107';
      case 'ASSIGNED': return '#28a745';
      case 'assigned': return '#28a745';
      case 'COLLECTOR_EN_ROUTE': return '#3498db';
      case 'ARRIVED': return '#9b59b6';
      case 'AWAITING_USER_CONFIRMATION': return '#ffc107';
      case 'COMPLETED': return '#6c757d';
      case 'in_progress': return '#27ae60';
      case 'completion_pending': return '#ffc107';
      case 'completed': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'CREATED': return '⏳ Pending';
      case 'pending': return '⏳ Pending';
      case 'ASSIGNED': return '✅ Assigned';
      case 'assigned': return '✅ Assigned';
      case 'COLLECTOR_EN_ROUTE': return '🚚 On The Way';
      case 'ARRIVED': return '📍 Arrived';
      case 'AWAITING_USER_CONFIRMATION': return '⚖️ Waiting for Weight Confirmation';
      case 'COMPLETED': return '✅ Completed';
      case 'in_progress': return '🔄 In Progress';
      case 'completion_pending': return '⏳ Waiting for user confirmation';
      case 'completed': return '✅ Completed';
      default: return status;
    }
  };

  const collectorCoordinates = parseLocation(userData?.gps) || parseLocation(collectorLocation);
  const materialLabel = (type) => ({
    plastic: 'Plastic',
    paper: 'Paper',
    metal: 'Metal',
    glass: 'Glass',
    organic: 'Organic',
    other: 'Other'
  }[type] || type || 'Unknown');

  const requestsWithDistance = requests.map(request => ({
    ...request,
    distance: getDistanceInKm(collectorCoordinates, parseRequestLocation(request.gps))
  }));

  const filteredRequests = requestsWithDistance
    .filter(request => {
      if (requestFilter === 'mine' && !sameId(request.collector_id, userData.id)) return false;
      if (requestFilter === 'available' && !hasRequestStatus(request, 'PENDING', 'CREATED')) return false;
      if (requestFilter === 'in_progress' && !hasRequestStatus(request, 'IN_PROGRESS', 'COLLECTOR_EN_ROUTE', 'ARRIVED')) return false;
      if (requestFilter === 'completion_pending' && !hasRequestStatus(request, 'COMPLETION_PENDING', 'AWAITING_USER_CONFIRMATION')) return false;
      if (requestFilter === 'completed' && !hasRequestStatus(request, 'COMPLETED')) return false;
      if (!['all', 'mine', 'available', 'in_progress', 'completion_pending', 'completed'].includes(requestFilter)
        && !hasRequestStatus(request, requestFilter.toUpperCase())) return false;
      if (materialFilter !== 'all' && request.material_type !== materialFilter) return false;
      if (materialSearch && !materialLabel(request.material_type).toLowerCase().includes(materialSearch.toLowerCase())) return false;
      if (distanceLimit !== 'all' && (request.distance === null || request.distance > Number(distanceLimit))) return false;
      return true;
    })
    .sort((firstRequest, secondRequest) => {
      if (requestSort === 'distance') return (firstRequest.distance ?? Number.MAX_SAFE_INTEGER) - (secondRequest.distance ?? Number.MAX_SAFE_INTEGER);
      if (requestSort === 'weight') return Number(secondRequest.weight || 0) - Number(firstRequest.weight || 0);
      return new Date(secondRequest.created_at) - new Date(firstRequest.created_at);
    });

  if (!userData) {
    return <div className="collectors-container">
      <div className="auth-message">
        <h2>🔒 Authentication Required</h2>
        <p>Please log in as a collector to access this page.</p>
        <button onClick={() => navigate('/')} className="home-btn">Go to Home</button>
      </div>
    </div>;
  }

  const myCollections = requests.filter(request => sameId(request.collector_id, userData.id));
  return (
    <div className="collector-layout">
      <AccountSidebar
        userData={userData}
        userType="collector"
        sections={[
          { id: 'requests', label: 'Available Requests' },
          { id: 'collections', label: 'My Collections' }
        ]}
        onRefresh={refreshCollectorData}
        refreshing={refreshing}
        onSignOut={handleSignOut}
      />

      <main className="collector-main">
        <header className="collector-topbar" id="dashboard">
          <div>
            <p className="dashboard-label">COLLECTOR PORTAL</p>
            <h1>Collector Dashboard</h1>
          </div>
          <span className="topbar-breadcrumb">Home / Collector Dashboard</span>
        </header>

        {collectorDashboard && (
          <section className="collector-summary" aria-label="Today's collection summary">
            <div><strong>{collectorDashboard.assigned_requests}</strong><span>Assigned Requests</span></div>
            <div><strong>{collectorDashboard.in_progress}</strong><span>In Progress</span></div>
            <div><strong>{collectorDashboard.pending_confirmation}</strong><span>Waiting for User</span></div>
            <div><strong>{collectorDashboard.completed_today}</strong><span>Completed Today</span></div>
            <div><strong>{collectorDashboard.disputed_requests}</strong><span>Disputed</span></div>
          </section>
        )}

        {collectorDashboard && (
          <section className="collector-material-totals" aria-labelledby="collector-material-totals-title">
            <div className="collector-material-totals-heading">
              <p className="dashboard-label">COMPLETED COLLECTIONS</p>
              <h2 id="collector-material-totals-title">Collected weight by material</h2>
              <p>Total verified weight from all completed requests assigned to you.</p>
            </div>
            {collectorDashboard.material_totals?.length ? (
              <div className="collector-material-totals-grid">
                {collectorDashboard.material_totals.map(item => (
                  <div className="collector-material-total" key={item.material_type}>
                    <span>{materialLabel(item.material_type)}</span>
                    <strong>{Number(item.total_weight_kg).toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="collector-material-totals-empty">No completed collection weights yet.</p>
            )}
          </section>
        )}

        <section className="collector-profile-panel" id="profile">
          <div className="panel-title profile-title-row">
            <div>
            <p className="dashboard-label">PERSONAL INFORMATION</p>
            <h2>My Profile</h2>
            </div>
            <button
              type="button"
              className="profile-edit-button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
            >
              {isEditingProfile ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
          {isEditingProfile ? (
            <div className="profile-edit-grid">
              <label>Full Name<input name="name" value={profileForm.name} onChange={handleProfileInput} /></label>
              <label>Phone<input name="phone" value={profileForm.phone} onChange={handleProfileInput} /></label>
              <label>Registration<input name="registry" value={profileForm.registry} onChange={handleProfileInput} /></label>
              <label>Email<input value={userData.email || 'Not provided'} disabled /></label>
              <button type="button" className="profile-save-button" onClick={handleProfileSave} disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
          <div className="collector-details-grid">
            <div className="collector-detail"><span className="detail-label">Full Name</span><strong>{userData.name || 'Not provided'}</strong></div>
            <div className="collector-detail"><span className="detail-label">Email</span><strong>{userData.email || 'Not provided'}</strong></div>
            <div className="collector-detail"><span className="detail-label">Phone</span><strong>{userData.phone || 'Not provided'}</strong></div>
            <div className="collector-detail"><span className="detail-label">Registration</span><strong>{userData.registry || 'Not provided'}</strong></div>
            <div className="collector-detail"><span className="detail-label">Age</span><strong>{userData.age || 'Not provided'}</strong></div>
            <div className="collector-detail"><span className="detail-label">Experience</span><strong>{userData.experience_years ?? 'Not provided'} years</strong></div>
            <div className="collector-detail"><span className="detail-label">Points</span><strong>{userData.points || 0}</strong></div>
            <div className="collector-detail"><span className="detail-label">Account Status</span><strong>Active</strong></div>
            <div className="collector-detail collector-location-detail"><span className="detail-label">Location</span><strong>{collectorCity || 'Map location selected'}</strong></div>
          </div>
          )}

          <div className="profile-location-section" id="location">
            <div className="location-header">
              <h3>📍 Your Location</h3>
              <button
                onClick={handleGetGPS}
                className="location-toggle-btn"
              >
                Update Location
              </button>
            </div>

            <div className="location-form">
              <div className="form-group">
                <label>Select your location on the map</label>
                <div className="collector-map">
                  <MapContainer center={mapPosition} zoom={14} className="map">
                    <RecenterMap position={mapPosition} />
                    <TileLayer
                      attribution="&copy; OpenStreetMap"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <CollectorLocationMarker
                      position={mapPosition}
                      onChange={handleMapLocationChange}
                    />
                  </MapContainer>
                </div>
                <button type="button" onClick={handleGetGPS} className="gps-btn">
                  Use My Current Location
                </button>
              </div>
            </div>
          </div>
        </section>

      {/* Error Display */}
      {error && (
        <div className="error-modal-backdrop" role="presentation">
          <div className="error-message" role="alertdialog" aria-modal="true" aria-label="Notification">
            <div className="error-message-content">
              <strong>Notification</strong>
              <p>{error}</p>
            </div>
            <button onClick={() => setError('')} className="close-error" aria-label="Close notification">×</button>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="requests-section" id="requests">
        <div className="section-heading">
          <p className="dashboard-label">COLLECTION WORKFLOW</p>
          <h2>Collection requests</h2>
          <p className="section-description">Choose an available request, follow your active work, and confirm completion.</p>
        </div>
        <div className="request-filters collector-request-filters" role="group" aria-label="Filter collection requests">
          {[
            ['all', 'All'],
            ['available', 'Available'],
            ['in_progress', 'In progress'],
            ['completion_pending', 'Awaiting confirmation'],
            ['completed', 'Completed'],
            ['mine', 'My collections']
          ].map(([value, label]) => (
            <button key={value} type="button" className={requestFilter === value ? 'active' : ''} onClick={() => setRequestFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="request-tools" aria-label="Request search and sorting">
          <label>
            <span>Material type</span>
            <select value={materialFilter} onChange={event => setMaterialFilter(event.target.value)}>
              <option value="all">All materials</option>
              <option value="plastic">Plastic</option>
              <option value="paper">Paper</option>
              <option value="metal">Metal</option>
              <option value="glass">Glass</option>
              <option value="organic">Organic</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="request-search">
            <span>Search material</span>
            <input
              type="search"
              value={materialSearch}
              onChange={event => setMaterialSearch(event.target.value)}
              placeholder="e.g. plastic, metal"
            />
          </label>
          <label>
            <span>Distance</span>
            <select value={distanceLimit} onChange={event => setDistanceLimit(event.target.value)}>
              <option value="all">Any distance</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select value={requestSort} onChange={event => setRequestSort(event.target.value)}>
              <option value="distance">Nearest first</option>
              <option value="created">Newest first</option>
              <option value="weight">Heaviest first</option>
            </select>
          </label>
        </div>
        {!collectorCoordinates && (
          <div className="location-reminder">Set your location above to see the distance to every request.</div>
        )}
        
        {loading ? (
          <div className="loading">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="no-requests">
            <h3>No requests available</h3>
            <p>Check back later for new collection requests.</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="no-requests">
            <h3>No matching requests</h3>
            <p>Try another material, distance, or status filter.</p>
          </div>
        ) : (
          <div className="requests-grid">
            {filteredRequests.map(request => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <span className="request-id">#{request.id}</span>
                  <span 
                    className="request-status"
                    style={{ backgroundColor: getStatusColor(request.status) }}
                  >
                    {getStatusText(request.status)}
                  </span>
                </div>
                
                <div className="request-content">
                  <div className="request-info">
                    {request.material_type && (
                      <p>♻️ Material: <strong>{materialLabel(request.material_type)}</strong></p>
                    )}
                    <h4>📦 Estimated weight: {request.weight} kg</h4>
                    {request.actual_weight && (
                      <p>⚖️ Actual weight: {request.actual_weight} kg ({(Number(request.actual_weight) - Number(request.weight)).toFixed(2)} kg difference)</p>
                    )}
                    <p>📍 Location: {request.location}</p>
                    <p className="request-distance">
                      {request.distance === null ? '📏 Distance unavailable' : `📏 ${request.distance.toFixed(1)} km away`}
                    </p>
                    {request.description && (
                      <p>📝 Description: {request.description}</p>
                    )}
                    {request.gps && (
                      <p>🗺️ GPS: {typeof request.gps === 'object' ? `${request.gps.x}, ${request.gps.y}` : request.gps}</p>
                    )}
                    {request.collector_id && !sameId(request.collector_id, userData.id) && (
                      <p>👤 Assigned to another Collector</p>
                    )}
                  </div>
                  
                  <div className="request-meta">
                    <small>Created: {new Date(request.created_at).toLocaleDateString()}</small>
                    {request.collected_at && (
                      <small>Collected: {new Date(request.collected_at).toLocaleDateString()}</small>
                    )}
                  </div>
                </div>
                
                <div className="request-actions">
                  {hasRequestStatus(request, 'PENDING', 'CREATED') ? (
                    request.has_requested ? (
                      <button type="button" className="collect-btn" disabled>
                        ✅ Request Sent — Waiting for User
                      </button> 
                                           
                    ) : (
                      <button
                        onClick={() => handleCollectRequest(request.id)}
                        className="collect-btn"
                      >
                        🚛️ Collect Request
                      </button>
                    )
                  ) : hasRequestStatus(request, 'ASSIGNED', 'IN_PROGRESS') && sameId(request.collector_id, userData.id) ? (
                    <button
                      onClick={() => runCollectorOperation(request.id, 'start')}
                      className="collect-btn"
                      disabled={operationLoadingId === request.id}
                    >
                      {operationLoadingId === request.id ? 'Starting...' : 'Start Trip'}
                    </button>
                  ) : hasRequestStatus(request, 'COLLECTOR_EN_ROUTE') && sameId(request.collector_id, userData.id) ? (
                    <button onClick={() => runCollectorOperation(request.id, 'arrival')} className="collect-btn" disabled={operationLoadingId === request.id}>
                      {operationLoadingId === request.id ? 'Checking GPS...' : 'Confirm Arrival'}
                    </button>
                  ) : hasRequestStatus(request, 'ARRIVED') && sameId(request.collector_id, userData.id) ? (
                    <button onClick={() => runCollectorOperation(request.id, 'weight')} className="complete-btn" disabled={operationLoadingId === request.id}>
                      {operationLoadingId === request.id ? 'Submitting...' : 'Enter Actual Weight'}
                    </button>
                  ) : (
                    <div className="request-status-info">
                      {hasRequestStatus(request, 'ASSIGNED') && !sameId(request.collector_id, userData.id) && (
                        <span>🔒 Already assigned to another collector</span>
                      )}
                      {hasRequestStatus(request, 'IN_PROGRESS') && !sameId(request.collector_id, userData.id) && (
                        <span>🔄 In progress with another collector</span>
                      )}
                      {hasRequestStatus(request, 'AWAITING_USER_CONFIRMATION', 'COMPLETION_PENDING') && sameId(request.collector_id, userData.id) && (
                        <span>⏳ Waiting for the user to confirm completion</span>
                      )}
                      {hasRequestStatus(request, 'COMPLETED') && (
                        <span>✅ Request completed</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Collections */}
      <div className="my-collections-section" id="collections">
        <h2>📋 My Collections</h2>
        {myCollections.length === 0 ? (
          <div className="no-collections">No collections completed yet.</div>
        ) : (
          <div className="collections-grid">
            {myCollections.map(request => (
              <div key={request.id} className="collection-card">
                <div className="collection-header">
                  <span className="request-id">#{request.id}</span>
                  <span 
                    className="request-status"
                    style={{ backgroundColor: getStatusColor(request.status) }}
                  >
                    {getStatusText(request.status)}
                  </span>
                </div>
                
                <div className="collection-info">
                  <h4>📦 {request.weight} kg</h4>
                  <p>📍 {request.location}</p>
                  <small>Collected: {new Date(request.created_at).toLocaleDateString()}</small>
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

export default Collectors;
