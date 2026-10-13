import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';
import logo from './photo/heaaderimg.png';
// walaa


function Header({ user, setUser, onRegistrationClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [iconColor, setIconColor] = useState('rgb(255,255,255)');
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const userType = localStorage.getItem('greenovation_user_type');

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector('.hero-section');
      const heroHeight = heroSection ? heroSection.offsetHeight : 0;
      const scrollPosition = window.scrollY;

      if (heroSection) {
        if (scrollPosition < heroHeight) {
          const opacity = scrollPosition / heroHeight;
          document.querySelector('header').style.backgroundColor = `rgba(16, 16, 16, ${opacity})`;
          const icColor = `rgb(${255 - Math.floor(255 * opacity)},${255 - Math.floor(255 * opacity)},${255 - Math.floor(255 * opacity)})`;
          setIconColor(icColor);
        } else {
          document.querySelector('header').style.backgroundColor = 'rgb(0, 0, 0)';
          setIconColor('rgb(0,0,0)');
        }
      }

      setScrolled(scrollPosition > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("greenovation_user");
    localStorage.removeItem("greenovation_user_type");
    localStorage.removeItem("greenovation_token");
    setUser(null);
    setShowMenu(false);
    navigate('/');
  };

  // Get display name based on user type
  const getDisplayName = () => {
    if (!user) return "U";
    
    switch (userType) {
      case 'user':
        return user.email?.charAt(0)?.toUpperCase() || "U";
      case 'seller':
        return user.name?.charAt(0)?.toUpperCase() || "S";
      case 'collector':
        return user.name?.charAt(0)?.toUpperCase() || "C";
      default:
        return "U";   // Regular user (default)
    }
  };

  // Get menu items based on user type
  const getMenuItems = () => {
    const baseItems = [
      // { label: 'Register', onClick: () => { setShowMenu(false); navigate('/login'); } }
      { label: 'Clients', onClick: () => { setShowMenu(false); onRegistrationClick(); } }

    ];

    switch (userType) {
      case 'user':
        baseItems.push(
          { label: 'My Requests', onClick: () => { setShowMenu(false); navigate('/requests'); } },
          // { label: 'My Codes', onClick: () => { setShowMenu(false); navigate('/codes'); } }
        );
        break;
      case 'collector':
        baseItems.push(
          { label: 'My Collectors', onClick: () => { setShowMenu(false); navigate('/Collectors'); } },
          // { label: 'Generated Codes', onClick: () => { setShowMenu(false); navigate('/codes'); } }
        );
        break;
      case 'seller':
        baseItems.push(
          { label: 'Merchant Coupons', onClick: () => { setShowMenu(false); navigate('/merchant'); } },
          { label: 'My Offers', onClick: () => { setShowMenu(false); navigate('/offers'); } }
        );
        break;
    }

    baseItems.push({ label: 'Sign Out', onClick: handleLogout });
    return baseItems;
  };

  return (
    <header className={scrolled ? 'scrolled' : ''}>
      <nav className="navbar">
        {/* Logo */}
        <div className="nav-logo">
          <img src={logo} alt="Logo" className="logo-image" />
          <a href="/" className="logo-text">Greenovation🌿</a>
          <button
            className="menu-toggle"
            aria-label="Open Menu"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ color: iconColor }}
          >
            <span className="menu-icon">☰</span>
          </button>
        </div>

        {/* Menu Links */}
        <ul className={`nav-menu${menuOpen ? ' open' : ''}`}>
          <li><a href="#Home" className="nav-link">Home</a></li>
          <li><a href="#about" className="nav-link">About</a></li>
                    <li><a href="#My Role" className="nav-link">My Role</a></li>
          <li><a href="#greener-future" className="nav-link">Greener Future</a></li>
          <li><a href="#QuizComponent" className="nav-link">Quiz</a></li>
          <li><a href="#contact" className="nav-link">Contact</a></li>
          
          {/* <li><Link to="/login" className="nav-link">Login</Link> </li> */}

          {/* <li><a href="LoginW.jsx" className="nav-link">Login</a></li> */}

        </ul>

        {/* User or Registration Button */}
        {!user ? (
          <button className="login-btn" onClick={onRegistrationClick}>Registration</button>
        ) : (
          <div className="header__avatar-box">
            <div className="header__avatar" onClick={() => setShowMenu(!showMenu)}>
              {getDisplayName()}
            </div>
            {showMenu && (
              <div className="header__user-menu">
                {getMenuItems().map((item, index) => (
                  <button 
                    key={index}
                    className="header__menu-btn" 
                    onClick={item.onClick}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}

export default Header;