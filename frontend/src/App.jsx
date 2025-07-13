import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Search, Leaf, AlertCircle, Check, Plus, Minus, Trash2, Camera, CameraOff, Loader } from 'lucide-react';

const App = () => {
  const [budget, setBudget] = useState('');
  const [budgetSet, setBudgetSet] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraSupported, setCameraSupported] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5000';

  const quickAddProducts = [
    {
      id: '123456789',
      barcode: '6430757015189',
      name: 'Organic Bananas',
      price: 2.98,
      category: 'Produce',
      image: '/product_images/1.jpeg',
      ecoFriendly: true,
      description: 'Fresh organic bananas, perfect for smoothies and snacks'
    },
    {
      id: '987654321',
      barcode: '8293407795187',
      name: 'Whole Wheat Bread',
      price: 3.49,
      category: 'Bakery',
      image: '/product_images/2.jpeg',
      ecoFriendly: false,
      description: 'Freshly baked whole wheat bread'
    },
    {
      id: '555666777',
      barcode: '8649531808727',
      name: 'Eco-Friendly Detergent',
      price: 8.99,
      category: 'Household',
      image: '/product_images/3.jpeg',
      ecoFriendly: true,
      description: 'Plant-based laundry detergent, gentle on environment'
    },
    {
      id: '111222333',
      barcode: '9055483412902',
      name: 'Greek Yogurt',
      price: 4.29,
      category: 'Dairy',
      image: '/product_images/4.jpeg',
      ecoFriendly: false,
      description: 'Creamy Greek yogurt, high in protein'
    },
    {
      id: '444555666',
      barcode: '6430757015189',
      name: 'Reusable Water Bottle',
      price: 12.99,
      category: 'Home',
      image: '/product_images/5.jpeg',
      ecoFriendly: true,
      description: 'Stainless steel water bottle, BPA-free'
    },
    {
      id: '777888999',
      barcode: '3327150290103',
      name: 'Granola Bars',
      price: 5.99,
      category: 'Snacks',
      image: '/product_images/6.jpeg',
      ecoFriendly: false,
      description: 'Nutritious granola bars, perfect for on-the-go'
    }
  ];

  useEffect(() => {
    setCameraSupported(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const checkRef = () => console.log('videoRef is set:', videoRef.current ? 'yes' : 'no');
    checkRef();

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@ericblade/quagga2@1.7.0/dist/quagga.min.js';
    script.onload = () => console.log('Quagga2 library loaded');
    document.head.appendChild(script);

    return () => document.head.contains(script) && document.head.removeChild(script);
  }, []);

  useEffect(() => {
    if (isScanning && videoRef.current && window.Quagga) {
      startCamera().then(() => startBarcodeScanning()).catch(err => {
        setError('Failed to start camera or scanning: ' + err.message);
        console.error('Camera/Scanning error:', err);
      });
    } else if (!isScanning && window.Quagga) {
      stopCamera();
    }
  }, [isScanning]);

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const budgetProgress = budgetSet ? Math.min((totalAmount / parseFloat(budget)) * 100, 100) : 0;
  const isOverBudget = budgetSet && totalAmount > parseFloat(budget);

  const fetchProduct = async (barcodeValue) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch(`${API_BASE_URL}/product/${barcodeValue}`);
      if (!response.ok) throw new Error(`Product not found (${response.status})`);
      const product = await response.json();
      setCurrentProduct(product);
      addToCart(product);
      // Fetch recommendations after product is fetched
      await fetchRecommendations(barcodeValue);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching product:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecommendations = async (barcodeValue) => {
    try {
      console.log(`Fetching recommendations for barcode: ${barcodeValue}`);
      const response = await fetch(`${API_BASE_URL}/recommendations/${barcodeValue}?budget=${budget || 'inf'}`);
      if (response.ok) {
        const recs = await response.json();
        console.log('Recommendations received:', recs);
        setRecommendations(recs);
      } else {
        console.log(`Recommendations API returned ${response.status}`);
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    }
  };

  const startCamera = async () => {
    try {
      if (!cameraSupported) throw new Error('Camera not supported');
      if (!videoRef.current) throw new Error('Video element not available');
      console.log('Starting camera with videoRef:', videoRef.current);

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      if (videoDevices.length === 0) throw new Error('No cameras found');

      let stream = null;
      for (const device of videoDevices) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: device.deviceId ? { exact: device.deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
          });
          break;
        } catch (err) {
          console.log(`Failed to access camera with deviceId ${device.deviceId}: ${err.message}`);
        }
      }
      if (!stream) throw new Error('No working cameras found');

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await new Promise(resolve => videoRef.current.onloadeddata = () => { console.log('Video loaded'); resolve(); });
      setError('');
    } catch (err) {
      throw err;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (window.Quagga) { Quagga.stop(); Quagga.offDetected(); }
    setIsScanning(false);
  };

  let lastAddTime = 0, isProcessing = false, lastProcessedBarcode = null;

  const startBarcodeScanning = () => {
    if (!window.Quagga) { console.log('Quagga2 not loaded, retrying...'); setTimeout(startBarcodeScanning, 1000); return; }
    Quagga.init({
      inputStream: { name: "Live", type: "LiveStream", target: videoRef.current, constraints: { width: 1280, height: 720, facingMode: "environment" } },
      decoder: { readers: ["ean_reader"] },
      locate: true
    }, err => err ? (console.log('Quagga init error:', err), setError('Failed to initialize scanner: ' + err.message)) : (console.log('Quagga started'), Quagga.start()));
    Quagga.onDetected(data => {
      const detectedBarcode = data.codeResult.code;
      const currentTime = Date.now();
      if (detectedBarcode && !isProcessing && (detectedBarcode !== lastProcessedBarcode || currentTime - lastAddTime >= 1000)) {
        isProcessing = true;
        lastProcessedBarcode = detectedBarcode;
        setBarcode(detectedBarcode);
        fetchProduct(detectedBarcode).then(() => lastAddTime = currentTime).catch(err => console.error('Fetch error:', err)).finally(() => isProcessing = false);
      }
    });
  };

  const handleBudgetSubmit = () => budget && parseFloat(budget) > 0 && setBudgetSet(true);
  const handleBarcodeSubmit = () => barcode.trim() && fetchProduct(barcode.trim());

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      return existing ? prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, change) => {
    setCart(prev => prev.map(item => item.id === id ? (item.quantity + change > 0 ? { ...item, quantity: item.quantity + change } : item) : item));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const handleQuickAdd = async (product) => {
    console.log('handleQuickAdd called with product:', product);
    setCurrentProduct(product);
    addToCart(product);
    try {
      console.log('Fetching recommendations for barcode:', product.barcode);
      await fetchRecommendations(product.barcode);
      console.log('Recommendations fetch completed');
    } catch (err) {
      console.error('Recommendations fetch error:', err);
    }
  };

  const resetBudget = () => {
    setBudget('');
    setBudgetSet(false);
    setCart([]);
    setCurrentProduct(null);
    setRecommendations([]);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-medium">Marty - Smart Shopping Assistant</h1>
            <div className="flex items-center space-x-4">
              <ShoppingCart className="h-6 w-6" />
              <span className="text-sm">Cart ({cart.length})</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {!budgetSet ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Set Your Budget</h2>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="Enter your budget"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBudgetSubmit())}
                  />
                  <button onClick={handleBudgetSubmit} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors">Set Budget</button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Budget: ${parseFloat(budget).toFixed(2)}</h2>
                  <button onClick={resetBudget} className="text-sm text-blue-600 hover:text-blue-800 underline">Reset Budget</button>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Spent: ${totalAmount.toFixed(2)}</span>
                    <span>Remaining: ${Math.max(0, parseFloat(budget) - totalAmount).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all duration-300 ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${budgetProgress}%` }}></div>
                  </div>
                </div>
                {isOverBudget && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Budget exceeded by ${(totalAmount - parseFloat(budget)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Quick Add Products</h2>
                <button onClick={() => setShowQuickAdd(!showQuickAdd)} className="text-blue-600 hover:text-blue-800 text-sm underline">
                  {showQuickAdd ? 'Hide' : 'Show'} Quick Add
                </button>
              </div>
              {showQuickAdd ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {quickAddProducts.map(product => (
                    <div key={product.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer" onClick={() => handleQuickAdd(product)}>
                      <img src={product.image} alt={product.name} className="w-full h-50 object-cover rounded-md mb-2" />
                      <div className="flex items-center gap-1 mb-1">
                        <h4 className="font-medium text-gray-800 text-sm truncate">{product.name}</h4>
                        {product.ecoFriendly && <Leaf className="h-3 w-3 text-green-600 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{product.category}</p>
                      <p className="text-lg font-bold text-blue-600">${product.price}</p>
                      <div className="mt-2">
                        <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(product); }} className="w-full bg-blue-600 text-white py-1 px-2 rounded text-xs hover:bg-blue-700 transition-colors">Quick Add</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Click "Show Quick Add" to see available products</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Scan Product</h2>
              {cameraSupported && (
                <div className="mb-4 flex gap-3">
                  <button onClick={() => setIsScanning(!isScanning)} className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${isScanning ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}`} disabled={!cameraSupported}>
                    {isScanning ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                    {isScanning ? 'Stop Camera' : 'Start Camera'}
                  </button>
                </div>
              )}
              <div className="mb-4 relative">
                <video id="video" ref={videoRef} className="w-full h-64 bg-black rounded-lg object-cover" autoPlay playsInline muted style={{ display: isScanning ? 'block' : 'none' }} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Enter barcode manually" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBarcodeSubmit())} />
                </div>
                <button onClick={handleBarcodeSubmit} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : 'Scan'}
                </button>
              </div>
              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}
            </div>

            {currentProduct && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Product Details</h2>
                <div className="flex flex-col md:flex-row gap-4">
                  <img src={currentProduct.image || 'https://via.placeholder.com/200x150/E5E5E5/999999?text=No+Image'} alt={currentProduct.name} className="w-full md:w-48 h-36 object-cover rounded-lg" onError={(e) => e.target.src = 'https://via.placeholder.com/200x150/E5E5E5/999999?text=No+Image'} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">{currentProduct.name}</h3>
                      {currentProduct.ecoFriendly && (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                          <Leaf className="h-3 w-3" />
                          Eco-Friendly
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{currentProduct.description}</p>
                    <p className="text-sm text-gray-500 mb-2">Category: {currentProduct.category}</p>
                    <p className="text-2xl font-bold text-blue-600 mb-4">${currentProduct.price}</p>
                    <button onClick={() => addToCart(currentProduct)} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Recommendations</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.slice(0, 4).map(product => (
                    <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-800">{product.name}</h4>
                        {product.ecoFriendly && <Leaf className="h-4 w-4 text-green-600" />}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-blue-600">${product.price}</span>
                        <button onClick={() => addToCart(product)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">Add</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className='flex gap-2'>
                <ShoppingCart className="mt-0.5 h-6 w-6" />
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Shopping Cart</h2>
              </div>
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Your cart is empty</p>
              ) : (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <img src={item.image || 'https://via.placeholder.com/48x48/E5E5E5/999999?text=No+Image'} alt={item.name} className="w-12 h-12 object-cover rounded" onError={(e) => e.target.src = 'https://via.placeholder.com/48x48/E5E5E5/999999?text=No+Image'} />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800 text-sm">{item.name}</h4>
                        <p className="text-gray-600 text-xs">${item.price} each</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 transition-colors flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                          <span className="text-sm font-medium">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 transition-colors flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                          <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 bg-red-100 rounded text-red-600 hover:bg-red-200 transition-colors flex items-center justify-center ml-2"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span className={isOverBudget ? 'text-red-600' : 'text-gray-800'}>${totalAmount.toFixed(2)}</span>
                    </div>
                    <button className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors mt-4">Proceed to Checkout</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2"><Leaf className="mt-0.5 h-5 w-5" />Eco-Friendly Impact</h3>
              <p className="text-sm text-green-700">{cart.filter(item => item.ecoFriendly).length} of {cart.length} items are eco-friendly</p>
              {cart.filter(item => item.ecoFriendly).length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600">Great choice for the environment!</span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className='flex gap-2'>
                <Check className="mt-1.5 h-4 w-4 text-blue-900" />
                <h3 className="font-semibold text-blue-800 mb-2">Server Status</h3>
              </div>
              <p className="text-sm text-blue-700">Working</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;