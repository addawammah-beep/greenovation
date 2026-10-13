import React, { useRef } from 'react';
import './ContactSection.css';
import emailjs from '@emailjs/browser';

const ContactSection = () => {
    const form = useRef();

    const sendEmail = (e) => {
        e.preventDefault();
        emailjs.sendForm('service_42dvd3f', 'template_jtm0fi6', form.current, '5NhO-fR-PTdO3zCl-')
            .then((result) => {
                console.log(result.text);
                alert("Message sent successfully");
            }, (error) => {
                console.log(error.text);
            });
        e.target.reset();
    };

    return (
        <section className="contact-section" id="contact">
            <div id='contact2'>
                <h2 className="section-title">Contact Us -Greenovation🌿</h2>
                <p className="discribe-text" style={{ textAlign: "center", margin: "20px auto" }}>If you need any assistance, feel free to contact us E-mail or phone . 01111953646</p>
                <div className="section-content" style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
                    <form ref={form} className="contact-form" onSubmit={sendEmail} style={{ textAlign: "center" }}>
                        <input type="text" placeholder="Your name" className="form-input" required name='name_client' />
                        <input type="email" placeholder="Your email" className="form-input" required name="from_name" />
                        <textarea placeholder="Your message" className="form-input" required name='message'></textarea>
                        <button type="submit" className="button submit-button btn-submit">Submit</button>
                    </form>
                </div>
            </div>
        </section>
    );
};

export default ContactSection;
