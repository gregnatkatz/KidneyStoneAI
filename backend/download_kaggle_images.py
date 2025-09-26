#!/usr/bin/env python3
"""
Download Kaggle CT kidney dataset and extract sample images
"""
import kagglehub
import os
import shutil
from pathlib import Path

def download_and_extract_images():
    print("Downloading Kaggle CT kidney dataset...")
    
    dataset_path = kagglehub.dataset_download('nazmul0087/ct-kidney-dataset-normal-cyst-tumor-and-stone')
    print(f"Dataset downloaded to: {dataset_path}")
    
    print("Dataset contents:")
    for item in os.listdir(dataset_path):
        print(f"  {item}")
    
    main_folder = os.path.join(dataset_path, "CT-KIDNEY-DATASET-Normal-Cyst-Tumor-Stone", "CT-KIDNEY-DATASET-Normal-Cyst-Tumor-Stone")
    
    if not os.path.exists(main_folder):
        print(f"Could not find main dataset folder at: {main_folder}")
        return
    
    print(f"Main dataset folder: {main_folder}")
    print("Categories found:")
    for item in os.listdir(main_folder):
        item_path = os.path.join(main_folder, item)
        if os.path.isdir(item_path):
            count = len([f for f in os.listdir(item_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
            print(f"  {item}: {count} images")
    
    target_base = "/home/ubuntu/KidneyStoneAI/backend/public/medical-images/kaggle"
    categories = ['Normal', 'Stone', 'Cyst', 'Tumor']
    
    for category in categories:
        source_dir = os.path.join(main_folder, category)
        target_dir = os.path.join(target_base, category)
        
        if os.path.exists(source_dir):
            os.makedirs(target_dir, exist_ok=True)
            
            images = [f for f in os.listdir(source_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))][:2]
            
            for i, image in enumerate(images, 1):
                source_path = os.path.join(source_dir, image)
                target_name = f"{category}-{i}.jpg"
                target_path = os.path.join(target_dir, target_name)
                
                print(f"Copying {source_path} -> {target_path}")
                shutil.copy2(source_path, target_path)
                
                size = os.path.getsize(target_path)
                print(f"  File size: {size} bytes")
        else:
            print(f"Warning: {category} directory not found in {main_folder}")

if __name__ == "__main__":
    download_and_extract_images()
