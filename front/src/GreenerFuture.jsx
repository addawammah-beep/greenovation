import React from 'react';
import './GreenerFuture.css';

function GreenerFuture() {
  return (
    <section className="greener-future-section" id="greener-future">
      <div className="section-content">
        <div className="details">
          <h2 className="section-title">
            Getting A Greener Future Safe Environment
          </h2>
          <span className="underline"></span>
          <p className="text-muted">
            Join us in building a greener future by adopting sustainable practices and protecting our environment. 
            We work towards a cleaner, safer planet through responsible recycling, ocean conservation, and eco-friendly initiatives. 
            Every action counts—let's make a difference together!
          </p>
          
          <div className="buttons">
            <button className="button white">
              <img 
                src="https://e7.pngegg.com/pngimages/38/204/png-clipart-computer-icons-check-mark-true-or-false-miscellaneous-company.png" 
                alt="Safe Environment" 
                className="button-icon" 
              /> 
              Safe Environment
            </button>
            <button className="button green">
              <img 
                src="https://e7.pngegg.com/pngimages/38/204/png-clipart-computer-icons-check-mark-true-or-false-miscellaneous-company.png" 
                alt="Recycling" 
                className="button-icon" 
              /> 
              Recycling
            </button>
          </div>
          
          <div className="progress-container">
            <div className="progress-item">
              <div className="progress-header">
                <span className="fw-bold">Recycling</span>
                <span className="progress-percentage">90%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress" 
                  style={{ width: '90%', backgroundColor: '#4CAF50' }} 
                  aria-valuenow="90" 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                  role="progressbar"
                  aria-label="Recycling progress 90%"
                ></div>
              </div>
            </div>
            
            <div className="progress-item">
              <div className="progress-header">
                <span className="fw-bold">Ocean Cleaning</span>
                <span className="progress-percentage">80%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress" 
                  style={{ width: '80%', backgroundColor: '#4CAF50' }} 
                  aria-valuenow="80" 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                  role="progressbar"
                  aria-label="Ocean cleaning progress 80%"
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="image-wrapper">
          <img 
            src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2023/12/skill-thumb.png" 
            alt="Plant in Hand representing environmental sustainability" 
            className="main-image" 
          />
          <img 
            src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/animate.png" 
            alt="Animated environmental icon" 
            className="animated-icon" 
          />
        </div>
      </div>
    </section>
  );
}

export default GreenerFuture;