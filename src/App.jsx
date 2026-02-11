import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileSpreadsheet, Play, Download, Loader2, Video, CheckCircle, AlertCircle, Settings, Type, Palette, MoveVertical, ChevronsUp, ChevronsDown, Eye, Pause, Sliders, Music, Layers, Plus, Trash2, Zap, Clock, Volume2, VolumeX, Monitor, Smartphone, Grid, FileAudio, FolderArchive, FileVideo, ToggleLeft, ToggleRight, List, Check, FolderInput, Square, PlayCircle } from 'lucide-react';

// Helper to load external libraries (CDN)
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const App = () => {
  const [videos, setVideos] = useState([]);
  const [audioFiles, setAudioFiles] = useState([]); 
  const [excelData, setExcelData] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState("Ready to start...");
  const [finished, setFinished] = useState(false);
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [activeOverlayIndex, setActiveOverlayIndex] = useState(0); 
  const [estimatedTime, setEstimatedTime] = useState(null); 
  const [zipFolderName, setZipFolderName] = useState("my_videos");
  
  const [processedVideos, setProcessedVideos] = useState([]);

  // Audio Extraction States
  const [batchExtracting, setBatchExtracting] = useState(false); 
  const [audioExtractionQuality, setAudioExtractionQuality] = useState(128000); 

  // Control Refs
  const stopProcessingRef = useRef(false);
  const pauseProcessingRef = useRef(false);

  // Configuration State
  const [config, setConfig] = useState({
    autoDownload: false, 
    video: {
      opacity: 1,
      volume: 1,
      aspectRatio: "9:16",
      format: "webm" 
    },
    audio: {
      volume: 0.5 
    },
    overlays: [
      {
        id: 0,
        name: "Column 1",
        enabled: true,
        fontFamily: 'Arial',
        fontSize: 5,
        color: '#FFFFFF',
        bgColor: '#000000',
        bgOpacity: 1, 
        strokeColor: '#000000', 
        strokeOpacity: 1, 
        styleType: 'box',
        positionY: 10,
        wordsPerLine: 4
      },
      {
        id: 1,
        name: "Column 2",
        enabled: true,
        fontFamily: 'Arial',
        fontSize: 5,
        color: '#FFFFFF',
        bgColor: '#000000',
        bgOpacity: 0,
        strokeColor: '#000000',
        strokeOpacity: 1, 
        styleType: 'stroke', 
        positionY: 50,
        wordsPerLine: 4
      }
    ]
  });
  
  // Refs
  const canvasRef = useRef(null); 
  const videoRef = useRef(null);
  const audioRef = useRef(null); 
  const previewCanvasRef = useRef(null); 
  const previewVideoRef = useRef(null); 
  const requestRef = useRef(); 
  const zipRef = useRef(null); 
  
  const extractionVideoRef = useRef(null);

  // Audio Context Refs
  const audioCtxRef = useRef(null);
  const videoSourceNodeRef = useRef(null);
  const audioSourceNodeRef = useRef(null); 
  const videoGainNodeRef = useRef(null);   
  const audioGainNodeRef = useRef(null);   

  // Load external libraries
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        await Promise.all([
          loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"),
          loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"),
          loadScript("https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js")
        ]);
        setLibsLoaded(true);
        setLogs("Libraries loaded. Ready for upload.");
      } catch (error) {
        setLogs("Error: Libraries load nahi ho payi. Page refresh karein.");
        console.error("Library load error:", error);
      }
    };
    loadLibraries();
  }, []);

  // --- PREVIEW LOGIC ---
  useEffect(() => {
    if (videos.length > 0 && previewVideoRef.current) {
      const vid = previewVideoRef.current;
      vid.src = URL.createObjectURL(videos[0]);
      vid.load();
    }
  }, [videos]);

  const formatTime = (ms) => {
    if (!ms || ms < 0) return "--:--";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    return `${minutes}m ${seconds}s`;
  };

  const drawImageProp = (ctx, img, x, y, w, h, offsetX, offsetY) => {
    offsetX = typeof offsetX === "number" ? offsetX : 0.5;
    offsetY = typeof offsetY === "number" ? offsetY : 0.5;

    if (offsetX < 0) offsetX = 0;
    if (offsetX > 1) offsetX = 1;
    if (offsetY < 0) offsetY = 0;
    if (offsetY > 1) offsetY = 1;

    var iw = img.videoWidth,
        ih = img.videoHeight,
        r = Math.min(w / iw, h / ih),
        nw = iw * r,
        nh = ih * r,
        cx, cy, cw, ch, ar = 1;

    if (nw < w) ar = w / nw;                             
    if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh; 
    nw *= ar;
    nh *= ar;

    cw = iw / (nw / w);
    ch = ih / (nh / h);

    cx = (iw - cw) * offsetX;
    cy = (ih - ch) * offsetY;

    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;
    if (cw > iw) cw = iw;
    if (ch > ih) ch = ih;

    ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
  }

  const getAspectRatioDimensions = (ratio) => {
    switch(ratio) {
      case "16:9": return { width: 1920, height: 1080 };
      case "1:1": return { width: 1080, height: 1080 };
      case "4:5": return { width: 1080, height: 1350 };
      case "9:16":
      default: return { width: 1080, height: 1920 };
    }
  }

  const drawOverlay = useCallback((ctx, canvas, width, height, rowData) => {
    config.overlays.forEach((overlay) => {
      if (!overlay.enabled) return;

      const text = rowData[overlay.id];
      if (!text) return;

      const fontSize = Math.floor(width * (overlay.fontSize / 100));
      ctx.font = `bold ${fontSize}px ${overlay.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const lines = wrapText(text, overlay.wordsPerLine);
      const lineHeight = fontSize * 1.4;
      const boxPadding = fontSize * 0.4;
      
      const totalBlockHeight = lines.length * lineHeight;
      const startY = (height * (overlay.positionY / 100)) - (totalBlockHeight / 2) + (lineHeight / 2);

      lines.forEach((line, idx) => {
        const yPos = startY + (idx * lineHeight);
        
        if (overlay.styleType === 'box') {
           const textWidth = ctx.measureText(line).width;
           ctx.save();
           ctx.globalAlpha = overlay.bgOpacity;
           ctx.fillStyle = overlay.bgColor;
           ctx.fillRect(
             (width / 2) - (textWidth / 2) - boxPadding, 
             yPos - (fontSize / 2) - (boxPadding / 2), 
             textWidth + (boxPadding * 2), 
             fontSize + boxPadding
           );
           ctx.restore();
        } else if (overlay.styleType === 'stroke') {
           ctx.save();
           ctx.globalAlpha = overlay.strokeOpacity !== undefined ? overlay.strokeOpacity : 1;
           ctx.strokeStyle = overlay.strokeColor;
           ctx.lineWidth = fontSize * 0.15; 
           ctx.strokeText(line, width / 2, yPos);
           ctx.restore();
        }

        ctx.fillStyle = overlay.color;
        ctx.fillText(line, width / 2, yPos);
      });
    });
  }, [config.overlays]);

  const animatePreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const video = previewVideoRef.current;
    
    if (canvas && video && !video.paused && !video.ended) {
      const dims = getAspectRatioDimensions(config.video.aspectRatio);
      const scaleFactor = 400 / dims.height;
      canvas.width = dims.width * scaleFactor;
      canvas.height = dims.height * scaleFactor;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.globalAlpha = config.video.opacity;
      if (video.readyState >= 2) {
          drawImageProp(ctx, video, 0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
      
      const currentRow = excelData.length > 0 ? excelData[0] : config.overlays.map(o => `Preview ${o.name}`);
      drawOverlay(ctx, canvas, canvas.width, canvas.height, currentRow);
      
      requestRef.current = requestAnimationFrame(animatePreview);
    }
  }, [excelData, drawOverlay, config.video.opacity, config.video.aspectRatio, config.overlays]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const video = previewVideoRef.current;
    
    if (canvas && video) {
        if (video.readyState >= 2) {
            const dims = getAspectRatioDimensions(config.video.aspectRatio);
            const scaleFactor = 400 / dims.height;
            canvas.width = dims.width * scaleFactor;
            canvas.height = dims.height * scaleFactor;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.globalAlpha = config.video.opacity;
            drawImageProp(ctx, video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            
            const currentRow = excelData.length > 0 ? excelData[0] : config.overlays.map(o => `Preview ${o.name}`);
            drawOverlay(ctx, canvas, canvas.width, canvas.height, currentRow);
        }
    }
  }, [config, excelData, videos, drawOverlay]);

  const togglePreviewPlay = () => {
    const video = previewVideoRef.current;
    if (video) {
      if (video.paused) {
        video.play().then(() => {
          setIsPreviewPlaying(true);
          requestRef.current = requestAnimationFrame(animatePreview);
        });
      } else {
        video.pause();
        setIsPreviewPlaying(false);
        cancelAnimationFrame(requestRef.current);
      }
    }
  };

  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setVideos(files);
      setLogs(`${files.length} videos select ki gayi hain.`);
    }
  };

  const handleAudioUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setAudioFiles(files);
      setLogs(`${files.length} audio files select ki gayi hain.`);
    }
  };

  const handleExcelUpload = (e) => {
    if (!libsLoaded) {
      alert("Libraries abhi load nahi hui hain. Please refresh karein.");
      return;
    }
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result;
          if (!window.XLSX) throw new Error("XLSX lib not loaded");
          
          const wb = window.XLSX.read(bstr, { type: 'binary' });
          if (!wb.SheetNames || wb.SheetNames.length === 0) throw new Error("Invalid Excel");

          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          const cleanData = data.filter(row => Array.isArray(row) && row.length > 0);
          
          if (cleanData.length === 0) throw new Error("Excel file is empty or data format is wrong.");

          if (cleanData.length > 0) {
             const numCols = cleanData[0].length;
             const newOverlays = [];
             for(let i=0; i<numCols; i++) {
               newOverlays.push({
                  id: i,
                  name: `Column ${i + 1}`,
                  enabled: true,
                  fontFamily: 'Arial',
                  fontSize: 5,
                  color: '#FFFFFF',
                  bgColor: '#000000',
                  bgOpacity: i === 0 ? 0.8 : 0, 
                  strokeColor: '#000000',
                  strokeOpacity: 1,
                  styleType: i === 0 ? 'box' : 'stroke',
                  positionY: 20 + (i * 20),
                  wordsPerLine: 4
               });
             }
             setConfig(prev => ({ ...prev, overlays: newOverlays }));
             setActiveOverlayIndex(0);
          }

          setExcelData(cleanData);
          setLogs(`Excel data load ho gaya: ${cleanData.length} rows mili.`);
        } catch (error) {
          console.error("Excel Parsing Error:", error);
          alert("Excel file corrupt hai ya format sahi nahi hai.");
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const wrapText = (text, wordsPerLine) => {
    if (!text) return [];
    const words = text.toString().split(' ');
    const lines = [];
    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine).join(' '));
    }
    return lines;
  };

  const updateOverlayConfig = (index, key, value) => {
    setConfig(prev => {
      const newOverlays = [...prev.overlays];
      newOverlays[index] = { ...newOverlays[index], [key]: value };
      return { ...prev, overlays: newOverlays };
    });
  };

  const updateGlobalConfig = (section, key, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  // --- CONTROLS: START/STOP/PAUSE ---
  const handleStopProcessing = () => {
    stopProcessingRef.current = true;
    setProcessing(false);
    setIsPaused(false);
    setLogs("Processing stopped by user.");
  };

  const handlePauseProcessing = () => {
    pauseProcessingRef.current = !pauseProcessingRef.current;
    setIsPaused(pauseProcessingRef.current);
    setLogs(pauseProcessingRef.current ? "Processing paused..." : "Resuming...");
  };

  const downloadSingleVideo = (url, filename) => {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllZip = async () => {
    if (!zipRef.current) return;
    setLogs("Generating ZIP file...");
    const content = await zipRef.current.generateAsync({ type: "blob" });
    const safeName = zipFolderName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || "processed_videos";
    window.saveAs(content, `${safeName}.zip`);
    setLogs("ZIP Downloaded!");
  };

  // --- MAIN PROCESSING LOGIC ---
  const startProcessing = async () => {
    if (!libsLoaded || videos.length === 0 || excelData.length === 0) {
      alert("Ensure libraries, videos, and excel data are loaded.");
      return;
    }

    setProcessing(true);
    setFinished(false);
    setProgress(0);
    setEstimatedTime(null);
    setProcessedVideos([]); 
    setIsPaused(false);
    stopProcessingRef.current = false;
    pauseProcessingRef.current = false;
    
    zipRef.current = new window.JSZip();
    
    const startTime = Date.now(); 
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    const video = videoRef.current;
    const audio = audioRef.current;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    if (!videoSourceNodeRef.current) videoSourceNodeRef.current = audioCtx.createMediaElementSource(video);
    if (!audioSourceNodeRef.current && audio) audioSourceNodeRef.current = audioCtx.createMediaElementSource(audio);
    if (!videoGainNodeRef.current) {
      videoGainNodeRef.current = audioCtx.createGain();
      videoSourceNodeRef.current.connect(videoGainNodeRef.current);
    }
    if (!audioGainNodeRef.current && audioSourceNodeRef.current) {
      audioGainNodeRef.current = audioCtx.createGain();
      audioSourceNodeRef.current.connect(audioGainNodeRef.current);
    }

    const outputDims = getAspectRatioDimensions(config.video.aspectRatio);
    const count = excelData.length;

    let mimeType = 'video/webm;codecs=vp8,opus';
    let fileExt = 'webm';
    if (config.video.format === 'mp4') {
        fileExt = 'mp4';
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
            mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else {
            mimeType = 'video/webm;codecs=vp8,opus'; 
        }
    }

    try {
      for (let i = 0; i < count; i++) {
        if (stopProcessingRef.current) break;

        while (pauseProcessingRef.current) {
            await new Promise(r => setTimeout(r, 500)); 
            if (stopProcessingRef.current) break;
        }
        if (stopProcessingRef.current) break;

        const randomVideoIndex = Math.floor(Math.random() * videos.length);
        const file = videos[randomVideoIndex];
        
        let currentAudioFile = null;
        if (audioFiles.length > 0) {
           const randomAudioIndex = Math.floor(Math.random() * audioFiles.length);
           currentAudioFile = audioFiles[randomAudioIndex];
        }

        const rowData = excelData[i];
        const currentFileName = `${i + 1}.${fileExt}`;
        setLogs(`Processing ${i + 1}/${count}: ${file.name}...`);
        
        const videoUrl = URL.createObjectURL(file);
        video.src = videoUrl;
        video.muted = false; 
        video.volume = 1;    
        
        let audioUrl = null;
        if (currentAudioFile && audio) {
          audioUrl = URL.createObjectURL(currentAudioFile);
          audio.src = audioUrl;
          audio.volume = 1;
        }

        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            canvas.width = outputDims.width;
            canvas.height = outputDims.height;
            resolve();
          };
        });

        if (audioUrl) {
            await new Promise((resolve) => {
                if (audio.readyState >= 1) resolve();
                else audio.onloadedmetadata = () => resolve();
            });
        }

        const videoDur = video.duration;
        const audioDur = audioUrl ? audio.duration : Infinity;
        let durationToRecord = Math.min(videoDur, audioDur);
        if (!isFinite(durationToRecord) || durationToRecord <= 0) durationToRecord = videoDur;

        const dest = audioCtx.createMediaStreamDestination();
        
        videoGainNodeRef.current.gain.value = config.video.volume;
        videoGainNodeRef.current.connect(dest);

        if (currentAudioFile && audioGainNodeRef.current) {
          audioGainNodeRef.current.gain.value = config.audio.volume;
          audioGainNodeRef.current.connect(dest);
        }

        const canvasStream = canvas.captureStream(30); 
        const combinedTracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
        const combinedStream = new MediaStream(combinedTracks);
        
        const mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: mimeType,
          videoBitsPerSecond: 5000000 
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        const processPromise = new Promise((resolveRecorder) => {
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
            const blobUrl = URL.createObjectURL(blob);
            zipRef.current.file(currentFileName, blob);
            setProcessedVideos(prev => [{ id: i + 1, name: currentFileName, url: blobUrl }, ...prev]);
            if (config.autoDownload) {
                downloadSingleVideo(blobUrl, currentFileName);
            }
            resolveRecorder();
          };
        });

        mediaRecorder.start();
        
        const playPromises = [video.play()];
        if (currentAudioFile && audio) playPromises.push(audio.play());
        await Promise.all(playPromises);
        
        await new Promise((resolveStop) => {
            const drawFrame = () => {
                if (stopProcessingRef.current) {
                    resolveStop();
                    return;
                }

                const isTimeUp = video.currentTime >= durationToRecord;
                const isEnded = video.ended || (audioUrl && audio.ended);

                if (isTimeUp || isEnded || video.paused) {
                    resolveStop();
                    return;
                }

                if (video.readyState >= 2) {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.save();
                    ctx.globalAlpha = config.video.opacity;
                    drawImageProp(ctx, video, 0, 0, canvas.width, canvas.height);
                    ctx.restore();

                    drawOverlay(ctx, canvas, canvas.width, canvas.height, rowData);
                }
                
                if ('requestVideoFrameCallback' in video) {
                    video.requestVideoFrameCallback(drawFrame);
                } else {
                    requestAnimationFrame(drawFrame);
                }
            };
            drawFrame();
        });

        video.pause();
        if (audioUrl) audio.pause();
        
        mediaRecorder.stop();
        await processPromise;
        
        videoGainNodeRef.current.disconnect(dest);
        if (currentAudioFile && audioGainNodeRef.current) audioGainNodeRef.current.disconnect(dest);
        URL.revokeObjectURL(videoUrl);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        
        const elapsedTime = Date.now() - startTime;
        const processedCount = i + 1;
        const remainingCount = count - processedCount;
        if (remainingCount > 0) {
          const avgTimePerVideo = elapsedTime / processedCount;
          setEstimatedTime(formatTime(avgTimePerVideo * remainingCount));
        } else {
          setEstimatedTime("Finishing...");
        }

        setProgress(Math.round(((i + 1) / count) * 100));
      }

      setLogs(stopProcessingRef.current ? "Stopped!" : "All videos processed!");
      setFinished(true);
      setEstimatedTime(null);

    } catch (error) {
      console.error(error);
      setLogs(`Error: ${error.message}`);
      setEstimatedTime(null);
    } finally {
      setProcessing(false);
      setIsPaused(false);
    }
  };

  const handleBatchExtractAudio = async () => {
    if (videos.length === 0) return alert("No videos.");
    setBatchExtracting(true);
    setProgress(0);
    const zip = new window.JSZip();
    const folder = zip.folder("extracted_mp3_audios");
    const extractCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (extractCtx.state === 'suspended') await extractCtx.resume();
    const dest = extractCtx.createMediaStreamDestination();
    const video = extractionVideoRef.current;
    try {
        const source = extractCtx.createMediaElementSource(video);
        source.connect(dest);
    } catch(e) {}
    
    try {
      for (let i = 0; i < videos.length; i++) {
        const file = videos[i];
        setLogs(`Extracting Audio ${i+1}/${videos.length}`);
        const videoUrl = URL.createObjectURL(file);
        video.src = videoUrl;
        video.volume = 1;
        video.playbackRate = 1.0; 
        await new Promise(r => video.onloadedmetadata = r);
        const mr = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: audioExtractionQuality });
        const chunks = [];
        mr.ondataavailable = e => chunks.push(e.data);
        const p = new Promise(r => { mr.onstop = () => { folder.file(`${file.name.split('.')[0]}.mp3`, new Blob(chunks, {type:'audio/mp3'})); r(); }});
        mr.start(); await video.play(); await new Promise(r => video.onended = r); mr.stop(); await p;
        video.pause(); URL.revokeObjectURL(videoUrl);
        setProgress(Math.round(((i + 1) / videos.length) * 100));
      }
      const c = await zip.generateAsync({type:"blob"});
      window.saveAs(c, "audios.zip");
      setLogs("Done!");
    } catch(e) { console.error(e); } finally { extractCtx.close(); setBatchExtracting(false); video.src=""; }
  };

  const fonts = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Impact', 'Comic Sans MS'];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
        
        <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 border-b border-gray-700">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-8 h-8" />
            Ultimate Video Text Automation
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            Unlimited Rows | Auto-Shuffle | Queue System | Instant Downloads
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          <div className="xl:col-span-3 space-y-6">
             <div className="bg-yellow-900/30 border border-yellow-700/50 p-3 rounded-lg text-xs text-yellow-200 flex gap-2">
                <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span><strong>Fast Mode:</strong> Enable "Hardware Acceleration" in browser settings.</span>
             </div>

             <div className="bg-blue-900/20 border border-blue-700/50 p-4 rounded-lg space-y-3">
               <h3 className="text-sm font-bold text-blue-300 flex items-center gap-2">
                 <FileAudio className="w-4 h-4" /> Audio Tools
               </h3>
               <div>
                  <select className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-gray-300 mb-3"
                     value={audioExtractionQuality} onChange={(e) => setAudioExtractionQuality(parseInt(e.target.value))}>
                     <option value={128000}>128 kbps</option>
                     <option value={320000}>320 kbps (High)</option>
                   </select>
                  <button onClick={handleBatchExtractAudio} disabled={batchExtracting || videos.length === 0}
                     className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-xs font-bold flex items-center justify-center gap-2">
                     {batchExtracting ? <Loader2 className="w-3 h-3 animate-spin"/> : <FolderArchive className="w-3 h-3"/>} Extract Audios (ZIP)
                   </button>
               </div>
            </div>

            <div className="space-y-4">
              <label className="cursor-pointer flex items-center gap-3 bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                  <div className="bg-blue-600 p-2 rounded"><Upload className="w-5 h-5 text-white" /></div>
                  <input type="file" multiple accept="video/*" onChange={handleVideoUpload} className="hidden" />
                  <div><span className="font-medium block">1. Videos</span><span className="text-xs text-gray-400">{videos.length} selected</span></div>
              </label>
              <label className="cursor-pointer flex items-center gap-3 bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                  <div className="bg-purple-600 p-2 rounded"><Music className="w-5 h-5 text-white" /></div>
                  <input type="file" multiple accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                  <div><span className="font-medium block">2. Audio</span><span className="text-xs text-gray-400">{audioFiles.length} selected</span></div>
              </label>
              <label className="cursor-pointer flex items-center gap-3 bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                  <div className="bg-green-600 p-2 rounded"><FileSpreadsheet className="w-5 h-5 text-white" /></div>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} className="hidden" />
                  <div><span className="font-medium block">3. Excel Data</span><span className="text-xs text-gray-400">{excelData.length} rows</span></div>
              </label>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm border border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Progress:</span><span className="text-blue-400">{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-xs text-gray-300 flex items-center gap-2 truncate mb-2">
                {(processing || !libsLoaded) && <Loader2 className="w-3 h-3 animate-spin" />} {logs}
              </p>
              {estimatedTime && (
                <div className="flex items-center gap-2 text-yellow-400 bg-yellow-900/20 p-2 rounded border border-yellow-800/50">
                   <Clock className="w-3 h-3" /> <span>Est. Time: {estimatedTime}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
               <div>
                 <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                    <FolderInput className="w-3 h-3" /> Output Folder Name
                 </label>
                 <input 
                   type="text" 
                   value={zipFolderName} 
                   onChange={(e) => setZipFolderName(e.target.value)}
                   className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                   placeholder="e.g., my_shorts"
                 />
               </div>

               {!processing && !finished ? (
                <button onClick={startProcessing} disabled={!libsLoaded || videos.length === 0 || excelData.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:cursor-not-allowed">
                  <Play className="w-5 h-5" /> Start Processing
                </button>
              ) : processing ? (
                <div className="flex gap-2">
                    <button onClick={handlePauseProcessing} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold bg-yellow-600 hover:bg-yellow-700 text-white">
                        {isPaused ? <><PlayCircle className="w-5 h-5"/> Resume</> : <><Pause className="w-5 h-5"/> Pause</>}
                    </button>
                    <button onClick={handleStopProcessing} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white">
                        <Square className="w-5 h-5" /> Stop
                    </button>
                </div>
              ) : (
                <button onClick={() => setFinished(false)} className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold">
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="xl:col-span-9 space-y-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-black rounded-lg border border-gray-700 overflow-hidden relative aspect-video flex items-center justify-center group shadow-xl">
                  <canvas ref={previewCanvasRef} className="max-w-full max-h-full w-full h-full object-contain" />
                  {!videos.length && <div className="absolute text-gray-500 flex flex-col items-center"><Eye className="w-10 h-10 mb-2 opacity-50"/><span>Preview</span></div>}
                </div>

                <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col h-full overflow-hidden">
                    <div className="p-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                        <h3 className="font-bold text-sm flex items-center gap-2"><List className="w-4 h-4"/> Processed Queue</h3>
                        {(finished || processedVideos.length > 0) && <button onClick={downloadAllZip} className="text-xs bg-green-600 px-2 py-1 rounded flex gap-1 items-center hover:bg-green-700"><FolderArchive className="w-3 h-3"/> ZIP All</button>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[300px] lg:max-h-full">
                        {processedVideos.length === 0 && <div className="text-gray-500 text-xs text-center mt-10">Processed videos will appear here...</div>}
                        {processedVideos.map((vid) => (
                            <div key={vid.id} className="bg-gray-700 p-2 rounded flex justify-between items-center animate-fade-in">
                                <span className="text-xs truncate max-w-[120px]">{vid.name}</span>
                                <button onClick={() => downloadSingleVideo(vid.url, vid.name)} className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded">
                                    <Download className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-600 space-y-3 h-full">
                  <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 border-b border-gray-700 pb-2">
                     <Sliders className="w-4 h-4" /> Output Settings
                  </h3>
                  
                  <div className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                      <span className="text-xs text-gray-300">Auto-Download Each Video</span>
                      <button onClick={() => updateGlobalConfig('autoDownload', '', !config.autoDownload)} className={`${config.autoDownload ? "text-green-400" : "text-gray-500"}`}>
                          {config.autoDownload ? <ToggleRight className="w-6 h-6"/> : <ToggleLeft className="w-6 h-6"/>}
                      </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Aspect Ratio</label>
                        <select className="w-full bg-gray-700 border-none rounded text-xs p-1"
                           value={config.video.aspectRatio} onChange={(e) => updateGlobalConfig('video', 'aspectRatio', e.target.value)}>
                           <option value="9:16">9:16 (Reels)</option>
                           <option value="16:9">16:9 (YT)</option>
                           <option value="1:1">1:1 (Sq)</option>
                           <option value="4:5">4:5 (Port)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Format</label>
                        <select className="w-full bg-gray-700 border-none rounded text-xs p-1"
                           value={config.video.format} onChange={(e) => updateGlobalConfig('video', 'format', e.target.value)}>
                           <option value="webm">WebM</option>
                           <option value="mp4">MP4</option>
                        </select>
                      </div>
                  </div>

                  <div className="space-y-2 pt-2">
                      <div>
                        <div className="flex justify-between text-xs text-gray-400"><span>Video Opacity</span><span>{Math.round(config.video.opacity * 100)}%</span></div>
                        <input type="range" min="0" max="1" step="0.1" value={config.video.opacity} 
                           onChange={(e) => updateGlobalConfig('video', 'opacity', parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-lg"/>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-400"><span>Original Vol</span><span>{Math.round(config.video.volume * 100)}%</span></div>
                        <input type="range" min="0" max="1" step="0.1" value={config.video.volume} 
                           onChange={(e) => updateGlobalConfig('video', 'volume', parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-lg"/>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-400"><span>Added Audio Vol</span><span>{Math.round(config.audio.volume * 100)}%</span></div>
                        <input type="range" min="0" max="1.5" step="0.1" value={config.audio.volume} 
                           onChange={(e) => updateGlobalConfig('audio', 'volume', parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-lg"/>
                      </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-4 rounded-lg border border-gray-600 h-full flex flex-col">
                  <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
                      <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2"><Layers className="w-4 h-4" /> Text Overlays</h3>
                      <div className="flex gap-1">
                         {config.overlays.map((o, i) => (
                             <button key={i} onClick={() => setActiveOverlayIndex(i)} 
                                className={`w-2 h-2 rounded-full ${activeOverlayIndex===i ? 'bg-blue-500 ring-2 ring-blue-300' : 'bg-gray-600'}`}/>
                         ))}
                      </div>
                  </div>
                  
                  {config.overlays.length > 0 && (
                      <div className="space-y-3">
                          <div className="flex justify-between text-xs text-blue-300 font-bold">
                              <span>Editing: {config.overlays[activeOverlayIndex].name}</span>
                              <button onClick={() => updateOverlayConfig(activeOverlayIndex, 'enabled', !config.overlays[activeOverlayIndex].enabled)} 
                                className={`${config.overlays[activeOverlayIndex].enabled ? 'text-green-400':'text-red-400'}`}>
                                {config.overlays[activeOverlayIndex].enabled ? 'ON' : 'OFF'}
                              </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="text-xs text-gray-500">Style</label>
                                  <select value={config.overlays[activeOverlayIndex].styleType} onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'styleType', e.target.value)}
                                    className="w-full bg-gray-700 rounded text-xs p-1 border-none">
                                      <option value="box">Box</option><option value="stroke">Stroke</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs text-gray-500">Font</label>
                                  <select 
                                    value={config.overlays[activeOverlayIndex].fontFamily}
                                    onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'fontFamily', e.target.value)}
                                    className="w-full bg-gray-700 rounded text-xs p-1 border-none"
                                  >
                                    {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs text-gray-500">Font Size</label>
                                  <input type="number" value={config.overlays[activeOverlayIndex].fontSize} onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'fontSize', parseFloat(e.target.value))}
                                    className="w-full bg-gray-700 rounded text-xs p-1 border-none"/>
                              </div>
                              <div>
                                  <label className="text-xs text-gray-500">Words/Line</label>
                                  <input type="number" min="1" value={config.overlays[activeOverlayIndex].wordsPerLine} onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'wordsPerLine', parseInt(e.target.value))}
                                    className="w-full bg-gray-700 rounded text-xs p-1 border-none"/>
                              </div>
                          </div>

                          <div>
                              <label className="text-xs text-gray-500 flex justify-between">
                                <span>Vertical Position (Y%)</span>
                                <span>{config.overlays[activeOverlayIndex].positionY}%</span>
                              </label>
                              <div className="flex gap-2 items-center">
                                <input type="range" min="0" max="100" className="flex-1 h-1.5 bg-gray-600 rounded-lg"
                                  value={config.overlays[activeOverlayIndex].positionY} 
                                  onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'positionY', parseInt(e.target.value))}
                                />
                                <input type="number" min="0" max="100" className="w-12 bg-gray-700 text-xs p-1 rounded border-none text-center"
                                  value={config.overlays[activeOverlayIndex].positionY}
                                  onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'positionY', parseInt(e.target.value))}
                                />
                              </div>
                          </div>
                          
                          <div className="flex gap-2">
                              <div className="flex-1">
                                  <label className="text-xs text-gray-500 block">Text Color</label>
                                  <div className="flex items-center gap-2 bg-gray-700 rounded p-1">
                                    <input type="color" value={config.overlays[activeOverlayIndex].color} onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'color', e.target.value)} className="w-6 h-6 rounded bg-transparent border-none"/>
                                    <span className="text-[10px] text-gray-400">{config.overlays[activeOverlayIndex].color}</span>
                                  </div>
                              </div>
                              <div className="flex-1">
                                  <label className="text-xs text-gray-500 block">Bg/Stroke & Opacity</label>
                                  <div className="flex items-center gap-2 bg-gray-700 rounded p-1">
                                    {config.overlays[activeOverlayIndex].styleType === 'box' ? (
                                        <>
                                          <input type="color" value={config.overlays[activeOverlayIndex].bgColor} onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'bgColor', e.target.value)} className="w-6 h-6 rounded bg-transparent border-none"/>
                                          <input type="range" min="0" max="1" step="0.1" className="w-16 h-1.5 bg-gray-500 rounded" 
                                            value={config.overlays[activeOverlayIndex].bgOpacity}
                                            onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'bgOpacity', parseFloat(e.target.value))}
                                          />
                                        </>
                                    ) : (
                                        <>
                                          <input type="color" value={config.overlays[activeOverlayIndex].strokeColor} onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'strokeColor', e.target.value)} className="w-6 h-6 rounded bg-transparent border-none"/>
                                          <input type="range" min="0" max="1" step="0.1" className="w-16 h-1.5 bg-gray-500 rounded"
                                            value={config.overlays[activeOverlayIndex].strokeOpacity !== undefined ? config.overlays[activeOverlayIndex].strokeOpacity : 1}
                                            onChange={(e) => updateOverlayConfig(activeOverlayIndex, 'strokeOpacity', parseFloat(e.target.value))}
                                          />
                                        </>
                                    )}
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
                </div>
            </div>

          </div>
        </div>

        <div className="hidden">
          <video ref={videoRef} playsInline crossOrigin="anonymous" />
          <video ref={extractionVideoRef} playsInline crossOrigin="anonymous" />
          <audio ref={audioRef} crossOrigin="anonymous" />
          <canvas ref={canvasRef} />
          <video ref={previewVideoRef} playsInline muted loop crossOrigin="anonymous" />
        </div>
      </div>
    </div>
  );
};

export default App;