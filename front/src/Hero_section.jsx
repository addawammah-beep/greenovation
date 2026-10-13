import React, { useState, useEffect } from 'react';
import { HashLink } from 'react-router-hash-link';
import './hero-section.css';
import downloading2 from './photo/downloading2.png';
import download from './photo/download.png';
import Mpicture1 from './photo/Mpicture1.png';
import Mpicture2 from './photo/Mpicture2.png';
import hero_greenovation from "./photo/hero-greenovation.mp4";

const Hero_section = () => {
  const [currentBackground, setCurrentBackground] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const desktopBackgrounds = [downloading2, download];
  const mobileBackgrounds = [Mpicture1, Mpicture2];
  const backgrounds = isMobile ? mobileBackgrounds : desktopBackgrounds;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBackground((prevBackground) => (prevBackground + 1) % backgrounds.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [backgrounds.length]);

  return (
    <>
      <section className="hero-section" id="Home">
        <div className="carousel relative w-screen h-[calc(100vh-30px)] overflow-hidden">
          <div className="list absolute w-full h-full">
            {backgrounds.map((background, index) => (
              <div
                className={`item absolute w-full h-full transition-opacity duration-1000 ${index === currentBackground ? 'active opacity-100 z-10' : 'opacity-0'}`}
                key={index}
                style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              >
                <div className="content absolute top-1/2 left-[10%] transform -translate-y-1/2 text-left text-white max-w-[600px]">
                  <p className="natural-environment text-xl mb-4">Natural Environment</p>
                  <h1 className="title text-3xl font-bold mb-5">Together for a Cleaner Planet and a Sustainable Future</h1>
                  <p className="description text-lg mb-4">
                    Welcome to our site (Greenovation 🌿), where we strive to reduce pollution and protect our environment. 
                    Join us in making a difference by preserving clean air, pure water, and healthy soil for future generations. 🌿🌍
                    <br/>
                    Do you want to watch a video that explains our website and environmental issues?
                  </p>
<button
  onClick={() => window.open(hero_greenovation, '_blank')}
  className="watchnowbtn "
>
  Watch Now
</button>
                </div>
              </div>
            ))}
          </div>
          <div className="carousel-progress absolute top-0 left-0 h-1 bg-orange-500 transition-all" style={{ width: `${(currentBackground + 1) / backgrounds.length * 100}%` }}></div>
        </div>
      </section>
    </>
  );
};

export default Hero_section;
