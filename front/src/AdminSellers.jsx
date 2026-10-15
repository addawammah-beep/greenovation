import { useEffect, useRef, useState } from 'react';
import './AdminSellers.css';

const API_BASE = 'http://localhost:4000';

const AdminReportImage = ({ reportId, token }) => {
  const imageContainerRef = useRef(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return undefined;

    const controller = new AbortController();
    let objectUrl;
    const loadImage = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v2/admin/reports/${reportId}/image`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Could not load report image');
        }
        objectUrl = URL.createObjectURL(await response.blob());
        setImageUrl(objectUrl);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setImageError(error.message || 'Could not load report image');
        }
      }
    };

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        loadImage();
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportId, token]);

  return (
    <div className="admin-report-image" ref={imageContainerRef}>
      {imageUrl ? <img src={imageUrl} alt={`Environmental report ${reportId}`} /> :
        imageError ? <p className="admin-report-image-error" role="alert">{imageError}</p> :
          <p>Loading report image...</p>}
    </div>
  );
};

const AdminSellers = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('greenovation_admin') || 'null');
    } catch (error) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('greenovation_admin_token') || '');
  const [sellers, setSellers] = useState([]);
  const [reports, setReports] = useState([]);
  const [taxPointSellers, setTaxPointSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [updatingSellerId, setUpdatingSellerId] = useState(null);
  const [verifyingTaxSellerId, setVerifyingTaxSellerId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSellers = async (adminToken) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/v2/admin/sellers`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('greenovation_admin_token');
          localStorage.removeItem('greenovation_admin');
          setToken('');
          setAdmin(null);
        }
        throw new Error(data.error || 'Could not load seller applications');
      }
      setSellers(data.sellers || []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load seller applications');
    } finally {
      setLoading(false);
    }
  };

  const loadTaxPointSellers = async (adminToken) => {
    try {
      const response = await fetch(`${API_BASE}/api/v2/admin/seller-tax-points`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load seller tax points');
      setTaxPointSellers(data.sellers || []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load seller tax points');
    }
  };

  const loadReports = async (adminToken) => {
    setReportsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v2/admin/reports`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load environmental reports');
      setReports(data.reports || []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load environmental reports');
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadSellers(token);
      loadTaxPointSellers(token);
      loadReports(token);
    }
  }, [token]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API_BASE}/api/v2/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Admin sign-in failed');
      localStorage.setItem('greenovation_admin_token', data.token);
      localStorage.setItem('greenovation_admin', JSON.stringify(data.admin));
      setAdmin(data.admin);
      setToken(data.token);
      setCredentials({ email: '', password: '' });
    } catch (loginError) {
      setError(loginError.message || 'Admin sign-in failed');
    }
  };

  const updateSellerStatus = async (seller, status) => {
    setUpdatingSellerId(seller.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API_BASE}/api/v2/admin/sellers/${seller.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update seller status');
      setSellers(current => current.map(item => item.id === seller.id ? { ...item, ...data.seller } : item));
      setNotice(`${seller.name} status updated to ${data.seller.account_status}.`);
    } catch (updateError) {
      setError(updateError.message || 'Could not update seller status');
    } finally {
      setUpdatingSellerId(null);
    }
  };

  const verifySellerTaxPoints = async (seller) => {
    setVerifyingTaxSellerId(seller.seller_id);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE}/api/v2/admin/sellers/${seller.seller_id}/seller-tax-points/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not verify seller tax points');
      setNotice(`${data.verified_points.toLocaleString()} points from ${data.verified_orders} picked-up orders verified for ${seller.seller_name}.`);
      await loadTaxPointSellers(token);
    } catch (verifyError) {
      setError(verifyError.message || 'Could not verify seller tax points');
    } finally {
      setVerifyingTaxSellerId(null);
    }
  };

  const signOut = () => {
    localStorage.removeItem('greenovation_admin_token');
    localStorage.removeItem('greenovation_admin');
    setAdmin(null);
    setToken('');
    setSellers([]);
    setReports([]);
    setTaxPointSellers([]);
  };

  return (
    <main className="admin-sellers-page">
      <header className="admin-sellers-header">
        <p>GREENOVATION ADMIN</p>
        <h1>Seller and tax verification</h1>
        {admin && (
          <div>
            <span>Signed in as {admin.name || admin.email}</span>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>

      {error && <p className="admin-sellers-message error" role="alert">{error}</p>}
      {notice && <p className="admin-sellers-message success" role="status">{notice}</p>}

      {!admin ? (
        <form className="admin-login-card" onSubmit={handleLogin}>
          <h2>Admin sign-in</h2>
          <label>Email<input type="email" autoComplete="username" value={credentials.email} onChange={event => setCredentials(current => ({ ...current, email: event.target.value }))} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={credentials.password} onChange={event => setCredentials(current => ({ ...current, password: event.target.value }))} required /></label>
          <button type="submit">Sign in</button>
          <p>Admin accounts are created by an operator on the server. Seller accounts cannot self-approve.</p>
        </form>
      ) : (
        <>
        <section className="admin-seller-list admin-reports-list">
          <div className="admin-seller-list-heading">
            <div>
              <h2>Environmental image reports</h2>
              <p>Gemini analysis and private photos for the latest submitted reports.</p>
            </div>
            <button type="button" onClick={() => loadReports(token)} disabled={reportsLoading}>
              {reportsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {reportsLoading && !reports.length ? <p>Loading environmental reports...</p> : reports.length ? reports.map(report => (
            <article className="admin-report-card" key={report.id}>
              <AdminReportImage reportId={report.id} token={token} />
              <div className="admin-report-heading">
                <div>
                  <p className="admin-seller-status">{report.status || 'pending'}</p>
                  <h3>{report.problem_type} <small>#{report.id}</small></h3>
                </div>
                <p className={report.ai_contains_trash ? 'admin-report-result detected' : 'admin-report-result'}>
                  {report.ai_contains_trash ? 'Trash detected' : 'No trash detected'}
                </p>
              </div>
              {/* <p><strong>AI confidence:</strong> {report.ai_confidence ?? 0}%</p> */}
              <p><strong>AI explanation:</strong> {report.ai_reason || 'No explanation recorded'}</p>
              <p><strong>Description:</strong> {report.description}</p>
              <p><strong>Location:</strong> {report.address} ({report.latitude}, {report.longitude})</p>
              <p><strong>Photo capture:</strong> {report.captured_at ? new Date(report.captured_at).toLocaleString() : 'Not recorded'}
                {report.capture_method ? ` · ${report.capture_method}` : ''}
                {report.capture_accuracy_m != null ? ` · ±${report.capture_accuracy_m} m` : ''}
              </p>
              <p><strong>Submitted:</strong> {report.created_at ? new Date(report.created_at).toLocaleString() : 'Unknown'}</p>
            </article>
          )) : <p>No environmental reports found.</p>}
          {reports.length > 0 && <p className="admin-tax-points-note">Showing the latest {reports.length} reports.</p>}
        </section>
        <section className="admin-seller-list admin-tax-points-list">
          <div className="admin-seller-list-heading">
            <div>
              <h2>Seller tax deduction points</h2>
              <p>Review completed customer pickups and verify each order only once.</p>
            </div>
            <button type="button" onClick={() => loadTaxPointSellers(token)}>Refresh</button>
          </div>
          {taxPointSellers.length ? taxPointSellers.map(seller => (
            <article className="admin-tax-points-card" key={seller.seller_id}>
              <div className="admin-tax-points-summary">
                <h3>{seller.seller_name} <small>#{seller.seller_id}</small></h3>
                <p>{seller.seller_email}</p>
                <p>Awaiting verification: <strong>{Number(seller.eligible_points).toLocaleString()}</strong> points across {seller.eligible_orders} completed pickups.</p>
                <p>Already verified: <strong>{Number(seller.verified_points).toLocaleString()}</strong> points across {seller.verified_orders} pickups.</p>
              </div>
              {seller.eligible_order_details.length > 0 && (
                <details>
                  <summary>Review orders ({seller.eligible_order_details.length})</summary>
                  <ul>
                    {seller.eligible_order_details.map(order => (
                      <li key={order.order_id}>Order #{order.order_id} · {order.product_name} · {Number(order.points).toLocaleString()} points · {new Date(order.fulfilled_at).toLocaleString()}</li>
                    ))}
                  </ul>
                </details>
              )}
              {Number(seller.eligible_orders) > 0 && (
                <button
                  type="button"
                  disabled={verifyingTaxSellerId === seller.seller_id}
                  onClick={() => verifySellerTaxPoints(seller)}
                >
                  {verifyingTaxSellerId === seller.seller_id ? 'Verifying...' : 'Verify points for tax deduction'}
                </button>
              )}
            </article>
          )) : <p>No completed seller orders are waiting for tax-point review.</p>}
          <p className="admin-tax-points-note">This records verified points for tax accounting. It does not calculate a currency deduction; apply the relevant tax rules separately.</p>
        </section>
        <section className="admin-seller-list">
          <div className="admin-seller-list-heading">
            <h2>Seller applications</h2>
            <button type="button" onClick={() => loadSellers(token)} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
          </div>
          {loading && !sellers.length ? <p>Loading seller applications...</p> : sellers.length ? sellers.map(seller => (
            <article className="admin-seller-card" key={seller.id}>
              <div>
                <p className="admin-seller-status">{seller.account_status}</p>
                <h3>{seller.name} <small>#{seller.id}</small></h3>
                <p>{seller.legal_name || 'Legal name not provided'}</p>
                <p>{seller.email} · {seller.phone || 'No phone'}</p>
                <p>Registration: {seller.commercial_registration_number || 'Not provided'}</p>
                <p>Tax registration: {seller.tax_registration_number || 'Not provided'}</p>
                <p>Business activity: {seller.business_activity || 'Not provided'}</p>
                <p>Address: {seller.business_address || seller.branch_address || 'Not provided'}</p>
                {seller.rejection_reason && <p>Previous review: {seller.rejection_reason}</p>}
              </div>
              {!['VERIFIED', 'SUSPENDED'].includes(String(seller.account_status).toUpperCase()) && (
                <div className="admin-seller-actions">
                  <button type="button" disabled={updatingSellerId === seller.id} onClick={() => updateSellerStatus(seller, 'verify')}>Verify seller</button>
                  <button type="button" className="reject" disabled={updatingSellerId === seller.id} onClick={() => updateSellerStatus(seller, 'reject')}>Reject application</button>
                </div>
              )}
            </article>
          )) : <p>No seller applications found.</p>}
        </section>
        </>
      )}
    </main>
  );
};

export default AdminSellers;
