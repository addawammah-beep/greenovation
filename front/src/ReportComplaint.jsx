import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "./Complaint.css";

// إصلاح أيقونات Leaflet
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function ChangeMap({ position }) {
  const map = useMap();
  map.setView(position, 15);
  return null;
}

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return (
    <Marker position={position}>
      <Popup>Selected Location</Popup>
    </Marker>
  );
}

export default function ReportComplaint() {
  const [position, setPosition] = useState([30.0444, 31.2357]);

  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    problemType: "",
    address: "",
    description: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const dataURLtoFile = (dataUrl, filename) => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);

    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg");
    setCapturedImage(image);

    const stream = videoRef.current?.srcObject;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    setCameraStarted(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStarted(true);
    } catch (err) {
      console.error(err);
      alert("Cannot access camera.");
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (location) => {
        setPosition([
          location.coords.latitude,
          location.coords.longitude,
        ]);
      },
      () => {
        alert("Please allow location access.");
      }
    );
  };

  const submitReport = async (e) => {
    e.preventDefault();

    if (!capturedImage) {
      alert("Please capture an image first.");
      return;
    }

    try {
      const imageFile = dataURLtoFile(capturedImage, "report.jpg");

      const form = new FormData();
      form.append("image", imageFile);
      form.append("problemType", formData.problemType);
      form.append("address", formData.address);
      form.append("description", formData.description);
      form.append("latitude", position[0]);
      form.append("longitude", position[1]);

      const response = await fetch("http://localhost:4000/report", {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (data.success) {
        alert("✅ Report submitted successfully.");

        setCapturedImage(null);

        setFormData({
          problemType: "",
          address: "",
          description: "",
        });
      } else {
        alert(data.error || data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit report.");
    }
  };
    return (
    <section className="report-section">

      <div className="report-header">
        <h2 className="section-title">
          Report Environmental Issue
        </h2>

        <p className="section-subtitle">
          Help us keep our environment clean by reporting polluted places.
        </p>
      </div>

      <div className="report-content">

        {/* الخريطة */}

        <div className="report-map">

          <MapContainer
            center={position}
            zoom={13}
            className="map"
          >

            <ChangeMap position={position} />

            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <LocationMarker
              position={position}
              setPosition={setPosition}
            />

          </MapContainer>

        </div>

        {/* الفورم */}

        <form
          className="report-form"
          onSubmit={submitReport}
        >

          <button
            type="button"
            className="location-btn"
            onClick={getCurrentLocation}
          >
            📍 Use My Current Location
          </button>

          <div className="camera-box">
            {!cameraStarted && (
              <button
                type="button"
                onClick={startCamera}
                className="submit-btn"
              >
                📷 Open Camera
              </button>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="camera-preview"
            />

            <canvas
              ref={canvasRef}
              style={{ display: "none" }}
            />

            {cameraStarted && (
              <button
                type="button"
                className="submit-btn"
                onClick={capturePhoto}
              >
                📸 Capture
              </button>
            )}

            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured"
                className="captured-image"
              />
            )}
          </div>

          <label>Problem Type</label>

          <select
            name="problemType"
            value={formData.problemType}
            onChange={handleChange}
            required
          >
            <option value="">Select Problem</option>

            <option value="Garbage">
              Garbage
            </option>

            <option value="Illegal Dumping">
              Illegal Dumping
            </option>

            <option value="Water Pollution">
              Water Pollution
            </option>

            <option value="Air Pollution">
              Air Pollution
            </option>

            <option value="Sewage">
              Sewage
            </option>

            <option value="Other">
              Other
            </option>

          </select>

          <label>Address</label>

          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter address..."
            required
          />

          <label>Description</label>

          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe the problem..."
            rows="5"
            required
          />

          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading
              ? "Submitting..."
              : "Submit Report"}
          </button>

        </form>

      </div>

    </section>
  );
}