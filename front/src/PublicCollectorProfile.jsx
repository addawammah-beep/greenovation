import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './Collectors.css';

const PublicCollectorProfile = () => {
  const { id } = useParams();
  const [collector, setCollector] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`http://localhost:4000/api/collectors/${id}/public`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load profile');
        setCollector(data);
      })
      .catch((profileError) => setError(profileError.message));
  }, [id]);

  if (error) return <div className="public-collector-profile"><h2>{error}</h2></div>;
  if (!collector) return <div className="public-collector-profile"><p>Loading profile...</p></div>;

  return (
    <main className="public-collector-profile">
      <section className="public-collector-card">
        {collector.profile_image ? (
          <img src={collector.profile_image} alt={collector.name || 'Collector'} className="public-collector-photo" />
        ) : (
          <div className="public-collector-avatar">{(collector.name || 'C').charAt(0).toUpperCase()}</div>
        )}
        <p className="dashboard-label">COLLECTOR PROFILE</p>
        <h1>{collector.name || 'Collector'}</h1>
        <p className="public-profile-note">Public profile · View only</p>
        <div className="public-collector-details">
          <div><span>Age</span><strong>{collector.age ? `${collector.age} years` : 'Not provided'}</strong></div>
          <div><span>Completed orders</span><strong>{collector.completed_orders || 0}</strong></div>
          <div><span>Phone</span><strong>{collector.phone || 'Not provided'}</strong></div>
          <div><span>Location</span><strong>{collector.location_name || 'Not provided'}</strong></div>
          <div><span>Status</span><strong>{collector.is_active ? 'Active' : 'Inactive'}</strong></div>
        </div>
      </section>
    </main>
  );
};

export default PublicCollectorProfile;
