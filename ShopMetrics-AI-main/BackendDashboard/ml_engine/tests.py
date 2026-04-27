import requests
import pandas as pd

with open('supermarket.csv', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://localhost:5050/analyze', files=files)

print('Status:', response.status_code)
if response.status_code == 200:
    data = response.json()
    print('Categories:')
    print(data.get('categories', []))
    if data.get('categories'):
        print('\nFirst few categories:')
        for cat in data['categories'][:5]:
            print(cat)
else:
    print('Error:', response.text)
