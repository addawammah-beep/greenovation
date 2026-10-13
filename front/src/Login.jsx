import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

const Login = ({ show, onClose, setUser }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState("choose");
  const [mode, setMode] = useState(""); // login OR register
  const [accountType, setAccountType] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    registry: "",
    commercial_registration_number: "",
    tax_registration_number: "",
    business_address: "",
    legal_name: "",
    business_activity: "",
    branch_name: "",
    branch_address: "",
    responsible_person: "",
    gps: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const API_URL = "http://localhost:4000";

  //walaa: Reset form when modal opens
  // Reset form when modal opens
  useEffect(() => {
    if (show) {
      setStep("choose");
      setMode("");
      setAccountType("");
      setForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        registry: "",
        commercial_registration_number: "",
        tax_registration_number: "",
        business_address: "",
        legal_name: "",
        business_activity: "",
        branch_name: "",
        branch_address: "",
        responsible_person: "",
        gps: "",
      });
      setError("");
      setSuccess("");
    }
  }, [show]);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ----------- LOGIN ------------
  const handleLogin = async () => {
    try {
      const response = await axios.post(`${API_URL}/users/login`, {
        email: form.email,
        password: form.password,
        type: accountType,
      });

      setUser(response.data.user);
      localStorage.setItem("greenovation_user", JSON.stringify(response.data.user));
      localStorage.setItem("greenovation_user_type", accountType);
      localStorage.setItem("greenovation_token", response.data.token);

      setSuccess("✅ تم تسجيل الدخول بنجاح");
      // Navigate to profile page
      setError("");

      setTimeout(() => {
        onClose();
        navigate(accountType === 'collector' ? '/collectors' : '/profile');
      }, 1200);
    } catch (err) {
      console.error(err);
      setError("❌ Incorrect login credentials");
    }
  };

  // ----------- REGISTER ------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      setError("Email and password are required");
    }

    try {
      await axios.post(`${API_URL}/users`, { ...form, type: accountType });
      setSuccess("✅ Account created successfully");
        
      // Auto-login after successful registration
      try {
        const loginResponse = await axios.post(`${API_URL}/users/login`, {
          email: form.email,
          password: form.password,
          type: accountType,
        });
          
        setUser(loginResponse.data.user);
        localStorage.setItem("greenovation_user", JSON.stringify(loginResponse.data.user));
        localStorage.setItem("greenovation_user_type", accountType);
        localStorage.setItem("greenovation_token", loginResponse.data.token);
          
        setTimeout(() => {
          onClose();
          navigate(accountType === 'collector' ? '/collectors' : '/profile');
        }, 1200);
      } catch (loginErr) {
        console.error("Auto-login failed:", loginErr);
        setTimeout(() => onClose(), 2000);
      }
      return;

    } catch (err) {
      console.error(err);
      setError("❌ Error in process ");
    }
  };

  if (!show) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <span className="popup-close" onClick={onClose}>
          &times;
        </span>

        {/* ---------------- STEP 1: Choose account type ---------------- */}
        {step === "choose" && (
          <div className="choose-account">
            <h3>Choose account type</h3>

            <button
              className="button"
              onClick={() => {
                setAccountType("user");
                setStep("choose-mode");
              }}
            >
              User
            </button>

            <button
              className="button"
              onClick={() => {
                setAccountType("seller");
                setStep("choose-mode");
              }}
            >
              Seller
            </button>

            <button
              className="button"
              onClick={() => {
                setAccountType("collector");
                setStep("choose-mode");
              }}
            >
              Collector
            </button>
          </div>
        )}

        {/* ---------------- STEP 2: Choose login OR register ---------------- */}
        {step === "choose-mode" && (
          <div className="choose-account">
            <h3>Choose action</h3>

            <button
              className="button"
              onClick={() => {
                setMode("login");
                setStep("form");
              }}
            >
              Login
            </button>

            <button
              className="button"
              onClick={() => {
                setMode("register");
                setStep("form");
              }}
            >
              Create account
            </button>
          </div>
        )}

        {/* ---------------- STEP 3: FORM ---------------- */}
        {step === "form" && (
          <div className="login-form">
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleInput}
                className="input"
              />

              {/* Password */}
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleInput}
                className="input"
              />

              {/* REGISTER FIELDS ONLY */}
              {mode === "register" && (
                <>
                  <input
                    type="text"
                    name="name"
                    placeholder={accountType === "seller" ? "Business Name" : "Name"}
                    value={form.name}
                    onChange={handleInput}
                    className="input"
                  />

                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone"
                    value={form.phone}
                    onChange={handleInput}
                    className="input"
                  />

                  {accountType === "seller" && (
                    <>
                      <input type="text" name="commercial_registration_number" placeholder="Commercial Registration Number" value={form.commercial_registration_number} onChange={handleInput} className="input" required />
                      <input type="text" name="tax_registration_number" placeholder="Tax Registration Number" value={form.tax_registration_number} onChange={handleInput} className="input" required />
                      <input type="text" name="business_address" placeholder="Business Address" value={form.business_address} onChange={handleInput} className="input" required />
                      <input type="text" name="legal_name" placeholder="Legal / Registered Name" value={form.legal_name} onChange={handleInput} className="input" />
                      <input type="text" name="business_activity" placeholder="Business Activity" value={form.business_activity} onChange={handleInput} className="input" required />
                      <input type="text" name="branch_name" placeholder="Branch Name" value={form.branch_name} onChange={handleInput} className="input" />
                      <input type="text" name="branch_address" placeholder="Branch Address" value={form.branch_address} onChange={handleInput} className="input" />
                      <input type="text" name="responsible_person" placeholder="Legal Representative / Responsible Person" value={form.responsible_person} onChange={handleInput} className="input" required />
                    </>
                  )}

                  {accountType === "collector" && (
                    <input
                      type="text"
                      name="registry"
                      placeholder="Business registration"
                      value={form.registry}
                      onChange={handleInput}
                      className="input"
                    />
                  )}


                  {(accountType === "seller" || accountType === "collector") && (
                    //gps input with button to get current location
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        name="gps"
                        placeholder="GPS coordinates"
                        value={form.gps}
                        onChange={handleInput}
                        className="input"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                const { latitude, longitude } = position.coords;
                                setForm({ ...form, gps: `${latitude},${longitude}` });
                              },
                              (error) => {
                                setError("❌ Failed to get geolocation");
                                console.error("Geolocation error:", error);
                              }
                            );
                          } else {
                            setError("❌ Browser does not support geolocation");
                          }
                        }}
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                      >
                        📍 Get location
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* BUTTONS */}
              {mode === "login" ? (
                <button type="button" className="button" onClick={handleLogin}>
                  Login
                </button>
              ) : (
                <button type="submit" className="button">
                  Create account
                </button>
              )}
            </form>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
