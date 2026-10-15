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
  const [captureDetails, setCaptureDetails] = useState(null);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [imageFile, setImageFile] = useState(null);
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

  const getFreshLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location services."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });
  });

  const createCaptureDetails = (location, source) => ({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    capturedAt: new Date().toISOString(),
    source,
  });

  const capturePhoto = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!video || !canvas || !video.videoWidth) return;

    setCapturing(true);
    try {
      const location = await getFreshLocation();

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const details = createCaptureDetails(location, "camera");
      setCapturedImage(canvas.toDataURL("image/jpeg"));
      setCaptureDetails(details);
      setImageFile(null);
      setLastAnalysis(null);
      setCameraError("");
      setPosition([details.latitude, details.longitude]);

      const stream = video.srcObject;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      setCameraStarted(false);
    } catch (locationError) {
      console.error("Could not record photo location:", locationError);
      setCameraError(
        locationError.code === 1
          ? "Allow location access in your browser settings, then capture the photo again."
          : "Could not get your GPS location. Check location services and try again."
      );
    } finally {
      setCapturing(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setCameraError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCameraError("The image must be smaller than 10 MB.");
      return;
    }

    setCapturing(true);
    setCameraError("");
    try {
      const [location, imageData] = await Promise.all([
        getFreshLocation(),
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read the selected image."));
          reader.readAsDataURL(file);
        }),
      ]);
      const details = createCaptureDetails(location, "upload");
      setImageFile(file);
      setCapturedImage(imageData);
      setCaptureDetails(details);
      setLastAnalysis(null);
      setPosition([details.latitude, details.longitude]);
    } catch (uploadError) {
      console.error("Could not prepare uploaded photo:", uploadError);
      setCameraError(
        uploadError.code === 1
          ? "Allow location access to attach the current GPS location to this image."
          : uploadError.message || "Could not prepare the selected image."
      );
    } finally {
      setCapturing(false);
    }
  };

  const startCamera = async () => {
    setCameraError("");
    if (!window.isSecureContext) {
      setCameraError("Camera access requires HTTPS, or localhost while developing. Open the app on a secure connection.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera access. Try a recent version of Chrome, Edge, or Firefox.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      } else {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview is unavailable. Please try again.");
      }
      setCameraStarted(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      const messages = {
        NotAllowedError: "Camera permission was denied. Allow camera access for this site in your browser settings, then try again.",
        NotFoundError: "No camera was found on this device.",
        NotReadableError: "The camera is already in use by another app. Close that app and try again.",
        OverconstrainedError: "The requested camera is unavailable. Try another browser or camera.",
        SecurityError: "The browser blocked camera access. Open the app over HTTPS or localhost.",
      };
      setCameraError(messages[err.name] || err.message || "Could not access the camera. Check browser permissions and try again.");
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
    if (!captureDetails) {
      alert("Capture the image again so its location and capture time can be recorded.");
      return;
    }

    setLoading(true);
    try {
      const selectedImageFile = imageFile || dataURLtoFile(capturedImage, "report.jpg");

      const form = new FormData();
      form.append("image", selectedImageFile);
      form.append("problemType", formData.problemType);
      form.append("address", formData.address);
      form.append("description", formData.description);
      form.append("latitude", captureDetails.latitude);
      form.append("longitude", captureDetails.longitude);
      form.append("capturedAt", captureDetails.capturedAt);
      form.append("captureAccuracy", captureDetails.accuracy);
      form.append("captureMethod", captureDetails.source);

      const response = await fetch("http://localhost:4000/report", {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (data.success) {
        setLastAnalysis({
          ...data.ai,
          latitude: data.report.latitude,
          longitude: data.report.longitude,
          capturedAt: data.report.capturedAt,
          source: data.report.captureMethod,
        });
        alert(
          `✅ Report submitted successfully.\n${data.ai?.reason || "تم رصد زبالة في الصورة."}`
        );

        setCapturedImage(null);
        setCaptureDetails(null);
        setImageFile(null);

        setFormData({
          problemType: "",
          address: "",
          description: "",
        });
      } else {
        if (data.ai) {
          setLastAnalysis({
            ...data.ai,
            latitude: captureDetails.latitude,
            longitude: captureDetails.longitude,
            capturedAt: captureDetails.capturedAt,
            source: captureDetails.source,
          });
        }
        alert(
          data.ai?.reason ||
            data.message ||
            data.error ||
            "Could not determine whether the image contains trash."
        );
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to submit report.");
    } finally {
      setLoading(false);
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
            📍 Show My Current Location
          </button>
          <p className="capture-details-note">
            GPS location is recorded when the photo is captured or selected. For uploaded images, the displayed time is the selection time, not necessarily when the original photo was taken.
          </p>

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
            <label className="image-upload-label">
              Or choose a photo from your device
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                disabled={capturing || loading}
              />
            </label>
            {cameraError && <p className="camera-error" role="alert">{cameraError}</p>}

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
                disabled={capturing}
              >
                {capturing ? "Getting GPS..." : "📸 Capture"}
              </button>
            )}

            {capturedImage && (
              <>
                <img src={capturedImage} alt="Captured" className="captured-image" />
                {captureDetails && (
                  <div className="capture-details" role="status">
                    <p>📍 Captured location: {captureDetails.latitude.toFixed(6)}, {captureDetails.longitude.toFixed(6)}</p>
                    <p>GPS accuracy: approximately {Math.round(captureDetails.accuracy)} m</p>
                    <p>🕒 {captureDetails.source === "camera" ? "Captured at" : "Selected at"}: {new Date(captureDetails.capturedAt).toLocaleString()}</p>
                    <p>The image is analyzed temporarily and is not saved with the report.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {lastAnalysis && (
            <div className="capture-details" role="status">
              <strong>
                {lastAnalysis.contains_trash
                  ? "Image check: trash detected"
                  : "Image check: no visible trash detected"}
              </strong>
              <p>{lastAnalysis.reason}</p>
              <p>📍 Photo location: {Number(lastAnalysis.latitude).toFixed(6)}, {Number(lastAnalysis.longitude).toFixed(6)}</p>
              <p>🕒 {lastAnalysis.source === "camera" ? "Photo time" : "Image selection time"}: {new Date(lastAnalysis.capturedAt).toLocaleString()}</p>
            </div>
          )}

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