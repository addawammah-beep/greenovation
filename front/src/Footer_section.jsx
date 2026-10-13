import FacebookRoundedIcon from '@mui/icons-material/FacebookRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import XIcon from '@mui/icons-material/X';
import React from 'react';
import { Link } from 'react-router-dom';
import { HashLink } from 'react-router-hash-link';
import './Footer_section.css';

const Footer_section = () => {
  return (
    <footer className="footer-section">
      <div className="section-content">
        <p className="copyright-text">  © 2025 Greenovation🌿</p>
        <p className="copyright-text">Mawada Mahmoud Abosalem🌿</p>

        <div className="social-link-list">
          <Link to="https://www.facebook.com" className="social-link">
            <FacebookRoundedIcon style={{ color: 'white', fontSize: '26px' }} />
          </Link>
          <Link to="https://www.instagram.com" className="social-link">
            <InstagramIcon style={{ color: 'white', fontSize: '26px' }} />
          </Link>
          <Link to="https://www.twitter.com" className="social-link">
            <XIcon style={{ color: 'white', fontSize: '26px' }} />
          </Link>
        </div>

        <p className="policy-text">
          <HashLink to="" className="Greenovation🌿">Greenovation🌿</HashLink>
          <span className="separator">•</span>
        </p>
      </div>
    </footer>
  );
}

export default Footer_section;
