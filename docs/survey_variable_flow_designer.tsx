import React, { useState, useEffect, useRef } from 'react';

const DEFAULT_WIDGETS = [
  { type: 'text', label: 'Text Input', icon: '🅣', desc: 'Capture name, short answers' },
  { type: 'number', label: 'Number Input', icon: '🅝', desc: 'Age, volume, transactional data' },
  { type: 'dropdown', label: 'Dropdown', icon: '🅢', desc: 'Single selection lists' },
  { type: 'radio', label: 'Radio Group', icon: '🅡', desc: 'Exclusive options' },
  { type: 'checkbox', label: 'Checkbox Group', icon: '🅒', desc: 'Multiple selection lists' },
  { type: 'gps', label: 'GPS Capture', icon: '🅖', desc: 'Automated geolocation capture' },
  { type: 'signature', label: 'Signature Pad', icon: '🅢', desc: 'Legal user consent draw area' }
];

const INITIAL_NODES = [
  {
    id: 'node-1',
    title: 'BioData',
    description: 'Basic participant demographic information',
    x: 80,
    y: 120,
    fields: [
      { id: 'f-1', variableName: 'full_name', label: 'What is your name?', type: 'text', options: [] },
      { id: 'f-2', variableName: 'age', label: 'How old are you?', type: 'number', options: [] },
      { id: 'f-3', variableName: 'gender', label: 'Gender', type: 'radio', options: ['Male', 'Female', 'Prefer not to say'] }
    ],
    renderMode: 'list',
    platforms: ['web', 'mobile']
  },
  {
    id: 'node-2',
    title: 'Purchases',
    description: 'Track details about purchase volumes',
    x: 520,
    y: 180,
    fields: [
      { id: 'f-4', variableName: 'brand_category', label: 'Brand Categories', type: 'dropdown', options: ['Premium', 'Economy', 'Value'] },
      { id: 'f-5', variableName: 'skus_purchased', label: 'SKUs Purchased', type: 'checkbox', options: ['SKU_Alpha', 'SKU_Beta', 'SKU_Gamma'] },
      { id: 'f-6', variableName: 'record_financials', label: 'Proceed to capture financials?', type: 'dropdown', options: ['Yes', 'No'], routingTarget: 'node-3' }
    ],
    renderMode: 'list',
    platforms: ['web', 'mobile', 'ussd']
  },
  {
    id: 'node-3',
    title: 'Financials',
    description: 'Financial transactions and mapping',
    x: 960,
    y: 280,
    fields: [
      { id: 'f-7', variableName: 'total_sales', label: 'Total Sales Revenue (USD)', type: 'number', options: [] },
      { id: 'f-8', variableName: 'payment_method', label: 'Primary Payment Method', type: 'radio', options: ['Cash', 'Mobile Money', 'Bank Transfer'] }
    ],
    renderMode: 'single',
    platforms: ['web', 'mobile']
  }
];

export default function App() {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState('node-1');
  const [selectedFieldId, setSelectedFieldId] = useState('f-2'); // default focuses "age"
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorStep, setSimulatorStep] = useState(0);
  
  // AI Copilot state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');

  // Voice/TTS states
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsStatus, setTtsStatus] = useState('');

  // References for dragging
  const canvasRef = useRef(null);

  const handleMouseDown = (e, node) => {
    if (e.target.closest('.field-row') || e.target.closest('.no-drag-area')) {
      // Don't drag node if selecting variable inside it
      return;
    }
    setDraggingNode(node.id);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setSelectedNodeId(node.id);
    // Focus first field of that node if present, else null
    if (node.fields.length > 0) {
      setSelectedFieldId(node.fields[0].id);
    } else {
      setSelectedFieldId(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!draggingNode || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left - dragOffset.x;
    const y = e.clientY - canvasRect.top - dragOffset.y;

    setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: Math.max(10, x), y: Math.max(10, y) } : n));
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  useEffect(() => {
    if (draggingNode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingNode, dragOffset]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];
  const selectedField = selectedNode ? selectedNode.fields.find(f => f.id === selectedFieldId) : null;

  const updateSelectedNode = (key, value) => {
    if (!selectedNode) return;
    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, [key]: value } : n));
  };

  const updateSelectedField = (key, value) => {
    if (!selectedNode || !selectedField) return;
    setNodes(prev => prev.map(n => {
      if (n.id === selectedNode.id) {
        return {
          ...n,
          fields: n.fields.map(f => f.id === selectedField.id ? { ...f, [key]: value } : f)
        };
      }
      return n;
    }));
  };

  const addFieldToNode = (nodeId, type = 'text') => {
    const baseWidget = DEFAULT_WIDGETS.find(w => w.type === type) || DEFAULT_WIDGETS[0];
    const newFieldId = 'f-' + Date.now();
    const cleanVarName = `${baseWidget.type}_field_${Math.floor(Math.random() * 1000)}`;
    const newField = {
      id: newFieldId,
      variableName: cleanVarName,
      label: `New ${baseWidget.label} Question`,
      type: type,
      options: type === 'dropdown' || type === 'radio' || type === 'checkbox' ? ['Option 1', 'Option 2'] : []
    };

    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          fields: [...n.fields, newField]
        };
      }
      return n;
    }));
    setSelectedFieldId(newFieldId);
  };

  const deleteSelectedField = () => {
    if (!selectedNode || !selectedField) return;
    setNodes(prev => prev.map(n => {
      if (n.id === selectedNode.id) {
        const remaining = n.fields.filter(f => f.id !== selectedField.id);
        return { ...n, fields: remaining };
      }
      return n;
    }));
    setSelectedFieldId(null);
  };

  const createNewSectionNode = () => {
    const newId = 'node-' + Date.now();
    const newNode = {
      id: newId,
      title: 'New Section',
      description: 'Define logic parameters',
      x: 150,
      y: 200,
      fields: [
        { id: 'f-' + Date.now(), variableName: 'input_one', label: 'Primary question key?', type: 'text', options: [] }
      ],
      renderMode: 'list',
      platforms: ['web', 'mobile']
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newId);
    setSelectedFieldId(newNode.fields[0].id);
  };

  const deleteSelectedNode = () => {
    if (nodes.length <= 1) return; // Prevent deleting everything
    const remaining = nodes.filter(n => n.id !== selectedNodeId);
    setNodes(remaining);
    setSelectedNodeId(remaining[0].id);
    setSelectedFieldId(remaining[0].fields[0]?.id || null);
  };

  const playSpeechForSection = async () => {
    if (!selectedNode) return;
    setTtsPlaying(true);
    setTtsStatus('Preparing synthesized output text...');
    
    // Create text describing current form section contextually
    let script = `Survey Section titled: ${selectedNode.title}. Description: ${selectedNode.description}. `;
    selectedNode.fields.forEach((f, idx) => {
      script += `Question ${idx + 1}: ${f.label}. This is a ${f.type} input. `;
      if (f.options && f.options.length > 0) {
        script += `Options are: ${f.options.join(', ')}. `;
      }
    });

    try {
      setTtsStatus('Invoking Gemini Voice engine...');
      const payload = {
        contents: [{
          parts: [{ text: `Read this out beautifully as an elegant interactive screen-reader assistant. Welcome the surveyor and list each option cleanly: ${script}` }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Zephyr" } // Bright, energetic voice
            }
          }
        },
        model: "gemini-2.5-flash-preview-tts"
      };

      const apiKey = ""; // Canvas framework injects key at runtime when left empty
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      const part = result?.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (audioData && mimeType && mimeType.startsWith("audio/")) {
        setTtsStatus('Decoding PCM elements...');
        // Match sample rate from mimeType if provided, default to 24000
        let sampleRate = 24000;
        const rateMatch = mimeType.match(/rate=(\d+)/);
        if (rateMatch) {
          sampleRate = parseInt(rateMatch[1], 10);
        }

        // Parse PCM-16
        const pcmBuffer = base64ToArrayBuffer(audioData);
        const pcm16 = new Int16Array(pcmBuffer);
        const wavBlob = pcmToWav(pcm16, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);
        
        const audio = new Audio(audioUrl);
        setTtsStatus('Speaking interactive preview...');
        audio.play();
        audio.onended = () => {
          setTtsPlaying(false);
          setTtsStatus('');
        };
      } else {
        throw new Error('Unexpected model payload structure');
      }
    } catch (err) {
      console.error(err);
      setTtsStatus('TTS generation skipped. Simulating with browser audio fallback.');
      
      // Fallback to Native Speech Synthesis
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(script);
        utterance.rate = 0.95;
        utterance.onend = () => {
          setTtsPlaying(false);
          setTtsStatus('');
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setTtsPlaying(false);
        setTtsStatus('Browser lacks TTS support');
      }
    }
  };

  // WAV conversion helper
  const pcmToWav = (pcm16Data, sampleRate) => {
    const buffer = new ArrayBuffer(44 + pcm16Data.length * 2);
    const view = new DataView(buffer);
    
    const writeString = (v, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        v.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcm16Data.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // Raw PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, pcm16Data.length * 2, true);
    
    let index = 44;
    for (let i = 0; i < pcm16Data.length; i++) {
      view.setInt16(index, pcm16Data[i], true);
      index += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const handleAiSurveyBuild = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiFeedback('Grounded AI Agent formulating survey tree structural metadata...');

    try {
      const systemInstruction = `You are a world-class surveyor architect specializing in schema design.
      Produce ONLY structured JSON data aligning with the following format. Do not write markdown, code blocks, or text. Just pure valid JSON.
      JSON Schema format:
      [
        {
          "title": "Unique Section Title",
          "description": "Short summary",
          "x": 200,
          "y": 300,
          "renderMode": "list",
          "platforms": ["web", "mobile"],
          "fields": [
            {
              "variableName": "system_var_name",
              "label": "The user-facing question text?",
              "type": "text | number | dropdown | radio | checkbox",
              "options": ["Opt 1", "Opt 2"] 
            }
          ]
        }
      ]`;

      const userQuery = `Create a realistic survey schema flow containing nodes based on this request: "${aiPrompt}". 
      Make sure variables have professional database-friendly names. Provide realistic layout positions (separate x coordinate by roughly 300px per node, y around 200). Include branching where applicable by using a specific options list.`;

      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                description: { type: "STRING" },
                x: { type: "INTEGER" },
                y: { type: "INTEGER" },
                renderMode: { type: "STRING" },
                platforms: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                fields: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      variableName: { type: "STRING" },
                      label: { type: "STRING" },
                      type: { type: "STRING" },
                      options: {
                        type: "ARRAY",
                        items: { type: "STRING" }
                      }
                    },
                    required: ["variableName", "label", "type"]
                  }
                }
              },
              required: ["title", "description", "x", "y", "fields"]
            }
          }
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        const generatedNodes = JSON.parse(rawText);
        // Append IDs & Format coordinate offsets to prevent overlap with existing nodes
        const formattedNodes = generatedNodes.map((n, index) => ({
          ...n,
          id: `node-ai-${Date.now()}-${index}`,
          x: n.x || (300 + index * 350),
          y: n.y || (200 + index * 50),
          renderMode: n.renderMode || 'list',
          platforms: n.platforms || ['web', 'mobile'],
          fields: n.fields.map((f, fIndex) => ({
            ...f,
            id: `f-ai-${Date.now()}-${index}-${fIndex}`,
            options: f.options || []
          }))
        }));

        setNodes(prev => [...prev, ...formattedNodes]);
        setSelectedNodeId(formattedNodes[0].id);
        setSelectedFieldId(formattedNodes[0].fields[0]?.id || null);
        setAiFeedback('AI Survey Nodes generated and compiled into visual canvas successfully!');
        setAiPrompt('');
      } else {
        throw new Error('Could not compile AI feedback output');
      }
    } catch (err) {
      console.error(err);
      setAiFeedback('Synthesis failed. Falling back to simple default node injector.');
      // Inject standard template node as safe fallback
      const fallbackId = `node-fb-${Date.now()}`;
      const fallbackNode = {
        id: fallbackId,
        title: 'Satisfaction Score',
        description: 'AI Generated Quality Check',
        x: 450,
        y: 150,
        fields: [
          { id: `f-fb-${Date.now()}-1`, variableName: 'satisfaction_rating', label: 'Rate your overall design satisfaction?', type: 'radio', options: ['Highly Satisfied', 'Neutral', 'Unsatisfied'] }
        ],
        renderMode: 'list',
        platforms: ['web', 'mobile']
      };
      setNodes(prev => [...prev, fallbackNode]);
      setSelectedNodeId(fallbackId);
    }
    setAiLoading(false);
    setTimeout(() => setAiFeedback(''), 6000);
  };

  const renderSVGConnections = () => {
    const paths = [];
    nodes.forEach(sourceNode => {
      sourceNode.fields.forEach((field, fIdx) => {
        if (field.routingTarget) {
          const targetNode = nodes.find(n => n.id === field.routingTarget);
          if (targetNode) {
            // Rough estimation of port coordinates based on node elements layout
            const nodeWidth = 280;
            const headerHeight = 52;
            const fieldHeight = 36;
            
            const startX = sourceNode.x + nodeWidth;
            const startY = sourceNode.y + headerHeight + (fIdx * fieldHeight) + (fieldHeight / 2);
            
            const endX = targetNode.x;
            const endY = targetNode.y + 24; // Connect to destination header top-ish left

            const controlPointX1 = startX + 120;
            const controlPointY1 = startY;
            const controlPointX2 = endX - 120;
            const controlPointY2 = endY;

            paths.push({
              id: `${sourceNode.id}-${field.id}-${targetNode.id}`,
              d: `M ${startX} ${startY} C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, ${endX} ${endY}`,
              fieldLabel: field.variableName
            });
          }
        }
      });
    });

    return (
      <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#0f766e" />
          </marker>
        </defs>
        {paths.map(path => (
          <g key={path.id} className="opacity-80">
            <path
              d={path.d}
              fill="none"
              stroke="#0f766e"
              strokeWidth="2.5"
              markerEnd="url(#arrow)"
              strokeDasharray="4 2"
              className="animate-[dash_20s_linear_infinite]"
            />
            {/* Draw active variable label marker over logic curve */}
            <rect
              x={(nodes.find(n => n.fields.some(f => f.variableName === path.fieldLabel))?.x + 300 || 200)}
              y={(nodes.find(n => n.fields.some(f => f.variableName === path.fieldLabel))?.y + 100 || 200)}
              width="100"
              height="18"
              rx="4"
              fill="#0d9488"
              className="hidden"
            />
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans selection:bg-teal-700 selection:text-white">
      
      {/* GLOBAL HEADER BAR */}
      <header className="flex justify-between items-center px-6 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-600 text-slate-950 p-2 rounded-lg font-black tracking-wider text-xl">OP</div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-sm">Workspace:</span>
              <span className="font-semibold text-slate-200 text-sm">fmcg / osiog-sales</span>
            </div>
            <h1 className="text-lg font-bold text-teal-400 flex items-center gap-2">
              Opine Flow Designer 
              <span className="text-xs bg-teal-950 text-teal-300 px-2 py-0.5 rounded-full border border-teal-800">Hybrid Mode</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowSimulator(!showSimulator)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition ${
              showSimulator ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-teal-700 hover:bg-teal-600 text-white'
            }`}
          >
            <span>📱</span>
            <span>{showSimulator ? 'Close Simulator' : 'Preview Simulator'}</span>
          </button>
          
          <button 
            onClick={createNewSectionNode}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg transition text-slate-200"
          >
            <span>➕</span>
            <span>Add Section Node</span>
          </button>

          <button 
            onClick={() => {
              setNodes(INITIAL_NODES);
              setSelectedNodeId('node-1');
              setSelectedFieldId('f-2');
            }}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 p-2 rounded-lg transition"
            title="Reset Schema Layout"
          >
            🔄
          </button>
        </div>
      </header>

      {/* THREE PANELS LAYOUT CONTAINER */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* PANE 1: LEFT WIDGET & QUICK-ADD DRAWER */}
        <aside className="w-72 bg-slate-950 border-r border-slate-800 p-4 overflow-y-auto flex flex-col justify-between shrink-0">
          <div>
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">Basic Schema Widgets</h3>
              <p className="text-xs text-slate-500 mb-3">Click or append standard structural inputs directly to the selected active Node.</p>
              
              <div className="space-y-2">
                {DEFAULT_WIDGETS.map(widget => (
                  <button
                    key={widget.type}
                    onClick={() => addFieldToNode(selectedNodeId, widget.type)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-teal-700 rounded-lg text-left transition text-slate-300"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-teal-400 text-lg font-mono">{widget.icon}</span>
                      <div>
                        <span className="text-xs font-semibold block">{widget.label}</span>
                        <span className="text-[10px] text-slate-500 block leading-tight">{widget.desc}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-600 hover:text-teal-400">➕</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-850 pt-4 mt-4">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">Design Presets</h3>
              <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
                <button 
                  onClick={() => {
                    const id = 'node-ai-' + Date.now();
                    setNodes(prev => [...prev, {
                      id, title: 'Geospatial Capture', description: 'GPS audit triggers', x: 200, y: 100,
                      fields: [{ id: 'f-' + Date.now(), variableName: 'gps_coordinate', label: 'Record survey GPS location coordinates', type: 'gps', options: [] }],
                      renderMode: 'list', platforms: ['mobile']
                    }]);
                    setSelectedNodeId(id);
                  }}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded p-2 text-slate-400 hover:text-slate-200 transition"
                >
                  📍 Geolocation
                </button>
                <button 
                  onClick={() => {
                    const id = 'node-ai-' + Date.now();
                    setNodes(prev => [...prev, {
                      id, title: 'Consent Signoff', description: 'Legal validation signature', x: 250, y: 150,
                      fields: [{ id: 'f-' + Date.now(), variableName: 'user_signature', label: 'Draw your signature below', type: 'signature', options: [] }],
                      renderMode: 'single', platforms: ['web', 'mobile']
                    }]);
                    setSelectedNodeId(id);
                  }}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded p-2 text-slate-400 hover:text-slate-200 transition"
                >
                  ✍️ Signature Block
                </button>
              </div>
            </div>
          </div>

          {/* QUICK REFERENCE DOCUMENTATION */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg mt-4">
            <h4 className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
              <span>💡</span> Opine Visual Philosophy
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-1.5">
              Variables align cleanly inside logical Section containers. Dynamic skip routing is plotted by binding questions to subsequent sections via the inspector panel on the right.
            </p>
          </div>
        </aside>

        {/* PANE 2: THE INTERACTIVE CANVAS */}
        <main 
          ref={canvasRef}
          className="flex-1 bg-slate-900 relative overflow-auto select-none p-8"
          style={{
            backgroundImage: 'radial-gradient(#1e293b 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}
        >
          {/* AI COPILOT INPUT FIELD Overlay bottom left */}
          <div className="absolute bottom-4 left-4 z-20 max-w-lg w-full bg-slate-950/95 border border-slate-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
            <form onSubmit={handleAiSurveyBuild} className="flex gap-2">
              <input 
                type="text" 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="AI Copilot: e.g. 'Add a customer satisfaction flow with routing'"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                disabled={aiLoading}
              />
              <button 
                type="submit"
                className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition shrink-0"
                disabled={aiLoading}
              >
                {aiLoading ? 'Thinking...' : 'Generate'}
              </button>
            </form>
            {aiFeedback && (
              <div className="text-[11px] mt-2 text-teal-400 animate-pulse transition">
                🚀 {aiFeedback}
              </div>
            )}
          </div>

          {/* SVG FLOW LINES BEHIND NODES */}
          {renderSVGConnections()}

          {/* DYNAMIC NODES GRAPH */}
          {nodes.map(node => {
            const isNodeSelected = selectedNodeId === node.id;
            return (
              <div
                key={node.id}
                style={{ left: node.x, top: node.y }}
                onMouseDown={(e) => handleMouseDown(e, node)}
                className={`absolute w-72 bg-slate-950/90 rounded-xl shadow-xl border-2 transition-all duration-150 z-10 ${
                  isNodeSelected ? 'border-teal-500 shadow-teal-950/30' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* NODE HEADER */}
                <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-900 bg-slate-900/60 rounded-t-xl cursor-grab active:cursor-grabbing">
                  <div className="flex items-center space-x-2">
                    <span className="bg-teal-950 border border-teal-800 text-teal-300 font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">
                      Sec
                    </span>
                    <h4 className="text-sm font-bold text-slate-200 truncate max-w-[130px]">{node.title}</h4>
                  </div>
                  <div className="flex items-center space-x-1 no-drag-area">
                    <button 
                      onClick={() => addFieldToNode(node.id)}
                      className="bg-slate-850 hover:bg-slate-700 text-[10px] text-teal-400 px-1.5 py-0.5 rounded border border-slate-700 transition"
                      title="Quick Add Question Field"
                    >
                      ➕
                    </button>
                    {nodes.length > 1 && (
                      <button 
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          deleteSelectedNode();
                        }}
                        className="text-slate-600 hover:text-red-400 text-xs px-1"
                        title="Delete Form Section"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* FIELDS LISTING (Opine Data Schema Model) */}
                <div className="p-2 space-y-1">
                  {node.fields.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-600 italic">No variables defined yet</div>
                  ) : (
                    node.fields.map(field => {
                      const isFieldSelected = isNodeSelected && selectedFieldId === field.id;
                      const widgetIcon = DEFAULT_WIDGETS.find(w => w.type === field.type)?.icon || '❔';
                      return (
                        <div
                          key={field.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(node.id);
                            setSelectedFieldId(field.id);
                          }}
                          className={`field-row flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                            isFieldSelected 
                              ? 'bg-teal-950/70 border border-teal-800 text-teal-200' 
                              : 'bg-slate-900/50 hover:bg-slate-900 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate pr-2">
                            <span className="font-mono text-slate-500 font-bold">{widgetIcon}</span>
                            <div className="truncate">
                              <span className="font-mono text-[10px] text-teal-400 block font-semibold truncate">
                                {field.variableName}
                              </span>
                              <span className="text-[11px] text-slate-300 truncate block">
                                {field.label}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0">
                            {field.routingTarget && (
                              <span className="text-[10px] text-teal-500 bg-teal-950 px-1 rounded border border-teal-900" title={`Conditional Route to node: ${field.routingTarget}`}>
                                ➔
                              </span>
                            )}
                            <span className="text-slate-700">☰</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* NODE FOOTER */}
                <div className="px-3.5 py-2.5 bg-slate-950/50 border-t border-slate-900 rounded-b-xl flex items-center justify-between text-[11px] text-slate-500">
                  <span>{node.fields.length} Variable{node.fields.length === 1 ? '' : 's'}</span>
                  <div className="flex space-x-1.5 uppercase tracking-wider text-[9px]">
                    {node.platforms.map(p => (
                      <span key={p} className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </main>

        {/* PANE 3: THE ADAPTIVE INSPECTOR PANEL */}
        <aside className="w-80 bg-slate-950 border-l border-slate-800 p-4 overflow-y-auto shrink-0 flex flex-col justify-between">
          <div>
            
            {/* INSPECTOR CONTEXT HEADER */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                Active Inspector
              </h3>
              <span className="text-[11px] bg-teal-950 text-teal-400 font-mono px-2 py-0.5 rounded border border-teal-900">
                {selectedField ? 'Variable Focused' : 'Section Focused'}
              </span>
            </div>

            {/* DYNAMIC CASE A: FOCUS ON VARIABLE / QUESTION FIELD */}
            {selectedField ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Database Variable Key</label>
                  <input
                    type="text"
                    value={selectedField.variableName}
                    onChange={(e) => updateSelectedField('variableName', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">No spaces. Use underscores for analytical mapping tools.</span>
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Question/Label</label>
                  <textarea
                    rows={2}
                    value={selectedField.label}
                    onChange={(e) => updateSelectedField('label', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Input Widget Class</label>
                  <select
                    value={selectedField.type}
                    onChange={(e) => updateSelectedField('type', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    {DEFAULT_WIDGETS.map(w => (
                      <option key={w.type} value={w.type}>{w.label}</option>
                    ))}
                  </select>
                </div>

                {/* CONDITIONAL CHOICE OPTIONS MAPPING FOR SELECTION WIDGETS */}
                {(selectedField.type === 'dropdown' || selectedField.type === 'radio' || selectedField.type === 'checkbox') && (
                  <div className="border border-slate-900 bg-slate-900/40 p-2.5 rounded-lg space-y-2">
                    <label className="block text-[10px] uppercase font-bold text-teal-400">Response Choices Mapping</label>
                    <div className="space-y-1.5">
                      {selectedField.options?.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center space-x-1.5">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const copy = [...selectedField.options];
                              copy[oIdx] = e.target.value;
                              updateSelectedField('options', copy);
                            }}
                            className="flex-1 bg-slate-850 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              const copy = selectedField.options.filter((_, idx) => idx !== oIdx);
                              updateSelectedField('options', copy);
                            }}
                            className="text-[10px] text-red-500 hover:text-red-400 px-1"
                          >
                            ✖
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const copy = [...(selectedField.options || []), `Option ${selectedField.options.length + 1}`];
                        updateSelectedField('options', copy);
                      }}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 w-full py-1 rounded transition"
                    >
                      ➕ Add Option Value
                    </button>
                  </div>
                )}

                {/* SKIP LOGIC / ROUTING SELECT */}
                <div className="border border-teal-950 bg-teal-950/10 p-2.5 rounded-lg">
                  <label className="block text-[10px] uppercase font-bold text-teal-400 mb-1">
                    Conditional Jump Route (If answered)
                  </label>
                  <select
                    value={selectedField.routingTarget || ''}
                    onChange={(e) => updateSelectedField('routingTarget', e.target.value || null)}
                    className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- No Skip Logic (Linear Flow) --</option>
                    {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                      <option key={n.id} value={n.id}>Jump to Section: {n.title}</option>
                    ))}
                  </select>
                  <span className="text-[9px] text-slate-500 mt-1 block">Creates a logic routing branch line on the canvas.</span>
                </div>

                <div className="pt-3 border-t border-slate-900 flex justify-between items-center">
                  <button
                    onClick={deleteSelectedField}
                    className="text-xs text-red-400 hover:text-red-300 font-medium py-1 px-2.5 rounded bg-red-950/20 hover:bg-red-950/50 transition border border-red-900"
                  >
                    🗑️ Delete Variable
                  </button>
                  
                  <button
                    onClick={() => setSelectedFieldId(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Edit Section Settings ➔
                  </button>
                </div>
              </div>
            ) : (
              /* DYNAMIC CASE B: FOCUS ON SECTION STRUCTURAL NODE */
              selectedNode && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Section Title</label>
                    <input
                      type="text"
                      value={selectedNode.title}
                      onChange={(e) => updateSelectedNode('title', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Section Description</label>
                    <textarea
                      rows={2}
                      value={selectedNode.description}
                      onChange={(e) => updateSelectedNode('description', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Rendering Mode</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        onClick={() => updateSelectedNode('renderMode', 'list')}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition ${
                          selectedNode.renderMode === 'list'
                            ? 'bg-teal-900/50 border-teal-500 text-teal-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        ☰ List Mode
                      </button>
                      <button
                        onClick={() => updateSelectedNode('renderMode', 'single')}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition ${
                          selectedNode.renderMode === 'single'
                            ? 'bg-teal-900/50 border-teal-500 text-teal-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        📄 Single Field
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Target Platform Availability</label>
                    <div className="space-y-1.5 mt-1">
                      {['web', 'mobile', 'ussd'].map(platform => {
                        const hasPlatform = selectedNode.platforms.includes(platform);
                        return (
                          <label key={platform} className="flex items-center space-x-2.5 text-xs cursor-pointer text-slate-300">
                            <input
                              type="checkbox"
                              checked={hasPlatform}
                              onChange={() => {
                                const list = hasPlatform 
                                  ? selectedNode.platforms.filter(p => p !== platform) 
                                  : [...selectedNode.platforms, platform];
                                updateSelectedNode('platforms', list);
                              }}
                              className="accent-teal-500 rounded"
                            />
                            <span className="uppercase">{platform} platform channel</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-900">
                    <button
                      onClick={deleteSelectedNode}
                      disabled={nodes.length <= 1}
                      className="w-full text-center text-xs text-red-400 hover:text-red-300 font-medium py-1.5 px-3 rounded bg-red-950/20 hover:bg-red-950/50 transition border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🗑️ Remove Survey Section
                    </button>
                  </div>
                </div>
              )
            )}

          </div>

          {/* ACTIVE EXPORT DATA JSON REPRESENTATION */}
          <div className="border-t border-slate-800 pt-4 mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Interactive Diagnostics</span>
              <span className="text-[9px] text-teal-500">Form Active Status</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850 max-h-36 overflow-y-auto font-mono text-[9px] text-slate-400">
              <div className="text-[10px] text-teal-400 font-bold mb-1">Parsed JSON Schema Map</div>
              <pre>{JSON.stringify(nodes.map(n => ({ section: n.title, variables: n.fields.map(f => f.variableName) })), null, 2)}</pre>
            </div>
          </div>
        </aside>

      </div>

      {/* OVERLAY PANEL: SMARTPHONE PREVIEW AND LIVE FORM SIMULATOR */}
      {showSimulator && selectedNode && (
        <div className="absolute right-80 top-16 bottom-16 w-96 bg-slate-950 border-l border-slate-800 shadow-2xl z-30 flex flex-col justify-between overflow-hidden animate-[slideLeft_0.3s_ease-out]">
          
          {/* SIMULATOR HEADER */}
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex justify-between items-center shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-teal-400">📱</span>
              <div>
                <h3 className="text-sm font-bold text-slate-200">Interactive Simulator</h3>
                <p className="text-[10px] text-slate-500 leading-none">Renders: {selectedNode.title}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowSimulator(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              ✖
            </button>
          </div>

          {/* SIMULATOR VOICE CONTROLLER */}
          <div className="bg-teal-950/40 border-b border-teal-900/40 px-4 py-2 flex items-center justify-between text-xs text-teal-300">
            <div className="flex items-center space-x-2">
              <button 
                onClick={playSpeechForSection}
                className={`bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold px-2.5 py-1 rounded transition flex items-center gap-1 shrink-0 ${
                  ttsPlaying ? 'animate-pulse' : ''
                }`}
                disabled={ttsPlaying}
              >
                <span>🔊</span>
                <span>{ttsPlaying ? 'Playing Voice...' : 'Speak Screen'}</span>
              </button>
              {ttsPlaying && (
                <div className="flex space-x-1 items-center h-3">
                  <span className="w-1 h-2 bg-teal-400 animate-[bounce_0.6s_infinite_100ms]" />
                  <span className="w-1 h-3 bg-teal-300 animate-[bounce_0.6s_infinite_200ms]" />
                  <span className="w-1 h-1.5 bg-teal-400 animate-[bounce_0.6s_infinite_300ms]" />
                </div>
              )}
            </div>
            <span className="text-[9px] text-teal-400 truncate max-w-[150px]" title={ttsStatus}>
              {ttsStatus || 'Voice Synthesizer Ready'}
            </span>
          </div>

          {/* SIMULATOR CLIENT WORKSPACE */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-900">
            
            {/* PHONE INNER FRAME MOCK */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 min-h-full space-y-4">
              
              <div className="text-center pb-2 border-b border-slate-900">
                <h4 className="text-sm font-bold text-slate-200">{selectedNode.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{selectedNode.description}</p>
              </div>

              {/* DYNAMIC FORM RENDERING */}
              <div className="space-y-4">
                {selectedNode.fields.map((field, fIdx) => (
                  <div key={field.id} className="space-y-1.5 p-2 rounded bg-slate-900/40 border border-slate-900">
                    <label className="block text-xs font-semibold text-slate-300">
                      {fIdx + 1}. {field.label}
                      <span className="text-[10px] font-mono text-teal-500 ml-1.5 block">({field.variableName})</span>
                    </label>

                    {/* TEXT FIELD */}
                    {field.type === 'text' && (
                      <input 
                        type="text" 
                        placeholder="Type answer preview..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                      />
                    )}

                    {/* NUMBER FIELD */}
                    {field.type === 'number' && (
                      <input 
                        type="number" 
                        placeholder="Value field..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                      />
                    )}

                    {/* SELECT FIELD */}
                    {field.type === 'dropdown' && (
                      <select className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500">
                        <option value="">-- Choose Option --</option>
                        {field.options?.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    )}

                    {/* RADIO PREVIEW */}
                    {field.type === 'radio' && (
                      <div className="space-y-1 mt-1">
                        {field.options?.map((o, idx) => (
                          <label key={o} className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
                            <input type="radio" name={field.id} className="accent-teal-500" defaultChecked={idx === 0} />
                            <span>{o}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* CHECKBOX GROUP */}
                    {field.type === 'checkbox' && (
                      <div className="space-y-1 mt-1">
                        {field.options?.map(o => (
                          <label key={o} className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
                            <input type="checkbox" className="accent-teal-500" />
                            <span>{o}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* GPS CAPTURE */}
                    {field.type === 'gps' && (
                      <div className="bg-slate-950 border border-dashed border-slate-800 p-3 rounded text-center text-xs text-slate-400">
                        <span className="text-teal-400 block mb-1 font-bold">📡 Auto Location Active</span>
                        Lat: 5.6037° N, Long: 0.1870° W
                      </div>
                    )}

                    {/* SIGNATURE BLOCK */}
                    {field.type === 'signature' && (
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded text-center text-xs text-slate-600 italic h-20 flex items-center justify-center relative cursor-crosshair">
                        <span>Draw signature preview here</span>
                        <div className="absolute bottom-2 right-2 text-[9px] bg-slate-900 text-slate-400 px-1 py-0.5 rounded">Clear</div>
                      </div>
                    )}

                    {field.routingTarget && (
                      <div className="text-[10px] text-amber-400 bg-amber-950/20 px-2 py-1 rounded border border-amber-900 mt-2">
                        💡 Selection routes to: <strong>{nodes.find(n => n.id === field.routingTarget)?.title}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* SIMULATOR FOOTER PLATFORM ROUTER */}
          <div className="bg-slate-900 border-t border-slate-800 p-4 shrink-0 flex items-center justify-between text-xs text-slate-400">
            <span>Platform Emulation:</span>
            <div className="flex space-x-1.5">
              <button className="bg-teal-700 text-white font-bold px-2.5 py-0.5 rounded text-[10px] uppercase">Mobile</button>
              <button className="bg-slate-800 hover:bg-slate-700 px-2.5 py-0.5 rounded text-[10px] uppercase text-slate-300">Web</button>
              <button className="bg-slate-800 hover:bg-slate-700 px-2.5 py-0.5 rounded text-[10px] uppercase text-slate-300">USSD</button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}