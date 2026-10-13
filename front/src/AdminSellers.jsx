import { useEffect, useState } from 'react';
import './AdminSellers.css';

const API_BASE = 'http://localhost:4000';

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
  const [loading, setLoading] = useState(false);
  const [updatingSellerId, setUpdatingSellerId] = useState(null);
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

  useEffect(() => {
    if (token) loadSellers(token);
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

  const signOut = () => {
    localStorage.removeItem('greenovation_admin_token');
    localStorage.removeItem('greenovation_admin');
    setAdmin(null);
    setToken('');
    setSellers([]);
  };

  return (
    <main className="admin-sellers-page">
      <header className="admin-sellers-header">
        <p>GREENOVATION ADMIN</p>
        <h1>Seller verification</h1>
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
      )}
    </main>
  );
};

export default AdminSellers;
