import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Collectors.css';

const API_BASE = 'http://localhost:4000';

const normalizeUserType = (type) => {
  if (type === 'merchant') return 'seller';
  return type || 'user';
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('greenovation_token');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const AccountSidebar = ({ userData, userType, sections = [], onSignOut, onRefresh, refreshing = false }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(userData || {});
  const [error, setError] = useState('');

  useEffect(() => {
    setUser(userData || {});
  }, [userData]);

  const role = normalizeUserType(userType);

  const initials = (user.name || 'User')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  const image = user.profileImage || user.profile_image || '';

  const updateUser = (updated) => {
    const normalized = {
      ...updated,
      profileImage:
        updated.profileImage ||
        updated.profile_image ||
        ''
    };

    setUser(normalized);

    localStorage.setItem(
      'greenovation_user',
      JSON.stringify(normalized)
    );

    window.dispatchEvent(
      new CustomEvent('account-profile-updated', {
        detail: normalized
      })
    );
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10 MB.');
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        setError('');

        const response = await fetch(
          `${API_BASE}/accounts/${role}/${user.id}/profile`,
          {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              profile_image: reader.result
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'Failed to upload profile photo'
          );
        }

        updateUser(data.user);
      } catch (uploadError) {
        setError(
          uploadError.message ||
          'Failed to upload profile photo'
        );
      }
    };

    reader.readAsDataURL(file);

    event.target.value = '';
  };

  return (
    <aside className={`collector-sidebar account-${role}-sidebar`}>
      <div className="sidebar-profile">
        <div className="profile-photo-wrap">
          {image ? (
            <img
              src={image}
              alt="Profile"
              className="collector-photo"
            />
          ) : (
            <div className="collector-avatar">
              {initials}
            </div>
          )}

          <label
            className="photo-upload"
            title="Upload profile photo"
          >
            <span>+</span>

            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              onChange={uploadPhoto}
            />
          </label>
        </div>

        <h2>{user.name || 'Account'}</h2>

        <p>
          {role === 'seller'
            ? 'Seller account'
            : `${role} account`}
        </p>
        {onRefresh && (
          <button
            type="button"
            className="account-refresh-button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={refreshing ? 'Refreshing profile' : 'Refresh profile'}
            title={refreshing ? 'Refreshing...' : 'Refresh'}
          >
            <svg
              className={refreshing ? 'account-refresh-icon is-refreshing' : 'account-refresh-icon'}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}
      </div>

      <nav
        className="collector-nav"
        aria-label="Account sections"
      >
        <a href="#dashboard">Dashboard</a>
        <a href="#profile">My Profile</a>

        {sections.map(section => (
          <a
            key={section.id}
            href={`#${section.id}`}
          >
            {section.label}
          </a>
        ))}

        <button
          type="button"
          className="collector-home-link"
          onClick={() => navigate('/#Home')}
        >
          Home
        </button>
        {onSignOut && (
          <button
            type="button"
            className="collector-home-link"
            onClick={onSignOut}
          >
            Sign Out
          </button>
        )}
      </nav>

      {error && (
        <p className="account-profile-error">
          {error}
        </p>
      )}
    </aside>
  );
};

export const AccountPageHeader = ({
  title,
  label = 'ACCOUNT PORTAL'
}) => (
  <header
    className="collector-topbar"
    id="dashboard"
  >
    <div>
      <p className="dashboard-label">{label}</p>
      <h1>{title}</h1>
    </div>

    <span className="topbar-breadcrumb">
      Home / {title}
    </span>
  </header>
);

export const AccountProfilePanel = ({
  userData,
  userType
}) => {
  const [user, setUser] = useState(userData || {});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const role = normalizeUserType(userType);

  const [form, setForm] = useState({
    name: userData?.name || '',
    phone: userData?.phone || '',
    registry: userData?.registry || ''
  });

  useEffect(() => {
    setUser(userData || {});

    setForm({
      name: userData?.name || '',
      phone: userData?.phone || '',
      registry: userData?.registry || ''
    });
  }, [userData]);

  useEffect(() => {
    const handleProfileUpdate = (event) => {
      const updated = event.detail || {};

      setUser(current => ({
        ...current,
        ...updated
      }));

      setForm(current => ({
        ...current,
        name: updated.name ?? current.name,
        phone: updated.phone ?? current.phone,
        registry: updated.registry ?? current.registry
      }));
    };

    window.addEventListener(
      'account-profile-updated',
      handleProfileUpdate
    );

    return () => {
      window.removeEventListener(
        'account-profile-updated',
        handleProfileUpdate
      );
    };
  }, []);

  const saveProfile = async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE}/accounts/${role}/${user.id}/profile`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim(),
            ...(role !== 'user'
              ? { registry: form.registry.trim() }
              : {})
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Failed to save profile'
        );
      }

      const normalized = {
        ...data.user,
        profileImage:
          data.user.profileImage ||
          data.user.profile_image ||
          ''
      };

      setUser(normalized);

      localStorage.setItem(
        'greenovation_user',
        JSON.stringify(normalized)
      );

      window.dispatchEvent(
        new CustomEvent('account-profile-updated', {
          detail: normalized
        })
      );

      setEditing(false);
    } catch (saveError) {
      setError(
        saveError.message ||
        'Failed to update account profile'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="collector-profile-panel account-profile-panel"
      id="profile"
    >
      <div className="panel-title profile-title-row">
        <div>
          <p className="dashboard-label">
            PERSONAL INFORMATION
          </p>

          <h2>My Profile</h2>
        </div>

        <button
          type="button"
          className="profile-edit-button"
          onClick={() => {
            setEditing(current => !current);
            setError('');
          }}
        >
          {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {error && (
        <p className="account-profile-error">
          {error}
        </p>
      )}

      {editing ? (
        <div className="profile-edit-grid">
          <label>
            Full Name

            <input
              value={form.name}
              onChange={event =>
                setForm({
                  ...form,
                  name: event.target.value
                })
              }
            />
          </label>

          <label>
            Phone

            <input
              value={form.phone}
              onChange={event =>
                setForm({
                  ...form,
                  phone: event.target.value
                })
              }
            />
          </label>

          {role !== 'user' && (
            <label>
              Registration

              <input
                value={form.registry}
                onChange={event =>
                  setForm({
                    ...form,
                    registry: event.target.value
                  })
                }
              />
            </label>
          )}

          <label>
            Email

            <input
              value={user.email || ''}
              disabled
              readOnly
            />
          </label>

          <button
            type="button"
            className="profile-save-button"
            onClick={saveProfile}
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Save Changes'}
          </button>
        </div>
      ) : (
        <div className="collector-details-grid">
          <div className="collector-detail">
            <span className="detail-label">
              Full Name
            </span>

            <strong>
              {user.name || 'Not provided'}
            </strong>
          </div>

          <div className="collector-detail">
            <span className="detail-label">
              Email
            </span>

            <strong>
              {user.email || 'Not provided'}
            </strong>
          </div>

          <div className="collector-detail">
            <span className="detail-label">
              Phone
            </span>

            <strong>
              {user.phone || 'Not provided'}
            </strong>
          </div>

          {role !== 'user' && user.registry && (
            <div className="collector-detail">
              <span className="detail-label">
                Registration
              </span>

              <strong>
                {user.registry}
              </strong>
            </div>
          )}

          {role === 'user' && (
            <div className="collector-detail">
              <span className="detail-label">
                Points
              </span>

              <strong>
                {Number(user.points || 0)}
              </strong>
            </div>
          )}

          <div className="collector-detail">
            <span className="detail-label">
              Account Status
            </span>

            <strong>Active</strong>
          </div>
        </div>
      )}
    </section>
  );
};

export default AccountSidebar;