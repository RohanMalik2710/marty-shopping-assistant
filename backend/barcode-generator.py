import barcode
from barcode.writer import ImageWriter
import random
import os

# Ensure output directory exists
output_dir = "barcodes"
os.makedirs(output_dir, exist_ok=True)

# Generate 5 random EAN-13 barcodes
for i in range(6):
    # Generate a random 12-digit number (EAN-13 requires 12 digits + checksum)
    random_code = ''.join([str(random.randint(0, 9)) for _ in range(12)])
    ean = barcode.get_barcode_class('ean13')
    barcode_instance = ean(random_code, writer=ImageWriter())
    filename = os.path.join(output_dir, f"barcode_{i+1}.png")
    barcode_instance.save(filename)
    print(f"Generated barcode: {random_code}, saved as {filename}")