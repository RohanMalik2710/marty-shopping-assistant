import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import cv2
from pyzbar.pyzbar import decode
import threading
import requests
import time

app = Flask(__name__, static_folder='../app/frontend/build')
CORS(app)

# Sample in-memory product database with hardcoded barcode IDs
products = [
    {
        "id": 1,
        "barcode": "6430757015189",
        "name": "Organic Apples",
        "description": "Fresh organic apples, 1kg",
        "category": "Fruits",
        "price": 4.99,
        "image": "/product_images/7.jpeg",
        "ecoFriendly": True
    },
    {
        "id": 2,
        "barcode": "8293407795187",
        "name": "Whole Grain Bread",
        "description": "Artisanal whole grain bread, 500g",
        "category": "Bakery",
        "price": 3.49,
        "image": "/product_images/8.jpeg",
        "ecoFriendly": True
    },
    {
        "id": 3,
        "barcode": "3327150290103",
        "name": "Plastic Water Bottle",
        "description": "Single-use plastic water bottle, 1L",
        "category": "Beverages",
        "price": 1.99,
        "image": "/product_images/9.jpeg",
        "ecoFriendly": False
    },
    {
        "id": 4,
        "barcode": "8649531808727",
        "name": "Organic Pasta",
        "description": "Whole wheat organic pasta, 500g",
        "category": "Pantry",
        "price": 2.99,
        "image": "/product_images/10.jpeg",
        "ecoFriendly": True
    },
    {
        "id": 5,
        "barcode": "9055483412902",
        "name": "Canned Soda",
        "description": "Carbonated soft drink, 330ml",
        "category": "Beverages",
        "price": 1.49,
        "image": "/product_images/11.jpeg",
        "ecoFriendly": False
    }
]

# In-memory cart
cart = {}

# Track last added barcode and timestamp
last_barcode_time = {}
last_add_time = 0

# Helper function to find product by barcode
def find_product_by_barcode(barcode):
    return next((product for product in products if product["barcode"] == barcode), None)

# Camera scan function for real-time scanning with rate limiting and debounce
def scan_barcodes():
    global cart, last_add_time, last_barcode_time
    cap = None
    try:
        # Try different camera indices for USB 2.0 camera
        for index in range(3):  # Test indices 0, 1, 2
            cap = cv2.VideoCapture(index)
            if cap.isOpened():
                print(f"USB camera found at index {index}")
                break
            cap.release()
        else:
            raise Exception("No USB camera found. Check connection and drivers.")

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)  # Set resolution for USB 2.0
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 15)  # Conservative frame rate

        print("Scanning barcodes continuously. Press 'q' to stop...")
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Could not read frame from USB camera.")
                break

            current_time = time.time()
            decoded_objects = decode(frame)
            for obj in decoded_objects:
                barcode_data = obj.data.decode('utf-8')
                print(f"Detected barcode: {barcode_data}")

                # Rate limiting: Allow addition only once per second
                if current_time - last_add_time < 1:
                    continue

                # Debounce logic: Check if the same barcode was detected recently
                if barcode_data in last_barcode_time:
                    time_diff = current_time - last_barcode_time[barcode_data]
                    if time_diff < 2:  # If less than 2 seconds, assume it didn't leave the camera
                        continue

                url = f"http://localhost:5000/product/{barcode_data}"
                try:
                    response = requests.get(url, timeout=5)
                    if response.status_code == 200:
                        product = response.json()
                        if barcode_data not in cart:
                            cart[barcode_data] = {"product": product, "quantity": 1}
                        else:
                            cart[barcode_data]["quantity"] += 1
                        last_add_time = current_time  # Update last addition time
                        last_barcode_time[barcode_data] = current_time  # Update last detection time
                        print(f"Added item with barcode {barcode_data} to cart. Cart: {cart}")
                    else:
                        print(f"Error: Product not found for barcode {barcode_data}")
                except requests.RequestException as e:
                    print(f"Network error: Failed to fetch product - {str(e)}")

                pts = obj.polygon
                if len(pts) > 4:
                    pts = pts[:4]
                cv2.polylines(frame, [pts], True, (0, 255, 0), 3)

            cv2.imshow('Barcode Scanner', frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    except cv2.error as e:
        print(f"Camera error: {str(e)}")
    except Exception as e:
        print(f"General error: {str(e)}")
    finally:
        if cap is not None:
            cap.release()
        cv2.destroyAllWindows()
        print("Scanning stopped. Final cart contents:", cart)

# Route to fetch product by barcode
@app.route('/product/<barcode>', methods=['GET'])
def get_product(barcode):
    product = find_product_by_barcode(barcode)
    if product:
        return jsonify(product), 200
    else:
        return jsonify({"error": "Product not found"}), 404

# Route to fetch recommendations based on product barcode and budget
@app.route('/recommendations/<barcode>', methods=['GET'])
def get_recommendations(barcode):
    product = find_product_by_barcode(barcode)
    if not product:
        return jsonify([]), 200

    remaining_budget = float(request.args.get('budget', float('inf')))

    complementary_categories = {
        "Fruits": ["Beverages", "Bakery"],
        "Bakery": ["Beverages", "Pantry"],
        "Beverages": ["Fruits", "Pantry"],
        "Pantry": ["Bakery", "Beverages"]
    }

    recommendations = [
        p for p in products
        if p["id"] != product["id"] and
        (p["category"] == product["category"] or p["category"] in complementary_categories.get(product["category"], [])) and
        p["price"] <= remaining_budget
    ]

    recommendations.sort(key=lambda x: (-x["ecoFriendly"], x["price"]))
    recommendations = recommendations[:4]

    return jsonify(recommendations), 200

# Route to trigger barcode scanning
@app.route('/scan', methods=['POST'])
def trigger_scan():
    global scan_thread
    scan_thread = threading.Thread(target=scan_barcodes)
    scan_thread.start()
    return jsonify({"message": "Barcode scanning started in a new thread", "status": "success"}), 200

# Route to stop barcode scanning
@app.route('/stop', methods=['POST'])
def stop_scan():
    global scan_thread
    if 'scan_thread' in globals() and scan_thread.is_alive():
        cv2.destroyAllWindows()  # This will stop the while loop in scan_barcodes
        scan_thread.join()
        return jsonify({"message": "Barcode scanning stopped", "status": "success"}), 200
    return jsonify({"message": "No active scan to stop", "status": "info"}), 200

# Route to get cart contents
@app.route('/cart', methods=['GET'])
def get_cart():
    return jsonify(cart), 200

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))