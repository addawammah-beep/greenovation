import React, { useRef, useState } from "react";
import Tesseract from "tesseract.js";
import "./Upload_vedio.css";

const VideoUploadPreview = ({ userType = "user" }) => {
  const [videoPreview, setVideoPreview] = useState(null);
  const [extractedCode, setExtractedCode] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);
  const fileInputRef = useRef();
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordedChunks = useRef([]);

  // قائمة الأكواد الصالحة
  const validCodes = useRef(["ABC123", "XYZ789", "TEST001"]);

  // رفع الفيديو
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("video/")) {
      alert("Please select a valid video file.");
      return;
    }

    const videoURL = URL.createObjectURL(file);
    setVideoPreview(videoURL);

    analyzeVideoForCode(file);
  };

  // تسجيل الفيديو
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;

      mediaRecorderRef.current = new MediaRecorder(stream);
      recordedChunks.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoPreview(url);

        analyzeVideoForCode(blob);

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (error) {
      alert("Error accessing camera.");
      console.error(error);
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  // === تحليل الفيديو لأخذ Frame واحد ===
  const analyzeVideoForCode = (videoFile) => {
    const videoEl = document.createElement("video");
    videoEl.src = URL.createObjectURL(videoFile);

    videoEl.onloadeddata = () => {
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      Tesseract.recognize(canvas, "eng").then(({ data: { text } }) => {
        const codeFound = text.trim();
        if (codeFound) verifyCodeLocally(codeFound);
      });
    };
  };

  // === التحقق من الكود محليًا ===
  const verifyCodeLocally = (code) => {
    const index = validCodes.current.indexOf(code);
    if (index !== -1) {
      setVerificationResult({ success: true });
      setExtractedCode(code);

      // لو المستخدم تاجر، نحذف الكود بعد ظهوره مرة واحدة
      if (userType === "merchant") validCodes.current.splice(index, 1);
    } else {
      setVerificationResult({ success: false, message: "Code is invalid or already used" });
      setExtractedCode("");
    }
  };

  return (
    <div className="video-upload-wrapper">
      <label className="upload-label">Upload or Record a Video</label>

      <div className="video-preview-box">
        {videoPreview ? (
          <video src={videoPreview} controls className="video-preview" />
        ) : (
          <p className="placeholder-text">No video selected</p>
        )}
      </div>

      <input
        type="file"
        accept="video/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden-input"
      />

      <div className="button-group">
        <button type="button" onClick={() => fileInputRef.current.click()} className="upload-button">
          Upload Video
        </button>

        {!recording ? (
          <button type="button" onClick={handleStartRecording} className="record-button">
            Start Recording
          </button>
        ) : (
          <button type="button" onClick={handleStopRecording} className="stop-button">
            Stop Recording
          </button>
        )}
      </div>

      {verificationResult && verificationResult.success && (
        <div className="success-result">
          <h3>Code Verified: {extractedCode}</h3>
        </div>
      )}

      {verificationResult && !verificationResult.success && (
        <div className="error-result">
          <h3>{verificationResult.message}</h3>
        </div>
      )}
    </div>
  );
};

export default VideoUploadPreview;
