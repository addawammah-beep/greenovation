import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountSidebar, {
  AccountPageHeader,
  AccountProfilePanel
} from './AccountSidebar';
import './Requests.css';

const API_BASE_URL = 'http://localhost:4000';

const Requests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState(null);
  const [userType, setUserType] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [requestFilter, setRequestFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [form, setForm] = useState({
    material_type: '',
    weight: '',
    location: '',
    description: '',
    gps: ''
  });

  const navigate = useNavigate();

  /*
   * ============================================================
   * AUTH HELPERS
   * ============================================================
   */

  const getToken = () => {
    return localStorage.getItem('greenovation_token');
  };

  const getAuthHeaders = (includeJson = true) => {
    const token = getToken();

    return {
      ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  /*
   * ============================================================
   * LOAD USER
   * ============================================================
   */

  useEffect(() => {
    let storedUser = null;

    try {
      storedUser = JSON.parse(
        localStorage.getItem('greenovation_user') || 'null'
      );
    } catch (err) {
      console.error('Failed to read stored user:', err);
    }

    const storedUserType =
      localStorage.getItem('greenovation_user_type') || 'user';

    const token = getToken();

    if (!storedUser || !token) {
      navigate('/');
      return;
    }

    setUserData(storedUser);
    setUserType(storedUserType);

    fetchRequests(storedUser);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ============================================================
   * FETCH REQUESTS
   * ============================================================
   */

  const fetchRequests = async (user) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `${API_BASE_URL}/api/requests/user/${user.id}`,
        {
          method: 'GET',
          headers: getAuthHeaders(false)
        }
      );

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to fetch requests'
        );
      }

      /*
       * Backend may return:
       *   []
       * or
       *   { requests: [] }
       */
      const receivedRequests = Array.isArray(data)
        ? data
        : Array.isArray(data.requests)
          ? data.requests
          : [];

      setRequests(receivedRequests);
    } catch (err) {
      console.error('Fetch requests error:', err);
      setError(err.message || 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  /*
   * ============================================================
   * CREATE REQUEST
   * ============================================================
   *
   * IMPORTANT:
   * user_id is intentionally NOT sent from the frontend.
   * The backend must identify the authenticated user from JWT.
   */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userData) {
      setError('User not logged in');
      return;
    }

    if (!getToken()) {
      setError('Your session has expired. Please log in again.');
      navigate('/');
      return;
    }

    if (!form.material_type) {
      setError('Please select a material type');
      return;
    }

    const weight = Number(form.weight);

    if (!Number.isFinite(weight) || weight <= 0) {
      setError('Please enter a valid estimated weight');
      return;
    }

    if (!form.location.trim()) {
      setError('Please enter the pickup location');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(
        `${API_BASE_URL}/api/v2/requests`,
        {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            material_type: form.material_type,
            estimated_weight: weight,
            location: form.location.trim(),
            description: form.description.trim(),
            gps: form.gps || null
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error || 'Failed to create request'
        );
      }

      const created = data.request || data;

      setRequests((current) => [
        created,
        ...current
      ]);

      setForm({
        material_type: '',
        weight: '',
        location: '',
        description: '',
        gps: ''
      });

      setShowForm(false);
      setError('');
    } catch (err) {
      console.error('Create request error:', err);
      setError(err.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * ============================================================
   * USER RESPONSE TO ASSIGNED COLLECTOR
   * ============================================================
   */

  const handleRespondToRequest = async (requestId, action) => {
    if (!userData) return;

    try {
      setActionLoading(`${requestId}-respond`);
      setError('');

      const response = await fetch(
        `${API_BASE_URL}/api/requests/respond`,
        {
          method: 'PUT',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            request_id: requestId,
            action
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
          `Failed to ${action} request`
        );
      }

      const updated = data.request || data;

      setRequests((current) =>
        current.map((req) =>
          req.id === requestId
            ? { ...req, ...updated }
            : req
        )
      );

      /*
       * Do not manually force a status here.
       * The backend is the source of truth.
       */

      if (action === 'accept') {
        alert('Collector accepted successfully.');
      } else {
        alert('Request rejected successfully.');
      }
    } catch (err) {
      console.error('Respond request error:', err);
      setError(
        err.message ||
        `Failed to ${action} request`
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ============================================================
   * CONFIRM ACTUAL WEIGHT
   * ============================================================
   *
   * IMPORTANT:
   *
   * The frontend DOES NOT calculate points.
   *
   * Backend should:
   * 1. Verify authenticated user owns request.
   * 2. Verify request state.
   * 3. Verify collector submitted actual weight.
   * 4. Confirm user decision.
   * 5. Calculate points.
   * 6. Add points exactly once.
   * 7. Create an immutable points ledger record.
   * 8. Move request to completed / weight_confirmed.
   */

  const handleConfirmCompletion = async (
    requestId,
    action
  ) => {
    if (!userData) return;

    try {
      setActionLoading(`${requestId}-completion`);
      setError('');

      const response = await fetch(
        `${API_BASE_URL}/api/v2/requests/${requestId}/weight-confirmation`,
        {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({ action: action === 'reject' ? 'dispute' : action })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'This session does not have user permissions to confirm weight. Sign out and sign back in with a user account, then try again.'
            : data?.error ||
          'Failed to confirm request'
        );
      }

      const updatedRequest = data.request || data;

      setRequests((current) =>
        current.map((req) =>
          req.id === requestId
            ? { ...req, ...updatedRequest }
            : req
        )
      );

      /*
       * IMPORTANT:
       *
       * We no longer do:
       *
       * userData.points + points_added
       *
       * because points must be controlled by the backend.
       *
       * If backend returns updated user data, we synchronize it.
       */

      if (data.user) {
        const updatedUser = {
          ...userData,
          ...data.user
        };

        setUserData(updatedUser);

        localStorage.setItem(
          'greenovation_user',
          JSON.stringify(updatedUser)
        );

        window.dispatchEvent(
          new CustomEvent(
            'account-profile-updated',
            {
              detail: updatedUser
            }
          )
        );
      }

      if (action === 'confirm') {
        alert(
          'Weight confirmed successfully. Your points were processed by Greenovation.'
        );
      } else {
        alert(
          'The request was marked as disputed/not yet completed.'
        );
      }
    } catch (err) {
      console.error(
        'Confirm completion error:',
        err
      );

      setError(
        err.message ||
        'Failed to confirm request'
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ============================================================
   * SELECT COLLECTOR
   * ============================================================
   */

  const handleSelectCollector = async (
    requestId,
    collectorId
  ) => {
    if (!userData) return;

    try {
      setActionLoading(`${requestId}-collector`);
      setError('');

      const response = await fetch(
        `${API_BASE_URL}/api/requests/select-collector`,
        {
          method: 'PUT',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            request_id: requestId,
            collector_id: collectorId
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Failed to select collector'
        );
      }

      const updated = data.request || data;

      setRequests((current) =>
        current.map((req) =>
          req.id === requestId
            ? {
                ...req,
                ...updated
              }
            : req
        )
      );
    } catch (err) {
      console.error(
        'Select collector error:',
        err
      );

      setError(
        err.message ||
        'Failed to select collector'
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ============================================================
   * COMPLETION DURATION
   * ============================================================
   */

  const getCompletionDuration = (request) => {
    if (
      !request.collected_at ||
      !request.completed_at
    ) {
      return null;
    }

    const durationMs =
      new Date(request.completed_at) -
      new Date(request.collected_at);

    if (
      !Number.isFinite(durationMs) ||
      durationMs < 0
    ) {
      return null;
    }

    const minutes = Math.floor(
      durationMs / 60000
    );

    const hours = Math.floor(minutes / 60);

    return hours
      ? `${hours}h ${minutes % 60}m`
      : `${minutes}m`;
  };

  /*
   * ============================================================
   * FORM INPUT
   * ============================================================
   */

  const handleInputChange = (e) => {
    const {
      name,
      value
    } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  /*
   * ============================================================
   * GPS
   * ============================================================
   */

  const handleGetGPS = () => {
    setError('');

    if (!navigator.geolocation) {
      setError(
        'Browser does not support geolocation'
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const {
          latitude,
          longitude
        } = position.coords;

        setForm((current) => ({
          ...current,
          gps: `${latitude},${longitude}`
        }));
      },
      (gpsError) => {
        console.error(
          'Geolocation error:',
          gpsError
        );

        setError(
          'Failed to get GPS location. Please allow location access and try again.'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  /*
   * ============================================================
   * STATUS HELPERS
   * ============================================================
   */

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#ffc107';

      case 'CREATED':
        return '#ffc107';

      case 'assigned':
        return '#28a745';

      case 'ASSIGNED':
        return '#28a745';

      case 'on_the_way':
        return '#3498db';

      case 'arrived':
        return '#9b59b6';

      case 'in_progress':
        return '#27ae60';

      case 'COLLECTOR_EN_ROUTE':
        return '#3498db';

      case 'ARRIVED':
        return '#9b59b6';

      case 'waiting_user_weight_confirmation':
        return '#f39c12';

      case 'completion_pending':
        return '#f39c12';

      case 'AWAITING_USER_CONFIRMATION':
        return '#f39c12';

      case 'COMPLETED':
        return '#6c757d';

      case 'weight_confirmed':
        return '#2ecc71';

      case 'weight_disputed':
        return '#e67e22';

      case 'completed':
        return '#6c757d';

      case 'cancelled':
        return '#dc3545';

      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return '⏳ Waiting for Collector';

      case 'CREATED':
        return '⏳ Waiting for Collector';

      case 'assigned':
        return '✅ Collector Assigned';

      case 'ASSIGNED':
        return '✅ Collector Assigned';

      case 'on_the_way':
        return '🚚 Collector On The Way';

      case 'arrived':
        return '📍 Collector Arrived';

      case 'in_progress':
        return '🔄 Collection In Progress';

      case 'waiting_user_weight_confirmation':
        return '⚖️ Confirm Actual Weight';

      case 'completion_pending':
        return '⚖️ Confirm Actual Weight';

      case 'AWAITING_USER_CONFIRMATION':
        return '⚖️ Confirm Actual Weight';

      case 'COMPLETED':
        return '✅ Completed';

      case 'weight_confirmed':
        return '✅ Weight Confirmed';

      case 'weight_disputed':
        return '⚠️ Weight Disputed';

      case 'completed':
        return '✅ Completed';

      case 'cancelled':
        return '❌ Cancelled';

      default:
        return status || 'Unknown';
    }
  };

  /*
   * ============================================================
   * MATERIAL LABEL
   * ============================================================
   */

  const materialLabel = (type) => {
    switch (type) {
      case 'plastic':
        return 'Plastic';

      case 'paper':
        return 'Paper';

      case 'metal':
        return 'Metal';

      case 'glass':
        return 'Glass';

      case 'organic':
        return 'Organic';

      case 'other':
        return 'Other';

      default:
        return type || 'Unknown';
    }
  };

  /*
   * ============================================================
   * GPS DISPLAY
   * ============================================================
   */

  const formatGPS = (gps) => {
    if (!gps) return '';

    if (
      typeof gps === 'object' &&
      gps !== null
    ) {
      if (
        gps.latitude !== undefined &&
        gps.longitude !== undefined
      ) {
        return `${gps.latitude}, ${gps.longitude}`;
      }

      if (
        gps.x !== undefined &&
        gps.y !== undefined
      ) {
        return `${gps.y}, ${gps.x}`;
      }
    }

    return String(gps);
  };

  /*
   * ============================================================
   * FILTERS
   * ============================================================
   */

  const activeStatuses = [
    'pending',
    'CREATED',
    'assigned',
    'ASSIGNED',
    'on_the_way',
    'arrived',
    'in_progress',
    'waiting_user_weight_confirmation',
    'completion_pending',
    'AWAITING_USER_CONFIRMATION',
    'weight_disputed'
  ];

  const filteredRequests =
    requestFilter === 'all'
      ? requests
      : requests.filter((request) => {
          if (requestFilter === 'active') {
            return activeStatuses.includes(
              request.status
            );
          }

          if (
            requestFilter ===
            'waiting_weight'
          ) {
            return [
              'waiting_user_weight_confirmation',
              'completion_pending',
              'AWAITING_USER_CONFIRMATION'
            ].includes(request.status);
          }

          if (
            requestFilter ===
            'completed'
          ) {
            return [
              'completed',
              'COMPLETED',
              'weight_confirmed'
            ].includes(request.status);
          }

          return (
            request.status ===
            requestFilter
          );
        });

  /*
   * ============================================================
   * USER NOT LOGGED IN
   * ============================================================
   */

  if (!userData) {
    return (
      <div className="requests-container">
        <h2>
          Please log in to view requests
        </h2>
      </div>
    );
  }

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div className="requests-container">
        <div className="loading">
          Loading requests...
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="account-layout">
      <AccountSidebar
        userData={userData}
        userType="user"
        sections={[]}
      />

      <main className="account-main requests-container">
        <AccountPageHeader
          title="My Requests"
          label="USER PORTAL"
        />

        <AccountProfilePanel
          userData={userData}
          userType="user"
        />

        {userType === 'user' && (
          <button
            className="add-request-btn"
            onClick={() =>
              setShowForm((current) => !current)
            }
            disabled={submitting}
          >
            {showForm
              ? 'Cancel'
              : '+ New Request'}
          </button>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/*
         * ========================================================
         * NEW REQUEST FORM
         * ========================================================
         */}

        {showForm && userType === 'user' && (
          <div className="request-form">
            <h3>Create New Request</h3>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Material Type*
                </label>

                <select
                  name="material_type"
                  value={form.material_type}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">
                    Select material type
                  </option>

                  <option value="plastic">
                    Plastic
                  </option>

                  <option value="paper">
                    Paper
                  </option>

                  <option value="metal">
                    Metal
                  </option>

                  <option value="glass">
                    Glass
                  </option>

                  <option value="organic">
                    Organic
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Estimated Weight (kg)*
                </label>

                <input
                  type="number"
                  name="weight"
                  value={form.weight}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0.1"
                  required
                />

                <small>
                  This is only an estimated
                  weight. Final points are based
                  on the actual verified weight.
                </small>
              </div>

              <div className="form-group">
                <label>
                  Location*
                </label>

                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleInputChange}
                  placeholder="Enter pickup location"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  GPS Coordinates
                </label>

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center'
                  }}
                >
                  <input
                    type="text"
                    name="gps"
                    value={form.gps}
                    onChange={handleInputChange}
                    placeholder="latitude,longitude"
                    style={{ flex: 1 }}
                  />

                  <button
                    type="button"
                    className="gps-btn"
                    onClick={handleGetGPS}
                  >
                    📍 Get GPS
                  </button>
                </div>

                <small>
                  GPS is used to verify the
                  pickup location and collector
                  arrival.
                </small>
              </div>

              <div className="form-group">
                <label>
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  placeholder="Describe the recyclable materials"
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Submitting...'
                    : 'Submit Request'}
                </button>

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() =>
                    setShowForm(false)
                  }
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/*
         * ========================================================
         * REQUESTS LIST
         * ========================================================
         */}

        <div
          className="requests-list"
          id="requests"
        >
          <div className="requests-toolbar">
            <div>
              <p className="dashboard-label">
                REQUESTS
              </p>

              <h2>
                Track your collections
              </h2>
            </div>

            <div
              className="request-filters"
              role="group"
              aria-label="Filter requests"
            >
              {[
                ['all', 'All'],
                ['active', 'Active'],
                ['pending', 'Waiting'],
                ['on_the_way', 'On The Way'],
                ['arrived', 'Arrived'],
                [
                  'waiting_weight',
                  'Needs Weight Confirmation'
                ],
                [
                  'completed',
                  'Completed'
                ],
                [
                  'cancelled',
                  'Cancelled'
                ]
              ].map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      requestFilter === value
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setRequestFilter(value)
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="no-requests">
              <p>
                No requests found. Create
                your first request!
              </p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="no-requests">
              <p>
                No requests match this
                filter.
              </p>
            </div>
          ) : (
            filteredRequests.map(
              (request) => (
                <div
                  key={request.id}
                  className="request-card"
                >
                  {/*
                   * ==================================================
                   * REQUEST HEADER
                   * ==================================================
                   */}

                  <div className="request-header">
                    <span
                      className="request-status"
                      style={{
                        backgroundColor:
                          getStatusColor(
                            request.status
                          )
                      }}
                    >
                      {getStatusText(
                        request.status
                      )}
                    </span>

                    <span className="request-id">
                      #{request.id}
                    </span>
                  </div>

                  <div className="request-content">
                    <div className="request-info">
                      {request.material_type && (
                        <p>
                          ♻️ Material:{' '}
                          {materialLabel(
                            request.material_type
                          )}
                        </p>
                      )}

                      {/*
                       * Estimated weight
                       */}

                      {request.weight !==
                        undefined &&
                        request.weight !==
                          null && (
                          <h4>
                            📦 Estimated Weight:{' '}
                            {request.weight} kg
                          </h4>
                        )}

                      {/*
                       * Actual verified weight
                       */}

                      {request.collected_weight !==
                        undefined &&
                        request.collected_weight !==
                          null && (
                          <h4>
                            ⚖️ Actual Weight:{' '}
                            {
                              request.collected_weight
                            } kg
                          </h4>
                        )}

                      {request.location && (
                        <p>
                          📍 Location:{' '}
                          {request.location}
                        </p>
                      )}

                      {request.description && (
                        <p>
                          📝 Description:{' '}
                          {request.description}
                        </p>
                      )}

                      {request.gps && (
                        <p>
                          🗺️ GPS:{' '}
                          {formatGPS(
                            request.gps
                          )}
                        </p>
                      )}

                      {/*
                       * =================================================
                       * COLLECTOR INFO
                       * =================================================
                       */}

                      {request.collector_id && (
                        <div className="collector-info">
                          <p>
                            👤 Collector assigned
                            to this request
                          </p>

                          {request.collector_profile_image && (
                            <img
                              className="collector-profile-thumb"
                              src={
                                request.collector_profile_image
                              }
                              alt="Collector"
                            />
                          )}

                          {request.collector_name && (
                            <p>
                              <a
                                href={`/collector-profile/${request.collector_id}`}
                                className="collector-profile-link"
                              >
                                📛{' '}
                                {
                                  request.collector_name
                                }
                              </a>
                            </p>
                          )}

                          {request.collector_phone && (
                            <p>
                              📞 Phone:{' '}
                              {
                                request.collector_phone
                              }
                            </p>
                          )}

                          {request.collector_gps && (
                            <p>
                              📍 Collector GPS:{' '}
                              {formatGPS(
                                request.collector_gps
                              )}
                            </p>
                          )}

                          {request.arrived_at && (
                            <p>
                              📍 Arrived:{' '}
                              {new Date(
                                request.arrived_at
                              ).toLocaleString()}
                            </p>
                          )}

                          {request.status ===
                            'completed' &&
                            request.completed_at && (
                              <>
                                <p>
                                  ✅ Completed at:{' '}
                                  {new Date(
                                    request.completed_at
                                  ).toLocaleString()}
                                </p>

                                {getCompletionDuration(
                                  request
                                ) && (
                                  <p>
                                    ⏱️ Duration:{' '}
                                    {getCompletionDuration(
                                      request
                                    )}
                                  </p>
                                )}
                              </>
                            )}
                        </div>
                      )}

                      {/*
                       * =================================================
                       * COLLECTOR CANDIDATES
                       * =================================================
                       */}

                      {['pending', 'CREATED'].includes(request.status) &&
                        request.collector_candidates
                          ?.length > 0 && (
                          <div className="collector-candidates">
                            <p>
                              <b>
                                Collectors
                                interested:
                              </b>
                            </p>

                            {request.collector_candidates.map(
                              (candidate) => (
                                <div
                                  key={
                                    candidate.id
                                  }
                                  className="collector-candidate-row"
                                >
                                  {candidate.profile_image && (
                                    <img
                                      src={
                                        candidate.profile_image
                                      }
                                      alt="Collector"
                                      className="collector-profile-thumb"
                                    />
                                  )}

                                  <a
                                    href={`/collector-profile/${candidate.id}`}
                                    className="collector-profile-link"
                                  >
                                    {candidate.name ||
                                      'Collector'}
                                  </a>

                                  <button
                                    type="button"
                                    disabled={
                                      actionLoading ===
                                      `${request.id}-collector`
                                    }
                                    onClick={() =>
                                      handleSelectCollector(
                                        request.id,
                                        candidate.id
                                      )
                                    }
                                  >
                                    {actionLoading ===
                                    `${request.id}-collector`
                                      ? 'Selecting...'
                                      : 'Select'}
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
                    </div>

                    {/*
                     * =================================================
                     * REQUEST META
                     * =================================================
                     */}

                    <div className="request-meta">
                      {request.created_at && (
                        <small>
                          Created:{' '}
                          {new Date(
                            request.created_at
                          ).toLocaleDateString()}
                        </small>
                      )}

                      {request.collected_at && (
                        <small>
                          Collected:{' '}
                          {new Date(
                            request.collected_at
                          ).toLocaleDateString()}
                        </small>
                      )}
                    </div>
                  </div>

                  {/*
                   * ==================================================
                   * ASSIGNED COLLECTOR
                   * ==================================================
                   */}

                  {request.status ===
                    'assigned' && (
                    <div className="request-actions">
                      <p
                        style={{
                          marginBottom:
                            '10px',
                          textAlign:
                            'center',
                          color: '#666'
                        }}
                      >
                        A collector has been
                        assigned to your
                        request. Do you
                        accept?
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          gap: '10px'
                        }}
                      >
                        <button
                          onClick={() =>
                            handleRespondToRequest(
                              request.id,
                              'accept'
                            )
                          }
                          className="accept-btn"
                          disabled={
                            actionLoading ===
                            `${request.id}-respond`
                          }
                        >
                          {actionLoading ===
                          `${request.id}-respond`
                            ? 'Processing...'
                            : '✅ Accept Collector'}
                        </button>

                        <button
                          onClick={() =>
                            handleRespondToRequest(
                              request.id,
                              'reject'
                            )
                          }
                          className="reject-btn"
                          disabled={
                            actionLoading ===
                            `${request.id}-respond`
                          }
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {/*
                   * ==================================================
                   * ACTUAL WEIGHT CONFIRMATION
                   * ==================================================
                   *
                   * Both old and new backend status names are
                   * supported temporarily.
                   */}

                  {[
                    'waiting_user_weight_confirmation',
                    'completion_pending',
                    'AWAITING_USER_CONFIRMATION'
                  ].includes(
                    request.status
                  ) && (
                    <div className="request-actions completion-confirmation">
                      <p>
                        ⚖️ The collector has
                        reported the actual
                        weight.
                      </p>

                          (request.actual_weight ?? request.collected_weight) !==
                        undefined &&
                        (request.actual_weight ?? request.collected_weight) !==
                          null && (
                          <p>
                            Actual reported
                            weight:{' '}
                            <strong>
                              {request.actual_weight ?? request.collected_weight}{' '}
                              kg
                            </strong>
                          </p>
                        )}

                      {request.weight !==
                        undefined &&
                        request.weight !==
                          null && (
                          <p>
                            Your estimated
                            weight:{' '}
                            <strong>
                              {request.weight}{' '}
                              kg
                            </strong>
                          </p>
                        )}

                      <p>
                        Please confirm the
                        actual weight only if
                        it is correct.
                      </p>

                      <div>
                        <button
                          onClick={() =>
                            handleConfirmCompletion(
                              request.id,
                              'confirm'
                            )
                          }
                          className="accept-btn"
                          disabled={
                            actionLoading ===
                            `${request.id}-completion`
                          }
                        >
                          {actionLoading ===
                          `${request.id}-completion`
                            ? 'Processing...'
                            : '✅ Confirm Weight'}
                        </button>

                        <button
                          onClick={() =>
                            handleConfirmCompletion(
                              request.id,
                              'reject'
                            )
                          }
                          className="reject-btn"
                          disabled={
                            actionLoading ===
                            `${request.id}-completion`
                          }
                        >
                          ❌ Dispute / Not Correct
                        </button>
                      </div>
                    </div>
                  )}

                  {/*
                   * ==================================================
                   * WEIGHT DISPUTE
                   * ==================================================
                   */}

                  {request.status ===
                    'weight_disputed' && (
                    <div className="request-actions">
                      <p>
                        ⚠️ This request is under
                        weight review.
                      </p>

                      <p>
                        The reported weight was
                        disputed. Greenovation
                        must resolve the
                        request before points
                        are added.
                      </p>
                    </div>
                  )}

                  {/*
                   * ==================================================
                   * COMPLETED
                   * ==================================================
                   */}

                  {[
                    'completed',
                    'weight_confirmed'
                  ].includes(
                    request.status
                  ) && (
                    <div className="request-actions">
                      <p>
                        ✅ This collection has
                        been completed.
                      </p>

                      {request.collected_weight !==
                        undefined &&
                        request.collected_weight !==
                          null && (
                          <p>
                            Verified weight:{' '}
                            <strong>
                              {
                                request.collected_weight
                              }{' '}
                              kg
                            </strong>
                          </p>
                        )}

                      {request.points_added !==
                        undefined &&
                        request.points_added !==
                          null && (
                          <p>
                            ⭐ Points awarded:{' '}
                            <strong>
                              {
                                request.points_added
                              }
                            </strong>
                          </p>
                        )}

                      <p>Points are managed by the Greenovation backend and remain in your account balance.</p>
                    </div>
                  )}
                </div>
              )
            )
          )}
        </div>
      </main>
    </div>
  );
};

export default Requests;