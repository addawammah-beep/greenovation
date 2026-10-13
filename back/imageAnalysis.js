// // services/imageAnalysis.js

// // 1. تحليل الصورة باستخدام Google Vision
// export async function analyzeEnvironmentalImage(imageDataUrl) {
//   const apiKey = process.env.REACT_APP_GOOGLE_VISION_API_KEY;
  
//   // تحويل DataURL إلى Base64
//   const base64Image = imageDataUrl.split(',')[1];
  
//   try {
//     const response = await fetch(
//       `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
//       {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           requests: [{
//             image: {
//               content: base64Image
//             },
//             features: [
//               { 
//                 type: 'LABEL_DETECTION', 
//                 maxResults: 20 
//               },
//               { 
//                 type: 'OBJECT_LOCALIZATION',
//                 maxResults: 10
//               },
//               { 
//                 type: 'SAFE_SEARCH_DETECTION' 
//               },
//               { 
//                 type: 'TEXT_DETECTION' 
//               },
//               { 
//                 type: 'IMAGE_PROPERTIES' 
//               }
//             ]
//           }]
//         })
//       }
//     );
    
//     const data = await response.json();
    
//     if (data.error) {
//       throw new Error(data.error.message);
//     }
    
//     return processVisionResults(data.responses[0]);
    
//   } catch (error) {
//     console.error('Google Vision Error:', error);
//     throw error;
//   }
// }

// // معالجة النتائج
// function processVisionResults(results) {
//   const labels = results.labelAnnotations || [];
//   const objects = results.localizedObjectAnnotations || [];
//   const safeSearch = results.safeSearchAnnotation || {};
//   const colors = results.imagePropertiesAnnotation?.dominantColors?.colors || [];
  
//   // كلمات دلالية للتلوث
//   const pollutionKeywords = [
//     'trash', 'garbage', 'waste', 'plastic', 'pollution',
//     'litter', 'rubbish', 'debris', 'dump', 'landfill',
//     'sewage', 'chemical', 'oil', 'smoke', 'smog'
//   ];
  
//   // كشف التلوث
//   const pollutionDetected = labels.some(label => 
//     pollutionKeywords.some(keyword => 
//       label.description.toLowerCase().includes(keyword)
//     )
//   );
  
//   // حساب شدة التلوث (0-10)
//   let severity = 0;
//   labels.forEach(label => {
//     pollutionKeywords.forEach(keyword => {
//       if (label.description.toLowerCase().includes(keyword)) {
//         severity += label.confidence * 10;
//       }
//     });
//   });
//   severity = Math.min(Math.round(severity), 10);
  
//   // تصنيف المشكلة
//   const problemType = classifyProblem(labels);
  
//   // وصف الصورة
//   const description = generateDescription(labels, objects);
  
//   return {
//     pollutionDetected,
//     severity,
//     problemType,
//     description,
//     labels: labels.map(l => ({
//       name: l.description,
//       confidence: Math.round(l.confidence * 100)
//     })),
//     objects: objects.map(o => ({
//       name: o.name,
//       confidence: Math.round(o.confidence * 100),
//       boundingBox: o.boundingPoly?.normalizedVertices
//     })),
//     safeSearch: {
//       adult: safeSearch.adult || 'UNKNOWN',
//       violence: safeSearch.violence || 'UNKNOWN',
//       medical: safeSearch.medical || 'UNKNOWN'
//     },
//     dominantColors: colors.slice(0, 5).map(c => ({
//       color: c.color,
//       percentage: Math.round(c.pixelFraction * 100)
//     })),
//     text: results.textAnnotations?.[0]?.description || null
//   };
// }

// // تصنيف نوع المشكلة
// function classifyProblem(labels) {
//   const classifications = {
//     garbage: ['trash', 'garbage', 'waste', 'litter', 'rubbish'],
//     water: ['water', 'sea', 'ocean', 'river', 'lake', 'pollution'],
//     air: ['smoke', 'smog', 'exhaust', 'fumes', 'cloud'],
//     sewage: ['sewage', 'drain', 'pipe', 'wastewater'],
//     plastic: ['plastic', 'bottle', 'bag', 'container'],
//     chemical: ['chemical', 'oil', 'spill', 'hazardous']
//   };
  
//   for (const [type, keywords] of Object.entries(classifications)) {
//     if (labels.some(label => 
//       keywords.some(keyword => 
//         label.description.toLowerCase().includes(keyword)
//       )
//     )) {
//       return type.charAt(0).toUpperCase() + type.slice(1);
//     }
//   }
  
//   return 'Other';
// }

// // توليد وصف
// function generateDescription(labels, objects) {
//   const detected = labels.slice(0, 5).map(l => l.description);
//   const items = objects.slice(0, 3).map(o => o.name);
  
//   if (detected.length === 0) return 'No clear objects detected';
  
//   let desc = `This image contains ${detected.join(', ')}`;
//   if (items.length > 0) {
//     desc += `. Detected objects: ${items.join(', ')}`;
//   }
  
//   return desc;
// }