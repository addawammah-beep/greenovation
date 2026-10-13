import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/manipulation';
import { Navigation, Pagination, Manipulation } from 'swiper/modules';
import Card from 'react-bootstrap/Card';
import 'bootstrap/dist/css/bootstrap.min.css';
import './OurServices.css';

const OurServices = () => {
  const [emps, setEmp] = useState([]);

  useEffect(() => {
    axios.get("data.json")
      .then((res) => {
        setEmp(res.data.Employee);
      });
  }, []);

  return (
    <>
      <div className="our-services" id='My Role'>
        <h2>Your Role in Protecting the Planet</h2>
        <div className="titleunderline"></div>
        <Swiper
          slidesPerView={3}
          centeredSlides={true}
          spaceBetween={30}
          pagination={{ clickable: true }}
          navigation={true}
          modules={[Pagination, Navigation, Manipulation]}
          className="mySwiper"
          breakpoints={{
            // Mobile (up to 767px)
            0: {
              slidesPerView: 1,
              spaceBetween: 20,
              centeredSlides: true,
            },
            // Tablet (768px to 991px)
            768: {
              slidesPerView: 2,
              spaceBetween: 25,
              centeredSlides: true,
            },
            // Desktop (992px and up)
            992: {
              slidesPerView: 3,
              spaceBetween: 30,
              centeredSlides: true,
            }
          }}
        >
          <SwiperSlide>
            <Card className="shadow-lg text-left p-3 card-hover" style={{ width: 'calc(18rem + 80px)', borderRadius: '10px', margin: '30px 0' }}>
              <Card.Img variant="top" src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/container.png" style={{ borderRadius: '10px 10px 0 0' }} />
              <Card.Body>
                <img src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/icon2.png" alt="" className="small-icon" style={{ width: '40px', height: '40px', margin: '10px' }} />
                <div className="emoji">Waste Recycling</div>
                <div className="underline"></div>
                <Card.Text className="description">
                  Transforming waste into reusable materials to reduce pollution and promote sustainability.
                </Card.Text>
              </Card.Body>
            </Card>
          </SwiperSlide>

          <SwiperSlide>
            <Card className="shadow-lg text-left p-3 card-hover" style={{ width: 'calc(18rem + 80px)', borderRadius: '10px', margin: '30px 0' }}>
              <Card.Img variant="top" src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/payara.png" style={{ borderRadius: '10px 10px 0 0' }} />
              <Card.Body>
                <img src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/icon3.png" alt="" className="small-icon" style={{ width: '40px', height: '40px', margin: '10px' }} />
                <div className="emoji">Tree Plantation</div>
                <div className="underline"></div>
                <Card.Text className="description">
                  Increasing green spaces to improve air quality and combat climate change.
                </Card.Text>
              </Card.Body>
            </Card>
          </SwiperSlide>

          <SwiperSlide>
            <Card className="shadow-lg text-left p-3 card-hover" style={{ width: 'calc(18rem + 80px)', borderRadius: '10px', margin: '30px 0' }}>
              <Card.Img variant="top" src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/sea-area.png" style={{ borderRadius: '10px 10px 0 0' }} />
              <Card.Body>
                <img src="https://wp.ditsolution.net/echofy-multi/wp-content/uploads/2024/03/icon1.png" alt="" className="small-icon" style={{ width: '40px', height: '40px', margin: '10px' }} />
                <div className="emoji">Ocean Cleanup</div>
                <div className="underline"></div>
                <Card.Text className="description">
                  Removing plastic waste and pollutants to protect marine life and ecosystems.
                </Card.Text>
              </Card.Body>
            </Card>
          </SwiperSlide>

          <SwiperSlide>
            <Card className="shadow-lg text-left p-3 card-hover" style={{ width: 'calc(18rem + 80px)', borderRadius: '10px', margin: '30px 0' }}>
              <Card.Img variant="top" src="https://img.freepik.com/premium-photo/team-planting-trees-dense-forest-restore-ecosystem-reforestation-campaigns_34478-3592.jpg?w=1380" style={{ borderRadius: '10px 10px 0 0' }} />
              <Card.Body>
                <img src="https://cdn-icons-png.flaticon.com/512/9480/9480276.png" alt="" className="small-icon" style={{ width: '40px', height: '40px', margin: '10px' }} />
                <div className="emoji">Forest Conservation</div>
                <div className="underline"></div>
                <Card.Text className="description">
                  Protecting forests to preserve biodiversity and reduce deforestation.
                <br/>
                <br/>
                <br/>
                </Card.Text>
              </Card.Body>
            </Card>
          </SwiperSlide>

          <SwiperSlide>
            <Card className="shadow-lg text-left p-3 card-hover" style={{ width: 'calc(18rem + 80px)', borderRadius: '10px', margin: '30px 0' }}>
              <Card.Img variant="top" src="https://media.greenmatters.com/brand-img/DLYEgjysb/0x0/renewable-energy-1556648900700.jpg" style={{ borderRadius: '10px 10px 0 0' }} />
              <Card.Body>
                <img src="https://th.bing.com/th/id/OIP.0ev3xizu_AjO_EpeQYHv2QHaHa?w=512&h=512&rs=1&pid=ImgDetMain" alt="" className="small-icon" style={{ width: '40px', height: '40px', margin: '10px' }} />
                <div className="emoji">Solar Energy</div>
                <div className="underline"></div>
                <Card.Text className="description">
                  Promoting renewable energy sources to reduce carbon emissions.
                  <br/>
                  <br/>
                  <br/>
                </Card.Text>
              </Card.Body>
            </Card>
          </SwiperSlide>
        </Swiper>
      </div>
    </>
  );
}

export default OurServices;