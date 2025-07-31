# agent-python-backend/create_dummy_data.py

import pandas as pd
import numpy as np
import os

output_dir = '../agent-frontend/public/data'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# --- Function to create the new, in-depth retail sales data ---
def create_retail_sales_data():
    num_transactions = 2000
    start_date = '2024-01-01'

    products = {
        'SKU-101': {'ProductName': 'Pro Carbon Stick', 'Category': 'Sticks', 'Cost': 150.0},
        'SKU-102': {'ProductName': 'Elite Performance Stick', 'Category': 'Sticks', 'Cost': 220.0},
        'SKU-201': {'ProductName': 'Vapor Flex Skates', 'Category': 'Skates', 'Cost': 300.0},
        'SKU-202': {'ProductName': 'Supreme Power Skates', 'Category': 'Skates', 'Cost': 450.0},
        'SKU-301': {'ProductName': 'AeroLite Helmet', 'Category': 'Helmets', 'Cost': 80.0},
        'SKU-302': {'ProductName': 'Guardian Pro Helmet', 'Category': 'Helmets', 'Cost': 120.0},
        'SKU-401': {'ProductName': 'Stealth Pro Gloves', 'Category': 'Gloves', 'Cost': 90.0},
    }

    skus = list(products.keys())
    transaction_skus = np.random.choice(skus, num_transactions)

    data = {
        'Date': pd.to_datetime(start_date) + pd.to_timedelta(np.random.randint(0, 365, num_transactions), unit='d'),
        'SKU': transaction_skus,
        'Category': [products[sku]['Category'] for sku in transaction_skus],
        'ProductName': [products[sku]['ProductName'] for sku in transaction_skus],
        'Cost': [products[sku]['Cost'] for sku in transaction_skus],
        'Promotion': np.random.choice(['None', '10% Off', 'Holiday Sale'], num_transactions, p=[0.7, 0.2, 0.1]),
        'Weather': np.random.choice(['Sunny', 'Cloudy', 'Rain', 'Snow'], num_transactions),
    }

    df = pd.DataFrame(data)

    # Calculate Sales and Profit
    df['Sales'] = df['Cost'] * np.random.uniform(1.5, 2.5, num_transactions)
    df['Sales'] = np.where(df['Promotion'] == '10% Off', df['Sales'] * 0.9, df['Sales'])
    df['Sales'] = np.where(df['Promotion'] == 'Holiday Sale', df['Sales'] * 0.85, df['Sales'])
    df['Sales'] = df['Sales'].round(2)
    df['Profit'] = (df['Sales'] - df['Cost']).round(2)

    # Add a Holiday flag
    holidays = [pd.Timestamp('2024-12-25'), pd.Timestamp('2024-07-04'), pd.Timestamp('2024-05-27')]
    df['Holiday'] = df['Date'].isin(holidays).astype(int)

    df.sort_values(by='Date').to_csv(os.path.join(output_dir, 'retail_sales.csv'), index=False)
    print("Successfully created enhanced retail_sales.csv")

# --- Create all other datasets (code from previous versions) ---
def create_other_datasets():
    # (This part is omitted for brevity, but you should keep your existing functions for the other 6 datasets)
    # For example:
    churn_data = {'CustomerID': range(1, 101), 'TenureMonths': np.random.randint(1, 72, 100), 'MonthlyCharge': np.random.uniform(20, 120, 100).round(2), 'FeaturesUsed': np.random.randint(1, 8, 100), 'SupportTickets': np.random.randint(0, 10, 100), 'Churn': np.random.choice([0, 1], 100, p=[0.7, 0.3])}
    pd.DataFrame(churn_data).to_csv(os.path.join(output_dir, 'customer_churn.csv'), index=False)
    # ... and so on for all other 6 files
    print("Successfully created other 6 dummy data files.")

# --- Run the functions ---
create_retail_sales_data()
# create_other_datasets() # You can uncomment this if you need to regenerate all files

print("\nData creation script finished.")