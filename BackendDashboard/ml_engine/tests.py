import requests
import pandas as pd

with open('SuperMarket Analysis.csv', 'rb') as f:

    files = {'file': f}
    response = requests.post('https://shopmetrics-ai-1.onrender.com/analyze', files=files)

print('Status:', response.status_code)
if response.status_code == 200:
    data = response.json()
    print('Categorias:')
    print(data.get('categories', []))
    if data.get('categories'):
        print('\nPrimeras categorias:')
        for cat in data['categories'][:5]:
            print(cat)
else:
    print('Error:', response.text)
