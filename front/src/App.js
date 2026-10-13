// src/App.js
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AdminSellers from './AdminSellers';
import Collectors from './Collectors';
import Contact_section from './Contact_section'; // صفحة الشات الجديدة
import Header from './Header';
import Home from './Home';
import Login from './Login';
import Offers from './Offers';
import Profile from './Profile';
import PublicCollectorProfile from './PublicCollectorProfile';
import Requests from './Requests';

import './App.css';

function App() {
  // مبدئيا خليه null بدل [] عشان الشرط يشتغل صح
  const [user, setUser] = useState(null);          
  const [showLogin, setShowLogin] = useState(false); 

  const handleOpenLogin = () => setShowLogin(true);    
  const handleCloseLogin = () => setShowLogin(false);  
  const location = useLocation();
  const subpagePaths = ['/profile', '/requests', '/collectors', '/offers', '/admin'];
  const isSubpage = subpagePaths.includes(location.pathname.toLowerCase());

  return (
    <>
      {!isSubpage && (
        <Header
          user={user}
          setUser={setUser}
          onRegistrationClick={handleOpenLogin}
        />
      )}

      {/* نافذة تسجيل الدخول (تظهر فقط عند showLogin = true) */}
      <Login
        show={showLogin}
        onClose={handleCloseLogin}
        setUser={setUser}
      />

      {/* بقية الموقع */}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminSellers />} />

          <Route
            path="/profile"
            element={user ? <Profile setUser={setUser} /> : <Navigate to="/" />}
          />

          <Route
            path="/requests"
            element={user ? <Requests /> : <Navigate to="/" />}
          />

          <Route
            path="/collectors"
            element={user ? <Collectors setUser={setUser} /> : <Navigate to="/" />}
          />
          <Route path="/collector-profile/:id" element={<PublicCollectorProfile />} />

          <Route
            path="/offers"
            element={user ? <Offers setUser={setUser} /> : <Navigate to="/" />}
          />

          <Route path="/login" element={<Login />} />

          {/* صفحة الدعم اللي فيها Chatbase */}
          <Route path="/support" element={<Contact_section />} />
        </Routes>
      </main>
    </>
  );
}

const AppWithRouter = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export default AppWithRouter;
