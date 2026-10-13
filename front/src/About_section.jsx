import React from "react";
import "./About_section.css";
import aboutImage from "./photo/aboutimg.jpg";
import Dropdown from 'react-bootstrap/Dropdown';

const AboutSection = () => {
  return (
    <section className="about-section" id="about" aria-label="About GreenEco">
      <div className="section-content">
        <div className="image-container">
          <figure className="about-image-wrapper">
            <img src={aboutImage} alt="Nature and Sustainability" className="about-image" />
          </figure>
        </div>

        <article className="about-details">
          <h2 className="section-title">
            <span className="highlight">ABOUT US</span>
          </h2>
          <p className="text">
            <span className="highlight-large normal-font custom-line-height">
              Towards a Sustainable and Greener Future
            </span>
          </p>

          <div className="benefits">
            <div className="benefit-item">
              <img 
                src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/leaf1.png" 
                alt="Economic Benefits" 
                className="inline-icon" 
              />
              <h3 className="highlight-medium">Economic Benefits</h3>
              <p className="italic-text">
                Sustainable solutions not only protect the environment but also drive economic growth 
                by reducing waste and optimizing resources.
              </p>
            </div>

            <div className="benefit-item">
              <img 
                src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/hand.png" 
                alt="Safe Environment" 
                className="inline-icon" 
              />
              <h3 className="highlight-medium">Safe Environment</h3>
              <p className="italic-text">
                By adopting green initiatives, we ensure cleaner air, purer water, and healthier soil for future generations.
              </p>
            </div>
          </div>

          <div className="dropdown-arrow-container">
            <Dropdown>
              <Dropdown.Toggle variant="success" id="dropdown-basic" className="custom-dropdownbtn">
                More About
              </Dropdown.Toggle>

              <Dropdown.Menu className="dropdownmenu">
                <Dropdown.Item href="https://air-pollution-rouge.vercel.app/" target="_blank" rel="noopener noreferrer">Air Pollution Control & Reduction</Dropdown.Item>
                <Dropdown.Item href="https://water-pollution.vercel.app/" target="_blank" rel="noopener noreferrer">Water Pollution Treatment & Prevention</Dropdown.Item>
                <Dropdown.Item href="https://soil-pollution-sage.vercel.app/" target="_blank" rel="noopener noreferrer">Soil Conservation & Pollution Management</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
            <img 
              src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/arrow.png" 
              alt="Animated Arrow"
              className="animated-arrow"
            />
          </div>
        </article>
      </div>
    </section>
  );
};

export default AboutSection;